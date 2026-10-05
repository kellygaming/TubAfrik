import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { UploadForm } from "@/components/upload/UploadForm";

export const metadata: Metadata = { title: "Publier" };

export default async function PublishPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/publier");
  const { data: profile } = await supabase.from("tub_profiles").select("username,main_game").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/bienvenue?next=/publier");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-12">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-text">Annuler</Link>
        <h1 className="font-semibold">Nouvelle vidéo</h1>
        <span className="w-12" />
      </div>
      <UploadForm username={profile.username} defaultGame={profile.main_game} />
    </main>
  );
}
