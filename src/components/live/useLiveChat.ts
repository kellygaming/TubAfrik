"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type LiveMessage = {
  id: number;
  body: string;
  kind: "text" | "gift";
  gift_slug: string | null;
  author_id: string;
  created_at: string;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
};

const COLUMNS = "id,body,kind,gift_slug,author_id,created_at,author:tub_profiles(username,display_name,avatar_url)";
const KEEP = 60;

/**
 * Le chat d'un live: les derniers messages, puis ceux qui arrivent en
 * direct (Supabase Realtime). `onGift` est appelé pour chaque cadeau reçu
 * pendant qu'on regarde, pour jouer son animation.
 */
export function useLiveChat(liveId: string, onGift?: (m: LiveMessage) => void) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const giftRef = useRef(onGift);
  useEffect(() => {
    giftRef.current = onGift;
  }, [onGift]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let cancelled = false;
    supabase.from("tub_live_messages").select(COLUMNS).eq("live_id", liveId)
      .order("id", { ascending: false }).limit(40)
      .then(({ data }) => {
        if (!cancelled) setMessages(((data as unknown as LiveMessage[]) ?? []).reverse());
      });

    const channel = supabase
      .channel(`live-chat-${liveId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tub_live_messages", filter: `live_id=eq.${liveId}` },
        async (payload) => {
          // L'événement ne contient pas le profil de l'auteur: on relit la ligne complète.
          const { data } = await supabase.from("tub_live_messages").select(COLUMNS).eq("id", (payload.new as { id: number }).id).maybeSingle();
          if (!data || cancelled) return;
          const m = data as unknown as LiveMessage;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-KEEP)));
          if (m.kind === "gift") giftRef.current?.(m);
        })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveId]);

  const send = useCallback(async (userId: string, body: string) => {
    const { data, error } = await supabaseBrowser().from("tub_live_messages")
      .insert({ live_id: liveId, author_id: userId, body }).select(COLUMNS).single();
    if (error) return error.message.includes("trop_vite") ? "Doucement 🙂 un message par seconde." : "Envoi impossible.";
    const m = data as unknown as LiveMessage;
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-KEEP)));
    return null;
  }, [liveId]);

  const remove = useCallback(async (id: number) => {
    const { error } = await supabaseBrowser().from("tub_live_messages").delete().eq("id", id);
    if (!error) setMessages((list) => list.filter((x) => x.id !== id));
  }, []);

  return { messages, send, remove };
}
