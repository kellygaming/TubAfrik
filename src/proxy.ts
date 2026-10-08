import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// L'ancienne adresse renvoie vers le domaine officiel: une seule adresse,
// donc une seule session (les cookies de connexion sont liés au domaine).
// Les API ne sont pas redirigées: Chariow et Bunny y envoient encore leurs
// notifications, et un POST redirigé se perdrait.
const LEGACY_HOST = "tubafrik.vercel.app";
const CANONICAL = "https://www.tubafrik.com";

// Rafraîchit la session Supabase une fois par navigation, avant le rendu,
// pour que les pages serveur voient toujours un jeton valide.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    request.headers.get("host") === LEGACY_HOST &&
    (request.method === "GET" || request.method === "HEAD") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(`${CANONICAL}${pathname}${search}`, 308);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Ni les fichiers statiques, ni le webhook Bunny (aucune session à rafraîchir).
  matcher: ["/((?!_next/static|_next/image|api/bunny|api/cron|api/chariow|favicon.ico|icon|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
