"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

// Lecteur du live: hls.js (Chrome, Android) ou HLS natif (Safari, iPhone).
// Réglé pour la stabilité plutôt que pour coller au direct: ~3 segments
// de marge absorbent les à-coups d'un réseau mobile.
export function LivePlayer({ src, muted, className = "" }: { src: string; muted: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    let cancelled = false;
    const play = () => video.play().catch(() => {});

    (async () => {
      const { default: HlsClass } = await import("hls.js");
      if (cancelled) return;
      if (HlsClass.isSupported()) {
        hls = new HlsClass({
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
          maxBufferLength: 20,
          backBufferLength: 10,
          capLevelToPlayerSize: true,
        });
        hls.on(HlsClass.Events.MANIFEST_PARSED, play);
        hls.on(HlsClass.Events.ERROR, (_e, data) => {
          if (!data.fatal || !hls) return;
          // Réseau qui flanche: on relance le chargement plutôt que d'abandonner.
          if (data.type === HlsClass.ErrorTypes.NETWORK_ERROR) setTimeout(() => hls?.startLoad(), 2000);
          else if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("loadedmetadata", play, { once: true });
      }
    })();

    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={ref}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        muted={muted}
        onWaiting={() => setStalled(true)}
        onPlaying={() => setStalled(false)}
      />
      {stalled && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Chargement" />
        </div>
      )}
    </div>
  );
}
