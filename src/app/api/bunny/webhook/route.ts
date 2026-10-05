import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncVideo } from "@/lib/sync";

// Bunny prévient quand une vidéo change d'état. On ne croit pas le
// contenu du message: il sert seulement à savoir QUELLE vidéo relire
// auprès de l'API Bunny. Le secret dans l'URL évite qu'un inconnu
// nous fasse interroger Bunny en boucle.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") ?? "";
  const expected = process.env.BUNNY_WEBHOOK_SECRET ?? "";
  if (!expected || !sameText(secret, expected)) {
    return NextResponse.json({ error: "Refusé." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { VideoGuid?: string } | null;
  const guid = payload?.VideoGuid;
  if (!guid) return NextResponse.json({ ok: true });

  const { data: video } = await supabaseAdmin()
    .from("tub_videos").select("id,bunny_id,status").eq("bunny_id", guid).maybeSingle();
  if (video) await syncVideo(video);

  return NextResponse.json({ ok: true });
}

function sameText(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
