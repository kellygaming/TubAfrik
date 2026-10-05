import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GAMES } from "@/lib/games";
import { LogoMark, Wordmark } from "@/components/Logo";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Connexion" };

// La photo de fond: un collage de gamers africains (voir docs/prompt-collage.md).
// Tant qu'elle manque, le motif de bandes kente prend le relais.
const COLLAGE = "/connexion/collage.webp";
const FEATURED = ["free-fire", "efootball", "codm", "pubg-mobile", "ea-fc"];

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const { user, profile } = await getSession();
  if (user) redirect(profile ? next : `/bienvenue?next=${encodeURIComponent(next)}`);

  const games = GAMES.filter((g) => FEATURED.includes(g.slug));

  return (
    <main className="relative min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* ── Le collage: plein écran sur téléphone, panneau de gauche sur ordinateur ── */}
      <div aria-hidden className="kente-fallback absolute inset-0 lg:relative">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${COLLAGE})` }}
        />
        {/* Voile sombre pour que le texte reste lisible, quelle que soit la photo */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/50 to-bg lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-bg/80" />
      </div>

      {/* ── Le contenu, ancré en bas sur téléphone (là où passe le pouce) ── */}
      <section className="relative flex min-h-dvh flex-col justify-end px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+28px)] lg:justify-center lg:bg-bg lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3">
            <LogoMark size={52} />
            <Wordmark className="text-3xl" />
          </div>

          <h1 className="font-display mt-8 text-[1.7rem] leading-[1.12] sm:text-[2rem] font-extrabold text-balance">
            Tes clips.
            <br />
            Ta communauté.
            <br />
            <span className="text-brand">Ton continent.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text/80">
            La plateforme de vidéos courtes des gamers africains. Publie tes meilleures actions,
            fais-toi un nom, et sois prêt quand la monétisation arrive.
          </p>

          <ul aria-label="Jeux à l'honneur" className="mt-5 flex flex-wrap gap-1.5">
            {games.map((g) => (
              <li key={g.slug} className="rounded-md border border-line bg-surface/80 px-2.5 py-1 text-xs text-text/85 backdrop-blur-sm">
                {g.name}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <GoogleButton next={next} />
            {sp.erreur && <p role="alert" className="mt-3 text-sm text-like">La connexion a échoué. Réessaie, ou vérifie que ton navigateur accepte les cookies.</p>}
          </div>

          <Link href="/" className="mt-3 block rounded-full py-3 text-center text-sm font-medium text-text/80 transition hover:text-text">
            Regarder sans compte
          </Link>

          <p className="mt-4 text-center text-xs leading-relaxed text-muted">
            Un seul compte pour TubAfrik et Kelly Gaming.
          </p>
        </div>
      </section>
    </main>
  );
}
