"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FeedItem } from "@/lib/types";
import { GAMES } from "@/lib/games";
import { CATEGORIES } from "@/lib/categories";
import { bumpInterest, topInterests } from "@/lib/interests";
import { loginHref, useSession } from "../session";
import { LeafIcon, SearchIcon } from "../icons";
import { LogoMark } from "../Logo";
import { VideoSlide } from "./VideoSlide";
import { CommentsSheet } from "./CommentsSheet";
import { ShareSheet } from "./ShareSheet";
import { MoreSheet } from "./MoreSheet";
import { SupportSheet, type SupportTarget } from "../support/SupportSheet";
import { anonKey, useFeedSettings } from "./useFeedSettings";

export type FeedMode = "pour-toi" | "abonnements";
const PAGE = 8;

export type FeedFilterProps = { mode: FeedMode; categories: string[]; games: string[] };

export function Feed({
  initialItems,
  initialOffset,
  filter,
  seed,
  liveCount = 0,
}: {
  initialItems: FeedItem[];
  /** Combien d'éléments du fil ont déjà été lus côté serveur (hors vidéo partagée). */
  initialOffset: number;
  filter: FeedFilterProps;
  /** Graine tirée par le serveur: la suite du fil garde le même ordre. */
  seed: string;
  /** Lives à l'antenne: un bouton LIVE apparaît en haut à gauche. */
  liveCount?: number;
}) {
  const { mode, categories, games } = filter;
  const router = useRouter();
  const { userId } = useSession();
  const { dataSaver } = useFeedSettings();
  const [items, setItems] = useState(initialItems);
  const [offset, setOffset] = useState(initialOffset);
  const [done, setDone] = useState(initialItems.length === 0);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<FeedItem | null>(null);
  const [moreItem, setMoreItem] = useState<FeedItem | null>(null);
  const [giftTarget, setGiftTarget] = useState<SupportTarget | null>(null);
  const [giftsOn, setGiftsOn] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const checked = useRef(new Set<string>());
  const loadMoreRef = useRef<() => void>(() => {});

  // ── Vidéo active = celle qui occupe au moins 60 % de l'écran ──
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const index = Number((e.target as HTMLElement).dataset.index);
          setActive(index);
          // On charge la suite trois vidéos avant la fin.
          if (index >= root.querySelectorAll("[data-index]").length - 3) loadMoreRef.current();
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  // Le bouton cadeau n'apparaît que quand le catalogue est configuré.
  useEffect(() => {
    supabaseBrowser().from("tub_gifts").select("slug", { count: "exact", head: true })
      .then(({ count }) => setGiftsOn((count ?? 0) > 0));
  }, []);

  // ── Pagination ──
  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const { data } = await supabaseBrowser().rpc("tub_feed_v3", {
      p_mode: mode,
      p_categories: categories,
      p_games: games,
      p_interests: userId ? null : topInterests(),
      p_seed: seed,
      p_anon_key: userId ? null : anonKey(),
      p_limit: PAGE,
      p_offset: offset,
    });
    const page = (data as FeedItem[] | null) ?? [];
    setOffset((o) => o + page.length);
    setItems((prev) => {
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...page.filter((i) => !seen.has(i.id))];
    });
    if (page.length < PAGE) setDone(true);
    setLoading(false);
  }, [loading, done, mode, categories, games, offset, seed, userId]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // ── Ce que l'utilisateur a déjà aimé / qui il suit, pour les nouvelles vidéos ──
  useEffect(() => {
    if (!userId) return;
    const fresh = items.filter((i) => !checked.current.has(i.id));
    if (!fresh.length) return;
    fresh.forEach((i) => checked.current.add(i.id));
    const supabase = supabaseBrowser();
    supabase
      .from("tub_likes").select("video_id").eq("user_id", userId).in("video_id", fresh.map((i) => i.id))
      .then(({ data }) => data?.length && setLiked((s) => new Set([...s, ...data.map((d) => d.video_id)])));
    const authors = [...new Set(fresh.map((i) => i.author_id))];
    supabase
      .from("tub_follows").select("followee_id").eq("follower_id", userId).in("followee_id", authors)
      .then(({ data }) => data?.length && setFollowing((s) => new Set([...s, ...data.map((d) => d.followee_id)])));
  }, [items, userId]);

  // ── Clavier sur ordinateur ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!scroller.current || document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        scroller.current.scrollBy({ top: (e.key === "ArrowDown" ? 1 : -1) * scroller.current.clientHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patchItem = (id: string, patch: (i: FeedItem) => Partial<FeedItem>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch(i) } : i)));

  function requireLogin() {
    if (userId) return false;
    router.push(loginHref());
    return true;
  }

  // Like optimiste: l'écran réagit tout de suite, on annule si la base refuse.
  async function toggleLike(item: FeedItem, like: boolean) {
    if (requireLogin()) return;
    const supabase = supabaseBrowser();
    const apply = (on: boolean) => {
      setLiked((s) => {
        const n = new Set(s);
        if (on) n.add(item.id);
        else n.delete(item.id);
        return n;
      });
      patchItem(item.id, (i) => ({ likes_count: Math.max(0, i.likes_count + (on ? 1 : -1)) }));
    };
    apply(like);
    if (like) bumpInterest(item.category, 3);
    const { error } = like
      ? await supabase.from("tub_likes").insert({ user_id: userId, video_id: item.id })
      : await supabase.from("tub_likes").delete().eq("user_id", userId!).eq("video_id", item.id);
    if (error && error.code !== "23505") apply(!like);
  }

  async function follow(authorId: string) {
    if (requireLogin()) return;
    setFollowing((s) => new Set(s).add(authorId));
    const { error } = await supabaseBrowser().from("tub_follows").insert({ follower_id: userId, followee_id: authorId });
    if (error && error.code !== "23505") {
      setFollowing((s) => {
        const n = new Set(s);
        n.delete(authorId);
        return n;
      });
    }
  }

  function recordView(item: FeedItem) {
    bumpInterest(item.category, 1);
    supabaseBrowser().rpc("tub_record_view", { p_video: item.id, p_anon_key: userId ? null : anonKey() }).then(() => {});
  }

  const commentsItem = items.find((i) => i.id === commentsFor);

  return (
    <div
      className="relative mx-auto h-dvh w-full max-w-[calc(100dvh*9/16)] bg-black sm:border-x sm:border-line"
      // Hauteur de l'en-tête: la ligne des jeux s'ajoute sous les catégories.
      style={{ "--feed-top": categories.includes("gaming") ? "140px" : "108px" } as React.CSSProperties}
    >
      <FeedHeader mode={mode} categories={categories} games={games} dataSaver={dataSaver} liveCount={liveCount} />

      <div ref={scroller} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {items.map((item, index) => (
          <section key={item.id} data-index={index} className="h-dvh snap-start snap-always" aria-label={`Vidéo de ${item.display_name}`}>
            <VideoSlide
              item={item}
              active={index === active}
              load={Math.abs(index - active) <= 1}
              liked={liked.has(item.id)}
              following={following.has(item.author_id)}
              isSelf={item.author_id === userId}
              giftable={giftsOn}
              onLike={(like) => toggleLike(item, like)}
              onFollow={() => follow(item.author_id)}
              onComments={() => setCommentsFor(item.id)}
              onShare={() => setShareItem(item)}
              onMore={() => setMoreItem(item)}
              onGift={() =>
                setGiftTarget({
                  creatorId: item.author_id,
                  username: item.username,
                  displayName: item.display_name,
                  avatarUrl: item.avatar_url,
                  videoId: item.id,
                })
              }
              onViewed={() => recordView(item)}
            />
          </section>
        ))}

        {items.length === 0 && <EmptyFeed mode={mode} filtered={categories.length > 0} loggedIn={!!userId} />}

        {items.length > 0 && done && (
          <section className="grid h-dvh snap-start place-items-center px-8 text-center">
            <div>
              <p className="text-4xl">🏁</p>
              <p className="mt-3 font-semibold">Tu as tout vu !</p>
              <p className="mt-1 text-sm text-muted">Reviens plus tard, ou publie ta propre vidéo.</p>
              <Link href="/publier" className="bg-brand mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
                Publier une vidéo
              </Link>
            </div>
          </section>
        )}
      </div>

      <CommentsSheet
        videoId={commentsFor}
        count={commentsItem?.comments_count ?? 0}
        creatorId={commentsItem?.author_id ?? null}
        onClose={() => setCommentsFor(null)}
        onCountChange={(d) => commentsFor && patchItem(commentsFor, (i) => ({ comments_count: i.comments_count + d }))}
      />
      <ShareSheet item={shareItem} onClose={() => setShareItem(null)} />
      <SupportSheet target={giftTarget} onClose={() => setGiftTarget(null)} />
      <MoreSheet
        item={moreItem}
        onClose={() => setMoreItem(null)}
        onRemoved={(id) => setItems((list) => list.filter((i) => i.id !== id))}
      />
    </div>
  );
}

function feedHref(mode: FeedMode, categories: string[], games: string[] = []) {
  const p = new URLSearchParams();
  if (mode !== "pour-toi") p.set("mode", mode);
  if (categories.length) p.set("cat", categories.join(","));
  if (games.length) p.set("jeu", games.join(","));
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

/** Coche ou décoche une valeur. */
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FeedHeader({
  mode,
  categories,
  games,
  dataSaver,
  liveCount,
}: {
  mode: FeedMode;
  categories: string[];
  games: string[];
  dataSaver: boolean;
  liveCount: number;
}) {
  const tab = (m: FeedMode, label: string) => (
    <Link
      href={feedHref(m, categories, games)}
      scroll={false}
      aria-current={mode === m ? "page" : undefined}
      className={`relative px-1 pb-1.5 text-[15px] font-semibold transition ${mode === m ? "text-white" : "text-white/60"}`}
    >
      {label}
      {mode === m && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white" />}
    </Link>
  );

  // La puce choisie peut être loin à droite: on la ramène au centre.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelectorAll("[aria-current=page]").forEach((el) =>
      el.scrollIntoView({ inline: "center", block: "nearest" }),
    );
  }, [categories, games]);

  return (
    <header ref={navRef} className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 via-black/30 to-transparent pb-6">
      <div className="pointer-events-auto relative flex h-12 items-center justify-center gap-5 px-4">
        {liveCount > 0 ? (
          <Link href="/lives" aria-label={`${liveCount} live${liveCount > 1 ? "s" : ""} en direct`}
            className="absolute left-3 flex items-center gap-1.5 rounded-md bg-like px-2 py-1 text-[11px] font-bold tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </Link>
        ) : (
          <span className="absolute left-4"><LogoMark size={28} /></span>
        )}
        {tab("abonnements", "Abonnements")}
        {tab("pour-toi", "Pour toi")}
        {dataSaver && (
          <span title="Économie de data activée" className="absolute right-14 text-ok">
            <LeafIcon width={18} height={18} />
          </span>
        )}
        <Link href="/recherche" aria-label="Chercher un créateur" className="absolute right-3 p-1.5 text-white">
          <SearchIcon width={22} height={22} />
        </Link>
      </div>
      <nav aria-label="Filtrer par catégorie" className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto px-4 pt-1">
        <Chip href={feedHref(mode, [])} active={categories.length === 0}>Tout</Chip>
        {CATEGORIES.map((c) => {
          const next = toggle(categories, c.slug);
          // Décocher le gaming retire aussi les jeux choisis.
          return (
          <Chip key={c.slug} href={feedHref(mode, next, next.includes("gaming") ? games : [])} active={categories.includes(c.slug)}>
            {c.emoji} {c.name}
          </Chip>
          );
        })}
      </nav>
      {categories.includes("gaming") && (
        <nav aria-label="Filtrer par jeu" className="no-scrollbar pointer-events-auto mt-2 flex gap-2 overflow-x-auto px-4">
          <Chip href={feedHref(mode, categories)} active={games.length === 0} small>Tous les jeux</Chip>
          {GAMES.map((g) => (
            <Chip key={g.slug} href={feedHref(mode, categories, toggle(games, g.slug))} active={games.includes(g.slug)} small>
              {g.name}
            </Chip>
          ))}
        </nav>
      )}
    </header>
  );
}

function Chip({ href, active, small, children }: { href: string; active: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 font-medium backdrop-blur transition ${small ? "py-0.5 text-[11px]" : "py-1 text-xs"} ${
        active ? "bg-white text-bg" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyFeed({ mode, filtered, loggedIn }: { mode: FeedMode; filtered: boolean; loggedIn: boolean }) {
  const followMode = mode === "abonnements";
  return (
    <section className="grid h-dvh place-items-center px-8 text-center">
      <div>
        <p className="text-5xl">{followMode ? "👀" : "🎬"}</p>
        <p className="mt-4 text-lg font-semibold">
          {followMode && !loggedIn
            ? "Connecte-toi pour voir tes abonnements"
            : followMode
              ? "Tu ne suis encore personne"
              : filtered
                ? "Pas encore de vidéo ici"
                : "Aucune vidéo pour l'instant"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {followMode ? "Abonne-toi aux créateurs que tu kiffes depuis « Pour toi »." : "Sois le premier : publie ta meilleure vidéo !"}
        </p>
        <Link
          href={followMode && !loggedIn ? "/connexion?next=/?mode=abonnements" : followMode ? "/" : "/publier"}
          className="bg-brand mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg"
        >
          {followMode && !loggedIn ? "Se connecter" : followMode ? "Découvrir" : "Publier une vidéo"}
        </Link>
      </div>
    </section>
  );
}
