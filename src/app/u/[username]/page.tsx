/* eslint-disable @next/next/no-img-element -- miniatures servies par le CDN Bunny */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { onAirCutoff } from "@/lib/lives";
import { getSession } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { compact } from "@/lib/format";
import { gameName } from "@/lib/games";
import { videoTag } from "@/lib/categories";
import { countryName, flag } from "@/lib/countries";
import { previewUrl, thumbnailUrl } from "@/lib/media";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { FollowButton } from "@/components/profile/FollowButton";
import { PlayIcon, WalletIcon } from "@/components/icons";
import { SupportButton } from "@/components/support/SupportButton";
import { fcfa } from "@/lib/gifts";

type TopFan = {
  fan_id: string;
  total_fcfa: number;
  fan: { username: string; display_name: string; avatar_url: string | null } | null;
};

type VideoTile = {
  id: string;
  bunny_id: string;
  thumbnail_file: string | null;
  status: string;
  views_count: number;
};

async function loadProfile(username: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("tub_profiles")
    .select("id,username,display_name,avatar_url,bio,main_game,main_category,country,followers_count,following_count,videos_count")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data as Profile | null;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = await loadProfile((await params).username);
  if (!p) return { title: "Profil introuvable" };
  return {
    title: `${p.display_name} (@${p.username})`,
    description: p.bio || `Les vidéos de ${p.display_name} sur TubAfrik`,
    openGraph: { images: p.avatar_url ? [p.avatar_url] : [] },
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const p = await loadProfile((await params).username);
  if (!p) notFound();

  const supabase = await supabaseServer();
  const { user } = await getSession();
  const isSelf = user?.id === p.id;

  const now = new Date().toISOString();
  const [{ data: videos }, { data: follow }, { data: fans }, { count: giftsOn }, { data: onAir }, { data: totals }] = await Promise.all([
    supabase
      .from("tub_videos")
      .select("id,bunny_id,thumbnail_file,status,views_count")
      .eq("author_id", p.id)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(60),
    user && !isSelf
      ? supabase.from("tub_follows").select("follower_id").eq("follower_id", user.id).eq("followee_id", p.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("tub_vip")
      .select("fan_id,total_fcfa,fan:tub_profiles!tub_vip_fan_id_fkey(username,display_name,avatar_url)")
      .eq("creator_id", p.id)
      .gt("expires_at", now)
      .order("total_fcfa", { ascending: false })
      .limit(10),
    supabase.from("tub_gifts").select("slug", { count: "exact", head: true }),
    supabase.from("tub_lives").select("id").eq("creator_id", p.id).eq("status", "live")
      .gte("last_live_at", onAirCutoff()).maybeSingle(),
    // Totaux de toutes les vidéos publiées (pas seulement celles affichées).
    supabase.from("tub_videos").select("views_count,likes_count").eq("author_id", p.id).eq("status", "ready"),
  ]);
  const totalViews = (totals ?? []).reduce((n, v) => n + (v.views_count ?? 0), 0);
  const totalLikes = (totals ?? []).reduce((n, v) => n + (v.likes_count ?? 0), 0);
  const topFans = (fans as unknown as TopFan[] | null) ?? [];
  const viewerIsVip = !!user && topFans.some((f) => f.fan_id === user.id);
  const tiles = (videos as VideoTile[] | null) ?? [];
  const tag = videoTag(p.main_category, p.main_game, gameName);
  const country = countryName(p.country);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="relative px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-center">
        <div className="relative flex flex-col items-center">
          {onAir ? (
            <Link href={`/live/${onAir.id}`} aria-label={`${p.display_name} est en direct`} className="relative">
              <Avatar src={p.avatar_url} name={p.display_name} size={96} className="ring-4 ring-like" />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-like px-2 py-0.5 text-[10px] font-bold text-white">EN DIRECT</span>
            </Link>
          ) : (
            <Avatar src={p.avatar_url} name={p.display_name} size={96} className="ring-4 ring-bg" />
          )}
          <h1 className="mt-3 text-xl font-bold">{p.display_name}</h1>
          <p className="text-sm text-muted">@{p.username}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            {tag && <span className="rounded-full bg-surface-2 px-3 py-1">{tag.label}</span>}
            {country && <span className="rounded-full bg-surface-2 px-3 py-1">{flag(p.country)} {country}</span>}
          </div>

          <dl className="mt-5 grid grid-cols-4 gap-1 text-center sm:gap-6">
            {(
              [
                [p.following_count, "Abonnements", `/u/${p.username}/abonnes?liste=abonnements`],
                [p.followers_count, "Abonnés", `/u/${p.username}/abonnes`],
                [totalLikes, "J'aime", null],
                [totalViews, "Vues", null],
              ] as const
            ).map(([n, label, href]) => {
              const inner = (
                <>
                  <dd className="text-lg font-bold">{compact(Number(n))}</dd>
                  <span className="text-xs text-muted">{label}</span>
                </>
              );
              return (
                <div key={label} className="min-w-0 px-1">
                  <dt className="sr-only">{label}</dt>
                  {href ? (
                    <Link href={href} className="block rounded-xl py-1 transition hover:bg-surface-2">{inner}</Link>
                  ) : (
                    <div className="py-1">{inner}</div>
                  )}
                </div>
              );
            })}
          </dl>

          {p.bio && <p className="mt-4 max-w-sm whitespace-pre-line text-sm text-text/90">{p.bio}</p>}

          <div className="mt-5 flex w-full max-w-xs gap-2">
            {isSelf ? (
              <>
                <Link href="/profil/modifier" className="flex-1 rounded-full border border-line bg-surface py-2.5 text-sm font-semibold hover:bg-surface-2">
                  Modifier le profil
                </Link>
                <Link href="/gains" className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-bold text-black">
                  <WalletIcon width={18} height={18} /> Mes gains
                </Link>
              </>
            ) : (
              <>
                <div className="flex-1"><FollowButton profileId={p.id} initialFollowing={!!follow} /></div>
                {(giftsOn ?? 0) > 0 && (
                  <SupportButton target={{ creatorId: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url }} />
                )}
              </>
            )}
          </div>
          {isSelf && (
            <p className="mt-3 text-xs text-muted">
              <Link href="/cauris" className="hover:text-text">🐚 Mes Cauris</Link>
              <span className="mx-2">·</span>
              <Link href="/gagner" className="hover:text-text">💰 Gagner</Link>
              <span className="mx-2">·</span>
              <Link href="/mission" className="hover:text-text">Notre mission</Link>
            </p>
          )}
          {viewerIsVip && (
            <p className="mt-3 text-xs text-muted"><span className="vip-badge">★ VIP</span> Tu es VIP de {p.display_name}</p>
          )}

          {topFans.length > 0 && (
            <section className="mt-6 w-full">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Meilleurs fans</h2>
              <ul className="no-scrollbar mt-3 flex justify-center gap-4 overflow-x-auto">
                {topFans.map((f, i) => (
                  <li key={f.fan_id} className="shrink-0">
                    <Link href={`/u/${f.fan?.username}`} className="flex w-16 flex-col items-center">
                      <span className="relative">
                        <Avatar src={f.fan?.avatar_url} name={f.fan?.display_name ?? "?"} size={48}
                          className={i === 0 ? "ring-2 ring-gold" : "ring-1 ring-white/20"} />
                        {i < 3 && (
                          <span className="absolute -right-1 -top-1 text-sm">{["👑", "🥈", "🥉"][i]}</span>
                        )}
                      </span>
                      <span className="mt-1 w-full truncate text-[11px]">{f.fan?.display_name}</span>
                      {isSelf && <span className="text-[10px] text-gold">{fcfa(f.total_fcfa)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </header>

      {tiles.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <p className="text-4xl">🎬</p>
          <p className="mt-3 font-semibold">{isSelf ? "Publie ta première vidéo" : "Pas encore de vidéo"}</p>
          {isSelf && (
            <Link href="/publier" className="bg-brand mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
              Publier
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-0.5">
          {tiles.map((v) => (
            <li key={v.id} className="relative aspect-[9/16] overflow-hidden bg-surface">
              {v.status === "ready" ? (
                <Link href={`/v/${v.id}`} className="group block h-full">
                  <img src={thumbnailUrl(v.bunny_id, v.thumbnail_file)} alt="" loading="lazy"
                    className="h-full w-full object-cover transition group-hover:opacity-0" />
                  <img src={previewUrl(v.bunny_id)} alt="" loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-0 transition group-hover:opacity-100" />
                  <span className="text-shadow absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold">
                    <PlayIcon width={12} height={12} /> {compact(v.views_count)}
                  </span>
                </Link>
              ) : (
                <StatusTile status={v.status} />
              )}
            </li>
          ))}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}

function StatusTile({ status }: { status: string }) {
  const label: Record<string, [string, string]> = {
    uploading: ["⏳", "Envoi…"],
    processing: ["⚙️", "Traitement…"],
    failed: ["⚠️", "Échec"],
    review: ["🛡️", "En vérification"],
  };
  const [icon, text] = label[status] ?? ["…", status];
  return (
    <div className="grid h-full place-items-center bg-surface-2 text-center text-xs text-muted">
      <div>
        <p className="text-2xl">{icon}</p>
        <p className="mt-1">{text}</p>
      </div>
    </div>
  );
}
