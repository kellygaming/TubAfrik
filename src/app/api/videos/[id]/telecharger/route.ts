import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/format";

// ═══════════════════════════════════════════════════════════════
// TÉLÉCHARGER UNE VIDÉO
//
// Bunny produit, en plus du HLS, des fichiers MP4 (« MP4 fallback »,
// à activer dans la bibliothèque). Le filigrane TubAfrik y est incrusté:
// chaque vidéo partagée hors du site ramène vers lui.
// On sert le fichier depuis notre domaine pour forcer le
// téléchargement (un lien direct vers le CDN ouvrirait juste la vidéo).
// ?check=1 répond seulement si un MP4 existe, sans rien télécharger.
// ═══════════════════════════════════════════════════════════════
const CDN = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;
const QUALITIES = [720, 480, 360, 240];

async function findMp4(bunnyId: string) {
  for (const q of QUALITIES) {
    const url = `https://${CDN}/${bunnyId}/play_${q}p.mp4`;
    const res = await fetch(url, { method: "HEAD", headers: { Referer: SITE_URL }, cache: "no-store" }).catch(() => null);
    if (res?.ok) return url;
  }
  return null;
}

export async function GET(request: Request, ctx: RouteContext<"/api/videos/[id]/telecharger">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const { data: v } = await supabaseAdmin().from("tub_videos")
    .select("bunny_id,status,author:tub_profiles(username)").eq("id", id).maybeSingle();
  if (!v || v.status !== "ready") return NextResponse.json({ error: "Vidéo introuvable." }, { status: 404 });

  const url = await findMp4(v.bunny_id);
  if (!url) return NextResponse.json({ ok: false, error: "Téléchargement pas encore disponible pour cette vidéo." }, { status: 404 });
  if (new URL(request.url).searchParams.has("check")) return NextResponse.json({ ok: true });

  const upstream = await fetch(url, { headers: { Referer: SITE_URL }, cache: "no-store" });
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Téléchargement impossible, réessaie." }, { status: 502 });

  const who = (v.author as unknown as { username: string } | null)?.username ?? "tubafrik";
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Content-Disposition": `attachment; filename="tubafrik-${who}-${id.slice(0, 8)}.mp4"`,
    "Cache-Control": "private, no-store",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new Response(upstream.body, { headers });
}
