import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase/admin";
import { setLiveInputEnabled } from "@/lib/cfstream";
import { getLive } from "@/lib/lives";

// Fin du live: par son créateur, ou coupure par la modération. Dans ce
// second cas, l'antenne est aussi désactivée chez Cloudflare pour que le
// flux s'arrête vraiment (elle est rouverte au prochain live du créateur).
export async function POST(_request: Request, ctx: RouteContext<"/api/live/[id]/fin">) {
  const user = await currentUser();
  const live = await getLive((await ctx.params).id);
  if (!user || !live) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const owner = live.creator_id === user.id;
  const admin = isAdminEmail(user.email);
  if (!owner && !admin) return NextResponse.json({ error: "Interdit." }, { status: 403 });

  if (!owner && admin) await setLiveInputEnabled(live.cf_input_id, false).catch((e) => console.error("live: coupure", e));
  await supabaseAdmin().from("tub_lives")
    .update({ status: "ended", ended_at: new Date().toISOString(), ended_reason: owner ? "createur" : "moderation" })
    .eq("id", live.id).neq("status", "ended");
  return NextResponse.json({ ok: true });
}
