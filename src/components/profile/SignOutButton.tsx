"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
      className="w-full rounded-full border border-line py-3 text-sm text-muted transition hover:border-like/40 hover:text-like"
    >
      Se déconnecter
    </button>
  );
}
