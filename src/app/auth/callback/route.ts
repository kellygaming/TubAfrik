import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Retour de Google: on échange le code contre une session, puis on
// envoie les nouveaux venus choisir leur pseudo.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL("/connexion?erreur=1", url));

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/connexion?erreur=1", url));

  const { data: profile } = await supabase
    .from("tub_profiles").select("id").eq("id", data.user.id).maybeSingle();

  const target = profile ? next : `/bienvenue?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(target, url));
}

// Uniquement un chemin interne: jamais de redirection vers un autre site.
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
