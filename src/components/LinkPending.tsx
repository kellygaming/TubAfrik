"use client";

import { useLinkStatus } from "next/link";

// À placer DANS un <Link> en position relative: un voile qui pulse dès le
// tap, le temps que la page suivante arrive (filtres du fil, onglets…).
export function LinkPending({ className = "rounded-full" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 bg-white/25 transition-opacity ${className} ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} />
  );
}
