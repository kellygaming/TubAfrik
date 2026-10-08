import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { getLiveInput } from "@/lib/cfstream";
import { getLive } from "@/lib/lives";

// La clé de diffusion: seulement pour le créateur du live. Elle n'est
// stockée nulle part chez nous, on la redemande à Cloudflare.
export async function GET(_request: Request, ctx: RouteContext<"/api/live/[id]/cle">) {
  const user = await currentUser();
  const live = await getLive((await ctx.params).id);
  if (!user || !live || live.creator_id !== user.id) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  try {
    const input = await getLiveInput(live.cf_input_id);
    if (!input.rtmps?.url || !input.rtmps.streamKey) throw new Error("rtmps absent");
    return NextResponse.json(
      { url: input.rtmps.url, key: input.rtmps.streamKey },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (e) {
    console.error("live: clé", e);
    return NextResponse.json({ error: "Clé indisponible, réessaie." }, { status: 502 });
  }
}
