import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { streamConfigured } from "@/lib/cfstream";
import { canGoLive, LIVE_COLUMNS, publicLive, refreshLive, type LiveRow } from "@/lib/lives";
import { LiveStudio } from "@/components/live/LiveStudio";

export const metadata: Metadata = { title: "Passer en live", robots: { index: false } };

export default async function LiveStudioPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/connexion?next=/live");
  if (!profile) redirect("/bienvenue?next=/live");

  const allowed = streamConfigured() && (await canGoLive(user.id, user.email));
  let current = null;
  let defaultCategory: string | null = null;
  if (allowed) {
    const db = supabaseAdmin();
    const [{ data: open }, { data: me }] = await Promise.all([
      db.from("tub_lives").select(LIVE_COLUMNS).eq("creator_id", user.id).neq("status", "ended").maybeSingle(),
      db.from("tub_profiles").select("main_category").eq("id", user.id).maybeSingle(),
    ]);
    if (open) current = publicLive(await refreshLive(open as unknown as LiveRow, true));
    defaultCategory = me?.main_category ?? null;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-16 pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/publier" className="text-sm text-muted hover:text-text">Retour</Link>
        <h1 className="font-semibold">🔴 Passer en live</h1>
        <span className="w-12" />
      </div>
      {allowed ? (
        <LiveStudio initial={current && current.status !== "ended" ? current : null} defaultCategory={defaultCategory} />
      ) : (
        <div className="rounded-2xl bg-surface-2 p-6 text-center">
          <p className="text-4xl">🎥</p>
          <p className="mt-3 font-semibold">Les lives arrivent, sur invitation</p>
          <p className="mt-2 text-sm text-muted">
            On ouvre les lives petit à petit pour garantir une diffusion stable. Continue à publier : les créateurs actifs
            seront les premiers invités.
          </p>
          <Link href="/publier" className="bg-brand mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-bg">
            Publier une vidéo
          </Link>
        </div>
      )}
    </main>
  );
}
