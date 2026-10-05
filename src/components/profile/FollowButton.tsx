"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { loginHref, useSession } from "../session";

export function FollowButton({ profileId, initialFollowing }: { profileId: string; initialFollowing: boolean }) {
  const router = useRouter();
  const { userId } = useSession();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!userId) return router.push(loginHref());
    setBusy(true);
    const supabase = supabaseBrowser();
    const next = !following;
    setFollowing(next);
    const { error } = next
      ? await supabase.from("tub_follows").insert({ follower_id: userId, followee_id: profileId })
      : await supabase.from("tub_follows").delete().eq("follower_id", userId).eq("followee_id", profileId);
    if (error && error.code !== "23505") setFollowing(!next);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full rounded-full py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
        following ? "border border-line bg-surface text-text" : "bg-brand text-bg"
      }`}
    >
      {following ? "Abonné ✓" : "S'abonner"}
    </button>
  );
}
