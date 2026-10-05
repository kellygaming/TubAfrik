import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { removeVideo } from "@/lib/sync";

// L'auteur retire sa vidéo: elle disparaît du fil et du stockage Bunny.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/videos/[id]">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: video } = await db
    .from("tub_videos").select("id,bunny_id,author_id").eq("id", id).maybeSingle();
  if (!video || video.author_id !== user.id) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  await removeVideo(video);
  return NextResponse.json({ ok: true });
}
