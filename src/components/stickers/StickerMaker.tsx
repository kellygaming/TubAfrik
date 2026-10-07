"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CAPTION_MAX, STICKER_COLUMNS, STICKER_SIZE, type Sticker } from "@/lib/stickers";
import { CloseIcon } from "../icons";
import { useSession } from "../session";

// ═══════════════════════════════════════════════════════════════
// FABRIQUE DE STICKERS
//
// On fige un instant de la vidéo qu'on regarde, on le cadre au carré,
// on y écrit une phrase façon mème: c'est un sticker de 320 px (~15 Ko).
//
// L'image est lue directement dans le lecteur du fil. hls.js remplit la
// vidéo via MSE: la toile n'est pas « souillée » et l'export marche.
// Safari lit le HLS lui-même: là, la toile est souillée; on ouvre alors
// une copie invisible de la vidéo en mode CORS, calée au même instant.
// Le lecteur du fil n'est jamais modifié.
// ═══════════════════════════════════════════════════════════════

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;

function readable(video: HTMLVideoElement) {
  if (video.readyState < 2 || !video.videoWidth) return false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(video, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** Copie de la vidéo lisible par la toile (Safari). */
function corsClone(playlist: string, at: number) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const v = document.createElement("video");
    if (!v.canPlayType("application/vnd.apple.mpegurl")) return reject(new Error("hls"));
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const fail = () => reject(new Error("clone"));
    v.addEventListener("error", fail, { once: true });
    v.addEventListener("loadedmetadata", () => { v.currentTime = at; }, { once: true });
    v.addEventListener("seeked", () => (readable(v) ? resolve(v) : fail()), { once: true });
    setTimeout(fail, 15_000);
    v.src = playlist;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function StickerMaker({
  videoId,
  onClose,
  onCreated,
}: {
  videoId: string;
  onClose: () => void;
  onCreated: (s: Sticker) => void;
}) {
  const { userId } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLVideoElement | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const v = sourceRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || !v.videoWidth) return;
    const ctx = canvas.getContext("2d")!;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const side = Math.min(w, h) / zoom;
    const sx = clamp(center.x * w - side / 2, 0, w - side);
    const sy = clamp(center.y * h - side / 2, 0, h - side);
    ctx.drawImage(v, sx, sy, side, side, 0, 0, STICKER_SIZE, STICKER_SIZE);

    const text = caption.trim();
    if (!text) return;
    ctx.font = `900 34px Impact, "Arial Black", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineJoin = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#fff";
    const lines = wrap(ctx, text, STICKER_SIZE - 28);
    lines.forEach((l, i) => {
      const y = STICKER_SIZE - 14 - (lines.length - 1 - i) * 38;
      ctx.strokeText(l, STICKER_SIZE / 2, y);
      ctx.fillText(l, STICKER_SIZE / 2, y);
    });
  }, [zoom, center, caption]);

  // Le dessin suit les réglages; un « seeked » le relance aussi (ci-dessous).
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  useEffect(() => {
    const main = document.querySelector<HTMLVideoElement>(`[data-video-id="${videoId}"] video`);
    let cancelled = false;
    const onSeeked = () => {
      drawRef.current();
      if (sourceRef.current) setTime(sourceRef.current.currentTime);
    };

    (async () => {
      if (!main) return setError("Lance la vidéo pour en tirer un sticker.");
      const wasPlaying = !main.paused;
      const at = main.currentTime;
      main.pause();
      restoreRef.current = () => {
        if (sourceRef.current === main) main.currentTime = at;
        if (wasPlaying) main.play().catch(() => {});
      };

      let src: HTMLVideoElement = main;
      if (!readable(main)) {
        try {
          src = await corsClone(main.dataset.playlist ?? "", at);
        } catch {
          if (!cancelled) setError("Ce navigateur ne permet pas de capturer cette vidéo.");
          return;
        }
      }
      if (cancelled) return;
      sourceRef.current = src;
      src.addEventListener("seeked", onSeeked);
      setDuration(Number.isFinite(src.duration) ? src.duration : 0);
      setTime(src.currentTime);
      setReady(true);
      drawRef.current();
    })();

    return () => {
      cancelled = true;
      const src = sourceRef.current;
      src?.removeEventListener("seeked", onSeeked);
      if (src && src !== main) src.removeAttribute("src");
      sourceRef.current = null;
      restoreRef.current?.();
      restoreRef.current = null;
    };
  }, [videoId]);

  function seek(t: number) {
    const v = sourceRef.current;
    if (!v) return;
    const next = clamp(t, 0, Math.max(0, duration - 0.05));
    setTime(next);
    v.currentTime = next;
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const v = sourceRef.current;
    if (!drag.current || !v?.videoWidth) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const side = Math.min(v.videoWidth, v.videoHeight) / zoom;
    const dx = ((e.clientX - drag.current.x) / rect.width) * (side / v.videoWidth);
    const dy = ((e.clientY - drag.current.y) / rect.height) * (side / v.videoHeight);
    drag.current = { x: e.clientX, y: e.clientY };
    setCenter((c) => ({ x: clamp(c.x - dx, 0, 1), y: clamp(c.y - dy, 0, 1) }));
  }

  async function create() {
    const canvas = canvasRef.current;
    if (!canvas || !userId) return;
    setBusy(true);
    setError(null);
    draw();
    const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob("image/webp", 0.82);
    // Safari n'encode pas le WebP: il rend du PNG, trop lourd. On passe au JPEG.
    if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
    if (!blob) {
      setBusy(false);
      return setError("Capture impossible, réessaie.");
    }
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = supabaseBrowser();
    const up = await supabase.storage.from("tub-stickers").upload(path, blob, { contentType: blob.type });
    if (up.error) {
      setBusy(false);
      return setError("Envoi de l'image impossible, réessaie.");
    }
    const { data, error } = await supabase
      .from("tub_stickers")
      .insert({ creator_id: userId, source_video_id: videoId, image_path: path, caption: caption.trim() || null })
      .select(STICKER_COLUMNS)
      .single();
    if (error || !data) {
      setBusy(false);
      return setError(
        error?.message.includes("quota_stickers")
          ? "Tu as déjà créé 30 stickers aujourd'hui. Reviens demain !"
          : "Création impossible, réessaie.",
      );
    }
    await supabase.from("tub_sticker_saves").insert({ user_id: userId, sticker_id: data.id });
    onCreated(data as Sticker);
  }

  return createPortal(
    <div className="animate-fade fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Créer un sticker">
      <div className="pt-safe mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
        <h2 className="font-semibold">Créer un sticker</h2>
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1.5 text-muted hover:text-text">
          <CloseIcon width={22} height={22} />
        </button>
      </div>

      <div className="no-scrollbar mx-auto flex w-full max-w-md flex-1 flex-col items-center overflow-y-auto px-5 pb-6">
        <p className="text-center text-xs text-muted">Choisis l&apos;instant, cadre avec le doigt, ajoute ta phrase.</p>

        <div className="relative mt-4 w-full max-w-[18rem]">
          <canvas
            ref={canvasRef}
            width={STICKER_SIZE}
            height={STICKER_SIZE}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            className={`aspect-square w-full touch-none rounded-3xl border-4 border-white bg-surface-2 shadow-[0_8px_40px_rgba(245,166,35,0.25)] ${
              ready ? "cursor-grab active:cursor-grabbing" : "animate-pulse"
            }`}
          />
          {!ready && !error && (
            <p className="absolute inset-0 grid place-items-center text-sm text-muted">Capture de la vidéo…</p>
          )}
        </div>

        {ready && (
          <div className="mt-5 w-full space-y-4">
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-muted">
                <span>Instant</span>
                <span className="tabular-nums">{fmt(time)}</span>
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => seek(time - 0.1)} aria-label="Image précédente"
                  className="h-8 w-8 shrink-0 rounded-full bg-surface-2 text-sm">‹</button>
                <input type="range" min={0} max={duration || 0} step={0.05} value={time}
                  onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
                <button type="button" onClick={() => seek(time + 0.1)} aria-label="Image suivante"
                  className="h-8 w-8 shrink-0 rounded-full bg-surface-2 text-sm">›</button>
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Zoom</span>
              <input type="range" min={1} max={3} step={0.05} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[var(--color-gold)]" />
            </label>
            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-muted">
                <span>Texte du sticker</span>
                <span>{caption.length}/{CAPTION_MAX}</span>
              </span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={CAPTION_MAX}
                placeholder="Quand le prof dit « interro surprise »"
                className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-white/40" />
            </label>
          </div>
        )}

        {error && <p role="alert" className="mt-4 w-full rounded-xl bg-like/10 px-3 py-2 text-center text-sm text-like">{error}</p>}

        {ready && (
          <button onClick={create} disabled={busy}
            className="mt-5 h-12 w-full rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50">
            {busy ? "Création…" : "Créer et utiliser"}
          </button>
        )}
        <p className="mt-3 text-center text-[11px] text-muted">
          Ton sticker rejoint ta collection. Ceux qui le voient pourront le reprendre.
        </p>
      </div>
    </div>,
    document.body,
  );
}
