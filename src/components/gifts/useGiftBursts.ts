"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loadGifts } from "@/lib/giftCatalog";
import type { Burst } from "./GiftBurst";

type GiftComment = {
  id: string;
  body: string;
  gift_slug: string | null;
  author: { display_name: string; avatar_url: string | null } | null;
};

const RECENT_HOURS = 72;
const SEEN_KEY = "tub_gift_seen";

// Une animation déjà vue ne se rejoue pas à chaque passage sur la vidéo.
function seen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function markSeen(id: string) {
  try {
    const s = seen();
    s.add(id);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200)));
  } catch {}
}

async function toBurst(c: GiftComment): Promise<Burst | null> {
  const gift = (await loadGifts()).find((g) => g.slug === c.gift_slug);
  if (!gift || !c.author) return null;
  // Sans message, la base écrit « a envoyé 💎 Diamant »: inutile de le répéter.
  const message = c.body.startsWith("a envoyé ") ? null : c.body;
  return { key: c.id, gift, fan: c.author, message };
}

/**
 * Les cadeaux à jouer sur la vidéo à l'écran:
 *  • ceux des 3 derniers jours, une fois par session (on arrive après la fête,
 *    on la voit quand même);
 *  • ceux qui tombent EN DIRECT pendant qu'on regarde (Supabase Realtime).
 */
export function useGiftBursts(videoId: string, active: boolean) {
  const [queue, setQueue] = useState<Burst[]>([]);

  const push = useCallback((b: Burst | null) => {
    if (!b || seen().has(b.key)) return;
    markSeen(b.key);
    setQueue((q) => (q.some((x) => x.key === b.key) ? q : [...q, b]));
  }, []);

  useEffect(() => {
    if (!active) return;
    const supabase = supabaseBrowser();
    let cancelled = false;
    const columns = "id,body,gift_slug,author:tub_profiles(display_name,avatar_url)";

    const since = new Date(Date.now() - RECENT_HOURS * 3600_000).toISOString();
    supabase
      .from("tub_comments").select(columns)
      .eq("video_id", videoId).eq("kind", "gift").gte("created_at", since)
      .order("created_at", { ascending: true }).limit(3)
      .then(async ({ data }) => {
        for (const c of (data as unknown as GiftComment[] | null) ?? []) {
          if (cancelled) return;
          push(await toBurst(c));
        }
      });

    const channel = supabase
      .channel(`gifts:${videoId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tub_comments", filter: `video_id=eq.${videoId}` },
        async (payload) => {
          const row = payload.new as { id: string; kind: string };
          if (row.kind !== "gift") return;
          const { data } = await supabase.from("tub_comments").select(columns).eq("id", row.id).maybeSingle();
          if (!cancelled && data) push(await toBurst(data as unknown as GiftComment));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [videoId, active, push]);

  const done = useCallback(() => setQueue((q) => q.slice(1)), []);
  return { current: active ? (queue[0] ?? null) : null, done };
}
