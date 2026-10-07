import { Feed } from "@/components/feed/Feed";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { fetchFeed, newSeed, parseFeedParams } from "@/lib/feed";

export default async function Home({ searchParams }: PageProps<"/">) {
  const filter = parseFeedParams(await searchParams);
  const seed = newSeed();
  const items = await fetchFeed(filter, seed);

  return (
    <main className="h-dvh overflow-hidden bg-bg">
      <Feed
        key={`${filter.mode}:${filter.category}:${filter.game}`}
        initialItems={items}
        initialOffset={items.length}
        filter={filter}
        seed={seed}
      />
      <BottomNav overlay />
      <InstallPrompt />
    </main>
  );
}
