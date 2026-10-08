import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { compact } from "@/lib/format";
import { gameName } from "@/lib/games";
import { videoTag } from "@/lib/categories";
import { flag } from "@/lib/countries";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { SearchBox } from "./SearchBox";

export const metadata: Metadata = { title: "Recherche" };

const COLUMNS = "id,username,display_name,avatar_url,bio,main_game,main_category,country,followers_count,following_count,videos_count";

export default async function SearchPage({ searchParams }: PageProps<"/recherche">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 40);

  const supabase = await supabaseServer();
  let query = supabase.from("tub_profiles").select(COLUMNS).is("deleted_at", null).order("followers_count", { ascending: false }).limit(25);
  if (q) {
    // Le % et le _ sont des jokers SQL: échappés pour que chercher
    // « 100% » ne retourne pas tout le monde.
    const safe = q.replace(/[%_\\]/g, "\\$&");
    query = query.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
  }
  const { data } = await query;
  const profiles = (data as Profile[] | null) ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-24">
      <SearchBox initial={q} />

      <h1 className="mt-6 mb-3 text-sm font-semibold text-muted">
        {q ? `Résultats pour « ${q} »` : "Créateurs populaires"}
      </h1>

      {profiles.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 font-semibold">{q ? `Personne ne correspond à « ${q} »` : "Aucun créateur pour l'instant"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Vérifie l'orthographe, ou cherche un autre pseudo." : "Les premiers profils apparaîtront ici."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {profiles.map((p) => (
            <li key={p.id}>
              <Link href={`/u/${p.username}`} className="flex items-center gap-3 py-3 transition active:bg-surface">
                <Avatar src={p.avatar_url} name={p.display_name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.display_name} {flag(p.country)}
                  </p>
                  <p className="truncate text-sm text-muted">
                    @{p.username} · {compact(p.followers_count)} abonné{p.followers_count > 1 ? "s" : ""}
                    {videoTag(p.main_category, p.main_game, gameName) ? ` · ${videoTag(p.main_category, p.main_game, gameName)!.label}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium">Voir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}
