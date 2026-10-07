import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { fcfa, GIFT_COLUMNS, vipLabel, type Gift } from "@/lib/gifts";
import { GiftArt } from "@/components/gifts/GiftArt";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Gagner sur TubAfrik",
  description:
    "Les cadeaux de tes fans, payés en mobile money: 80 % pour toi, retirables 3 jours après, sans minimum. Bientôt: le partage des revenus publicitaires.",
};

const FAQ = [
  ["Faut-il beaucoup d'abonnés ?", "Non. Les cadeaux sont ouverts dès ta première vidéo. Un seul fan qui t'apprécie suffit pour commencer."],
  ["Quand puis-je retirer ?", "Chaque cadeau devient retirable 3 jours après le don, le temps que l'opérateur valide définitivement le paiement. Pas de minimum."],
  ["Comment suis-je payé ?", "Sur ton numéro mobile money (Orange, MTN, Moov, Wave…), depuis la page « Mes gains » de ton profil."],
  ["Et mes fans, qu'y gagnent-ils ?", "Un badge VIP sur ton profil, des commentaires en or affichés en premier et une place parmi tes meilleurs fans."],
] as const;

export default async function GagnerPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("tub_gifts").select(GIFT_COLUMNS).order("sort");
  const gifts = (data as Gift[] | null) ?? [];
  const sample = gifts.find((g) => g.slug === "diamant") ?? gifts[0];

  return (
    <InfoPage
      eyebrow="Monétisation"
      title={<>Ton talent, <span className="text-gold-grad">ton revenu</span>.</>}
      intro={<p>Sur TubAfrik, ton public peut te soutenir directement, en mobile money. Voici comment tu gagnes de l&apos;argent aujourd&apos;hui, et ce qui arrive bientôt.</p>}
    >
      <InfoSection title="① Les cadeaux · disponible">
        <p>
          Sous chacune de tes vidéos et sur ton profil, tes fans peuvent t&apos;offrir un cadeau. Ils paient en mobile money,
          tu reçois <strong className="text-text">80 %</strong> du montant. Les 20 % restants font tourner la plateforme
          (serveurs, vidéos, paiements).
        </p>
      </InfoSection>

      {gifts.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2.5">
          {gifts.map((g) => (
            <li key={g.slug} className="flex flex-col items-center rounded-2xl border border-line bg-surface px-2 py-4 text-center">
              <GiftArt gift={g} size={52} />
              <span className="mt-2 text-sm font-semibold">{g.name}</span>
              <span className="text-sm font-bold text-gold">{fcfa(g.price_fcfa)}</span>
              <span className="mt-0.5 text-[11px] text-muted">dont {fcfa(Math.floor(g.price_fcfa * 0.8))} pour toi</span>
              <span className="text-[11px] text-muted">{vipLabel(g.vip_days)}</span>
            </li>
          ))}
        </ul>
      )}

      {sample && (
        <div className="vip-card mt-4 p-4 pl-5 text-sm">
          <p className="text-muted">Exemple</p>
          <p className="mt-1">
            10 fans t&apos;offrent un {sample.name} ce mois-ci: <strong>{fcfa(sample.price_fcfa * 10)}</strong> envoyés,
            soit <strong className="text-gold">{fcfa(Math.floor(sample.price_fcfa * 10 * 0.8))}</strong> sur ton mobile money.
          </p>
        </div>
      )}

      <ol className="mt-5 space-y-2 text-sm">
        {[
          "Un fan t'offre un cadeau sous ta vidéo ou depuis ton profil.",
          "Tu reçois une notification, l'argent apparaît dans « Mes gains ».",
          "3 jours plus tard, il est retirable. Tu demandes le retrait, sans minimum.",
          "L'équipe vérifie et l'envoie sur ton numéro mobile money.",
        ].map((t, i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-black">{i + 1}</span>
            <span className="text-text/80">{t}</span>
          </li>
        ))}
      </ol>

      <section className="relative mt-10 overflow-hidden rounded-3xl border border-line bg-surface p-5">
        <span className="absolute right-4 top-4 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-black">
          Bientôt
        </span>
        <h2 className="font-display pr-20 text-lg font-bold">② Le partage des revenus publicitaires</h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-text/80">
          <p>
            Bientôt, des marques pourront diffuser leurs publicités sur TubAfrik. Une part de ces revenus sera
            <strong className="text-text"> reversée aux TubAfrikains</strong> dont les vidéos les portent: plus ta vidéo
            est regardée, plus tu gagnes, même sans cadeau.
          </p>
          <p>
            Les conditions exactes (part reversée, critères d&apos;accès) seront annoncées au lancement. Les créateurs actifs
            dès aujourd&apos;hui seront les premiers servis.
          </p>
        </div>
        <p className="mt-4 text-sm font-semibold text-gold">Publie maintenant, ton audience comptera dès le premier jour.</p>
      </section>

      <InfoSection title="Questions fréquentes">
        <dl className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {FAQ.map(([q, a]) => (
            <div key={q} className="p-4">
              <dt className="font-semibold text-text">{q}</dt>
              <dd className="mt-1 text-sm text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </InfoSection>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/publier" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-black">Publier une vidéo</Link>
        <Link href="/gains" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2">Mes gains</Link>
        <Link href="/mission" className="rounded-full px-3 py-2.5 text-sm text-muted hover:text-text">Notre mission →</Link>
      </div>
    </InfoPage>
  );
}
