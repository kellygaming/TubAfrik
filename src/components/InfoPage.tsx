import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { BottomNav } from "./BottomNav";

// Gabarit des pages d'explication (mission, monétisation): une colonne
// lisible, un liseré kente en tête, la navigation du bas.
export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro: ReactNode; children: ReactNode }) {
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
          <LogoMark size={28} /> TubAfrik
        </Link>
        <header className="mt-8">
          <div className="kente-rule" aria-hidden />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
          <h1 className="font-display mt-2 text-[1.75rem] font-extrabold leading-tight">{title}</h1>
          <div className="mt-4 text-[15px] leading-relaxed text-text/80">{intro}</div>
        </header>
        {children}
      </main>
      <BottomNav />
    </>
  );
}

export function InfoSection({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-10 ${className}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-text/80">{children}</div>
    </section>
  );
}
