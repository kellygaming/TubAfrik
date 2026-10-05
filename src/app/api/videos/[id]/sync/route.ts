import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncVideo } from "@/lib/sync";

// L'auteur demande où en est l'encodage. Filet de sécurité si le webhook
// Bunny n'arrive pas: l'état vient toujours de Bunny, jamais du navigateur.
export async function POST(_req: Request, ctx: RouteContext<"/api/videos/[id]/sync">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: video } = await db
    .from("tub_videos").select("id,bunny_id,author_id,status").eq("id", id).maybeSingle();
  if (!video || video.author_id !== user.id) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const result = await syncVideo(video);
  return NextResponse.json(result);
}
