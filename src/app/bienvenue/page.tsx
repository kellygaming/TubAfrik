import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Bienvenue" };

export default async function WelcomePage({ searchParams }: PageProps<"/bienvenue">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";
  const session = await getSession();
  const { user, profile } = session;
  if (!user) redirect("/connexion");
  if ("deleted" in session && session.deleted) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
        <div>
          <p className="text-5xl">👋</p>
          <h1 className="mt-4 text-xl font-bold">Ce compte TubAfrik a été supprimé</h1>
          <p className="mt-2 text-sm text-muted">Pour en recréer un, écris-nous depuis cette adresse e-mail.</p>
        </div>
      </main>
    );
  }
  if (profile) redirect(next);

  const meta = user.user_metadata ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const fullName = str(meta.full_name) || str(meta.name);
  // Pseudo proposé à partir de l'adresse: « kelly.yt@gmail.com » → « kelly.yt ».
  const suggestion = (user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pt-[calc(env(safe-area-inset-top)+32px)] pb-12">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Bienvenue sur <span className="text-brand">TubAfrik</span> 👋
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
            main_category: null,
            interests: [],
            country: null,
          }}
        />
      </div>
    </main>
  );
}
