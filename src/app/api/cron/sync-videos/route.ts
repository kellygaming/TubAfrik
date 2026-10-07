import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncVideo } from "@/lib/sync";
import { confirmPayment } from "@/lib/payments";

// ═══════════════════════════════════════════════════════════════
// FILET DE SÉCURITÉ — chaque minute (vercel.json)
//
// Une vidéo ne doit jamais rester bloquée « en traitement » parce que
// son auteur a fermé la page et que le webhook Bunny s'est perdu.
// On relit chez Bunny l'état des vidéos en attente des dernières 24 h.
// Le 06/10, Bunny a mis 27 min à encoder un clip de 40 s: la page de
// publication avait abandonné au bout de 10 min, rien ne l'a publié.
// ═══════════════════════════════════════════════════════════════
const MAX_PER_RUN = 25;

export async function GET(request: NextRequest) {
  // Vercel envoie « Authorization: Bearer <CRON_SECRET> » à ses tâches planifiées.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Refusé." }, { status: 401 });
  }

  const db = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pending } = await db
    .from("tub_videos")
    .select("id,bunny_id,status")
    .in("status", ["uploading", "processing"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  const results = await Promise.allSettled((pending ?? []).map((v) => syncVideo(v)));
  const published = results.filter((r) => r.status === "fulfilled" && r.value.status === "ready").length;

  // Un envoi jamais terminé depuis plus de 24 h ne viendra plus: on le classe en échec.
  await db
    .from("tub_videos")
    .update({ status: "failed" })
    .in("status", ["uploading", "processing"])
    .lt("created_at", since);

  // Cadeaux: un Pulse Chariow perdu ne doit pas laisser un fan payé sans
  // son VIP ni un TubAfrikain sans son gain. On redemande à Chariow.
  const { data: payments } = await db
    .from("tub_payments")
    .select("id")
    .eq("status", "pending")
    .not("chariow_sale_id", "is", null)
    .gte("created_at", since)
    .lte("created_at", new Date(Date.now() - 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);
  const confirmed = await Promise.allSettled((payments ?? []).map((p) => confirmPayment(p.id)));
  const paid = confirmed.filter((r) => r.status === "fulfilled" && r.value === "paid").length;

  // Un paiement resté ouvert 24 h a été abandonné.
  await db.from("tub_payments").update({ status: "failed" }).eq("status", "pending").lt("created_at", since);

  return NextResponse.json({ checked: pending?.length ?? 0, published, payments: payments?.length ?? 0, paid });
}
