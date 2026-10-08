import "server-only";

// ═══════════════════════════════════════════════════════════════
// CLOUDFLARE STREAM LIVE — l'antenne des lives
//
// Une « entrée en direct » (live input) par créateur, créée une fois:
// sa clé RTMPS ne change pas, le créateur la colle une seule fois dans
// Prism Live Studio ou Streamlabs. Les spectateurs lisent le flux en HLS
// à l'adresse customer-<code>.cloudflarestream.com/<entrée>/manifest.
//
// Le jeton API ne sort jamais du serveur. La clé de diffusion non plus,
// sauf vers son propriétaire (route /api/live/[id]/cle).
// ═══════════════════════════════════════════════════════════════

const TIMEOUT = 12_000;

function config() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_TOKEN;
  if (!account || !token) throw new Error("Cloudflare Stream non configuré");
  return { base: `https://api.cloudflare.com/client/v4/accounts/${account}/stream/live_inputs`, token };
}

export const streamConfigured = () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_TOKEN);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, token } = config();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { message?: string }[] } | null;
  if (!res.ok || !data?.success) {
    throw new Error(`Cloudflare ${res.status}: ${data?.errors?.map((e) => e.message).join(", ") ?? "réponse illisible"}`);
  }
  return data.result as T;
}

type LiveInput = {
  uid: string;
  status?: string | null;
  enabled?: boolean;
  rtmps?: { url?: string; streamKey?: string };
};

/** Nouvelle entrée pour un créateur. Pas d'enregistrement: le stockage est facturé. */
export async function createLiveInput(name: string) {
  const input = await call<LiveInput>("", {
    method: "POST",
    body: JSON.stringify({ meta: { name }, recording: { mode: "off" } }),
  });
  return input.uid;
}

export const getLiveInput = (uid: string) => call<LiveInput>(`/${encodeURIComponent(uid)}`);

/** Couper ou rouvrir l'antenne: désactivée, l'entrée refuse le flux et termine le live en cours. */
export const setLiveInputEnabled = (uid: string, enabled: boolean) =>
  call<LiveInput>(`/${encodeURIComponent(uid)}`, { method: "PUT", body: JSON.stringify({ enabled }) });

// États où le flux arrive (ou se rétablit après une micro-coupure réseau).
const ON_AIR = new Set(["connected", "reconnected", "reconnecting"]);
export const isOnAir = (status: string | null | undefined) => ON_AIR.has(String(status ?? ""));

/**
 * Adresse HLS du live. Le code client Cloudflare (customer-xxxx) vient de
 * la variable d'environnement si elle existe, sinon on le lit dans
 * l'adresse de lecture que Cloudflare donne pour la diffusion en cours.
 */
export async function hlsUrl(uid: string): Promise<string | null> {
  const code = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (code) return `https://customer-${code}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
  try {
    const videos = await call<{ status?: { state?: string }; playback?: { hls?: string } }[]>(`/${encodeURIComponent(uid)}/videos`);
    const current = videos.find((v) => v.status?.state === "live-inprogress") ?? videos[0];
    const host = current?.playback?.hls ? new URL(current.playback.hls).origin : null;
    return host ? `${host}/${uid}/manifest/video.m3u8` : null;
  } catch {
    return null;
  }
}
