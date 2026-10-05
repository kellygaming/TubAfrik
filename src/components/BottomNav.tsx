"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PlusIcon, UserIcon } from "./icons";
import { useSession } from "./session";
import { Avatar } from "./Avatar";

export function BottomNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const { userId, profile } = useSession();

  const profileHref = profile ? `/u/${profile.username}` : userId ? "/bienvenue" : "/connexion";
  const onHome = pathname === "/" || pathname.startsWith("/v/");
  const onProfile = pathname.startsWith("/u/") || pathname.startsWith("/profil");

  return (
    <nav
      aria-label="Navigation principale"
      className={`pb-safe fixed inset-x-0 bottom-0 z-40 ${
        overlay ? "bg-gradient-to-t from-black/90 to-black/0" : "border-t border-line bg-bg/95 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-6">
        <Link href="/" className={`flex flex-col items-center gap-0.5 text-[11px] ${onHome ? "text-text" : "text-muted"}`}>
          <HomeIcon filled={onHome} />
          Accueil
        </Link>

        <Link
          href={userId ? "/publier" : "/connexion?next=/publier"}
          aria-label="Publier une vidéo"
          className="bg-brand grid h-10 w-14 place-items-center rounded-xl text-bg transition active:scale-95"
        >
          <PlusIcon />
        </Link>

        <Link
          href={profileHref}
          className={`flex flex-col items-center gap-0.5 text-[11px] ${onProfile ? "text-text" : "text-muted"}`}
        >
          {profile ? (
            <Avatar src={profile.avatar_url} name={profile.display_name} size={24}
              className={onProfile ? "ring-2 ring-text" : ""} />
          ) : (
            <UserIcon filled={onProfile} />
          )}
          {userId ? "Profil" : "Connexion"}
        </Link>
      </div>
    </nav>
  );
}
