"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FeedItem } from "@/lib/types";
import { GAMES } from "@/lib/games";
import { loginHref, useSession } from "../session";
import { LeafIcon, SearchIcon } from "../icons";
import { LogoMark } from "../Logo";
import { VideoSlide } from "./VideoSlide";
import { CommentsSheet } from "./CommentsSheet";
import { ShareSheet } from "./ShareSheet";
import { MoreSheet } from "./MoreSheet";
import { anonKey, useFeedSettings } from "./useFeedSettings";

export type FeedMode = "pour-toi" | "abonnements";
const PAGE = 8;

export function Feed({
  initialItems,
  initialOffset,
  mode,
  game,
}: {
  initialItems: FeedItem[];
  /** Combien d'éléments du fil ont déjà été lus côté serveur (hors vidéo partagée). */
  initialOffset: number;
  mode: FeedMode;
  game: string | null;
}) {
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

  // ── Pagination ──
  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const { data } = await supabaseBrowser().rpc("tub_feed", {
      p_mode: mode,
      p_game: game,
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
  }, [loading, done, mode, game, offset]);

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
    supabaseBrowser().rpc("tub_record_view", { p_video: item.id, p_anon_key: userId ? null : anonKey() }).then(() => {});
  }

  const commentsItem = items.find((i) => i.id === commentsFor);

  return (
    <div className="relative mx-auto h-dvh w-full max-w-[calc(100dvh*9/16)] bg-black sm:border-x sm:border-line">
      <FeedHeader mode={mode} game={game} dataSaver={dataSaver} />

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
              onLike={(like) => toggleLike(item, like)}
              onFollow={() => follow(item.author_id)}
              onComments={() => setCommentsFor(item.id)}
              onShare={() => setShareItem(item)}
              onMore={() => setMoreItem(item)}
              onViewed={() => recordView(item)}
            />
          </section>
        ))}

        {items.length === 0 && <EmptyFeed mode={mode} game={game} loggedIn={!!userId} />}

        {items.length > 0 && done && (
          <section className="grid h-dvh snap-start place-items-center px-8 text-center">
            <div>
              <p className="text-4xl">🏁</p>
              <p className="mt-3 font-semibold">Tu as tout vu !</p>
              <p className="mt-1 text-sm text-muted">Reviens plus tard, ou publie ton propre clip.</p>
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
        onClose={() => setCommentsFor(null)}
        onCountChange={(d) => commentsFor && patchItem(commentsFor, (i) => ({ comments_count: i.comments_count + d }))}
      />
      <ShareSheet item={shareItem} onClose={() => setShareItem(null)} />
      <MoreSheet
        item={moreItem}
        onClose={() => setMoreItem(null)}
        onRemoved={(id) => setItems((list) => list.filter((i) => i.id !== id))}
      />
    </div>
  );
}

function feedHref(mode: FeedMode, game: string | null) {
  const p = new URLSearchParams();
  if (mode !== "pour-toi") p.set("mode", mode);
  if (game) p.set("jeu", game);
  const q = p.toString();
  return q ? `/?${q}` : "/";
}

function FeedHeader({ mode, game, dataSaver }: { mode: FeedMode; game: string | null; dataSaver: boolean }) {
  const tab = (m: FeedMode, label: string) => (
    <Link
      href={feedHref(m, game)}
      scroll={false}
      aria-current={mode === m ? "page" : undefined}
      className={`relative px-1 pb-1.5 text-[15px] font-semibold transition ${mode === m ? "text-white" : "text-white/60"}`}
    >
      {label}
      {mode === m && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-white" />}
    </Link>
  );

  return (
    <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/70 via-black/30 to-transparent pb-6">
      <div className="pointer-events-auto relative flex h-12 items-center justify-center gap-5 px-4">
        <span className="absolute left-4"><LogoMark size={28} /></span>
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
      <nav aria-label="Filtrer par jeu" className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto px-4 pt-1">
        <Chip href={feedHref(mode, null)} active={!game}>Tous</Chip>
        {GAMES.map((g) => (
          <Chip key={g.slug} href={feedHref(mode, g.slug)} active={game === g.slug}>
            {g.name}
          </Chip>
        ))}
      </nav>
    </header>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium backdrop-blur transition ${
        active ? "bg-white text-bg" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyFeed({ mode, game, loggedIn }: { mode: FeedMode; game: string | null; loggedIn: boolean }) {
  const followMode = mode === "abonnements";
  return (
    <section className="grid h-dvh place-items-center px-8 text-center">
      <div>
        <p className="text-5xl">{followMode ? "👀" : "🎮"}</p>
        <p className="mt-4 text-lg font-semibold">
          {followMode && !loggedIn
            ? "Connecte-toi pour voir tes abonnements"
            : followMode
              ? "Tu ne suis encore personne"
              : game
                ? "Pas encore de vidéo pour ce jeu"
                : "Aucune vidéo pour l'instant"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {followMode ? "Abonne-toi aux gamers que tu kiffes depuis « Pour toi »." : "Sois le premier : publie ton meilleur clip !"}
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
