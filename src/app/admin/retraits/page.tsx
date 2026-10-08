import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase/admin";
import { fcfa, PAYOUT_METHODS } from "@/lib/gifts";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Retraits", robots: { index: false } };

type Row = {
  id: string;
  amount_fcfa: number;
  method: string;
  phone: string;
  status: string;
  created_at: string;
  processed_at: string | null;
  admin_note: string | null;
  creator: { username: string; display_name: string } | null;
};

async function requireAdmin() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) throw new Error("Interdit");
}

// Envoie l'argent à la main (Wave, Orange Money…) PUIS clique « Payé ».
async function markPaid(formData: FormData) {
  "use server";
  await requireAdmin();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  await supabaseAdmin().rpc("tub_process_withdrawal", { p_id: String(formData.get("id")), p_paid: true, p_note: note });
  revalidatePath("/admin/retraits");
}

// Refuser remet aussitôt le montant dans le disponible du créateur.
async function refuse(formData: FormData) {
  "use server";
  await requireAdmin();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || "Numéro à vérifier";
  await supabaseAdmin().rpc("tub_process_withdrawal", { p_id: String(formData.get("id")), p_paid: false, p_note: note });
  revalidatePath("/admin/retraits");
}

export default async function WithdrawalsAdmin() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) notFound();

  const db = supabaseAdmin();
  const [{ data }, { data: totals }, { data: packs }] = await Promise.all([
    db.from("tub_withdrawals")
      .select("id,amount_fcfa,method,phone,status,created_at,processed_at,admin_note,creator:tub_profiles(username,display_name)")
      .order("created_at", { ascending: false }).limit(100),
    db.from("tub_payments").select("amount_fcfa,creator_share,source").eq("status", "paid"),
    db.from("tub_cauri_purchases").select("amount_fcfa").eq("status", "paid"),
  ]);
  const rows = (data as unknown as Row[] | null) ?? [];
  const todo = rows.filter((r) => r.status === "en_attente");
  const done = rows.filter((r) => r.status !== "en_attente");
  // Argent réellement encaissé: cadeaux payés directement + packs de Cauris
  // (un cadeau payé en Cauris a déjà été encaissé lors de l'achat du pack).
  const revenue = (totals ?? []).filter((p) => p.source !== "cauris").reduce((s, p) => s + p.amount_fcfa, 0)
    + (packs ?? []).reduce((s, p) => s + p.amount_fcfa, 0);
  const share = (totals ?? []).reduce((s, p) => s + p.creator_share, 0);
  const label = (m: string) => PAYOUT_METHODS.find((x) => x.id === m)?.label ?? m;

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Retraits</h1>
        <Link href="/admin" className="text-sm text-muted hover:text-text">← Modération</Link>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Encaissé (cadeaux + Cauris)" value={fcfa(revenue)} />
        <Stat label="Part créateurs (80 %)" value={fcfa(share)} />
        <Stat label="Reste à TubAfrik" value={fcfa(revenue - share)} />
      </dl>

      <h2 className="mt-8 font-semibold">À payer ({todo.length})</h2>
      {todo.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune demande en attente 🎉</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {todo.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xl font-bold">{fcfa(r.amount_fcfa)}</p>
                <p className="text-xs text-muted">il y a {timeAgo(r.created_at)}</p>
              </div>
              <p className="mt-1 text-sm">
                <span className="font-semibold">@{r.creator?.username}</span> · {label(r.method)} ·{" "}
                <span className="select-all font-mono">{r.phone}</span>
              </p>
              <form className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="note" placeholder="Note (réf. transaction, motif…)" maxLength={300}
                  className="h-9 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3 text-sm outline-none" />
                <button formAction={markPaid} className="rounded-full bg-ok px-4 py-1.5 text-sm font-semibold text-black">Payé</button>
                <button formAction={refuse} className="rounded-full border border-like px-4 py-1.5 text-sm text-like">Refuser</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <h2 className="mt-10 font-semibold text-muted">Historique</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {done.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span>@{r.creator?.username} · {label(r.method)} · {r.phone}</span>
                <span className={r.status === "paye" ? "text-ok" : "text-like"}>
                  {fcfa(r.amount_fcfa)} {r.status === "paye" ? "payé" : "refusé"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
