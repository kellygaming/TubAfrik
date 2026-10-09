import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { isAdminEmail, supabaseAdmin } from "@/lib/supabase/admin";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "Accès aux lives", robots: { index: false } };

type Row = { id: string; username: string; display_name: string; avatar_url: string | null; live_enabled: boolean };
const COLS = "id,username,display_name,avatar_url,live_enabled";

async function requireAdmin() {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) throw new Error("Interdit");
}

async function setLive(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id"));
  const on = formData.get("on") === "1";
  await supabaseAdmin().from("tub_profiles").update({ live_enabled: on }).eq("id", id).is("deleted_at", null);
  revalidatePath("/admin/lives");
}

// Recherche par pseudo / nom affiché, ou par adresse email (compte Google).
async function search(q: string): Promise<Row[]> {
  const db = supabaseAdmin();
  if (q.includes("@")) {
    const wanted = q.toLowerCase();
    // Les comptes de connexion sont partagés avec Kelly Gaming: on parcourt quelques pages.
    for (let page = 1; page <= 10; page++) {
      const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      const hit = data?.users.find((u) => u.email?.toLowerCase() === wanted);
      if (hit) {
        const { data: p } = await db.from("tub_profiles").select(COLS).eq("id", hit.id).is("deleted_at", null).maybeSingle();
        return p ? [p as Row] : [];
      }
      if (!data || data.users.length < 1000) break;
    }
    return [];
  }
  const term = q.replace(/^@/, "").replace(/[%_,()]/g, "");
  const { data } = await db.from("tub_profiles").select(COLS).is("deleted_at", null)
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(20);
  return (data as Row[] | null) ?? [];
}

export default async function LiveAccess({ searchParams }: PageProps<"/admin/lives">) {
  const { user } = await getSession();
  if (!isAdminEmail(user?.email)) notFound();
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 120);

  const [{ data: enabled }, results] = await Promise.all([
    supabaseAdmin().from("tub_profiles").select(COLS).eq("live_enabled", true).is("deleted_at", null).order("username"),
    q.length >= 2 ? search(q) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Accès aux lives</h1>
        <Link href="/admin" className="text-sm text-muted hover:text-text">← Modération</Link>
      </div>
      <p className="mt-1 text-sm text-muted">Les lives sont sur invitation. Cherche un créateur par pseudo ou par email, puis active son accès.</p>

      <form className="mt-6 flex gap-2">
        <input name="q" defaultValue={q} placeholder="@pseudo ou adresse email" autoComplete="off"
          className="h-11 flex-1 rounded-full border border-line bg-surface px-4 text-base outline-none focus:border-white/40" />
        <button className="rounded-full bg-white px-5 text-sm font-semibold text-black">Chercher</button>
      </form>

      {results && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted">Résultats</h2>
          {results.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aucun profil TubAfrik trouvé. La personne doit d&apos;abord créer son profil sur le site.</p>
          ) : (
            <ul className="mt-3 space-y-2">{results.map((r) => <Item key={r.id} row={r} />)}</ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-muted">Peuvent faire des lives ({enabled?.length ?? 0})</h2>
        <ul className="mt-3 space-y-2">{((enabled as Row[] | null) ?? []).map((r) => <Item key={r.id} row={r} />)}</ul>
        <p className="mt-3 text-xs text-muted">Les administrateurs peuvent toujours faire des lives.</p>
      </section>
    </main>
  );
}

function Item({ row }: { row: Row }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <Avatar src={row.avatar_url} name={row.display_name} size={40} />
      <Link href={`/u/${row.username}`} className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{row.display_name}</span>
        <span className="block truncate text-xs text-muted">@{row.username}</span>
      </Link>
      <form action={setLive}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="on" value={row.live_enabled ? "0" : "1"} />
        {row.live_enabled ? (
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-like">Retirer</button>
        ) : (
          <button className="rounded-full bg-like px-4 py-2 text-sm font-semibold text-white">🔴 Autoriser</button>
        )}
      </form>
    </li>
  );
}
