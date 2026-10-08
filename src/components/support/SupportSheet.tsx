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

export type SupportTarget = {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  videoId?: string | null;
  /** Offert pendant un live: le cadeau s'affiche dans le chat. */
  liveId?: string | null;
};

export function SupportSheet({ target, onClose }: { target: SupportTarget | null; onClose: () => void }) {
  const { userId } = useSession();
  const [gifts, setGifts] = useState<Gift[] | null>(cachedGifts());
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const supabase = supabaseBrowser();
    loadGifts().then((list) => {
      setGifts(list);
      setSelected((s) => s ?? list[1]?.slug ?? list[0]?.slug ?? null);
    });
    if (userId) {
      supabase.from("tub_private").select("phone").eq("user_id", userId).maybeSingle()
        .then(({ data }) => data?.phone && setPhone((p) => p || data.phone));
    }
  }, [target, userId]);

  const gift = gifts?.find((g) => g.slug === (selected ?? gifts?.[1]?.slug ?? gifts?.[0]?.slug));

  async function pay(e: React.FormEvent) {
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
    // Paiement mobile money sur la page sécurisée de Chariow, retour sur /merci.
    window.location.assign(data.url);
  }

  return (
    <Sheet open={!!target} onClose={onClose} title="Soutenir">
      {target && (
        <div className="no-scrollbar overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <Avatar src={target.avatarUrl} name={target.displayName} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{target.displayName}</p>
              <p className="text-xs text-muted">
                Offre un cadeau à ce TubAfrikain et deviens son <span className="vip-badge">VIP</span>
              </p>
            </div>
          </div>

          {!userId ? (
            <Link href={loginHref()} className="bg-brand mt-4 block rounded-full py-3 text-center text-sm font-semibold text-bg">
              Connecte-toi pour envoyer un cadeau
            </Link>
          ) : gifts === null ? (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-2" />)}
            </div>
          ) : gifts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Les cadeaux arrivent très bientôt 🎁</p>
          ) : (
            <form onSubmit={pay}>
              <div role="radiogroup" aria-label="Choisis ton cadeau" className="mt-4 grid grid-cols-2 gap-2.5">
                {gifts.map((g) => {
                  const on = g.slug === gift?.slug;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      key={g.slug}
                      onClick={() => setSelected(g.slug)}
                      className={`flex flex-col items-center rounded-2xl border px-2 py-3 transition active:scale-[0.97] ${
                        on ? "border-gold bg-gold/10" : "border-line bg-surface-2 hover:border-white/25"
                      }`}
                    >
                      <GiftArt gift={g} size={44} className={`transition ${on ? "scale-110" : ""}`} />
                      <span className="mt-1.5 text-sm font-semibold">{g.name}</span>
                      <span className={`text-sm font-bold ${on ? "text-gold" : ""}`}>{fcfa(g.price_fcfa)}</span>
                      <span className="mt-0.5 text-[11px] text-muted">{vipLabel(g.vip_days)}</span>
                    </button>
                  );
                })}
              </div>

              <ul className="mt-4 space-y-1 text-xs text-muted">
                <li>⭐ Badge VIP et commentaires en or, affichés en premier</li>
                <li>💬 {target.liveId ? "Ton cadeau et ton message s'affichent dans le live" : target.videoId ? "Ton cadeau et ton message s'affichent sous la vidéo" : "Ton nom dans les meilleurs fans du profil"}</li>
                <li>🤝 80 % du montant va directement au TubAfrikain</li>
              </ul>

              <label className="mt-4 block">
                <span className="mb-1.5 flex justify-between text-sm font-medium">
                  Message <span className="font-normal text-muted">facultatif · {message.length}/150</span>
                </span>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={150}
                  placeholder="Force à toi, t'es le meilleur 🔥"
                  className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40"
                />
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-medium">Numéro mobile money</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="+225 07 00 00 00 00"
                  className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-white/40"
                />
                <span className="mt-1 block text-xs text-muted">Avec l&apos;indicatif du pays. Orange, MTN, Moov, Wave…</span>
              </label>

              {error && <p role="alert" className="mt-3 rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}

              <button
                disabled={busy || !gift || !phone.trim()}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold font-bold text-black transition active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? "Ouverture du paiement…" : gift ? `Envoyer ${gift.emoji} ${gift.name} · ${fcfa(gift.price_fcfa)}` : "Envoyer"}
              </button>
              <p className="mt-2 text-center text-[11px] text-muted">Paiement sécurisé par Chariow</p>
            </form>
          )}
        </div>
      )}
    </Sheet>
  );
}
