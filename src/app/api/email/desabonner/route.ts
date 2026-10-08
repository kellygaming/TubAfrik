import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkUnsubscribeToken } from "@/lib/email/mailer";
import { SITE_URL } from "@/lib/format";

// Lien « Ne plus recevoir ces emails » (signé, sans connexion requise).
// GET: clic dans l'email. POST: désinscription en un clic de Gmail / Apple Mail.
async function unsubscribe(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(u) || !checkUnsubscribeToken(u, t)) return false;
  await supabaseAdmin().from("tub_profiles").update({ email_opt_out: true }).eq("id", u);
  return true;
}

export async function GET(request: NextRequest) {
  const ok = await unsubscribe(request);
  return NextResponse.redirect(`${SITE_URL}/email/desabonne${ok ? "" : "?erreur=1"}`, 303);
}

export async function POST(request: NextRequest) {
  const ok = await unsubscribe(request);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
