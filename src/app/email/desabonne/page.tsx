import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Emails désactivés", robots: { index: false } };

export default async function UnsubscribedPage({ searchParams }: PageProps<"/email/desabonne">) {
  const failed = Boolean((await searchParams).erreur);
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <p className="text-5xl">{failed ? "🤔" : "📭"}</p>
        <h1 className="mt-5 text-xl font-bold">{failed ? "Lien invalide ou expiré" : "C'est noté, plus d'emails d'activité"}</h1>
        <p className="mt-2 text-sm text-muted">
          {failed
            ? "Tu peux couper les emails depuis « Modifier le profil »."
            : "Tu peux les réactiver à tout moment depuis « Modifier le profil ». Tes notifications restent visibles dans l'onglet Activité."}
        </p>
        <Link href="/profil/modifier" className="bg-brand mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
          Mes réglages
        </Link>
      </div>
    </main>
  );
}
