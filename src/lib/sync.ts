import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUNNY_STATUS, deleteBunnyVideo, getBunnyVideo, statusFromBunny } from "@/lib/bunny";

type VideoRef = { id: string; bunny_id: string; status?: string };

const FINAL = new Set(["failed", "review", "removed"]);

// Recopie l'état Bunny dans tub_videos. Partagé par le webhook, la tâche
// planifiée et la vérification que lance l'auteur depuis la page de publication.
export async function syncVideo(video: VideoRef) {
  if (video.status && FINAL.has(video.status)) return { status: video.status };
  if (video.status === "ready") return refreshMetadata(video);

  const b = await getBunnyVideo(video.bunny_id);
  const status = statusFromBunny(b);
  if (!status) return { status: video.status ?? "uploading", progress: 0 };

  const patch: Record<string, unknown> = { status };
  if (status === "ready") {
    Object.assign(patch, {
      duration_s: b.length || null,
      width: b.width || null,
      height: b.height || null,
      thumbnail_file: b.thumbnailFileName || null,
      published_at: new Date().toISOString(),
    });
  }

  // Ne jamais faire revenir une vidéo retirée ou masquée par la modération.
  await supabaseAdmin()
    .from("tub_videos").update(patch)
    .eq("id", video.id).in("status", ["uploading", "processing"]);

  return { status, progress: b.encodeProgress ?? 0 };
}

// Une vidéo publiée en JIT n'a pas encore sa durée ni sa miniature
// définitives: Bunny les donne à la fin de l'encodage complet, et le
// webhook « terminé » nous ramène ici pour les compléter.
async function refreshMetadata(video: VideoRef) {
  const b = await getBunnyVideo(video.bunny_id);
  if (b.status === BUNNY_STATUS.FINISHED) {
    await supabaseAdmin()
      .from("tub_videos")
      .update({
        duration_s: b.length || null,
        width: b.width || null,
        height: b.height || null,
        thumbnail_file: b.thumbnailFileName || null,
      })
      .eq("id", video.id).eq("status", "ready");
  }
  return { status: "ready", progress: b.encodeProgress ?? 100 };
}

export async function removeVideo(video: VideoRef) {
  await supabaseAdmin().from("tub_videos").update({ status: "removed" }).eq("id", video.id);
  try {
    await deleteBunnyVideo(video.bunny_id);
  } catch (e) {
    // La vidéo n'est déjà plus visible; un fichier orphelin chez Bunny
    // coûte quelques centimes, on le note sans bloquer l'utilisateur.
    console.error("[TUB] Suppression Bunny impossible:", (e as Error).message);
  }
}
