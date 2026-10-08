import { LogoMark } from "@/components/Logo";

// Affiché DÈS le tap, pendant que le serveur prépare la page: le site
// répond tout de suite au doigt, même sur un réseau lent.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-bg" role="status" aria-label="Chargement">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={56} className="animate-pulse" />
        <span className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
          <span className="loading-bar block h-full w-1/3 rounded-full bg-gold" />
        </span>
      </div>
    </div>
  );
}
