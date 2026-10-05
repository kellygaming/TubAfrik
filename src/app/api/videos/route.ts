import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createBunnyVideo, tusCredentials } from "@/lib/bunny";
import { isGameSlug } from "@/lib/games";

const MAX_PER_DAY = 15;

// Prépare une publication: crée la vidéo chez Bunny, la ligne chez nous,
// et rend au navigateur de quoi envoyer le fichier directement à Bunny.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Connecte-toi pour publier." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { caption?: unknown; game?: unknown } | null;
  const caption = typeof body?.caption === "string" ? body.caption.trim().slice(0, 300) : "";
  const game = isGameSlug(body?.game) ? body.game : null;
  if (!game) return NextResponse.json({ error: "Choisis le jeu de ta vidéo." }, { status: 400 });

  const db = supabaseAdmin();

  const { data: profile } = await db.from("tub_profiles").select("username").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Crée d'abord ton profil." }, { status: 403 });

  // Limite anti-abus: un compte piraté ou un robot ne remplit pas la facture Bunny.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db
    .from("tub_videos").select("id", { count: "exact", head: true })
    .eq("author_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_DAY) {
    return NextResponse.json({ error: `Maximum ${MAX_PER_DAY} vidéos par jour.` }, { status: 429 });
  }

  const guid = await createBunnyVideo(`${profile.username} · ${caption.slice(0, 60) || "TubAfrik"}`);
  const { data: video, error } = await db
    .from("tub_videos")
    .insert({ author_id: user.id, bunny_id: guid, caption, game })
    .select("id").single();
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });

  return NextResponse.json({ id: video.id, upload: tusCredentials(guid) });
}
