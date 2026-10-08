import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { InfoPage, InfoSection } from "@/components/InfoPage";
import { LEGAL } from "@/lib/legal";
import { DeleteRequest } from "./DeleteRequest";

export const metadata: Metadata = {
  title: "Supprimer mon compte",
  description: "Comment demander la suppression de ton compte TubAfrik et de tes données.",
};

// Page accessible depuis l'app ET depuis le web (exigence Google Play).
export default async function DeleteAccountPage() {
  const { user, profile } = await getSession();
  let pending: { requested_at: string; processed_at: string | null } | null = null;
  if (user && profile) {
    const { data } = await (await supabaseServer())
      .from("tub_account_deletions").select("requested_at,processed_at").eq("user_id", user.id).maybeSingle();
    pending = data;
  }

  return (
    <InfoPage
      eyebrow="Mon compte"
      title="Supprimer mon compte TubAfrik"
      intro={<p>Tu peux demander la suppression de ton compte à tout moment. Elle est traitée sous 30 jours maximum.</p>}
    >
      <InfoSection title="Ce qui est supprimé">
        <ul className="list-disc space-y-2 pl-5">
          <li>Ton profil (pseudo, nom, photo, bio, centres d&apos;intérêt).</li>
          <li>Tes vidéos, lives, commentaires, stickers et messages.</li>
          <li>Tes likes, abonnements et abonnés, tes notifications.</li>
          <li>Ton numéro mobile money enregistré.</li>
          <li><b>Ton solde de Cauris</b> (non remboursable) et tes statuts VIP.</li>
        </ul>
      </InfoSection>

      <InfoSection title="Ce qui est conservé">
        <p>Les écritures comptables des paiements (montants, dates), sans ton identité, comme la loi l&apos;exige. Ton compte de connexion Google partagé avec Kelly Gaming n&apos;est pas touché.</p>
        <p><b>Créateurs :</b> retire tes gains disponibles avant de demander la suppression, ils seraient perdus.</p>
      </InfoSection>

      <section className="mt-8">
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <p>Connecte-toi pour envoyer ta demande, ou écris-nous depuis l&apos;adresse e-mail de ton compte à{" "}
              <a href={`mailto:${LEGAL.email}?subject=Suppression%20de%20compte`} className="font-semibold text-text underline">{LEGAL.email}</a>.</p>
            <Link href="/connexion?next=/compte/supprimer" className="bg-brand mt-4 inline-block rounded-full px-5 py-2.5 font-semibold text-bg">Se connecter</Link>
          </div>
        ) : !profile ? (
          <p className="text-sm text-muted">Tu n&apos;as pas de compte TubAfrik : il n&apos;y a rien à supprimer.</p>
        ) : (
          <DeleteRequest userId={user.id} pending={pending} />
        )}
      </section>
    </InfoPage>
  );
}
