import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

// Client « au nom de l'utilisateur »: RLS s'applique comme dans le navigateur.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Un composant serveur ne peut pas écrire de cookie: le proxy
        // s'en charge déjà à chaque requête, on peut ignorer ici.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}

export type SessionUser = { id: string; email: string | null; user_metadata: Record<string, unknown> };

/**
 * L'utilisateur connecté, d'après son jeton (signature vérifiée par
 * getClaims). Plus d'aller-retour réseau vers le serveur d'auth à chaque
 * page: c'était ce qui faisait « traîner » chaque tap. Le proxy rafraîchit
 * déjà la session avant le rendu.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return {
    id: c.sub,
    email: typeof c.email === "string" ? c.email : null,
    user_metadata: (c.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
}
