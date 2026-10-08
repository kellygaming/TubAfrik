/* eslint-disable @next/next/no-img-element -- illustrations locales des packs, déjà en WebP */
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa } from "@/lib/gifts";
import { packImage, type CauriPack } from "./cauris";

// Choisir un pack et payer en mobile money (page sécurisée Chariow).
// `retour`: où revenir après le paiement (la vidéo, le live…).
export function RechargePanel({ userId, packs, retour, need = 0 }: { userId: string; packs: CauriPack[] | null; retour: string; need?: number }) {
  // Le plus petit pack qui couvre ce qu'il manque est présélectionné.
  const [selected, setSelected] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = selected ?? packs?.find((p) => p.cauris >= need)?.slug ?? packs?.[0]?.slug ?? null;
  const pack = packs?.find((p) => p.slug === pick);

  useEffect(() => {
    supabaseBrowser().from("tub_private").select("phone").eq("user_id", userId).maybeSingle()
      .then(({ data }) => data?.phone && setPhone((p) => p || data.phone));
  }, [userId]);

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (!pack) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/cauris", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pack: pack.slug, phone, retour }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res?.ok || !data?.url) {
      setBusy(false);
      return setError(data?.error ?? "Connexion impossible. Réessaie.");
    }
    window.location.assign(data.url);
  }

  if (packs === null) {
    return <div className="grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-2" />)}</div>;
  }

  return (
    <form onSubmit={buy}>
      <div role="radiogroup" aria-label="Choisis ton pack" className="grid grid-cols-2 gap-2.5">
        {packs.map((p) => {
          const on = p.slug === pick;
          const bonus = p.cauris - p.price_fcfa / 10;
          return (
            <button type="button" role="radio" aria-checked={on} key={p.slug} onClick={() => setSelected(p.slug)}
              className={`relative flex flex-col items-center rounded-2xl border px-2 pb-3 pt-2 transition active:scale-[0.97] ${
                on ? "border-gold bg-gold/10" : "border-line bg-surface-2 hover:border-white/25"
              }`}>
              {bonus > 0 && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-[#ff6b1a] px-1.5 py-0.5 text-[10px] font-bold text-black">+{bonus}</span>
              )}
              <img src={packImage(p.slug)} alt="" width={64} height={64} className={`h-16 w-16 object-contain transition ${on ? "scale-110" : ""}`} />
              <span className="mt-1 text-sm font-bold">{p.cauris} Cauris</span>
              <span className={`text-sm font-semibold ${on ? "text-gold" : "text-muted"}`}>{fcfa(p.price_fcfa)}</span>
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Numéro mobile money</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" required
          placeholder="+225 07 00 00 00 00"
          className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40" />
        <span className="mt-1 block text-xs text-muted">Avec l&apos;indicatif du pays. Orange, MTN, Moov, Wave…</span>
      </label>

      {error && <p role="alert" className="mt-3 rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}

      <button disabled={busy || !pack || !phone.trim()}
        className="mt-4 h-12 w-full rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50">
        {busy ? "Ouverture du paiement…" : pack ? `Recharger ${pack.cauris} Cauris · ${fcfa(pack.price_fcfa)}` : "Recharger"}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted">Paiement sécurisé par Chariow · crédit automatique</p>
    </form>
  );
}
