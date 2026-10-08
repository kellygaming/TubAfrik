import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseStatus } from "./PurchaseStatus";

export const metadata: Metadata = { title: "Recharge", robots: { index: false } };

export default function CaurisMerciPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-10 text-center">
      <Suspense>
        <PurchaseStatus />
      </Suspense>
    </main>
  );
}
