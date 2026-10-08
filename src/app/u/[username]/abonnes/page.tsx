import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { compact } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";

type Person = { username: string; display_name: string; avatar_url: string | null; followers_count: number };
type Row = { created_at: string; person: Person | null };

export async function generateMetadata({ params }: PageProps<"/u/[username]/abonnes">): Promise<Metadata> {
  return { title: `Abonnés de @${(await params).username}`, robots: { index: false } };
}

// Les abonnés d'un créateur, et ceux qu'il suit: deux onglets, du plus récent au plus ancien.
export default async function FollowsPage({ params, searchParams }: PageProps<"/u/[username]/abonnes">) {
  const { username } = await params;
  const following = (await searchParams).liste === "abonnements";
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("tub_profiles")
    .select("id,username,display_name,followers_count,following_count")
    .eq("username", username.toLowerCase()).maybeSingle();
  if (!p) notFound();

  const person = "username,display_name,avatar_url,followers_count";
  const { data } = following
    ? await supabase.from("tub_follows").select(`created_at, person:tub_profiles!tub_follows_followee_id_fkey(${person})`)
        .eq("follower_id", p.id).order("created_at", { ascending: false }).limit(300)
    : await supabase.from("tub_follows").select(`created_at, person:tub_profiles!tub_follows_follower_id_fkey(${person})`)
        .eq("followee_id", p.id).order("created_at", { ascending: false }).limit(300);
  const rows = ((data as unknown as Row[] | null) ?? []).filter((r) => r.person);

  const tab = (active: boolean, href: string, label: string, n: number) => (
    <Link href={href} replace aria-current={active ? "page" : undefined}
      className={`flex-1 border-b-2 pb-2.5 text-center text-sm font-semibold transition ${active ? "border-white text-white" : "border-transparent text-muted"}`}>
      {label} · {compact(n)}
    </Link>
  );

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md pb-28 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="relative flex items-center justify-center px-4 py-2">
          <Link href={`/u/${p.username}`} className="absolute left-4 text-sm text-muted hover:text-text">‹ Retour</Link>
          <h1 className="font-semibold">{p.display_name}</h1>
        </div>
        <nav className="mt-2 flex border-b border-line px-4">
          {tab(!following, `/u/${p.username}/abonnes`, "Abonnés", p.followers_count)}
          {tab(following, `/u/${p.username}/abonnes?liste=abonnements`, "Abonnements", p.following_count)}
        </nav>

        {rows.length === 0 ? (
          <p className="px-8 py-16 text-center text-sm text-muted">
            {following ? "Ne suit encore personne." : "Pas encore d'abonné. Partage ton profil !"}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ person: u }) => (
              <li key={u!.username}>
                <Link href={`/u/${u!.username}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface">
                  <Avatar src={u!.avatar_url} name={u!.display_name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{u!.display_name}</span>
                    <span className="block truncate text-xs text-muted">
                      @{u!.username} · {compact(u!.followers_count)} abonné{u!.followers_count > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rows.length === 300 && <p className="py-4 text-center text-xs text-muted">Les 300 plus récents sont affichés.</p>}
      </main>
      <BottomNav />
    </>
  );
}
