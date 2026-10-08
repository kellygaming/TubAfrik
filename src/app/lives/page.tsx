import type { Metadata } from "next";
import Link from "next/link";
import { liveNow } from "@/lib/lives";
import { category } from "@/lib/categories";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = { title: "En direct" };
export const dynamic = "force-dynamic";

export default async function LivesPage() {
  const lives = await liveNow();
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div className="flex items-center justify-between">
          <h1 className="font-display flex items-center gap-2 text-xl font-bold">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-like" /> En direct
          </h1>
          <Link href="/live" className="rounded-full bg-like px-4 py-2 text-sm font-semibold text-white">Passer en live</Link>
        </div>

        {lives.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-5xl">📡</p>
            <p className="mt-4 font-semibold">Personne n&apos;est en direct pour l&apos;instant</p>
            <p className="mt-1 text-sm text-muted">Reviens plus tard, ou lance le tien.</p>
          </div>
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3">
            {lives.map((l) => {
              const c = category(l.category);
              return (
                <li key={l.id}>
                  <Link href={`/live/${l.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface transition active:scale-[0.98]">
                    <div className="relative grid aspect-[3/4] place-items-center bg-gradient-to-b from-surface-2 to-black">
                      <Avatar src={l.creator?.avatar_url} name={l.creator?.display_name ?? "?"} size={72} className="ring-4 ring-like/80" />
                      <span className="absolute left-2 top-2 rounded-md bg-like px-1.5 py-0.5 text-[10px] font-bold">EN DIRECT</span>
                      {c && <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px]">{c.emoji} {c.name}</span>}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-semibold">{l.creator?.display_name}</p>
                      <p className="line-clamp-2 text-xs text-muted">{l.title}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav />
    </>
  );
}
