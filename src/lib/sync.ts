import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUNNY_STATUS, deleteBunnyVideo, getBunnyVideo, reencodeBunnyVideo, statusFromBunny } from "@/lib/bunny";

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
      encoded_at: new Date().toISOString(),
    });
  }

  // Ne jamais faire revenir une vidéo retirée ou masquée par la modération.
  await supabaseAdmin()
    .from("tub_videos").update(patch)
    .eq("id", video.id).in("status", ["uploading", "processing"]);

  return { status, progress: b.encodeProgress ?? 0 };
}

// Vidéo déjà publiée: le webhook « terminé » complète durée et miniature.
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
        encoded_at: new Date().toISOString(),
      })
      .eq("id", video.id).eq("status", "ready");
  }
  return { status: "ready", progress: b.encodeProgress ?? 100 };
}

// RÉPARATION — vidéos publiées avant le 08/10 alors que Bunny ne les avait
// qu'en JIT (aucun fichier). Terminée chez Bunny: on note l'encodage.
// Restée en JIT: on relance un encodage complet et on la retire du fil le
// temps qu'il se fasse; le cron la republie dès qu'elle est prête.
export async function repairVideo(video: { id: string; bunny_id: string }) {
  const b = await getBunnyVideo(video.bunny_id);
  const db = supabaseAdmin();
  if (b.status === BUNNY_STATUS.FINISHED) {
    await db.from("tub_videos").update({
      encoded_at: new Date().toISOString(),
      duration_s: b.length || null,
      width: b.width || null,
      height: b.height || null,
      thumbnail_file: b.thumbnailFileName || null,
    }).eq("id", video.id).eq("status", "ready");
    return "ok";
  }
  if (b.status === BUNNY_STATUS.ERROR || b.status === BUNNY_STATUS.UPLOAD_FAILED) {
    await db.from("tub_videos").update({ status: "failed" }).eq("id", video.id).eq("status", "ready");
    return "failed";
  }
  if (b.status === BUNNY_STATUS.JIT_SEGMENTING || b.status === BUNNY_STATUS.JIT_PLAYLISTS_CREATED) {
    await reencodeBunnyVideo(video.bunny_id);
  }
  await db.from("tub_videos").update({ status: "processing" }).eq("id", video.id).eq("status", "ready");
  return "reencoding";
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
