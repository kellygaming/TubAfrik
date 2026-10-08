import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Les règles de TubAfrik : contenus, cadeaux, Cauris, gains et retraits.",
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Conditions d'utilisation"
      title="Les règles de la communauté"
      intro={<p>En utilisant {LEGAL.product}, édité par {LEGAL.company}, tu acceptes ces règles. Dernière mise à jour : {LEGAL.updated}.</p>}
    >
      <InfoSection title="Ton compte">
        <p>Tu dois avoir au moins 13 ans. Tu es responsable de ce qui est publié depuis ton compte. Un seul compte par personne ; l&apos;usurpation d&apos;identité est interdite.</p>
      </InfoSection>

      <InfoSection title="Ce qui est interdit">
        <ul className="list-disc space-y-2 pl-5">
          <li>La nudité, le contenu sexuel, la violence choquante.</li>
          <li>La haine, le harcèlement, les menaces.</li>
          <li>Les arnaques (faux diamants, faux concours, faux comptes) et le spam.</li>
          <li>Publier le contenu de quelqu&apos;un d&apos;autre sans son accord.</li>
        </ul>
        <p>Nous pouvons retirer un contenu, couper un live ou suspendre un compte qui ne respecte pas ces règles. Tu peux signaler tout contenu depuis le menu « … ».</p>
      </InfoSection>

      <InfoSection title="Tes contenus">
        <p>Tu restes propriétaire de ce que tu publies. Tu autorises {LEGAL.product} à l&apos;héberger, l&apos;afficher, le diffuser et le promouvoir sur le service (avec le logo {LEGAL.product}), et les autres utilisateurs à le regarder, le partager et l&apos;enregistrer pour un usage personnel.</p>
      </InfoSection>

      <InfoSection title="Cauris et cadeaux">
        <p>Les Cauris sont une monnaie virtuelle propre à {LEGAL.product} : ils servent uniquement à offrir des cadeaux aux créateurs. Ils ne sont ni remboursables, ni échangeables contre de l&apos;argent, ni transférables. Un cadeau envoyé ne peut pas être annulé.</p>
      </InfoSection>

      <InfoSection title="Gains des créateurs">
        <p>Le créateur reçoit 80 % de la valeur de chaque cadeau. Les gains deviennent retirables 3 jours après le cadeau et sont versés en mobile money sur demande. En cas de fraude ou de paiement contesté, les gains concernés peuvent être annulés.</p>
      </InfoSection>

      <InfoSection title="Responsabilité">
        <p>Nous faisons de notre mieux pour que le service reste disponible et sûr, sans pouvoir le garantir en permanence. Les créateurs sont seuls responsables de leurs contenus.</p>
      </InfoSection>

      <InfoSection title="Contact">
        <p>
          <a href={`mailto:${LEGAL.email}`} className="font-semibold text-text underline">{LEGAL.email}</a> ·{" "}
          <Link href="/confidentialite" className="font-semibold text-text underline">Confidentialité</Link> ·{" "}
          <Link href="/compte/supprimer" className="font-semibold text-text underline">Supprimer mon compte</Link>
        </p>
      </InfoSection>
    </InfoPage>
  );
}
