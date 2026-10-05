"use client";

import { useCallback, useSyncExternalStore } from "react";

// Réglages du lecteur partagés par toutes les vidéos du fil:
// le son (coupé tant qu'on n'a pas touché l'écran, règle des navigateurs)
// et le mode économie de data, retenu d'une visite à l'autre.
type Settings = { muted: boolean; dataSaver: boolean };

const KEY = "tub_data_saver";
let state: Settings = { muted: true, dataSaver: false };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(KEY);
    // Par défaut: économie activée si le navigateur signale une connexion lente ou « Économiseur de données ».
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!conn?.saveData || /2g|3g/.test(conn?.effectiveType ?? "");
    state = { ...state, dataSaver: saved === null ? slow : saved === "1" };
  } catch {}
}

function set(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  if (patch.dataSaver !== undefined) {
    try {
      window.localStorage.setItem(KEY, patch.dataSaver ? "1" : "0");
    } catch {}
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const serverSnapshot: Settings = { muted: true, dataSaver: false };

export function useFeedSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => serverSnapshot,
  );
  const setMuted = useCallback((muted: boolean) => set({ muted }), []);
  const setDataSaver = useCallback((dataSaver: boolean) => set({ dataSaver }), []);
  return { ...settings, setMuted, setDataSaver };
}

// Identifiant anonyme pour compter une vue par jour aux non-connectés.
export function anonKey() {
  try {
    let k = window.localStorage.getItem("tub_anon");
    if (!k) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      k = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem("tub_anon", k);
    }
    return k;
  } catch {
    return null;
  }
}
