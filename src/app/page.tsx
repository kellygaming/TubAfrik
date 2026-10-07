import { Feed } from "@/components/feed/Feed";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { fetchFeed, parseFeedParams } from "@/lib/feed";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { mode, game } = parseFeedParams(await searchParams);
  const items = await fetchFeed(mode, game);

  return (
    <main className="h-dvh overflow-hidden bg-bg">
      <Feed key={`${mode}:${game}`} initialItems={items} initialOffset={items.length} mode={mode} game={game} />
      <BottomNav overlay />
      <InstallPrompt />
    </main>
  );
}
