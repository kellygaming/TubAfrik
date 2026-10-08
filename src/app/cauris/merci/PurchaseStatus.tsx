"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CauriIcon } from "@/components/cauris/cauris";

type State = { status: "pending" | "paid" | "failed" | "error"; cauris?: number; balance?: number };

// Retour de la page de paiement Chariow pour une recharge de Cauris.
// Toutes les 3 s pendant 3 minutes, puis on rassure.
export function PurchaseStatus() {
  const sp = useSearchParams();
  const id = sp.get("c");
  const raw = decodeReturn(sp.get("r")) ?? sp.get("retour") ?? "/";
  const back = /^\/(?!\/)/.test(raw) ? raw : "/";
  const [state, setState] = useState<State>({ status: "pending" });
  const [late, setLate] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const start = Date.now();
    (async () => {
      while (!stop) {
        const res = await fetch(`/api/cauris/${id}`, { cache: "no-store" }).catch(() => null);
        if (res?.status === 404 || res?.status === 401) return setState({ status: "error" });
        const data = (await res?.json().catch(() => null)) as State | null;
        if (data) setState(data);
        if (data?.status === "paid") return;
        if (Date.now() - start > 3 * 60_000) return setLate(true);
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      stop = true;
    };
  }, [id]);

  if (!id || state.status === "error") {
    return <Done emoji="🤔" title="Recharge introuvable" text="Ce lien ne correspond à aucune de tes recharges." href="/cauris" cta="Mes Cauris" />;
  }
  if (state.status === "paid") {
    return (
      <div>
        <CauriIcon size={96} className="animate-pop-in mx-auto" />
        <h1 className="mt-5 text-2xl font-bold">+{state.cauris} Cauris !</h1>
        <p className="mt-2 flex items-center justify-center gap-1 text-muted">
          Ton solde : <b className="text-text">{state.balance}</b> <CauriIcon size={16} />
        </p>
        <Link href={back} className="mt-8 block rounded-full bg-gold py-3 font-bold text-black">
          {back === "/cauris" ? "Voir mes Cauris" : "Retourner offrir un cadeau 🎁"}
        </Link>
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <Done emoji="😕" title="Paiement non abouti"
        text="Aucun montant n'a été débité. Si tu as quand même payé, la confirmation peut prendre quelques minutes : cette page se mettra à jour."
        href="/cauris" cta="Réessayer" />
    );
  }
  return (
    <div>
      <span className="mx-auto block h-14 w-14 animate-spin rounded-full border-4 border-surface-2 border-t-gold" />
      <h1 className="mt-6 text-xl font-bold">Confirmation du paiement…</h1>
      <p className="mt-2 text-sm text-muted">
        {late
          ? "Ça prend plus de temps que prévu. Dès que l'opérateur confirme, tes Cauris arrivent automatiquement."
          : "Valide le paiement sur ton téléphone si ce n'est pas encore fait."}
      </p>
      {late && <Link href={back} className="mt-8 block rounded-full border border-line py-3 text-sm">Continuer</Link>}
    </div>
  );
}

function Done({ emoji, title, text, href, cta }: { emoji: string; title: string; text: string; href: string; cta: string }) {
  return (
    <div>
      <p className="text-6xl">{emoji}</p>
      <h1 className="mt-5 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <Link href={href} className="bg-brand mt-8 block rounded-full py-3 font-semibold text-bg">{cta}</Link>
    </div>
  );
}

function decodeReturn(r: string | null) {
  if (!r) return null;
  try {
    const bin = atob(r.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
