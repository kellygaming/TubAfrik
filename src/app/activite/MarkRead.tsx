"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { setUnread } from "@/components/notifications/useUnread";

// Ouvrir la page Activité vaut lecture: la pastille s'éteint tout de
// suite, la base suit. Les nouveautés restent surlignées jusqu'à la
// prochaine visite (la page a été rendue avant).
export function MarkRead() {
  useEffect(() => {
    setUnread(0);
    supabaseBrowser().rpc("tub_mark_notifications_read").then(() => {});
  }, []);
  return null;
}
