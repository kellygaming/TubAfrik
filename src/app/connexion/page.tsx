import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { CATEGORIES } from "@/lib/categories";
import { LogoMark, Wordmark } from "@/components/Logo";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Connexion" };

// La photo de fond: un collage de créateurs africains (voir docs/prompt-collage.md).
// Son tiers bas est déjà noir: le texte s'y pose sans voile épais.
const COLLAGE = "/connexion/collage.webp";
const FEATURED = ["musique", "humour", "cuisine", "danse", "sport", "gaming", "beaute-mode"];

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const { user, profile } = await getSession();
  if (user) redirect(profile ? next : `/bienvenue?next=${encodeURIComponent(next)}`);

  const featured = CATEGORIES.filter((c) => FEATURED.includes(c.slug));

  return (
    <main className="relative min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* ── Le collage: plein écran sur téléphone, panneau de gauche sur ordinateur ── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-bg lg:relative">
        {/* Téléphone: le collage calé en haut. Ordinateur: entier, centré dans son panneau. */}
        <div
          className="absolute inset-0 bg-cover bg-top lg:inset-auto lg:top-0 lg:left-1/2 lg:aspect-[941/1672] lg:h-full lg:-translate-x-1/2 lg:[mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]"
          style={{ backgroundImage: `url(${COLLAGE})` }}
        />
        {/* Fondu vers le noir là où se posent le titre et le bouton */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/85 via-38% to-bg to-55% lg:hidden" />
      </div>

      {/* ── Le contenu, ancré en bas sur téléphone (là où passe le pouce) ── */}
      <section className="relative flex min-h-dvh flex-col justify-end px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+28px)] lg:justify-center lg:bg-bg lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-3">
            <LogoMark size={52} />
            <Wordmark className="text-3xl" />
          </div>

          <h1 className="font-display mt-8 text-[1.7rem] leading-[1.12] sm:text-[2rem] font-extrabold text-balance">
            Tes vidéos.
            <br />
            Ta communauté.
            <br />
            <span className="text-brand">Ton continent.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text/80">
            La plateforme de vidéos courtes de l&apos;Afrique. Publie, fais-toi un nom,
            et reçois les cadeaux de tes fans en mobile money.
          </p>

          <ul aria-label="Catégories" className="mt-5 flex flex-wrap gap-1.5">
            {featured.map((g) => (
              <li key={g.slug} className="rounded-md border border-line bg-surface/80 px-2.5 py-1 text-xs text-text/85 backdrop-blur-sm">
                {g.emoji} {g.name}
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
          <p className="mt-2 text-center text-xs text-muted">
            <Link href="/mission" className="underline-offset-2 hover:text-text hover:underline">Notre mission</Link>
            {" · "}
            <Link href="/gagner" className="underline-offset-2 hover:text-text hover:underline">Gagner sur TubAfrik</Link>
          </p>
          <p className="mt-2 text-center text-[11px] text-muted">
            En continuant, tu acceptes les{" "}
            <Link href="/conditions" className="underline underline-offset-2">conditions</Link> et la{" "}
            <Link href="/confidentialite" className="underline underline-offset-2">politique de confidentialité</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
