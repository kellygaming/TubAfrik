"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fcfa, vipLabel, type Gift } from "@/lib/gifts";
import { cachedGifts, loadGifts } from "@/lib/giftCatalog";
import { GiftArt } from "../gifts/GiftArt";
import { Avatar } from "../Avatar";
import { Sheet } from "../Sheet";
import { loginHref, useSession } from "../session";
import { CauriIcon, giftCost, useCauris } from "../cauris/cauris";
import { RechargePanel } from "../cauris/RechargePanel";

export type SupportTarget = {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  videoId?: string | null;
  /** Offert pendant un live: le cadeau s'affiche dans le chat. */
  liveId?: string | null;
};

type View = "gift" | "recharge" | "direct";

const ERRORS: Record<string, string> = {
  solde_insuffisant: "Solde insuffisant. Recharge tes Cauris.",
  soi_meme: "Tu ne peux pas t'offrir un cadeau 😄",
  cadeau_inconnu: "Ce cadeau n'est plus disponible.",
};

// ═══════════════════════════════════════════════════════════════
// SOUTENIR UN TUBAFRIKAIN
//
// Avec des Cauris en poche, le cadeau part en un geste: pas de page de
// paiement, on ne quitte ni la vidéo ni le live. Sinon: recharger un
// pack, ou payer ce cadeau seul en mobile money comme avant.
// ═══════════════════════════════════════════════════════════════
export function SupportSheet({ target, onClose }: { target: SupportTarget | null; onClose: () => void }) {
  const { userId } = useSession();
  const [gifts, setGifts] = useState<Gift[] | null>(cachedGifts());
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [view, setView] = useState<View>("gift");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wallet = useCauris(target ? userId : null);

  useEffect(() => {
    if (!target) return;
    loadGifts().then((list) => {
      setGifts(list);
      setSelected((s) => s ?? list[1]?.slug ?? list[0]?.slug ?? null);
    });
    if (userId) {
      supabaseBrowser().from("tub_private").select("phone").eq("user_id", userId).maybeSingle()
        .then(({ data }) => data?.phone && setPhone((p) => p || data.phone));
    }
  }, [target, userId]);

  // Panneau refermé: on repart de zéro la prochaine fois.
  const [wasOpen, setWasOpen] = useState(!!target);
  if (!!target !== wasOpen) {
    setWasOpen(!!target);
    if (!target) {
      setView("gift");
      setSent(null);
      setError(null);
    }
  }

  const gift = gifts?.find((g) => g.slug === (selected ?? gifts?.[1]?.slug ?? gifts?.[0]?.slug));
  const cost = gift ? giftCost(gift.price_fcfa) : 0;
  const balance = wallet.balance ?? 0;
  const enough = wallet.balance !== null && balance >= cost;
  const retour = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;

  async function sendWithCauris() {
    if (!target || !gift) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabaseBrowser().rpc("tub_send_gift_cauris", {
      p_creator: target.creatorId,
      p_gift: gift.slug,
      p_video: target.videoId ?? null,
      p_live: target.liveId ?? null,
      p_message: message.trim() || null,
    });
    setBusy(false);
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      if (key === "solde_insuffisant") wallet.refresh();
      return setError(key ? ERRORS[key] : "Envoi impossible, réessaie.");
    }
    wallet.setBalance(typeof data === "number" ? data : balance - cost);
    setMessage("");
    setSent(`${gift.emoji} ${gift.name} envoyé à ${target.displayName} !`);
    setTimeout(onClose, 1600);
  }

  async function payDirect(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !gift) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creator: target.creatorId, gift: gift.slug, video: target.videoId ?? null, live: target.liveId ?? null, message, phone }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res?.ok || !data?.url) {
      setBusy(false);
      return setError(data?.error ?? "Connexion impossible. Réessaie.");
    }
    window.location.assign(data.url);
  }

  const title = view === "recharge" ? "Recharger des Cauris" : view === "direct" ? "Payer ce cadeau" : "Soutenir";

  return (
    <Sheet open={!!target} onClose={onClose} title={title}>
      {target && (
        <div className="no-scrollbar overflow-y-auto px-4 pb-4">
          {!userId ? (
            <>
              <CreatorCard target={target} />
              <Link href={loginHref()} className="bg-brand mt-4 block rounded-full py-3 text-center text-sm font-semibold text-bg">
                Connecte-toi pour envoyer un cadeau
              </Link>
            </>
          ) : sent ? (
            <div className="animate-pop-in py-10 text-center">
              <p className="text-6xl">{gift?.emoji ?? "🎁"}</p>
              <p className="mt-4 font-semibold">{sent}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
                Il te reste {balance} <CauriIcon size={14} />
              </p>
            </div>
          ) : view === "recharge" ? (
            <>
              <BackLink onClick={() => setView("gift")} />
              <RechargePanel userId={userId} packs={wallet.packs} retour={retour} need={Math.max(0, cost - balance)} />
            </>
          ) : view === "direct" ? (
            <form onSubmit={payDirect}>
              <BackLink onClick={() => setView("gift")} />
              {gift && (
                <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <GiftArt gift={gift} size={44} />
                  <div>
                    <p className="font-semibold">{gift.name} pour {target.displayName}</p>
                    <p className="text-sm text-gold">{fcfa(gift.price_fcfa)}</p>
                  </div>
                </div>
              )}
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium">Numéro mobile money</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" required
                  placeholder="+225 07 00 00 00 00"
                  className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40" />
                <span className="mt-1 block text-xs text-muted">Avec l&apos;indicatif du pays. Orange, MTN, Moov, Wave…</span>
              </label>
              {error && <p role="alert" className="mt-3 rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}
              <button disabled={busy || !gift || !phone.trim()}
                className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50">
                {busy ? "Ouverture du paiement…" : gift ? `Payer ${fcfa(gift.price_fcfa)}` : "Payer"}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">Paiement sécurisé par Chariow</p>
            </form>
          ) : gifts === null ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />)}
            </div>
          ) : gifts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Les cadeaux arrivent très bientôt 🎁</p>
          ) : (
            <>
              <CreatorCard target={target} />

              <div className="mt-3 flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/5 px-3 py-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <CauriIcon size={20} />
                  <span className="font-bold">{wallet.balance ?? "…"}</span>
                  <span className="text-muted">Cauris</span>
                </span>
                <button type="button" onClick={() => setView("recharge")} className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-black">
                  + Recharger
                </button>
              </div>

              <div role="radiogroup" aria-label="Choisis ton cadeau" className="mt-3 grid grid-cols-2 gap-2.5">
                {gifts.map((g) => {
                  const on = g.slug === gift?.slug;
                  return (
                    <button type="button" role="radio" aria-checked={on} key={g.slug} onClick={() => setSelected(g.slug)}
                      className={`flex flex-col items-center rounded-2xl border px-2 py-3 transition active:scale-[0.97] ${
                        on ? "border-gold bg-gold/10" : "border-line bg-surface-2 hover:border-white/25"
                      }`}>
                      <GiftArt gift={g} size={44} className={`transition ${on ? "scale-110" : ""}`} />
                      <span className="mt-1.5 text-sm font-semibold">{g.name}</span>
                      <span className={`flex items-center gap-1 text-sm font-bold ${on ? "text-gold" : ""}`}>
                        {giftCost(g.price_fcfa)} <CauriIcon size={14} />
                      </span>
                      <span className="mt-0.5 text-[11px] text-muted">{vipLabel(g.vip_days)}</span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 flex justify-between text-sm font-medium">
                  Message <span className="font-normal text-muted">facultatif · {message.length}/150</span>
                </span>
                <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={150}
                  placeholder="Force à toi, t'es le meilleur 🔥"
                  className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40" />
              </label>

              <ul className="mt-3 space-y-1 text-xs text-muted">
                <li>⭐ Badge VIP et commentaires en or, affichés en premier</li>
                <li>💬 {target.liveId ? "Ton cadeau s'affiche dans le live" : target.videoId ? "Ton cadeau s'affiche sous la vidéo" : "Ton nom dans les meilleurs fans du profil"}</li>
                <li>🤝 80 % de la valeur va directement au TubAfrikain</li>
              </ul>

              {error && <p role="alert" className="mt-3 rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}

              {enough ? (
                <button onClick={sendWithCauris} disabled={busy || !gift}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50">
                  {busy ? "Envoi…" : gift ? <>Offrir {gift.emoji} {gift.name} · {cost} <CauriIcon size={18} /></> : "Offrir"}
                </button>
              ) : (
                <button onClick={() => setView("recharge")} disabled={!gift || wallet.balance === null}
                  className="mt-4 h-12 w-full rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50">
                  {wallet.balance === null ? "…" : `Recharger pour offrir (il manque ${cost - balance} Cauris)`}
                </button>
              )}
              {gift && (
                <button onClick={() => setView("direct")} className="mt-2 block w-full py-2 text-center text-xs text-muted underline-offset-2 hover:underline">
                  ou payer ce cadeau seul en mobile money ({fcfa(gift.price_fcfa)})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function CreatorCard({ target }: { target: SupportTarget }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <Avatar src={target.avatarUrl} name={target.displayName} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{target.displayName}</p>
        <p className="text-xs text-muted">
          Offre un cadeau à ce TubAfrikain et deviens son <span className="vip-badge">VIP</span>
        </p>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3 text-sm text-muted hover:text-text">‹ Retour aux cadeaux</button>
  );
}
