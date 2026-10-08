import { Feed } from "@/components/feed/Feed";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { fetchFeed, newSeed, parseFeedParams } from "@/lib/feed";
import { supabaseServer } from "@/lib/supabase/server";
import { onAirCutoff } from "@/lib/lives";

// Combien de lives à l'antenne (contrôle récent): sans appel à Cloudflare,
// pour ne pas ralentir l'accueil. La page /lives, elle, revérifie.
async function liveCount() {
  const { count } = await (await supabaseServer())
    .from("tub_lives").select("id", { count: "exact", head: true })
    .eq("status", "live").gte("last_live_at", onAirCutoff());
  return count ?? 0;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const filter = parseFeedParams(await searchParams);
  const seed = newSeed();
  const [items, lives] = await Promise.all([fetchFeed(filter, seed), liveCount()]);

  return (
    <main className="h-dvh overflow-hidden bg-bg">
      <Feed
        key={`${filter.mode}:${filter.category}:${filter.game}`}
        initialItems={items}
        initialOffset={items.length}
        filter={filter}
        seed={seed}
        liveCount={lives}
      />
      <BottomNav overlay />
      <InstallPrompt />
    </main>
  );
}
