"use client";

import { useSyncExternalStore } from "react";

// ═══════════════════════════════════════════════════════════════
// LE SITE OUVERT DANS L'APP PLAY STORE
//
// L'app Android (TWA) démarre sur « /?source=twa ». Google interdit d'y
// vendre des biens numériques hors de son propre paiement: dans l'app,
// on DÉPENSE ses Cauris, on ne les achète pas. La recharge reste sur le
// site web.
// Mémorisé pour l'onglet (sessionStorage), pas en cookie: l'app partage
// les cookies de Chrome, la recharge disparaîtrait aussi dans le navigateur.
// ═══════════════════════════════════════════════════════════════
const KEY = "tub_store_app";

export function isStoreApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("source") === "twa" || document.referrer.startsWith("android-app://")) {
      window.sessionStorage.setItem(KEY, "1");
    }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

const noop = () => () => {};

/** true dans l'app des stores (toujours false au rendu serveur). */
export function useStoreApp() {
  return useSyncExternalStore(noop, isStoreApp, () => false);
}
