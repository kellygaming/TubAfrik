/* eslint-disable @next/next/no-img-element -- miniatures servies par le CDN Bunny */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase/admin";
import { removeVideo } from "@/lib/sync";
import { thumbnailUrl } from "@/lib/media";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Modération", robots: { index: false } };

const REASON_LABEL: Record<string, string> = {
  nudite: "Nudité", violence: "Violence", haine: "Haine", arnaque: "Arnaque",
  droits_auteur: "Droits d'auteur", spam: "Spam", autre: "Autre",
};

type ReportRow = {
  video_id: string;
  reason: string;
  created_at: string;
  video: { id: string; bunny_id: string; thumbnail_file: string | null; caption: string; status: string;
           author: { username: string } | null } | null;
};

// Chaque action revérifie l'administrateur: une action serveur est une
// route publique, la page qui l'affiche ne la protège pas.
async function requireAdmin() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) throw new Error("Interdit");
}

async function keepVideo(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const db = supabaseAdmin();
  await db.from("tub_reports").update({ status: "dismissed" }).eq("video_id", id).eq("status", "open");
  await db.from("tub_videos").update({ status: "ready" }).eq("id", id).eq("status", "review");
  revalidatePath("/admin");
}

async function deleteVideo(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const db = supabaseAdmin();
  const { data: video } = await db.from("tub_videos").select("id,bunny_id").eq("id", id).maybeSingle();
  if (video) await removeVideo(video);
  await db.from("tub_reports").update({ status: "resolved" }).eq("video_id", id).eq("status", "open");
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) notFound();

  const { data } = await supabaseAdmin()
    .from("tub_reports")
    .select("video_id,reason,created_at,video:tub_videos(id,bunny_id,thumbnail_file,caption,status,author:tub_profiles(username))")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(500);

  // Regroupe les signalements par vidéo, les plus signalées d'abord.
  const byVideo = new Map<string, { video: NonNullable<ReportRow["video"]>; reasons: Map<string, number>; last: string; total: number }>();
  for (const r of (data as unknown as ReportRow[] | null) ?? []) {
    if (!r.video) continue;
    const g = byVideo.get(r.video_id) ?? { video: r.video, reasons: new Map(), last: r.created_at, total: 0 };
    g.reasons.set(r.reason, (g.reasons.get(r.reason) ?? 0) + 1);
    g.total++;
    byVideo.set(r.video_id, g);
  }
  const groups = [...byVideo.values()].sort((a, b) => b.total - a.total);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Modération</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin/retraits" className="font-semibold">Retraits →</Link>
          <Link href="/" className="text-muted hover:text-text">← Fil</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {groups.length} vidéo{groups.length > 1 ? "s" : ""} signalée{groups.length > 1 ? "s" : ""}. Au-delà de 5 signalements,
        une vidéo est masquée automatiquement en attendant ta décision.
      </p>

      {groups.length === 0 ? (
        <p className="mt-16 text-center text-muted">Rien à traiter 🎉</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {groups.map(({ video, reasons, last, total }) => (
            <li key={video.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-3">
              <Link href={`/v/${video.id}`} target="_blank" className="shrink-0">
                <img src={thumbnailUrl(video.bunny_id, video.thumbnail_file)} alt=""
                  className="aspect-[9/16] w-20 rounded-xl bg-black object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">@{video.author?.username}</span>
                  {video.status === "review" && (
                    <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">masquée</span>
                  )}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{video.caption || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...reasons].map(([reason, n]) => (
                    <span key={reason} className="rounded-full bg-like/10 px-2 py-0.5 text-xs text-like">
                      {REASON_LABEL[reason] ?? reason} ×{n}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">{total} signalement{total > 1 ? "s" : ""} · dernier il y a {timeAgo(last)}</p>
                <div className="mt-3 flex gap-2">
                  <form action={keepVideo}>
                    <input type="hidden" name="id" value={video.id} />
                    <button className="rounded-full border border-line px-4 py-1.5 text-xs hover:bg-surface-2">Garder</button>
                  </form>
                  <form action={deleteVideo}>
                    <input type="hidden" name="id" value={video.id} />
                    <button className="rounded-full bg-like px-4 py-1.5 text-xs font-semibold">Supprimer</button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
