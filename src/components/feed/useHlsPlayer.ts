"use client";

import { useEffect, useRef, type RefObject } from "react";
import type Hls from "hls.js";

// ═══════════════════════════════════════════════════════════════
// LECTEUR HLS ÉCONOME
//
// La data mobile coûte cher: seule la vidéo à l'écran et la suivante
// ont une source. Les autres n'ont rien chargé, ou ont tout relâché.
// En mode économie, on plafonne à 360p.
//
// LA PREMIÈRE SECONDE COMPTE: les créateurs y mettent l'action. Démarrer
// au plus bas niveau donnait 2-3 s de flou sur chaque vidéo. Le lecteur
// retient donc le débit mesuré sur les vidéos précédentes (et entre deux
// visites) et démarre directement à la qualité que le réseau tient. La
// suivante, préchargée avec cette estimation, est nette dès l'image 1.
// ═══════════════════════════════════════════════════════════════
const DATA_SAVER_MAX_HEIGHT = 360;
const BW_KEY = "tub_bw";
const FALLBACK_BPS = 1_500_000; // première visite, réseau inconnu: 360p sûr

let knownBandwidth: number | null = null;

function startEstimate(): number {
  if (knownBandwidth) return knownBandwidth;
  try {
    const saved = Number(window.localStorage.getItem(BW_KEY));
    if (saved > 0) return (knownBandwidth = saved);
  } catch {}
  // Indication du navigateur (Chrome/Android): débit descendant en Mb/s,
  // pris avec une marge car il est souvent optimiste.
  const downlink = (navigator as Navigator & { connection?: { downlink?: number } }).connection?.downlink;
  return downlink ? downlink * 1_000_000 * 0.7 : FALLBACK_BPS;
}

function rememberBandwidth(bps: number) {
  if (!bps || !Number.isFinite(bps)) return;
  knownBandwidth = bps;
  try {
    window.localStorage.setItem(BW_KEY, String(Math.round(bps)));
  } catch {}
}

export function useHlsPlayer(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  { load, active, dataSaver }: { load: boolean; active: boolean; dataSaver: boolean },
) {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !load) return;

    let hls: Hls | null = null;
    let cancelled = false;

    (async () => {
      const { default: HlsClass } = await import("hls.js");
      if (cancelled) return;

      if (HlsClass.isSupported()) {
        hls = new HlsClass({
          // -1: la qualité de départ est choisie d'après l'estimation de débit.
          startLevel: -1,
          abrEwmaDefaultEstimate: startEstimate(),
          // On fait confiance à l'estimation retenue plutôt que de la remesurer
          // sur le premier segment (qui serait alors chargé en basse qualité).
          testBandwidth: false,
          capLevelToPlayerSize: true,
          maxBufferLength: 10,
          maxMaxBufferLength: 20,
          backBufferLength: 10,
        });
        hls.on(HlsClass.Events.MANIFEST_PARSED, (_e, data) => {
          if (!hls || !dataSaver) return;
          let cap = 0;
          data.levels.forEach((lvl, i) => {
            if (lvl.height <= DATA_SAVER_MAX_HEIGHT) cap = i;
          });
          hls.autoLevelCapping = cap;
        });
        hls.on(HlsClass.Events.FRAG_LOADED, () => {
          if (hls) rememberBandwidth(hls.bandwidthEstimate);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari iOS lit HLS lui-même (sans plafond possible).
        video.src = src;
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [videoRef, src, load, dataSaver]);

  // La suivante ne précharge que quelques secondes; l'active, davantage.
  useEffect(() => {
    if (hlsRef.current) hlsRef.current.config.maxBufferLength = active ? 10 : 3;
  }, [active, load]);
}
