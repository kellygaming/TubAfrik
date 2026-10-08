import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLive, publicLive, refreshLive } from "@/lib/lives";
import { LiveViewer } from "@/components/live/LiveViewer";

export async function generateMetadata({ params }: PageProps<"/live/[id]">): Promise<Metadata> {
  const live = await getLive((await params).id);
  if (!live) return { title: "Live introuvable" };
  const who = live.creator?.display_name ?? "Un TubAfrikain";
  return {
    title: `${who} en direct`,
    description: live.title,
    openGraph: { title: `🔴 ${who} est en direct sur TubAfrik`, description: live.title },
  };
}

export default async function LivePage({ params }: PageProps<"/live/[id]">) {
  const live = await getLive((await params).id);
  if (!live) notFound();
  return <LiveViewer initial={publicLive(await refreshLive(live))} />;
}
