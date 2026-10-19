"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className={compact
        ? "text-muted transition hover:text-like"
        : "w-full rounded-full border border-line py-3 text-sm text-muted transition hover:border-like/40 hover:text-like"}
    >
      Se déconnecter
    </button>
  );
}
