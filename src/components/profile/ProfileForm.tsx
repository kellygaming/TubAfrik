"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { GAMES } from "@/lib/games";
import { CATEGORIES } from "@/lib/categories";
import { COUNTRIES, flag } from "@/lib/countries";
import { AvatarPicker } from "./AvatarPicker";
import { CoverPicker } from "./CoverPicker";

type Values = {
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url?: string | null;
  email_opt_out?: boolean;
  bio: string;
  main_game: string | null;
  main_category: string | null;
  interests: string[];
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
      main_category: v.main_category,
      main_game: v.main_category === "gaming" ? v.main_game : null,
      interests: v.interests,
      country: v.country,
    };
    const supabase = supabaseBrowser();
    const { error } =
      mode === "create"
        ? await supabase.from("tub_profiles").insert({ id: userId, ...row })
        : await supabase.from("tub_profiles").update({ ...row, email_opt_out: Boolean(v.email_opt_out) }).eq("id", userId);

    if (error) {
      setBusy(false);
      return setError(error.code === "23505" ? "Ce pseudo est déjà pris, essaie une variante." : "Enregistrement impossible, réessaie.");
    }
    router.replace(mode === "create" ? next : `/u/${v.username}`);
    router.refresh();
  }

  const field = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none transition focus:border-brand/70 focus:ring-2 focus:ring-brand/30";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* La ligne de profil doit exister pour y enregistrer la couverture. */}
      {mode === "edit" && <CoverPicker userId={userId} value={v.cover_url ?? null} onChange={(url) => set("cover_url", url)} />}
      <AvatarPicker
        userId={userId}
        name={v.display_name || v.username}
        value={v.avatar_url}
        onChange={(url) => set("avatar_url", url)}
      />

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
        <legend className="mb-1 text-sm font-medium">Ce que tu aimes regarder</legend>
        <p className="mb-2.5 text-xs text-muted">Ton fil « Pour toi » partira de là, puis s&apos;affinera avec tes likes.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = v.interests.includes(c.slug);
            return (
              <Pill key={c.slug} on={on}
                onClick={() => set("interests", on ? v.interests.filter((x) => x !== c.slug) : [...v.interests, c.slug])}>
                {c.emoji} {c.name}
              </Pill>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tu publies surtout… <span className="font-normal text-muted">facultatif</span></legend>
        <p className="mb-2.5 text-xs text-muted">Affiché sur ton profil et proposé par défaut quand tu publies.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = v.main_category === c.slug;
            return (
              <Pill key={c.slug} on={on} onClick={() => set("main_category", on ? null : c.slug)}>
                {c.emoji} {c.name}
              </Pill>
            );
          })}
        </div>
        {v.main_category === "gaming" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {GAMES.map((g) => {
              const on = v.main_game === g.slug;
              return (
                <Pill key={g.slug} on={on} small onClick={() => set("main_game", on ? null : g.slug)}>
                  {g.name}
                </Pill>
              );
            })}
          </div>
        )}
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
          placeholder="Ex. : Cheffe ivoirienne 🍲 · Recettes en 60 secondes"
          className={`${field} h-auto resize-none py-3`}
        />
      </label>

      {mode === "edit" && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span>
            <span className="block text-sm font-medium">Emails d&apos;activité</span>
            <span className="block text-xs text-muted">Cadeaux, abonnés, commentaires, vidéo publiée. Au plus un résumé toutes les 3 h.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={!v.email_opt_out}
            onChange={(e) => set("email_opt_out", !e.target.checked)}
            className="peer sr-only"
          />
          <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-surface-2 transition peer-checked:bg-gold peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
      )}

      {error && <p role="alert" className="rounded-xl bg-like/10 px-4 py-3 text-sm text-like">{error}</p>}

      <button disabled={busy} className="bg-brand h-12 w-full rounded-full font-semibold text-bg transition active:scale-[0.98] disabled:opacity-60">
        {busy ? "Enregistrement…" : mode === "create" ? "C'est parti 🚀" : "Enregistrer"}
      </button>
    </form>
  );
}

function Pill({ on, small, onClick, children }: { on: boolean; small?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border transition ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
        on ? "bg-brand border-transparent font-semibold text-bg" : "border-line bg-surface text-text/90 hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}
