import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { UploadForm } from "@/components/upload/UploadForm";

export const metadata: Metadata = { title: "Publier" };

export default async function PublishPage() {
  const supabase = await supabaseServer();
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/publier");
  const { data: profile } = await supabase.from("tub_profiles").select("username,main_game,main_category").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/bienvenue?next=/publier");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-12">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-text">Annuler</Link>
        <h1 className="font-semibold">Nouvelle vidéo</h1>
        <span className="w-12" />
      </div>
      <Link href="/live" className="mb-6 flex items-center gap-3 rounded-2xl border border-like/40 bg-like/10 p-4 transition active:scale-[0.99]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-like text-lg">🔴</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Passer en live</span>
          <span className="block text-xs text-muted">Caméra ou écran de jeu, avec le chat et les cadeaux en direct</span>
        </span>
        <span className="text-muted">›</span>
      </Link>
      <UploadForm username={profile.username} defaultCategory={profile.main_category} defaultGame={profile.main_game} />
    </main>
  );
}
