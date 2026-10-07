import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "./supabase/server";
import { isGameSlug } from "./games";
import { isCategorySlug, type CategorySlug } from "./categories";
import { INTEREST_COOKIE, parseInterestCookie } from "./interests";
import { FEED_COLUMNS, type FeedItem } from "./types";
import type { FeedMode } from "@/components/feed/Feed";

export type FeedFilter = { mode: FeedMode; category: CategorySlug | null; game: string | null };

export function parseFeedParams(sp: Record<string, string | string[] | undefined>): FeedFilter {
  const mode: FeedMode = sp.mode === "abonnements" ? "abonnements" : "pour-toi";
  const game = isGameSlug(sp.jeu) ? sp.jeu : null;
  // Un ancien lien « ?jeu=free-fire » reste valable: il implique le gaming.
  const category = game ? "gaming" : isCategorySlug(sp.cat) ? sp.cat : null;
  return { mode, category, game };
}

/** Graine de la session: même ordre pendant qu'on fait défiler, un autre à la prochaine visite. */
export const newSeed = () => Math.random().toString(36).slice(2, 10);

export async function fetchFeed(f: FeedFilter, seed: string, limit = 8, offset = 0) {
  const [supabase, jar] = await Promise.all([supabaseServer(), cookies()]);
  const { data } = await supabase.rpc("tub_feed_v2", {
    p_mode: f.mode,
    p_category: f.category,
    p_game: f.game,
    p_interests: parseInterestCookie(jar.get(INTEREST_COOKIE)?.value),
    p_seed: seed,
    p_limit: limit,
    p_offset: offset,
  });
  return (data as FeedItem[] | null) ?? [];
}

export async function fetchFeedItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tub_feed_items").select(FEED_COLUMNS).eq("id", id).maybeSingle();
  return (data as FeedItem | null) ?? null;
}
