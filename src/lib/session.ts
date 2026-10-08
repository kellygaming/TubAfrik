import "server-only";
import { cache } from "react";
import { currentUser, supabaseServer } from "./supabase/server";

// Une seule lecture de session par requête, quel que soit le nombre de
// composants serveur qui la demandent.
export const getSession = cache(async () => {
  const user = await currentUser();
  if (!user) return { user: null, profile: null };
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("tub_profiles").select("username,display_name,avatar_url").eq("id", user.id).maybeSingle();
  return { user, profile };
});
