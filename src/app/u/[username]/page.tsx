/* eslint-disable @next/next/no-img-element -- miniatures servies par le CDN Bunny */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import type { Profile } from "@/lib/types";
import { compact } from "@/lib/format";
import { gameName } from "@/lib/games";
import { countryName, flag } from "@/lib/countries";
import { previewUrl, thumbnailUrl } from "@/lib/media";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { FollowButton } from "@/components/profile/FollowButton";
import { PlayIcon } from "@/components/icons";

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
    .select("id,username,display_name,avatar_url,bio,main_game,country,followers_count,following_count,videos_count")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data as Profile | null;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = await loadProfile((await params).username);
  if (!p) return { title: "Profil introuvable" };
  return {
    title: `${p.display_name} (@${p.username})`,
    description: p.bio || `Les clips de ${p.display_name} sur TubAfrik`,
    openGraph: { images: p.avatar_url ? [p.avatar_url] : [] },
  };
}

export default async function ProfilePage({ params }: PageProps<"/u/[username]">) {
  const p = await loadProfile((await params).username);
  if (!p) notFound();

  const supabase = await supabaseServer();
  const { user } = await getSession();
  const isSelf = user?.id === p.id;

  const [{ data: videos }, { data: follow }] = await Promise.all([
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
  ]);
  const tiles = (videos as VideoTile[] | null) ?? [];
  const game = gameName(p.main_game);
  const country = countryName(p.country);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="relative px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-6 text-center">
        <div className="relative flex flex-col items-center">
          <Avatar src={p.avatar_url} name={p.display_name} size={96} className="ring-4 ring-bg" />
          <h1 className="mt-3 text-xl font-bold">{p.display_name}</h1>
          <p className="text-sm text-muted">@{p.username}</p>

          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            {game && <span className="rounded-full bg-surface-2 px-3 py-1">🎮 {game}</span>}
            {country && <span className="rounded-full bg-surface-2 px-3 py-1">{flag(p.country)} {country}</span>}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-8 text-center">
            {[
              [p.following_count, "Abonnements"],
              [p.followers_count, "Abonnés"],
              [p.videos_count, "Vidéos"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-lg font-bold">{compact(Number(n))}</dd>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </dl>

          {p.bio && <p className="mt-4 max-w-sm whitespace-pre-line text-sm text-text/90">{p.bio}</p>}

          <div className="mt-5 w-full max-w-xs">
            {isSelf ? (
              <Link href="/profil/modifier" className="block rounded-full border border-line bg-surface py-2.5 text-sm font-semibold hover:bg-surface-2">
                Modifier le profil
              </Link>
            ) : (
              <FollowButton profileId={p.id} initialFollowing={!!follow} />
            )}
          </div>
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
