import "server-only";
import { supabaseAdmin, isAdminEmail } from "./supabase/admin";
import { getLiveInput, hlsUrl, isOnAir, streamConfigured } from "./cfstream";

// ═══════════════════════════════════════════════════════════════
// ÉTAT DES LIVES — sans webhook, et qui se répare tout seul
//
// Cloudflare sait si le flux arrive; nous, on le lui demande. Chaque
// fois que quelqu'un regarde un live (le créateur dans son studio, un
// spectateur, la liste « En direct »), le serveur revérifie au plus une
// fois toutes les 8 s. Un live dont le flux ne revient pas pendant 45 s
// est terminé; un live jamais démarré expire au bout de 30 min.
// ═══════════════════════════════════════════════════════════════

export const LIVE_COLUMNS =
  "id,creator_id,cf_input_id,title,category,status,hls_url,created_at,started_at,ended_at,last_live_at,checked_at," +
  "creator:tub_profiles!tub_lives_creator_id_fkey(username,display_name,avatar_url)";

export type LiveRow = {
  id: string;
  creator_id: string;
  cf_input_id: string;
  title: string;
  category: string;
  status: "waiting" | "live" | "ended";
  hls_url: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  last_live_at: string | null;
  checked_at: string;
  creator: { username: string; display_name: string; avatar_url: string | null } | null;
};

/** Un live compte comme « à l'antenne » si son flux a été vu il y a moins de 90 s. */
export const onAirCutoff = () => new Date(Date.now() - 90_000).toISOString();

const CHECK_EVERY = 8_000;
const GRACE = 45_000;
const WAIT_MAX = 30 * 60_000;

/** Revérifie auprès de Cloudflare si la dernière vérification date un peu. */
export async function refreshLive(live: LiveRow, force = false): Promise<LiveRow> {
  if (live.status === "ended" || !streamConfigured()) return live;
  const now = Date.now();
  if (!force && now - Date.parse(live.checked_at) < CHECK_EVERY) return live;

  let onAir: boolean;
  try {
    onAir = isOnAir((await getLiveInput(live.cf_input_id)).status);
  } catch {
    return live; // Cloudflare injoignable: on ne conclut rien.
  }

  const iso = new Date(now).toISOString();
  const patch: Partial<LiveRow> & { ended_reason?: string } = { checked_at: iso };
  if (onAir) {
    patch.status = "live";
    patch.last_live_at = iso;
    if (!live.started_at) patch.started_at = iso;
    if (!live.hls_url) patch.hls_url = await hlsUrl(live.cf_input_id);
  } else if (live.status === "live" && now - Date.parse(live.last_live_at ?? live.checked_at) > GRACE) {
    Object.assign(patch, { status: "ended", ended_at: iso, ended_reason: "flux_coupe" });
  } else if (live.status === "waiting" && now - Date.parse(live.created_at) > WAIT_MAX) {
    Object.assign(patch, { status: "ended", ended_at: iso, ended_reason: "jamais_demarre" });
  }

  const { data } = await supabaseAdmin()
    .from("tub_lives").update(patch).eq("id", live.id).neq("status", "ended")
    .select(LIVE_COLUMNS).maybeSingle();
  return (data as unknown as LiveRow | null) ?? { ...live, ...patch };
}

export async function getLive(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from("tub_lives").select(LIVE_COLUMNS).eq("id", id).maybeSingle();
  return (data as unknown as LiveRow | null) ?? null;
}

/** Les lives à l'antenne, revérifiés au passage (les plus anciens contrôles d'abord). */
export async function liveNow(limit = 20): Promise<LiveRow[]> {
  const { data } = await supabaseAdmin()
    .from("tub_lives").select(LIVE_COLUMNS).eq("status", "live")
    .order("checked_at", { ascending: true }).limit(limit);
  const rows = (data as unknown as LiveRow[] | null) ?? [];
  const fresh = await Promise.all(rows.slice(0, 6).map((l) => refreshLive(l)));
  return [...fresh, ...rows.slice(6)]
    .filter((l) => l.status === "live")
    .sort((a, b) => Date.parse(b.started_at ?? b.created_at) - Date.parse(a.started_at ?? a.created_at));
}

/** Lives sur invitation: profils autorisés, plus les administrateurs. */
export async function canGoLive(userId: string, email: string | null | undefined) {
  if (isAdminEmail(email)) return true;
  const { data } = await supabaseAdmin().from("tub_profiles").select("live_enabled").eq("id", userId).maybeSingle();
  return Boolean(data?.live_enabled);
}

/** Pour un spectateur: ce qu'il peut savoir d'un live (jamais l'entrée Cloudflare brute au-delà de l'adresse HLS). */
export function publicLive(l: LiveRow) {
  return {
    id: l.id,
    status: l.status,
    title: l.title,
    category: l.category,
    hls: l.status === "live" ? l.hls_url : null,
    startedAt: l.started_at,
    creator: l.creator,
    creatorId: l.creator_id,
  };
}
export type PublicLive = ReturnType<typeof publicLive>;
