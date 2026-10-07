import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { fcfa } from "@/lib/gifts";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { GiftArt } from "@/components/gifts/GiftArt";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Activité", robots: { index: false } };

type Row = {
  id: number;
  kind: "gift" | "follow" | "comment";
  video_id: string | null;
  amount_fcfa: number | null;
  body: string | null;
  created_at: string;
  read_at: string | null;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
  gift: { name: string; emoji: string; image_url: string | null } | null;
};

export default async function ActivityPage() {
  const { user } = await getSession();
  if (!user) redirect("/connexion?next=/activite");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("tub_notifications")
    .select("id,kind,video_id,amount_fcfa,body,created_at,read_at,actor:tub_profiles!tub_notifications_actor_id_fkey(username,display_name,avatar_url),gift:tub_gifts(name,emoji,image_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const rows = (data as unknown as Row[] | null) ?? [];
  const hasUnread = rows.some((r) => !r.read_at);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-[calc(env(safe-area-inset-top)+20px)]">
      {hasUnread && <MarkRead />}
      <h1 className="font-display px-1 text-xl font-bold">Activité</h1>

      {rows.length === 0 ? (
        <div className="mt-20 text-center">
          <p className="text-5xl">🔔</p>
          <p className="mt-4 font-semibold">Rien pour l&apos;instant</p>
          <p className="mt-1 text-sm text-muted">Tes cadeaux, nouveaux abonnés et commentaires apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Item row={r} />
            </li>
          ))}
        </ul>
      )}
      <BottomNav />
    </main>
  );
}

function Item({ row }: { row: Row }) {
  const who = row.actor?.display_name ?? "Quelqu'un";
  const href = row.kind === "follow" || !row.video_id ? `/u/${row.actor?.username ?? ""}` : `/v/${row.video_id}`;
  const unread = !row.read_at;

  if (row.kind === "gift" && row.gift) {
    return (
      <Link href={href} className="vip-card flex items-center gap-3 p-3 pl-4">
        <Avatar src={row.actor?.avatar_url} name={who} size={44} className="ring-2 ring-gold" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-bold">{who}</span>{" "}
            <span className="text-gold-grad font-semibold">t&apos;a offert {row.gift.name}</span>
          </p>
          {row.body && <p className="truncate text-xs text-white/80">« {row.body} »</p>}
          <p className="text-xs text-muted">
            {row.amount_fcfa ? <span className="font-semibold text-gold">+{fcfa(row.amount_fcfa)}</span> : null}
            {row.amount_fcfa ? " · " : ""}il y a {timeAgo(row.created_at)}
          </p>
        </div>
        <GiftArt gift={row.gift} size={40} />
      </Link>
    );
  }

  return (
    <Link href={href} className={`flex items-center gap-3 rounded-2xl p-3 transition hover:bg-surface ${unread ? "bg-surface" : ""}`}>
      <Avatar src={row.actor?.avatar_url} name={who} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{who}</span>{" "}
          {row.kind === "follow" ? "s'est abonné à toi" : "a commenté ta vidéo"}
        </p>
        {row.kind === "comment" && row.body && <p className="truncate text-sm text-white/80">{row.body}</p>}
        <p className="text-xs text-muted">il y a {timeAgo(row.created_at)}</p>
      </div>
      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-like" aria-label="Nouveau" />}
    </Link>
  );
}
