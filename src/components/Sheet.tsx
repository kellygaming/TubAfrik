"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

// Panneau qui monte du bas, comme sur TikTok. Échap ou un tap sur le
// fond le referme; le défilement du fil est gelé pendant ce temps.
export function Sheet({
  open,
  onClose,
  title,
  children,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tall?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Fermer" className="animate-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`animate-sheet pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col rounded-t-3xl border-t border-line bg-surface ${
          tall ? "h-[70dvh]" : "max-h-[85dvh]"
        }`}
      >
        <div className="relative flex items-center justify-center px-4 pt-3 pb-2">
          <span className="absolute top-2 h-1 w-10 rounded-full bg-white/15" />
          <h2 className="mt-2 text-sm font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:text-text">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
