"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/types";
import { playlistUrl, thumbnailUrl } from "@/lib/media";
import { compact } from "@/lib/format";
import { gameName } from "@/lib/games";
import { videoTag } from "@/lib/categories";
import { Avatar } from "../Avatar";
import { CommentIcon, GiftIcon, HeartIcon, MoreIcon, PlayIcon, PlusIcon, ShareIcon, VolumeOffIcon } from "../icons";
import { useHlsPlayer } from "./useHlsPlayer";
import { useFeedSettings } from "./useFeedSettings";
import { GiftBurst } from "../gifts/GiftBurst";
import { useGiftBursts } from "../gifts/useGiftBursts";

type Props = {
  item: FeedItem;
  active: boolean;
  load: boolean;
  liked: boolean;
  following: boolean;
  isSelf: boolean;
  giftable: boolean;
  onLike: (like: boolean) => void;
  onFollow: () => void;
  onComments: () => void;
  onShare: () => void;
  onGift: () => void;
  onMore: () => void;
  onViewed: () => void;
};

export function VideoSlide(props: Props) {
  const { item, active, load, liked, following, isSelf } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const { muted, setMuted, dataSaver } = useFeedSettings();
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [expanded, setExpanded] = useState(false);
  const viewed = useRef(false);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const profileHref = `/u/${item.username}`;
  // Glisser vers la gauche: le profil du créateur arrive depuis la droite.
  const gesture = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const [pull, setPull] = useState(0);
  // Barre de lecture déplaçable: position affichée pendant le glissé.
  const [scrub, setScrub] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const scrubWasPlaying = useRef(false);

  useHlsPlayer(videoRef, playlistUrl(item.bunny_id), { load, active, dataSaver });
  const gifts = useGiftBursts(item.id, active);

  const activeRef = useRef(active);
  const pausedRef = useRef(false);
  useEffect(() => {
    activeRef.current = active;
    pausedRef.current = paused;
  }, [active, paused]);

  // Revenir sur une vidéo la relance: on oublie la pause d'avant.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setPaused(false);
  }

  // Lecture auto avec son refusée par le navigateur: on recoupe le son
  // et on relance. Les autres erreurs (source pas encore prête) sont
  // rattrapées par onLoadedData.
  const tryPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch((err: DOMException) => {
      if (err.name !== "NotAllowedError") return;
      v.muted = true;
      setMuted(true);
      v.play().catch(() => setPaused(true));
    });
  }, [setMuted]);

  // Lecture uniquement quand la vidéo occupe l'écran.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) {
      if (v.readyState > 0) v.currentTime = 0;
      tryPlay();
    } else {
      v.pause();
    }
  }, [active, tryPlay]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Le profil est préchargé pendant qu'on regarde: le glissé l'ouvre sans attente.
  useEffect(() => {
    if (active) router.prefetch(profileHref);
  }, [active, router, profileHref]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    if (scrub === null) setProgress(v.currentTime / v.duration);
    // Une vue = 3 secondes regardées (ou la moitié d'un clip très court).
    if (!viewed.current && v.currentTime >= Math.min(3, v.duration * 0.5)) {
      viewed.current = true;
      props.onViewed();
    }
  }

  // Un tap: pause/lecture (et active le son au premier geste).
  // Deux taps rapprochés: un like, avec un cœur là où le doigt a touché.
  function onTap(e: React.PointerEvent<HTMLDivElement>) {
    // Les boutons et liens au-dessus gèrent eux-mêmes leurs taps.
    if ((e.target as HTMLElement).closest("a,button")) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const id = now;
      setHearts((h) => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 800);
      if (!liked) props.onLike(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      if (muted) {
        setMuted(false);
        v.muted = false;
        if (v.paused) v.play().catch(() => {});
        setPaused(false);
        return;
      }
      if (v.paused) {
        v.play().catch(() => {});
        setPaused(false);
      } else {
        v.pause();
        setPaused(true);
      }
    }, 280);
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    // On décide une fois pour toutes: geste horizontal ou défilement vertical du fil.
    if (g.horizontal === null && Math.hypot(dx, dy) > 10) g.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    if (g.horizontal) setPull(Math.max(0, -dx));
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    if (g.horizontal === null) return onTap(e);
    setPull(0);
    if (g.horizontal && g.x - e.clientX > 70) router.push(profileHref);
  }

  function onCancel() {
    gesture.current = null;
    setPull(0);
  }

  function ratioAt(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  }

  function seek(ratio: number, precise: boolean) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const t = ratio * v.duration;
    // fastSeek (images clés) pendant le glissé, position exacte au lâcher.
    if (!precise && "fastSeek" in v) v.fastSeek(t);
    else v.currentTime = t;
  }

  function onScrubStart(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !v.duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubWasPlaying.current = !v.paused;
    v.pause();
    setDuration(v.duration);
    const r = ratioAt(e);
    setScrub(r);
    seek(r, false);
  }

  function onScrubMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrub === null) return;
    e.stopPropagation();
    const r = ratioAt(e);
    setScrub(r);
    seek(r, false);
  }

  function onScrubEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (scrub === null) return;
    e.stopPropagation();
    const r = ratioAt(e);
    seek(r, true);
    setProgress(r);
    setScrub(null);
    if (scrubWasPlaying.current) {
      videoRef.current?.play().catch(() => {});
      setPaused(false);
    }
  }

  const tag = videoTag(item.category, item.game, gameName);
  const portrait = !item.width || !item.height || item.height >= item.width;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" data-video-id={item.id}>
      <video
        ref={videoRef}
        data-playlist={playlistUrl(item.bunny_id)}
        className={`absolute inset-0 h-full w-full ${portrait ? "object-cover" : "object-contain"}`}
        poster={thumbnailUrl(item.bunny_id, item.thumbnail_file)}
        playsInline
        loop
        muted={muted}
        preload="none"
        onTimeUpdate={onTimeUpdate}
        onLoadedData={() => activeRef.current && !pausedRef.current && tryPlay()}
      />

      {/* Zone de tap (sous les boutons, au-dessus de la vidéo) */}
      <div
        className="absolute inset-0 touch-pan-y"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      />

      {pull > 0 && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center justify-center overflow-hidden bg-black/85 backdrop-blur"
          style={{ width: Math.min(pull, 260) }}
        >
          <div className={`flex min-w-[140px] flex-col items-center gap-2 transition-opacity ${pull > 70 ? "opacity-100" : "opacity-50"}`}>
            <Avatar src={item.avatar_url} name={item.display_name} size={64} className="ring-2 ring-gold" />
            <span className="max-w-[130px] truncate text-sm font-semibold">@{item.username}</span>
            <span className="text-xs text-white/70">{pull > 70 ? "Lâche pour voir le profil" : "Glisse encore…"}</span>
          </div>
        </div>
      )}

      {hearts.map((h) => (
        <HeartIcon
          key={h.id}
          filled
          width={96}
          height={96}
          className="animate-pop pointer-events-none absolute text-like drop-shadow-lg"
          style={{ left: h.x, top: h.y }}
        />
      ))}

      {gifts.current && <GiftBurst key={gifts.current.key} burst={gifts.current} onDone={gifts.done} />}

      {paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
            <PlayIcon width={40} height={40} className="ml-1 text-white/90" />
          </span>
        </div>
      )}

      {active && muted && (
        <button
          onClick={() => setMuted(false)}
          className="animate-fade absolute left-3 top-[calc(env(safe-area-inset-top)+var(--feed-top,108px))] flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium backdrop-blur"
        >
          <VolumeOffIcon width={16} height={16} /> Activer le son
        </button>
      )}

      {/* Dégradé pour la lisibilité des textes */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Colonne d'actions */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+88px)] right-2 z-10 flex flex-col items-center gap-5">
        <div className="relative mb-2">
          <Link href={`/u/${item.username}`} aria-label={`Profil de ${item.display_name}`}>
            <Avatar src={item.avatar_url} name={item.display_name} size={48} className="ring-2 ring-white" />
          </Link>
          {!isSelf && !following && (
            <button
              onClick={props.onFollow}
              aria-label={`S'abonner à ${item.display_name}`}
              className="absolute -bottom-2.5 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-like text-white"
            >
              <PlusIcon width={14} height={14} />
            </button>
          )}
        </div>

        <RailButton label={compact(item.likes_count)} onClick={() => props.onLike(!liked)}
          aria={liked ? "Retirer le like" : "Aimer"} pressed={liked}>
          <HeartIcon filled={liked} width={32} height={32}
            className={`transition ${liked ? "scale-110 text-like" : "text-white"}`} />
        </RailButton>
        <RailButton label={compact(item.comments_count)} onClick={props.onComments} aria="Commentaires">
          <CommentIcon width={30} height={30} />
        </RailButton>
        {!isSelf && props.giftable && (
          <RailButton label="Cadeau" onClick={props.onGift} aria={`Offrir un cadeau à ${item.display_name}`}>
            <GiftIcon width={30} height={30} className="text-gold" />
          </RailButton>
        )}
        <RailButton label="Partager" onClick={props.onShare} aria="Partager">
          <ShareIcon width={30} height={30} />
        </RailButton>
        <RailButton label="" onClick={props.onMore} aria="Plus d'options">
          <MoreIcon width={28} height={28} />
        </RailButton>
      </div>

      {/* Auteur, légende, jeu */}
      <div className="text-shadow absolute left-0 right-20 bottom-[calc(env(safe-area-inset-bottom)+84px)] pl-4">
        <Link href={`/u/${item.username}`} className="font-semibold">
          @{item.username}
        </Link>
        {item.caption && (
          <p
            onClick={() => setExpanded((e) => !e)}
            className={`mt-1 text-sm leading-snug text-white/90 ${expanded ? "" : "line-clamp-2"}`}
          >
            {item.caption}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-white/80">
          {tag && (
            <Link href={tag.href} className="rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur-sm">
              {tag.label}
            </Link>
          )}
          <span>{compact(item.views_count)} vues</span>
        </div>
      </div>

      {/* Progression: touche ou glisse pour avancer / revenir en arrière */}
      {scrub !== null && duration > 0 ? (
        <div className="text-shadow pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+110px)] z-20 text-center text-2xl font-bold tabular-nums">
          {clock(scrub * duration)}
          <span className="text-white/60"> / {clock(duration)}</span>
        </div>
      ) : null}
      <div
        role="slider"
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((scrub ?? progress) * 100)}
        className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-10 flex h-5 touch-none items-end"
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
      >
        <div className={`relative w-full bg-white/20 transition-[height] ${scrub !== null ? "h-1.5" : paused ? "h-1" : "h-0.5"}`}>
          <div className="h-full bg-white/85" style={{ width: `${(scrub ?? progress) * 100}%` }} />
          {(scrub !== null || paused) && (
            <span
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: `${(scrub ?? progress) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RailButton({
  children,
  label,
  onClick,
  aria,
  pressed,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  aria: string;
  pressed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      aria-pressed={pressed}
      className="text-shadow flex flex-col items-center gap-1 text-xs font-semibold drop-shadow transition active:scale-90"
    >
      {children}
      {label && <span>{label}</span>}
    </button>
  );
}

function clock(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
