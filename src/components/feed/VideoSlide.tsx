"use client";

import Link from "next/link";
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

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress(v.currentTime / v.duration);
    // Une vue = 3 secondes regardées (ou la moitié d'un clip très court).
    if (!viewed.current && v.currentTime >= Math.min(3, v.duration * 0.5)) {
      viewed.current = true;
      props.onViewed();
    }
  }

  // Un tap: pause/lecture (et active le son au premier geste).
  // Deux taps rapprochés: un like, avec un cœur là où le doigt a touché.
  function onTap(e: React.PointerEvent<HTMLDivElement>) {
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
      <div className="absolute inset-0" onPointerUp={onTap} />

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
      <div className="text-shadow absolute left-0 right-20 bottom-[calc(env(safe-area-inset-bottom)+76px)] pl-4">
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

      {/* Progression */}
      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] h-0.5 bg-white/15">
        <div className="h-full bg-white/80" style={{ width: `${progress * 100}%` }} />
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
