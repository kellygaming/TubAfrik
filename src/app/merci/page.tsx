import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentStatus } from "./PaymentStatus";

export const metadata: Metadata = { title: "Merci !", robots: { index: false } };

export default function MerciPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-10 text-center">
      <Suspense>
        <PaymentStatus />
      </Suspense>
    </main>
  );
}
