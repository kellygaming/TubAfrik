"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { GAMES } from "@/lib/games";
import { COUNTRIES, flag } from "@/lib/countries";
import { Avatar } from "../Avatar";

type Values = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  main_game: string | null;
  country: string | null;
};

const USERNAME_RE = /^[a-z0-9_.]{3,24}$/;

export function ProfileForm({
  userId,
  initial,
  mode,
  next = "/",
}: {
  userId: string;
  initial: Values;
  mode: "create" | "edit";
  next?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((s) => ({ ...s, [k]: val }));

  const usernameOk = USERNAME_RE.test(v.username);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameOk) return setError("Pseudo: 3 à 24 caractères, lettres minuscules, chiffres, « _ » ou « . ».");
    if (!v.display_name.trim()) return setError("Indique ton nom affiché.");
    setBusy(true);
    setError(null);

    const row = {
      username: v.username,
      display_name: v.display_name.trim(),
      avatar_url: v.avatar_url,
      bio: v.bio.trim() || null,
      main_game: v.main_game,
      country: v.country,
    };
    const supabase = supabaseBrowser();
    const { error } =
      mode === "create"
        ? await supabase.from("tub_profiles").insert({ id: userId, ...row })
        : await supabase.from("tub_profiles").update(row).eq("id", userId);

    if (error) {
      setBusy(false);
      return setError(error.code === "23505" ? "Ce pseudo est déjà pris, essaie une variante." : "Enregistrement impossible, réessaie.");
    }
    router.replace(mode === "create" ? next : `/u/${v.username}`);
    router.refresh();
  }

  const field = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/30";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar src={v.avatar_url} name={v.display_name || v.username} size={72} className="ring-2 ring-brand/60" />
        <div className="text-sm text-muted">
          Ta photo vient de ton compte Google.
          {v.avatar_url && (
            <button type="button" onClick={() => set("avatar_url", null)} className="mt-1 block text-xs text-text underline underline-offset-4">
              Utiliser mes initiales
            </button>
          )}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Pseudo</span>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input
            value={v.username}
            onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24))}
            className={`${field} pl-9`}
            autoCapitalize="none"
            autoComplete="username"
            required
          />
        </div>
        <span className={`mt-1 block text-xs ${usernameOk || !v.username ? "text-muted" : "text-like"}`}>
          tubafrik.com/u/{v.username || "ton-pseudo"}
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Nom affiché</span>
        <input value={v.display_name} maxLength={40} onChange={(e) => set("display_name", e.target.value)} className={field} required />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Ton jeu principal</legend>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => {
            const on = v.main_game === g.slug;
            return (
              <button
                type="button"
                key={g.slug}
                aria-pressed={on}
                onClick={() => set("main_game", on ? null : g.slug)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                  on ? "bg-gradient-brand border-transparent font-semibold text-bg" : "border-line bg-surface text-text/90 hover:border-white/20"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Pays</span>
        <select value={v.country ?? ""} onChange={(e) => set("country", e.target.value || null)} className={`${field} appearance-none`}>
          <option value="">— Choisir —</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {flag(code)} {name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-medium">
          Bio <span className="font-normal text-muted">{v.bio.length}/160</span>
        </span>
        <textarea
          value={v.bio}
          maxLength={160}
          rows={3}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Ex. : Rusher Free Fire 🔥 · Top 1 Côte d'Ivoire"
          className={`${field} h-auto resize-none py-3`}
        />
      </label>

      {error && <p role="alert" className="rounded-xl bg-like/10 px-4 py-3 text-sm text-like">{error}</p>}

      <button disabled={busy} className="bg-gradient-brand h-12 w-full rounded-full font-semibold text-bg transition active:scale-[0.98] disabled:opacity-60">
        {busy ? "Enregistrement…" : mode === "create" ? "C'est parti 🚀" : "Enregistrer"}
      </button>
    </form>
  );
}
