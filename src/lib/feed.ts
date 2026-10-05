import "server-only";
import { supabaseServer } from "./supabase/server";
import { isGameSlug } from "./games";
import { FEED_COLUMNS, type FeedItem } from "./types";
import type { FeedMode } from "@/components/feed/Feed";

export function parseFeedParams(sp: Record<string, string | string[] | undefined>) {
  const mode: FeedMode = sp.mode === "abonnements" ? "abonnements" : "pour-toi";
  const game = isGameSlug(sp.jeu) ? sp.jeu : null;
  return { mode, game };
}

export async function fetchFeed(mode: FeedMode, game: string | null, limit = 8, offset = 0) {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("tub_feed", { p_mode: mode, p_game: game, p_limit: limit, p_offset: offset });
  return (data as FeedItem[] | null) ?? [];
}

export async function fetchFeedItem(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tub_feed_items").select(FEED_COLUMNS).eq("id", id).maybeSingle();
  return (data as FeedItem | null) ?? null;
}
