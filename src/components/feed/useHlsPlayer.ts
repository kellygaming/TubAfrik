"use client";

import { useEffect, useRef, type RefObject } from "react";
import type Hls from "hls.js";

// ═══════════════════════════════════════════════════════════════
// LECTEUR HLS ÉCONOME
//
// La data mobile coûte cher: seule la vidéo à l'écran et la suivante
// ont une source. Les autres n'ont rien chargé, ou ont tout relâché.
// On démarre toujours au plus bas niveau (lecture immédiate même en
// 3G), puis l'adaptation monte si le réseau suit. En mode économie,
// on plafonne à 360p.
// ═══════════════════════════════════════════════════════════════
const DATA_SAVER_MAX_HEIGHT = 360;

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
          startLevel: 0,
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
