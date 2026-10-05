"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type SessionInfo = {
  userId: string | null;
  profile: { username: string; avatar_url: string | null; display_name: string } | null;
};

const SessionContext = createContext<SessionInfo>({ userId: null, profile: null });

// Le serveur fournit la session au premier rendu (pas de clignotement
// « Connexion » → « Profil »); le navigateur suit ensuite les changements.
export function SessionProvider({ initial, children }: { initial: SessionInfo; children: ReactNode }) {
  const [session, setSession] = useState(initial);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") setSession({ userId: null, profile: null });
      else if (s?.user && s.user.id !== session.userId) {
        supabase
          .from("tub_profiles").select("username,avatar_url,display_name").eq("id", s.user.id).maybeSingle()
          .then(({ data: profile }) => setSession({ userId: s.user.id, profile }));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [session.userId]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

// Renvoie vers la connexion en revenant ensuite exactement ici.
export function loginHref() {
  if (typeof window === "undefined") return "/connexion";
  return `/connexion?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}
