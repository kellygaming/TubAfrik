"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fcfa, PAYOUT_METHODS } from "@/lib/gifts";

export function WithdrawForm({ available, pending, defaultPhone }: { available: number; pending: boolean; defaultPhone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<string>("wave");
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending) {
    return (
      <p className="mt-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        ⏳ Ton retrait est en cours de traitement. Tu le recevras sous 48 h ouvrées.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={available <= 0}
        className="bg-brand mt-4 h-12 w-full rounded-full font-semibold text-bg transition active:scale-[0.98] disabled:opacity-40"
      >
        {available > 0 ? `Retirer ${fcfa(available)}` : "Rien à retirer pour l'instant"}
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/gains/retrait", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, phone }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Connexion impossible. Réessaie.");
    setOpen(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-line bg-surface p-4">
      <p className="font-semibold">Retirer {fcfa(available)}</p>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Reçois sur</legend>
        <div className="flex flex-wrap gap-2">
          {PAYOUT_METHODS.map((m) => (
            <button
              type="button"
              key={m.id}
              aria-pressed={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                method === m.id ? "bg-brand border-transparent font-semibold text-bg" : "border-line hover:border-white/25"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Numéro qui reçoit l&apos;argent</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          required
          placeholder="+225 07 00 00 00 00"
          className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40"
        />
      </label>
      {error && <p role="alert" className="rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-2.5 text-sm">
          Annuler
        </button>
        <button disabled={busy} className="bg-brand flex-1 rounded-full py-2.5 font-semibold text-bg disabled:opacity-50">
          {busy ? "Envoi…" : "Confirmer le retrait"}
        </button>
      </div>
    </form>
  );
}
