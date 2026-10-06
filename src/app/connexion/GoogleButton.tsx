"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

// ═══════════════════════════════════════════════════════════════
// CONNEXION GOOGLE — la même méthode que Kelly Gaming
//
// Pas de redirection via Supabase: Google rend directement à la page un
// jeton signé, que Supabase échange contre une session. Un seul réglage
// côté Google (l'origine du site), et l'écran de Google affiche le nom
// de l'appli au lieu d'une adresse supabase.co.
//
// Le nonce lie le jeton à CETTE demande: Google reçoit l'empreinte
// SHA-256 et la recopie dans le jeton, Supabase reçoit la valeur brute,
// la hache et compare. Envoyer la même valeur des deux côtés échoue.
// ═══════════════════════════════════════════════════════════════
const CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "601219275751-92jpo6ssoe2fchut98nhr8csnquj6h6o.apps.googleusercontent.com";

type GoogleId = {
  initialize(o: {
    client_id: string;
    nonce: string;
    callback: (r: { credential?: string }) => void;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && window.google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google indisponible"));
    document.head.appendChild(s);
  });
}

async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

export function GoogleButton({ next }: { next: string }) {
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "busy" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [nonce] = await Promise.all([makeNonce(), loadScript("https://accounts.google.com/gsi/client")]);
        const gid = window.google?.accounts?.id;
        if (cancelled || !gid || !slot.current) return;

        gid.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed,
          callback: async ({ credential }) => {
            if (!credential) return;
            setState("busy");
            setError(null);
            const supabase = supabaseBrowser();
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.raw,
            });
            if (error || !data.user) {
              setState("ready");
              setError("La connexion a échoué. Réessaie dans un instant.");
              return;
            }
            const { data: profile } = await supabase
              .from("tub_profiles").select("id").eq("id", data.user.id).maybeSingle();
            router.replace(profile ? next : `/bienvenue?next=${encodeURIComponent(next)}`);
            router.refresh();
          },
        });

        // Le bouton officiel de Google, à la largeur de la colonne.
        gid.renderButton(slot.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          locale: "fr",
          width: Math.min(slot.current.offsetWidth || 320, 400),
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [next, router]);

  return (
    <div>
      {/* Réserve la place du bouton pour que la page ne saute pas au chargement */}
      <div className="relative flex min-h-12 w-full justify-center">
        <div ref={slot} className={`w-full [&>div]:mx-auto ${state === "busy" ? "pointer-events-none opacity-40" : ""}`} />
        {state === "loading" && (
          <div aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-surface-2" />
        )}
      </div>
      {state === "busy" && <p className="mt-3 text-center text-sm text-muted">Connexion en cours…</p>}
      {state === "error" && (
        <p role="alert" className="mt-3 text-center text-sm text-like">
          Impossible de charger Google. Vérifie ta connexion internet puis recharge la page.
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-center text-sm text-like">{error}</p>}
    </div>
  );
}
