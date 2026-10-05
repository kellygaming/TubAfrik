"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/icons";

export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setBusy(false);
  }

  return (
    <button
      onClick={login}
      disabled={busy}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white font-semibold text-[#1f1f1f] shadow-lg transition hover:bg-white/90 active:scale-[0.98] disabled:opacity-60"
    >
      <GoogleIcon />
      {busy ? "Redirection…" : "Continuer avec Google"}
    </button>
  );
}
