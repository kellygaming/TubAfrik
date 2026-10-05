import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const { user, profile } = await getSession();
  if (user) redirect(profile ? next : `/bienvenue?next=${encodeURIComponent(next)}`);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6">
      {/* Halo décoratif */}
      <div aria-hidden className="bg-gradient-brand absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full opacity-25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-40 -right-20 h-80 w-80 rounded-full bg-accent opacity-20 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        <h1 className="text-gradient text-5xl font-extrabold tracking-tight">TubAfrik</h1>
        <p className="mt-3 text-lg font-medium">Les shorts des gamers africains</p>
        <p className="mt-1 text-sm text-muted">
          Free Fire, eFootball, CODM… Montre tes meilleurs moves et construis ta communauté.
        </p>

        <ul className="mx-auto mt-8 space-y-3 text-left text-sm">
          {[
            ["🎬", "Publie tes clips en quelques secondes"],
            ["🌍", "Une communauté 100 % Afrique"],
            ["💰", "La monétisation arrive bientôt pour les créateurs"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 backdrop-blur">
              <span className="text-xl">{icon}</span>
              {text}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <GoogleButton next={next} />
          {sp.erreur && <p className="mt-3 text-sm text-like">La connexion a échoué, réessaie.</p>}
        </div>

        <p className="mt-6 text-xs text-muted">
          Même compte que Kelly Gaming. En continuant, tu acceptes les règles de la communauté.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:underline">
          Continuer sans compte
        </Link>
      </div>
    </main>
  );
}
