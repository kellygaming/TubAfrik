"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { vipLabel } from "@/lib/gifts";

type State = {
  status: "pending" | "paid" | "failed" | "error";
  video?: string | null;
  live?: string | null;
  gift?: { name: string; emoji: string; vip_days: number } | null;
  creator?: { username: string; display_name: string } | null;
};

// Retour de la page de paiement Chariow. Le mobile money confirme
// parfois avec un peu de retard: on redemande toutes les 3 s pendant
// 3 minutes, puis on rassure (la confirmation finira par arriver).
export function PaymentStatus() {
  const id = useSearchParams().get("p");
  const [state, setState] = useState<State>({ status: "pending" });
  const [late, setLate] = useState(false);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const start = Date.now();
    (async () => {
      while (!stop) {
        const res = await fetch(`/api/support/${id}`, { cache: "no-store" }).catch(() => null);
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

  const back = state.live ? `/live/${state.live}` : state.video ? `/v/${state.video}` : state.creator ? `/u/${state.creator.username}` : "/";

  if (!id || state.status === "error") {
    return <Box emoji="🤔" title="Paiement introuvable" text="Ce lien ne correspond à aucun de tes cadeaux." href="/" cta="Retour au fil" />;
  }

  if (state.status === "paid") {
    return (
      <div>
        <p className="animate-pop-in text-7xl">{state.gift?.emoji ?? "🎁"}</p>
        <h1 className="mt-5 text-2xl font-bold">Cadeau envoyé !</h1>
        <p className="mt-2 text-muted">
          {state.creator?.display_name} a bien reçu ton {state.gift?.name}. Merci de soutenir les TubAfrikains 🙏
        </p>
        <div className="vip-card mx-auto mt-6 max-w-xs p-4 pl-5 text-left">
          <p className="flex items-center gap-2 font-semibold">
            <span className="vip-badge">★ VIP</span> chez @{state.creator?.username}
          </p>
          <p className="mt-1 text-sm text-muted">
            {state.gift ? `${vipLabel(state.gift.vip_days)} ajouté` : "Statut VIP activé"} : tes commentaires brillent en or et passent en premier.
          </p>
        </div>
        <Link href={back} className="bg-brand mt-8 block rounded-full py-3 font-semibold text-bg">
          {state.live ? "Retourner au live" : state.video ? "Revoir la vidéo" : "Voir son profil"}
        </Link>
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <Box emoji="😕" title="Paiement non abouti"
        text="Aucun montant n'a été débité. Si tu as quand même payé, la confirmation peut prendre quelques minutes : cette page se mettra à jour."
        href={back} cta="Réessayer" />
    );
  }

  return (
    <div>
      <span className="mx-auto block h-14 w-14 animate-spin rounded-full border-4 border-surface-2 border-t-gold" />
      <h1 className="mt-6 text-xl font-bold">Confirmation du paiement…</h1>
      <p className="mt-2 text-sm text-muted">
        {late
          ? "Ça prend plus de temps que prévu. Pas d'inquiétude : dès que l'opérateur confirme, ton cadeau est livré automatiquement."
          : "Valide le paiement sur ton téléphone si ce n'est pas encore fait."}
      </p>
      {late && (
        <Link href={back} className="mt-8 block rounded-full border border-line py-3 text-sm">Continuer</Link>
      )}
    </div>
  );
}

function Box({ emoji, title, text, href, cta }: { emoji: string; title: string; text: string; href: string; cta: string }) {
  return (
    <div>
      <p className="text-6xl">{emoji}</p>
      <h1 className="mt-5 text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <Link href={href} className="bg-brand mt-8 block rounded-full py-3 font-semibold text-bg">{cta}</Link>
    </div>
  );
}
