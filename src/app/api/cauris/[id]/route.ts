import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmCauriPurchase } from "@/lib/cauris";

// La page de retour demande où en est l'achat (et relance Chariow s'il attend).
export async function GET(_request: Request, ctx: RouteContext<"/api/cauris/[id]">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const db = supabaseAdmin();
  const { data: c } = await db.from("tub_cauri_purchases").select("id,user_id,status,cauris").eq("id", id).maybeSingle();
  if (!c || c.user_id !== user.id) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const status = c.status === "paid" ? c.status : await confirmCauriPurchase(c.id);
  const { data: w } = await db.from("tub_cauri_wallets").select("balance").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ status, cauris: c.cauris, balance: w?.balance ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
