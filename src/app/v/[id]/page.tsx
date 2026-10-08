import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Feed } from "@/components/feed/Feed";
import { BottomNav } from "@/components/BottomNav";
import { fetchFeed, fetchFeedItem, newSeed } from "@/lib/feed";
import { thumbnailUrl } from "@/lib/media";
import { gameName } from "@/lib/games";
import { videoTag } from "@/lib/categories";

// Page d'arrivée des liens partagés (WhatsApp surtout): la vidéo
// partagée d'abord, puis le fil « Pour toi » pour retenir le visiteur.
export async function generateMetadata({ params }: PageProps<"/v/[id]">): Promise<Metadata> {
  const item = await fetchFeedItem((await params).id);
  if (!item) return { title: "Vidéo introuvable" };
  const tag = videoTag(item.category, item.game, gameName);
  const title = `${item.display_name} (@${item.username})${tag ? ` · ${tag.label.replace(/^\S+ /, "")}` : ""}`;
  const description = item.caption || `Regarde la vidéo de @${item.username} sur TubAfrik`;
  const image = thumbnailUrl(item.bunny_id, item.thumbnail_file);
  return {
    title,
    description,
    openGraph: { title, description, type: "video.other", images: [{ url: image, width: item.width ?? undefined, height: item.height ?? undefined }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function VideoPage({ params }: PageProps<"/v/[id]">) {
  const item = await fetchFeedItem((await params).id);
  if (!item) notFound();
  const filter = { mode: "pour-toi" as const, categories: [], games: [] };
  const seed = newSeed();
  const rest = await fetchFeed(filter, seed);

  return (
    <main className="h-dvh overflow-hidden bg-bg">
      <Feed
        initialItems={[item, ...rest.filter((i) => i.id !== item.id)]}
        initialOffset={rest.length}
        filter={filter}
        seed={seed}
      />
      <BottomNav overlay />
    </main>
  );
}
