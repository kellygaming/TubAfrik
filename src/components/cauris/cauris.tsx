"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type CauriPack = { slug: string; name: string; cauris: number; price_fcfa: number };

/** 1 Cauri = 10 F de cadeau (même règle que tub_send_gift_cauris). */
export const giftCost = (priceFcfa: number) => Math.ceil(priceFcfa / 10);

export const packImage = (slug: string) => `/cauris/${slug}.webp`;

let packsCache: CauriPack[] | null = null;

/** Le solde de la personne connectée (null tant qu'il charge) et les packs en vente. */
export function useCauris(userId: string | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CauriPack[] | null>(packsCache);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabaseBrowser().from("tub_cauri_wallets").select("balance").eq("user_id", userId).maybeSingle();
    setBalance(data?.balance ?? 0);
  }, [userId]);

  useEffect(() => {
    if (userId) {
      supabaseBrowser().from("tub_cauri_wallets").select("balance").eq("user_id", userId).maybeSingle()
        .then(({ data }) => setBalance(data?.balance ?? 0));
    }
    if (!packsCache) {
      supabaseBrowser().from("tub_cauri_packs").select("slug,name,cauris,price_fcfa").order("sort")
        .then(({ data }) => setPacks((packsCache = (data as CauriPack[] | null) ?? [])));
    }
  }, [userId]);

  return { balance: userId ? balance : 0, setBalance, packs, refresh };
}

/** Petit cauri doré pour les montants (« 120 ⟡ »). */
export function CauriIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- icône locale de 33 Ko, déjà en WebP
    <img src="/cauris/poignee.webp" alt="Cauris" width={size} height={size} className={`inline-block shrink-0 object-contain ${className}`} />
  );
}
