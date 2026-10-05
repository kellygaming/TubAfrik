import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage({ searchParams }: PageProps<"/bienvenue">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const { user, profile } = await getSession();
  if (!user) redirect("/connexion");
  if (profile) redirect(next);

  const meta = user.user_metadata ?? {};
  const fullName: string = meta.full_name || meta.name || "";
  // Pseudo proposé à partir de l'adresse: « kelly.yt@gmail.com » → « kelly.yt ».
  const suggestion = (user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top)+32px)] pb-12">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Bienvenue sur <span className="text-gradient">TubAfrik</span> 👋
      </h1>
      <p className="mt-2 text-muted">Choisis comment la communauté va te reconnaître.</p>
      <div className="mt-8">
        <ProfileForm
          mode="create"
          next={next}
          userId={user.id}
          initial={{
            username: suggestion.length >= 3 ? suggestion : "",
            display_name: fullName.slice(0, 40),
            avatar_url: typeof meta.avatar_url === "string" && meta.avatar_url.startsWith("https://") ? meta.avatar_url : null,
            bio: "",
            main_game: null,
            country: null,
          }}
        />
      </div>
    </main>
  );
}
