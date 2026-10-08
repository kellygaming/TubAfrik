import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { BottomNav } from "@/components/BottomNav";
import { CauriIcon } from "@/components/cauris/cauris";
import { WalletRecharge } from "./WalletRecharge";

export const metadata: Metadata = { title: "Mes Cauris", robots: { index: false } };

type Move = { id: number; delta: number; kind: string; created_at: string; payment: { gift: { emoji: string; name: string } | null; creator: { username: string } | null } | null };

export default async function CaurisPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/connexion?next=/cauris");
  if (!profile) redirect("/bienvenue?next=/cauris");

  const supabase = await supabaseServer();
  const [{ data: wallet }, { data: moves }] = await Promise.all([
    supabase.from("tub_cauri_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase.from("tub_cauri_ledger")
      .select("id,delta,kind,created_at,payment:tub_payments(gift:tub_gifts(emoji,name),creator:tub_profiles!tub_payments_creator_id_fkey(username))")
      .order("created_at", { ascending: false }).limit(30),
  ]);
  const history = (moves as unknown as Move[] | null) ?? [];

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Mes Cauris</h1>
          <Link href={`/u/${profile.username}`} className="text-sm text-muted hover:text-text">Mon profil</Link>
        </div>

        <section className="vip-card mt-5 p-5 pl-6">
          <p className="text-sm text-muted">Solde</p>
          <p className="font-display mt-1 flex items-center gap-2 text-4xl font-bold">
            {wallet?.balance ?? 0} <CauriIcon size={34} />
          </p>
          <p className="mt-2 text-sm text-muted">
            Les Cauris servent à offrir des cadeaux en un geste, sous les vidéos et pendant les lives. 1 Cauri = 10 F de cadeau.
          </p>
        </section>

        <h2 className="mt-8 font-semibold">Recharger</h2>
        <div className="mt-3">
          <WalletRecharge userId={user.id} />
        </div>

        <h2 className="mt-10 font-semibold">Historique</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucun mouvement pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {history.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="text-xl">{m.kind === "achat" ? "➕" : m.payment?.gift?.emoji ?? "🎁"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {m.kind === "achat"
                      ? "Recharge"
                      : m.kind === "cadeau"
                        ? `${m.payment?.gift?.name ?? "Cadeau"} pour @${m.payment?.creator?.username ?? "…"}`
                        : "Ajustement"}
                  </span>
                  <span className="block text-xs text-muted">il y a {timeAgo(m.created_at)}</span>
                </span>
                <span className={`font-bold ${m.delta > 0 ? "text-ok" : "text-text"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </>
  );
}
