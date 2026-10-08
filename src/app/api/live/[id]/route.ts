import { NextResponse } from "next/server";
import { getLive, publicLive, refreshLive } from "@/lib/lives";

// Où en est ce live? Appelé régulièrement par le studio et les spectateurs.
export async function GET(_request: Request, ctx: RouteContext<"/api/live/[id]">) {
  const live = await getLive((await ctx.params).id);
  if (!live) return NextResponse.json({ error: "Live introuvable." }, { status: 404 });
  return NextResponse.json(publicLive(await refreshLive(live)), { headers: { "Cache-Control": "no-store" } });
}
