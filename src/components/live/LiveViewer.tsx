"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PublicLive } from "@/lib/lives";
import { loadGifts } from "@/lib/giftCatalog";
import { category as categoryOf } from "@/lib/categories";
import { Avatar } from "../Avatar";
import { CloseIcon, GiftIcon, ShareIcon, VolumeOffIcon, VolumeOnIcon } from "../icons";
import { GiftBurst, type Burst } from "../gifts/GiftBurst";
import { SupportSheet, type SupportTarget } from "../support/SupportSheet";
import { useSession } from "../session";
import { LivePlayer } from "./LivePlayer";
import { LiveChat } from "./LiveChat";
import { useLiveChat, type LiveMessage } from "./useLiveChat";

const POLL = 15_000;

// La page d'un live, plein écran: la vidéo, le chat par-dessus, le bouton
// cadeau. L'état (en attente, en direct, terminé) est redemandé au
// serveur toutes les 15 s, qui le revérifie lui-même auprès de Cloudflare.
export function LiveViewer({ initial }: { initial: PublicLive }) {
  const router = useRouter();
  const { userId } = useSession();
  const [live, setLive] = useState(initial);
  const [muted, setMuted] = useState(true);
  const [gift, setGift] = useState<SupportTarget | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    loadGifts();
  }, []);

  useEffect(() => {
    if (live.status === "ended") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/live/${live.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setLive(await res.json());
    }, POLL);
    return () => clearInterval(t);
  }, [live.id, live.status]);

  const onGift = useCallback(async (m: LiveMessage) => {
    const g = (await loadGifts()).find((x) => x.slug === m.gift_slug);
    if (!g || !m.author) return;
    const message = m.body.startsWith("a envoyé ") ? null : m.body;
    setBursts((q) => [...q, { key: `live-${m.id}`, gift: g, fan: m.author!, message }]);
  }, []);
  const chat = useLiveChat(live.id, onGift);

  const isCreator = userId === live.creatorId;
  const cat = categoryOf(live.category);
  const close = () => (window.history.length > 1 ? router.back() : router.push("/"));

  async function share() {
    const url = `${location.origin}/live/${live.id}`;
    const text = `${live.creator?.display_name} est en direct sur TubAfrik : ${live.title}`;
    if (navigator.share) await navigator.share({ title: "TubAfrik Live", text, url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
  }

  return (
    <main className="fixed inset-0 bg-black">
      {live.status === "live" && live.hls ? (
        <LivePlayer src={live.hls} muted={muted} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <Avatar src={live.creator?.avatar_url} name={live.creator?.display_name ?? "?"} size={88}
              className={live.status === "ended" ? "opacity-60" : "ring-4 ring-like/70"} />
            <p className="mt-5 text-lg font-semibold">
              {live.status === "ended" ? "Le live est terminé" : "Le live va commencer…"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {live.status === "ended"
                ? `Abonne-toi à ${live.creator?.display_name} pour ne pas rater le prochain.`
                : "Reste là, la vidéo apparaîtra toute seule."}
            </p>
            {live.status === "ended" && (
              <Link href={`/u/${live.creator?.username}`} className="bg-brand mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
                Voir son profil
              </Link>
            )}
          </div>
        </div>
      )}

      {bursts[0] && (
        <GiftBurst key={bursts[0].key} burst={bursts[0]} onDone={() => setBursts((q) => q.slice(1))} />
      )}

      {/* En-tête: créateur, badge EN DIRECT, titre */}
      <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10">
        <div className="pointer-events-auto mt-2 flex items-center gap-2">
          <Link href={`/u/${live.creator?.username}`} className="flex min-w-0 items-center gap-2 rounded-full bg-black/40 py-1 pl-1 pr-3 backdrop-blur">
            <Avatar src={live.creator?.avatar_url} name={live.creator?.display_name ?? "?"} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{live.creator?.display_name}</span>
              <span className="block truncate text-[11px] text-white/70">{cat ? `${cat.emoji} ${cat.name}` : "Live"}</span>
            </span>
          </Link>
          {live.status === "live" && (
            <span className="rounded-md bg-like px-2 py-0.5 text-[11px] font-bold tracking-wide">EN DIRECT</span>
          )}
          <button onClick={close} aria-label="Quitter le live" className="ml-auto rounded-full bg-black/40 p-2 backdrop-blur">
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium text-white/90">{live.title}</p>
      </header>

      {live.status === "live" && muted && (
        <button
          onClick={() => setMuted(false)}
          className="absolute left-1/2 top-1/3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold backdrop-blur"
        >
          <VolumeOffIcon width={18} height={18} /> Touche pour le son
        </button>
      )}

      {/* Bas: chat + actions */}
      <div className="pb-safe absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-16">
        <LiveChat
          messages={chat.messages}
          creatorId={live.creatorId}
          canWrite={live.status === "live"}
          onSend={(b) => (userId ? chat.send(userId, b) : Promise.resolve("Connecte-toi pour discuter."))}
          onRemove={chat.remove}
          actions={
            <>
              {!muted && live.status === "live" && (
                <button onClick={() => setMuted(true)} aria-label="Couper le son" className="grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur">
                  <VolumeOnIcon width={20} height={20} />
                </button>
              )}
              <button onClick={share} aria-label="Partager le live" className="grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur">
                <ShareIcon width={20} height={20} />
              </button>
              {!isCreator && live.status !== "ended" && live.creator && (
                <button
                  onClick={() =>
                    setGift({
                      creatorId: live.creatorId,
                      username: live.creator!.username,
                      displayName: live.creator!.display_name,
                      avatarUrl: live.creator!.avatar_url,
                      liveId: live.id,
                    })
                  }
                  aria-label="Offrir un cadeau"
                  className="grid h-10 w-10 place-items-center rounded-full bg-gold text-black"
                >
                  <GiftIcon width={20} height={20} />
                </button>
              )}
            </>
          }
        />
      </div>

      <SupportSheet target={gift} onClose={() => setGift(null)} />
    </main>
  );
}
