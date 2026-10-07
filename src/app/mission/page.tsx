import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Notre mission",
  description:
    "TubAfrik veut que les créateurs africains vivent de leur talent, chez eux, payés en mobile money par leur communauté.",
};

const PILLARS = [
  ["🌍", "Tous les talents", "Musique, humour, cuisine, danse, sport, gaming, éducation… Chaque talent africain a sa place, et chacun reçoit un fil qui lui ressemble."],
  ["📱", "Payé chez toi", "Pas de carte bancaire étrangère, pas de seuil inaccessible. Ton public te soutient en mobile money, tu retires sur ton numéro."],
  ["⚡", "Pensé pour nos réseaux", "Des vidéos qui démarrent vite et un mode économie de données: regarder ne doit pas vider le forfait."],
  ["🤝", "La communauté d'abord", "Les fans soutiennent directement ceux qu'ils aiment. 80 % de chaque cadeau va au créateur."],
] as const;

export default function MissionPage() {
  return (
    <InfoPage
      eyebrow="Notre mission"
      title={<>Donner à l&apos;Afrique <span className="text-gold-grad">sa propre scène</span>.</>}
      intro={
        <p>
          Nos créateurs font rire, danser et rêver des millions de personnes. Pourtant, sur les grandes plateformes, la
          plupart ne touchent rien: la monétisation n&apos;y est pas ouverte à leur pays, ou elle exige une carte bancaire
          qu&apos;ils n&apos;ont pas. TubAfrik existe pour changer ça.
        </p>
      }
    >
      <InfoSection title="Pourquoi TubAfrik">
        <p>
          On dit youtubeur, on dit tiktokeur. Chez nous, on dit <strong className="text-text">TubAfrikain</strong>. Un
          TubAfrikain crée depuis Abidjan, Dakar, Douala, Kinshasa ou Lomé, pour un public qui lui ressemble, et il est
          payé là où il vit.
        </p>
        <p>
          Notre conviction est simple: le talent africain a de la valeur, et cette valeur doit d&apos;abord revenir à ceux qui
          le créent.
        </p>
      </InfoSection>

      <ul className="mt-8 grid gap-3">
        {PILLARS.map(([icon, title, text]) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>{icon}</span>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <InfoSection title="Notre but commun">
        <p>
          TubAfrik ne se construit pas pour les créateurs, mais <strong className="text-text">avec eux</strong>. Chaque
          vidéo publiée, chaque cadeau, chaque sticker tiré d&apos;un moment drôle fait grandir une scène qui nous appartient.
        </p>
        <p>
          Plus la communauté grandit, plus il y a de façons de gagner: les cadeaux aujourd&apos;hui, le partage des revenus
          publicitaires demain. Le succès de la plateforme sera celui de ses TubAfrikains, ou il ne sera pas.
        </p>
      </InfoSection>

      <section className="vip-card mt-10 p-5 pl-6">
        <h2 className="font-display text-lg font-bold">Rejoins le mouvement</h2>
        <p className="mt-2 text-sm leading-relaxed text-text/80">
          Publie ta première vidéo, invite ta communauté, et découvre comment ton talent peut te rapporter.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/publier" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-black">Publier une vidéo</Link>
          <Link href="/gagner" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2">
            Comment gagner ?
          </Link>
        </div>
      </section>
    </InfoPage>
  );
}
