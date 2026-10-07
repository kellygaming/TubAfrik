"use client";

import { useEffect, useSyncExternalStore } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

// ═══════════════════════════════════════════════════════════════
// LA PASTILLE DE LA CLOCHE
//
// Un seul compteur pour tout l'onglet: lu à l'arrivée et au retour
// sur l'onglet, puis tenu à jour en direct (Supabase Realtime) quand
// un cadeau, un abonné ou un commentaire arrive.
// ═══════════════════════════════════════════════════════════════
let count = 0;
let owner: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setUnread(n: number) {
  count = Math.max(0, n);
  emit();
}

async function refresh(userId: string) {
  const { count: n } = await supabaseBrowser()
    .from("tub_notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
  if (owner === userId) setUnread(n ?? 0);
}

export function useUnread(userId: string | null) {
  const n = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (userId ? count : 0),
    () => 0,
  );

  useEffect(() => {
    if (!userId) return;
    owner = userId;
    refresh(userId);
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tub_notifications", filter: `user_id=eq.${userId}` },
        () => setUnread(count + 1),
      )
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && refresh(userId);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return n;
}
