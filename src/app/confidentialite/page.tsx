import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données TubAfrik collecte, pourquoi, et comment les supprimer.",
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Confidentialité"
      title="Tes données, simplement expliquées"
      intro={<p>{LEGAL.product} est édité par {LEGAL.company}. Cette page explique quelles données nous utilisons, pourquoi, et comment tu gardes la main dessus. Dernière mise à jour : {LEGAL.updated}.</p>}
    >
      <InfoSection title="Ce que nous collectons">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Ton compte</b> : adresse e-mail et nom fournis par Google lors de la connexion.</li>
          <li><b>Ton profil</b> : pseudo, nom affiché, photo, bio, pays, centres d&apos;intérêt.</li>
          <li><b>Ce que tu publies</b> : vidéos, lives, commentaires, stickers, messages de live.</li>
          <li><b>Tes interactions</b> : likes, abonnements, vidéos vues (pour personnaliser le fil « Pour toi »).</li>
          <li><b>Paiements</b> : ton numéro mobile money, le montant et l&apos;état de chaque achat ou cadeau. Nous ne voyons jamais ton code secret : le paiement se fait chez notre prestataire Chariow.</li>
          <li><b>Retraits (créateurs)</b> : le numéro sur lequel tu reçois tes gains.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Pourquoi">
        <p>Pour faire fonctionner le service (publier, regarder, discuter), personnaliser le fil, verser leurs gains aux créateurs, prévenir les abus et respecter nos obligations légales et comptables. Nous ne vendons pas tes données.</p>
      </InfoSection>

      <InfoSection title="Avec qui elles sont partagées">
        <ul className="list-disc space-y-2 pl-5">
          <li><b>Supabase</b> (base de données et connexion), <b>Vercel</b> (hébergement du site).</li>
          <li><b>Bunny.net</b> (stockage et diffusion des vidéos), <b>Cloudflare</b> (diffusion des lives).</li>
          <li><b>Chariow</b> (paiements mobile money), <b>Google</b> (connexion).</li>
        </ul>
        <p>Ce que tu publies (profil, vidéos, commentaires, lives) est visible par les autres utilisateurs.</p>
      </InfoSection>

      <InfoSection title="Combien de temps">
        <p>Tant que ton compte existe. Après suppression, tes contenus et ton identité sont effacés sous 30 jours ; seules les écritures comptables liées aux paiements (montants, dates) sont conservées de façon anonyme, comme la loi l&apos;exige.</p>
      </InfoSection>

      <InfoSection title="Tes droits">
        <p>Tu peux consulter et modifier ton profil à tout moment, et <Link href="/compte/supprimer" className="font-semibold text-text underline">demander la suppression de ton compte</Link>. Pour toute question : <a href={`mailto:${LEGAL.email}`} className="font-semibold text-text underline">{LEGAL.email}</a>.</p>
      </InfoSection>

      <InfoSection title="Mineurs">
        <p>{LEGAL.product} est réservé aux personnes de 13 ans et plus. Les achats et les retraits sont réservés aux personnes majeures ou autorisées par un parent.</p>
      </InfoSection>
    </InfoPage>
  );
}
