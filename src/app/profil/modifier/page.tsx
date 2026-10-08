import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { SignOutButton } from "@/components/profile/SignOutButton";

export const metadata: Metadata = { title: "Modifier mon profil" };

export default async function EditProfilePage() {
  const supabase = await supabaseServer();
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/profil/modifier");
  const { data: p } = await supabase
    .from("tub_profiles").select("username,display_name,avatar_url,cover_url,bio,main_game,main_category,interests,country").eq("id", user.id).maybeSingle();
  if (!p) redirect("/bienvenue");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-12">
      <div className="mb-8 flex items-center justify-between">
        <Link href={`/u/${p.username}`} className="text-sm text-muted hover:text-text">← Retour</Link>
        <h1 className="font-semibold">Modifier le profil</h1>
        <span className="w-12" />
      </div>
      <ProfileForm mode="edit" userId={user.id} initial={{ ...p, bio: p.bio ?? "" }} />
      <div className="mt-10 border-t border-line pt-6">
        <SignOutButton />
        <nav className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted">
          <Link href="/conditions" className="hover:text-text">Conditions</Link>
          <Link href="/confidentialite" className="hover:text-text">Confidentialité</Link>
          <Link href="/compte/supprimer" className="text-like/80 hover:text-like">Supprimer mon compte</Link>
        </nav>
      </div>
    </main>
  );
}
