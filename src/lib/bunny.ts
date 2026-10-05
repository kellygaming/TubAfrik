import "server-only";
import { createHash } from "node:crypto";

// ═══════════════════════════════════════════════════════════════
// BUNNY STREAM — stockage, encodage et diffusion des vidéos
//
// Le fichier ne transite jamais par nos serveurs: le navigateur
// l'envoie directement chez Bunny (TUS, reprise après coupure réseau),
// avec une signature que nous calculons ici sans révéler la clé.
// ═══════════════════════════════════════════════════════════════
const API = "https://video.bunnycdn.com";
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;
const API_KEY = process.env.BUNNY_STREAM_API_KEY!;

export const TUS_ENDPOINT = `${API}/tusupload`;

// Codes renvoyés par Bunny pour une vidéo.
export const BUNNY_STATUS = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  UPLOAD_FAILED: 6,
  JIT_SEGMENTING: 7,
  JIT_PLAYLISTS_CREATED: 8,
} as const;

export type BunnyVideo = {
  guid: string;
  status: number;
  length: number;
  width: number;
  height: number;
  thumbnailFileName: string | null;
  encodeProgress: number;
  availableResolutions: string | null;
};

async function bunny(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/library/${LIBRARY_ID}${path}`, {
    ...init,
    headers: { AccessKey: API_KEY, accept: "application/json", "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bunny ${init?.method ?? "GET"} ${path}: ${res.status}`);
  return res;
}

export async function createBunnyVideo(title: string): Promise<string> {
  const res = await bunny("/videos", { method: "POST", body: JSON.stringify({ title }) });
  const data = (await res.json()) as { guid: string };
  return data.guid;
}

export async function getBunnyVideo(guid: string): Promise<BunnyVideo> {
  const res = await bunny(`/videos/${encodeURIComponent(guid)}`);
  return (await res.json()) as BunnyVideo;
}

export async function deleteBunnyVideo(guid: string) {
  await bunny(`/videos/${encodeURIComponent(guid)}`, { method: "DELETE" });
}

// Autorisation d'envoi valable `ttlSeconds`: SHA256(library + clé + expiration + vidéo).
export function tusCredentials(guid: string, ttlSeconds = 6 * 3600) {
  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHash("sha256").update(`${LIBRARY_ID}${API_KEY}${expire}${guid}`).digest("hex");
  return { endpoint: TUS_ENDPOINT, libraryId: LIBRARY_ID, videoId: guid, expire, signature };
}

// Traduit l'état Bunny en état TubAfrik. `null` = rien de nouveau.
export function statusFromBunny(v: BunnyVideo): "processing" | "ready" | "failed" | null {
  if (v.status === BUNNY_STATUS.FINISHED) return "ready";
  if (v.status === BUNNY_STATUS.ERROR || v.status === BUNNY_STATUS.UPLOAD_FAILED) return "failed";
  if (v.status === BUNNY_STATUS.CREATED) return null;
  return "processing";
}
