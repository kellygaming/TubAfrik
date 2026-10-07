"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, IosShareIcon, PlusIcon } from "./icons";
import { LogoMark } from "./Logo";

// ═══════════════════════════════════════════════════════════════
// « INSTALLER TUBAFRIK »
//
// Le navigateur ne propose presque jamais l'installation de lui-même:
// sur Android il faut appeler l'invite nous-mêmes, sur iPhone elle
// n'existe pas du tout (le visiteur doit passer par Partager → Sur
// l'écran d'accueil). Cette carte apparaît après 20 s de visite, une
// fois le site un peu découvert; « Plus tard » la fait taire 7 jours.
// ═══════════════════════════════════════════════════════════════
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

const SNOOZE_KEY = "tub_install_snooze";
const DELAY_MS = 20_000;

export function InstallPrompt() {
  const [androidEvent, setAndroidEvent] = useState<InstallEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    try {
      // Déjà installée, ou mise en veille récemment: on ne dérange pas.
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const snoozed = Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
      if (standalone || snoozed) return;
    } catch {
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setAndroidEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const timer = setTimeout(() => {
      setMode((m) => (m !== "hidden" ? m : isIos ? "ios" : "android"));
    }, DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  // Android sans événement d'installation (navigateur non compatible,
  // ou site déjà installé): on n'affiche rien plutôt qu'un bouton mort.
  const visible = mode === "ios" || (mode === "android" && androidEvent);
  if (!visible) return null;

  function snooze() {
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 24 * 3600 * 1000));
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!androidEvent) return;
    await androidEvent.prompt();
    const { outcome } = await androidEvent.userChoice;
    if (outcome === "accepted") setMode("hidden");
    else snooze();
  }

  return createPortal(
    <div className="animate-sheet fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 px-3">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3">
          <LogoMark size={40} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Installe TubAfrik</p>
            {mode === "android" ? (
              <p className="mt-0.5 text-sm text-muted">L&apos;appli sur ton écran d&apos;accueil, légère et rapide.</p>
            ) : (
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                Appuie sur <IosShareIcon width={16} height={16} className="inline align-[-3px] text-text" /> <span className="text-text">Partager</span>, puis sur{" "}
                <span className="whitespace-nowrap"><PlusIcon width={14} height={14} className="inline align-[-2px] text-text" /> <span className="text-text">Sur l&apos;écran d&apos;accueil</span></span>.
              </p>
            )}
          </div>
          <button onClick={snooze} aria-label="Plus tard" className="shrink-0 rounded-full p-1 text-muted">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        {mode === "android" && (
          <button onClick={install} className="mt-3 w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-bg">
            Installer
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
