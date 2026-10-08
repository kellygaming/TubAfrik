"use client";

import { RechargePanel } from "@/components/cauris/RechargePanel";
import { useCauris } from "@/components/cauris/cauris";
import { useStoreApp } from "@/lib/appMode";

export function WalletRecharge({ userId }: { userId: string }) {
  const { packs } = useCauris(userId);
  if (useStoreApp()) return <p className="text-sm text-muted">La recharge n&apos;est pas disponible dans l&apos;application.</p>;
  return <RechargePanel userId={userId} packs={packs} retour="/cauris" />;
}
