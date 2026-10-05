import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-8 text-center">
      <div>
        <p className="text-brand text-7xl font-extrabold">404</p>
        <p className="mt-3 text-lg font-semibold">Cette page a quitté la partie.</p>
        <p className="mt-1 text-sm text-muted">La vidéo ou le profil n&apos;existe plus, ou le lien est incorrect.</p>
        <Link href="/" className="bg-brand mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
          Retour au fil
        </Link>
      </div>
    </main>
  );
}
