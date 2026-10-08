import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail, unsubscribeUrl } from "./mailer";
import { activityEmail, publishedEmail, welcomeEmail, type ActivityItem, type Mail } from "./templates";

// ═══════════════════════════════════════════════════════════════
// LE FACTEUR — passe toutes les 10 min (vercel.json)
//
// 1. Bienvenue: une fois par compte, juste après la création du profil.
// 2. Vidéo publiée: dès qu'elle passe « prête ».
// 3. Activité (cadeaux, abonnés, commentaires, réponses): un RÉSUMÉ, au
//    plus un toutes les 3 h par personne, seulement pour ce qu'elle n'a
//    pas déjà vu dans l'app (10 min de délai). Jamais de rafale.
//
// Chaque envoi est d'abord « réservé » en base (colonne datée posée si
// encore vide): deux passages simultanés n'envoient jamais deux fois.
// Un échec SMTP libère la réservation, le passage suivant réessaie.
// ═══════════════════════════════════════════════════════════════
const MAX_SENDS = 25; // par passage: reste sous les limites d'envoi Zoho
const DIGEST_EVERY_H = 3;
const SEEN_DELAY_MIN = 10;
const MAX_AGE_DAYS = 3;
const ITEMS_PER_DIGEST = 8;

type Profile = { id: string; username: string; display_name: string; email_opt_out: boolean; deleted_at: string | null };

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function emailOf(userId: string) {
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

export async function runEmailJobs() {
  if (!emailConfigured()) return { skipped: "SMTP non configuré" };
  const db = supabaseAdmin();
  const report = { welcome: 0, published: 0, digests: 0, errors: [] as string[] };
  let budget = MAX_SENDS;

  async function deliver(userId: string, mail: Mail) {
    const to = await emailOf(userId);
    if (!to) return false;
    await sendEmail({ to, userId, ...mail });
    budget--;
    return true;
  }

  // ── 1. Bienvenue ───────────────────────────────────────────────
  const { data: fresh } = await db.from("tub_profiles")
    .select("id,username,display_name,email_opt_out,deleted_at")
    .is("welcome_email_at", null).is("deleted_at", null)
    .order("created_at", { ascending: true }).limit(budget);
  for (const p of (fresh as Profile[] | null) ?? []) {
    if (budget <= 0) break;
    const { data: claimed } = await db.from("tub_profiles").update({ welcome_email_at: new Date().toISOString() })
      .eq("id", p.id).is("welcome_email_at", null).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      if (await deliver(p.id, welcomeEmail({ name: p.display_name, username: p.username, unsubscribe: unsubscribeUrl(p.id) }))) report.welcome++;
    } catch (e) {
      report.errors.push(`bienvenue ${p.username}: ${(e as Error).message}`);
      await db.from("tub_profiles").update({ welcome_email_at: null }).eq("id", p.id);
    }
  }

  // ── 2. Vidéo publiée ───────────────────────────────────────────
  if (budget > 0) {
    const { data: videos } = await db.from("tub_videos")
      .select("id,caption,author_id,author:tub_profiles!inner(id,username,display_name,email_opt_out,deleted_at)")
      .eq("status", "ready").is("published_email_at", null).gte("published_at", ago(2 * 86400_000))
      .limit(budget);
    for (const v of (videos as unknown as { id: string; caption: string | null; author_id: string; author: Profile }[] | null) ?? []) {
      if (budget <= 0) break;
      const { data: claimed } = await db.from("tub_videos").update({ published_email_at: new Date().toISOString() })
        .eq("id", v.id).is("published_email_at", null).select("id").maybeSingle();
      if (!claimed || v.author.email_opt_out || v.author.deleted_at) continue;
      try {
        const mail = publishedEmail({ name: v.author.display_name, username: v.author.username, videoId: v.id, caption: v.caption, unsubscribe: unsubscribeUrl(v.author_id) });
        if (await deliver(v.author_id, mail)) report.published++;
      } catch (e) {
        report.errors.push(`vidéo ${v.id}: ${(e as Error).message}`);
        await db.from("tub_videos").update({ published_email_at: null }).eq("id", v.id);
      }
    }
  }

  // ── 3. Résumé d'activité ───────────────────────────────────────
  // Déjà lu dans l'app, ou trop ancien: on ne l'enverra jamais.
  const now = new Date().toISOString();
  await db.from("tub_notifications").update({ emailed_at: now }).is("emailed_at", null).not("read_at", "is", null);
  await db.from("tub_notifications").update({ emailed_at: now }).is("emailed_at", null).lt("created_at", ago(MAX_AGE_DAYS * 86400_000));

  if (budget > 0) {
    const { data: pending } = await db.from("tub_notifications")
      .select("id,user_id,kind,body,amount_fcfa,video_id,created_at,actor:tub_profiles!tub_notifications_actor_id_fkey(display_name),gift:tub_gifts(name,emoji),user:tub_profiles!tub_notifications_user_id_fkey(id,username,display_name,email_opt_out,deleted_at,last_digest_at)")
      .is("emailed_at", null).is("read_at", null).lt("created_at", ago(SEEN_DELAY_MIN * 60_000))
      .order("created_at", { ascending: false }).limit(500);

    type Row = {
      id: number; user_id: string; kind: ActivityItem["kind"]; body: string | null; amount_fcfa: number | null; video_id: string | null;
      actor: { display_name: string } | null; gift: { name: string; emoji: string } | null;
      user: Profile & { last_digest_at: string | null };
    };
    const byUser = new Map<string, Row[]>();
    for (const r of (pending as unknown as Row[] | null) ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
    }

    const cutoff = ago(DIGEST_EVERY_H * 3600_000);
    for (const [userId, rows] of byUser) {
      if (budget <= 0) break;
      const u = rows[0].user;
      const ids = rows.map((r) => r.id);
      if (u.email_opt_out || u.deleted_at) {
        await db.from("tub_notifications").update({ emailed_at: now }).in("id", ids);
        continue;
      }
      if (u.last_digest_at && u.last_digest_at > cutoff) continue; // trop tôt, le prochain résumé les reprendra

      const { data: claimed } = await db.from("tub_profiles").update({ last_digest_at: new Date().toISOString() })
        .eq("id", userId).or(`last_digest_at.is.null,last_digest_at.lt.${cutoff}`).select("id").maybeSingle();
      if (!claimed) continue;

      // Les cadeaux d'abord: c'est ce qui fait ouvrir l'email.
      const sorted = [...rows].sort((a, b) => Number(b.kind === "gift") - Number(a.kind === "gift"));
      const items: ActivityItem[] = sorted.slice(0, ITEMS_PER_DIGEST).map((r) => ({
        kind: r.kind, actor: r.actor?.display_name ?? "Quelqu'un", body: r.body, amount: r.amount_fcfa,
        giftName: r.gift?.name ?? null, giftEmoji: r.gift?.emoji ?? null, videoId: r.video_id,
      }));
      try {
        const mail = activityEmail({ name: u.display_name, username: u.username, items, total: rows.length, unsubscribe: unsubscribeUrl(userId) });
        await deliver(userId, mail);
        await db.from("tub_notifications").update({ emailed_at: new Date().toISOString() }).in("id", ids);
        report.digests++;
      } catch (e) {
        report.errors.push(`résumé ${u.username}: ${(e as Error).message}`);
        await db.from("tub_profiles").update({ last_digest_at: u.last_digest_at }).eq("id", userId);
      }
    }
  }

  if (report.errors.length) console.error("[EMAIL]", report.errors.join(" | "));
  return report;
}
