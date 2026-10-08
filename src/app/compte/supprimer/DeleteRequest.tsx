"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Pending = { requested_at: string; processed_at: string | null } | null;

export function DeleteRequest({ userId, pending: initial }: { userId: string; pending: Pending }) {
  const [pending, setPending] = useState<Pending>(initial);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabaseBrowser().from("tub_account_deletions")
      .insert({ user_id: userId, reason: reason.trim() || null }).select("requested_at,processed_at").single();
    setBusy(false);
    if (error) return setError("Demande impossible, réessaie.");
    setPending(data);
  }

  async function cancel() {
    setBusy(true);
    const { error } = await supabaseBrowser().from("tub_account_deletions").delete().eq("user_id", userId);
    setBusy(false);
    if (!error) setPending(null);
  }

  if (pending) {
    return (
      <div className="rounded-2xl border border-like/40 bg-like/10 p-5 text-sm">
        <p className="font-semibold">Demande reçue le {new Date(pending.requested_at).toLocaleDateString("fr-FR")}.</p>
        <p className="mt-1 text-muted">Ton compte sera supprimé sous 30 jours. Tu peux encore changer d&apos;avis d&apos;ici là.</p>
        <button onClick={cancel} disabled={busy} className="mt-4 rounded-full border border-line px-5 py-2.5 font-semibold disabled:opacity-50">
          Annuler ma demande
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={request} className="rounded-2xl border border-line bg-surface p-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Pourquoi pars-tu ? <span className="text-muted">(facultatif)</span></span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2}
          className="w-full rounded-xl border border-line bg-surface-2 p-3 text-base outline-none focus:border-white/40" />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Écris <b>SUPPRIMER</b> pour confirmer</span>
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters"
          className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-white/40" />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-like">{error}</p>}
      <button disabled={busy || confirm.trim().toUpperCase() !== "SUPPRIMER"}
        className="mt-4 h-12 w-full rounded-full bg-like font-bold text-white disabled:opacity-40">
        {busy ? "Envoi…" : "Demander la suppression de mon compte"}
      </button>
    </form>
  );
}
