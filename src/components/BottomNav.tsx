"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "./icons";
import { useSession } from "./session";
import { Avatar } from "./Avatar";
import { useUnread } from "./notifications/useUnread";

export function BottomNav({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const { userId, profile } = useSession();
  const unread = useUnread(userId);

  const profileHref = profile ? `/u/${profile.username}` : userId ? "/bienvenue" : "/connexion";
  const onHome = pathname === "/" || pathname.startsWith("/v/");
  const onSearch = pathname.startsWith("/recherche");
  const onActivity = pathname.startsWith("/activite");
  const onProfile = pathname.startsWith("/u/") || pathname.startsWith("/profil") || pathname.startsWith("/gains");
  const item = (on: boolean) => `flex w-14 flex-col items-center gap-0.5 text-[11px] ${on ? "text-text" : "text-muted"}`;

  return (
    <nav
      aria-label="Navigation principale"
      className={`pb-safe fixed inset-x-0 bottom-0 z-40 ${
        overlay ? "bg-gradient-to-t from-black/90 to-black/0" : "border-t border-line bg-bg/95 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        <Link href="/" className={item(onHome)}>
          <HomeIcon filled={onHome} />
          Accueil
        </Link>

        <Link href="/recherche" className={item(onSearch)}>
          <SearchIcon strokeWidth={onSearch ? 2.6 : 2} />
          Découvrir
        </Link>

        <Link
          href={userId ? "/publier" : "/connexion?next=/publier"}
          aria-label="Publier une vidéo"
          className="bg-brand grid h-10 w-14 place-items-center rounded-xl text-bg transition active:scale-95"
        >
          <PlusIcon />
        </Link>

        <Link href={userId ? "/activite" : "/connexion?next=/activite"} className={item(onActivity)}
          aria-label={unread ? `Activité, ${unread} nouveauté${unread > 1 ? "s" : ""}` : "Activité"}>
          <span className="relative">
            <BellIcon filled={onActivity} />
            {unread > 0 && (
              <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-like px-1 text-[10px] font-bold leading-none text-white ring-2 ring-black">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          Activité
        </Link>

        <Link href={profileHref} className={item(onProfile)}>
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
