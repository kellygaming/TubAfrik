import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase/admin";
import { removeVideo } from "@/lib/sync";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Suppressions de compte", robots: { index: false } };

type Req = { user_id: string; reason: string | null; requested_at: string; processed_at: string | null; profile: { username: string; display_name: string } | null };

async function requireAdmin() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) throw new Error("Interdit");
}

// ═══════════════════════════════════════════════════════════════
// TRAITER UNE DEMANDE DE SUPPRESSION
//
// Le compte de connexion est partagé avec Kelly Gaming: on n'y touche
// pas. On efface les contenus et l'identité TubAfrik, et on garde les
// écritures comptables (cadeaux, gains des créateurs, retraits) reliées
// à un profil anonyme « Compte supprimé ».
// ═══════════════════════════════════════════════════════════════
async function anonymize(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const db = supabaseAdmin();

  // 1. Les fichiers vidéo chez Bunny (removeVideo marque aussi la ligne « removed »).
  const { data: videos } = await db.from("tub_videos").select("id,bunny_id").eq("author_id", id).neq("status", "removed");
  for (const v of videos ?? []) await removeVideo(v);

  // 2. Les contenus et les liens sociaux.
  const now = new Date().toISOString();
  await Promise.all([
    db.from("tub_comments").delete().eq("author_id", id),
    db.from("tub_likes").delete().eq("user_id", id),
    db.from("tub_follows").delete().or(`follower_id.eq.${id},followee_id.eq.${id}`),
    db.from("tub_sticker_saves").delete().eq("user_id", id),
    db.from("tub_stickers").update({ status: "removed" }).eq("creator_id", id),
    db.from("tub_notifications").delete().or(`user_id.eq.${id},actor_id.eq.${id}`),
    db.from("tub_live_messages").delete().eq("author_id", id),
    db.from("tub_lives").update({ status: "ended", ended_at: now, ended_reason: "compte_supprime" }).eq("creator_id", id).neq("status", "ended"),
    db.from("tub_live_channels").delete().eq("creator_id", id),
    db.from("tub_vip").delete().eq("fan_id", id),
    db.from("tub_private").delete().eq("user_id", id),
    db.from("tub_cauri_wallets").delete().eq("user_id", id),
  ]);

  // 3. L'identité.
  await db.from("tub_profiles").update({
    username: `supprime_${id.replace(/-/g, "").slice(0, 12)}`,
    display_name: "Compte supprimé",
    avatar_url: null,
    bio: null,
    main_game: null,
    main_category: null,
    interests: [],
    country: null,
    live_enabled: false,
    deleted_at: now,
  }).eq("id", id);
  await db.from("tub_account_deletions").update({ processed_at: now }).eq("user_id", id);
  revalidatePath("/admin/comptes");
}

export default async function AccountDeletions() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) notFound();
  const { data } = await supabaseAdmin().from("tub_account_deletions")
    .select("user_id,reason,requested_at,processed_at,profile:tub_profiles(username,display_name)")
    .order("requested_at", { ascending: false }).limit(100);
  const rows = (data as unknown as Req[] | null) ?? [];
  const todo = rows.filter((r) => !r.processed_at);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Suppressions de compte</h1>
        <Link href="/admin" className="text-sm text-muted hover:text-text">← Modération</Link>
      </div>
      <p className="mt-1 text-sm text-muted">À traiter sous 30 jours (règle Google Play). Pense à verser les gains disponibles d&apos;un créateur avant.</p>

      <h2 className="mt-8 font-semibold">À traiter ({todo.length})</h2>
      {todo.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune demande en attente.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {todo.map((r) => (
            <li key={r.user_id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">{r.profile?.display_name} <span className="font-normal text-muted">@{r.profile?.username}</span></p>
              <p className="text-xs text-muted">Demandé il y a {timeAgo(r.requested_at)}{r.reason ? ` · « ${r.reason} »` : ""}</p>
              <form action={anonymize} className="mt-3">
                <input type="hidden" name="id" value={r.user_id} />
                <button className="rounded-full bg-like px-4 py-2 text-sm font-semibold text-white">Supprimer définitivement</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-semibold">Traitées</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {rows.filter((r) => r.processed_at).map((r) => (
          <li key={r.user_id}>@{r.profile?.username} · traité il y a {timeAgo(r.processed_at!)}</li>
        ))}
      </ul>
    </main>
  );
}
