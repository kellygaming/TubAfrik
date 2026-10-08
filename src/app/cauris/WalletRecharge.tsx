"use client";

import { RechargePanel } from "@/components/cauris/RechargePanel";
import { useCauris } from "@/components/cauris/cauris";

export function WalletRecharge({ userId }: { userId: string }) {
  const { packs } = useCauris(userId);
  return <RechargePanel userId={userId} packs={packs} retour="/cauris" />;
}
