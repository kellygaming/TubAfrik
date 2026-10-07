import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmPayment } from "@/lib/payments";

// La page /merci demande où en est le paiement. Tant qu'il est en
// attente, on interroge Chariow: pas besoin d'attendre le Pulse.
export async function GET(_request: Request, ctx: RouteContext<"/api/support/[id]">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: p } = await db
    .from("tub_payments")
    .select("id,payer_id,status,video_id,gift:tub_gifts(name,emoji,vip_days),creator:tub_profiles!tub_payments_creator_id_fkey(username,display_name)")
    .eq("id", id).maybeSingle();
  if (!p || p.payer_id !== user.id) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const status = p.status === "paid" ? p.status : await confirmPayment(p.id);
  return NextResponse.json({ status, video: p.video_id, gift: p.gift, creator: p.creator });
}
