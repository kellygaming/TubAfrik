import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { fcfa, PAYOUT_METHODS } from "@/lib/gifts";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { WithdrawForm } from "./WithdrawForm";

export const metadata: Metadata = { title: "Mes gains", robots: { index: false } };

type Wallet = { available: number; upcoming: number; earned: number; withdrawn: number; next_release: string | null };
type Received = {
  id: string;
  creator_share: number;
  message: string | null;
  paid_at: string;
  gift: { emoji: string; name: string } | null;
  payer: { username: string; display_name: string; avatar_url: string | null } | null;
};
type Withdrawal = { id: string; amount_fcfa: number; method: string; status: string; created_at: string; admin_note: string | null };

const STATUS: Record<string, [string, string]> = {
  en_attente: ["En cours", "bg-white/10 text-text"],
  paye: ["Payé", "bg-ok/15 text-ok"],
  refuse: ["Refusé · recrédité", "bg-like/15 text-like"],
};

export default async function GainsPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/connexion?next=/gains");
  if (!profile) redirect("/bienvenue?next=/gains");

  const supabase = await supabaseServer();
  const [{ data: wallet }, { data: received }, { data: withdrawals }, { data: priv }] = await Promise.all([
    supabase.rpc("tub_my_wallet").single<Wallet>(),
    supabase
      .from("tub_payments")
      .select("id,creator_share,message,paid_at,gift:tub_gifts(emoji,name),payer:tub_profiles!tub_payments_payer_id_fkey(username,display_name,avatar_url)")
      .eq("creator_id", user.id).eq("status", "paid")
      .order("paid_at", { ascending: false }).limit(50),
    supabase.from("tub_withdrawals").select("id,amount_fcfa,method,status,created_at,admin_note")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("tub_private").select("phone").eq("user_id", user.id).maybeSingle(),
  ]);
  const w: Wallet = wallet ?? { available: 0, upcoming: 0, earned: 0, withdrawn: 0, next_release: null };
  const gifts = (received as unknown as Received[] | null) ?? [];
  const list = (withdrawals as Withdrawal[] | null) ?? [];
  const pending = list.some((x) => x.status === "en_attente");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-28 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Mes gains</h1>
        <Link href={`/u/${profile.username}`} className="text-sm text-muted hover:text-text">Mon profil</Link>
      </div>

      <section className="vip-card mt-5 p-5 pl-6">
        <p className="text-sm text-muted">Disponible</p>
        <p className="font-display mt-1 text-4xl font-bold">{fcfa(Math.max(0, w.available))}</p>
        {w.upcoming > 0 && (
          <p className="mt-2 text-sm text-muted">
            + <span className="font-semibold text-text">{fcfa(w.upcoming)}</span> en préparation
            {w.next_release && <> · prochain déblocage dans {timeUntil(w.next_release)}</>}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
          <div><dt className="text-muted">Gagné au total</dt><dd className="font-semibold">{fcfa(w.earned)}</dd></div>
          <div><dt className="text-muted">Déjà retiré</dt><dd className="font-semibold">{fcfa(Math.max(0, w.withdrawn))}</dd></div>
        </dl>
      </section>

      <WithdrawForm available={Math.max(0, w.available)} pending={pending} defaultPhone={priv?.phone ?? ""} />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Tu touches 80 % de chaque cadeau. L&apos;argent devient retirable 3 jours après le don, le temps que
        l&apos;opérateur valide définitivement le paiement. Pas de minimum : tu retires quand tu veux.
      </p>

      {list.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Retraits</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
            {list.map((x) => {
              const [label, cls] = STATUS[x.status] ?? [x.status, ""];
              return (
                <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold">{fcfa(x.amount_fcfa)}</p>
                    <p className="text-xs text-muted">
                      {PAYOUT_METHODS.find((m) => m.id === x.method)?.label ?? x.method} · il y a {timeAgo(x.created_at)}
                    </p>
                    {x.admin_note && <p className="mt-0.5 text-xs text-muted">{x.admin_note}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-muted">Cadeaux reçus</h2>
        {gifts.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
            <p className="text-4xl">🎁</p>
            <p className="mt-3 font-semibold">Pas encore de cadeau</p>
            <p className="mt-1 text-sm text-muted">
              Tes fans peuvent t&apos;en envoyer depuis tes vidéos ou ton profil. Partage tes clips pour te faire connaître !
            </p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {gifts.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <Avatar src={g.payer?.avatar_url} name={g.payer?.display_name ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">{g.payer?.display_name}</span> · {g.gift?.emoji} {g.gift?.name}
                  </p>
                  {g.message && <p className="truncate text-xs text-muted">« {g.message} »</p>}
                  <p className="text-xs text-muted">il y a {timeAgo(g.paid_at)}</p>
                </div>
                <span className="font-semibold text-gold">+{fcfa(g.creator_share)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function timeUntil(iso: string) {
  const h = Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600_000));
  return h >= 24 ? `${Math.ceil(h / 24)} j` : `${h} h`;
}
