"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PublicLive } from "@/lib/lives";
import { CATEGORIES } from "@/lib/categories";
import { CheckIcon, LinkIcon } from "../icons";
import { useSession } from "../session";
import { LivePlayer } from "./LivePlayer";
import { LiveChat } from "./LiveChat";
import { useLiveChat } from "./useLiveChat";

type Keys = { url: string; key: string };

// ═══════════════════════════════════════════════════════════════
// LE STUDIO DU CRÉATEUR
//
// 1. Titre + catégorie → « Préparer mon live »
// 2. L'adresse du serveur et la clé, à coller UNE FOIS dans Prism Live
//    Studio (ou Streamlabs): caméra ou écran du téléphone, au choix.
// 3. Dès que Cloudflare reçoit le flux, le live passe EN DIRECT tout
//    seul; le créateur voit son retour vidéo et le chat.
// ═══════════════════════════════════════════════════════════════
export function LiveStudio({ initial, defaultCategory }: { initial: PublicLive | null; defaultCategory: string | null }) {
  const [live, setLive] = useState<PublicLive | null>(initial);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState(defaultCategory ?? "divertissement");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, category: cat }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { live?: { id: string }; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.live) return setError(data?.error ?? "Connexion impossible, réessaie.");
    const s = await fetch(`/api/live/${data.live.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (s) setLive(s);
  }

  if (!live || live.status === "ended") {
    return (
      <form onSubmit={prepare} className="space-y-5">
        {live?.status === "ended" && (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm text-muted">Ton dernier live est terminé. Prêt pour le suivant ?</p>
        )}
        <label className="block">
          <span className="mb-1.5 flex justify-between text-sm font-medium">
            Titre du live <span className="font-normal text-muted">{title.length}/80</span>
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required
            placeholder="Ranked Free Fire avec les abonnés 🔥"
            className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-white/40" />
        </label>
        <div>
          <span className="mb-2 block text-sm font-medium">Catégorie</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.slug} onClick={() => setCat(c.slug)} aria-pressed={cat === c.slug}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${cat === c.slug ? "bg-white text-black" : "bg-surface-2 text-text/80"}`}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-like/10 px-3 py-2 text-sm text-like">{error}</p>}
        <button disabled={busy || !title.trim()}
          className="h-12 w-full rounded-full bg-like font-bold text-white transition active:scale-[0.98] disabled:opacity-50">
          {busy ? "Préparation…" : "🔴 Préparer mon live"}
        </button>
      </form>
    );
  }

  return <OnAir live={live} onChange={setLive} />;
}

function OnAir({ live, onChange }: { live: PublicLive; onChange: (l: PublicLive) => void }) {
  const { userId } = useSession();
  const [keys, setKeys] = useState<Keys | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const chat = useLiveChat(live.id);

  useEffect(() => {
    fetch(`/api/live/${live.id}/cle`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((k) => k && setKeys(k))
      .catch(() => {});
  }, [live.id]);

  // Le créateur suit son état de près: toutes les 5 s.
  useEffect(() => {
    const t = setInterval(async () => {
      const res = await fetch(`/api/live/${live.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) onChange(await res.json());
    }, 5000);
    return () => clearInterval(t);
  }, [live.id, onChange]);

  const copy = useCallback(async (label: string, text: string) => {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1800);
  }, []);

  async function end() {
    setEnding(true);
    await fetch(`/api/live/${live.id}/fin`, { method: "POST" }).catch(() => null);
    const res = await fetch(`/api/live/${live.id}`, { cache: "no-store" }).catch(() => null);
    setEnding(false);
    if (res?.ok) onChange(await res.json());
  }

  const onAir = live.status === "live";

  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-3 rounded-2xl p-4 ${onAir ? "bg-like/15 ring-1 ring-like/50" : "bg-surface-2"}`}>
        <span className={`h-3 w-3 shrink-0 rounded-full ${onAir ? "animate-pulse bg-like" : "animate-pulse bg-white/40"}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{onAir ? "Tu es EN DIRECT" : "En attente de ton signal…"}</p>
          <p className="truncate text-xs text-muted">{live.title}</p>
        </div>
        {onAir && (
          <Link href={`/live/${live.id}`} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black">
            Vue spectateur
          </Link>
        )}
      </div>

      {onAir && live.hls && (
        <div className="overflow-hidden rounded-2xl bg-black">
          <LivePlayer src={live.hls} muted className="aspect-[9/16] max-h-[50dvh] w-full" />
        </div>
      )}

      {!onAir && (
        <section className="space-y-4 rounded-2xl border border-line p-4">
          <h2 className="font-semibold">Lance la diffusion depuis ton téléphone</h2>
          <ol className="space-y-3 text-sm text-text/85">
            <li>
              <b>1.</b> Installe <b>Prism Live Studio</b> (gratuit,{" "}
              <a href="https://prismlive.com" target="_blank" rel="noreferrer" className="underline">prismlive.com</a>
              ). Il filme ta caméra <i>ou</i> l&apos;écran de ton jeu.
            </li>
            <li><b>2.</b> Dans Prism : <b>Ajouter une chaîne → RTMP personnalisé</b> (Custom RTMP).</li>
            <li><b>3.</b> Colle ces deux informations (une seule fois, Prism s&apos;en souvient) :</li>
          </ol>

          <Field label="Adresse du serveur (URL RTMP)" value={keys?.url} copied={copied === "url"} onCopy={() => keys && copy("url", keys.url)} />
          <Field
            label="Clé de diffusion — secrète, ne la montre à personne"
            value={keys ? (showKey ? keys.key : "•".repeat(24)) : undefined}
            copied={copied === "key"}
            onCopy={() => keys && copy("key", keys.key)}
            extra={
              <button type="button" onClick={() => setShowKey((s) => !s)} className="text-xs text-muted underline">
                {showKey ? "Masquer" : "Afficher"}
              </button>
            }
          />
          <p className="text-sm text-text/85"><b>4.</b> Dans Prism, choisis le mode <b>vertical</b>, puis touche <b>Démarrer</b>. Ton live apparaît ici en quelques secondes.</p>
          <p className="text-xs text-muted">Conseil réseau : 720p, 30 images/s, débit 1 500 à 2 500 kbit/s. En 3G, baisse à 480p.</p>
        </section>
      )}

      {onAir && (
        <section className="rounded-2xl bg-surface p-3">
          <h2 className="mb-2 text-sm font-semibold">Chat</h2>
          <LiveChat
            messages={chat.messages}
            creatorId={live.creatorId}
            canWrite
            onSend={(b) => (userId ? chat.send(userId, b) : Promise.resolve(null))}
            onRemove={chat.remove}
          />
        </section>
      )}

      {confirm ? (
        <div className="flex gap-2">
          <button onClick={end} disabled={ending} className="h-12 flex-1 rounded-full bg-like font-bold text-white disabled:opacity-50">
            {ending ? "Fin du live…" : "Oui, terminer"}
          </button>
          <button onClick={() => setConfirm(false)} className="h-12 flex-1 rounded-full border border-line font-semibold">Annuler</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="h-12 w-full rounded-full border border-like/60 font-semibold text-like">
          Terminer le live
        </button>
      )}
      <p className="text-center text-xs text-muted">Pense aussi à arrêter la diffusion dans Prism.</p>
    </div>
  );
}

function Field({ label, value, copied, onCopy, extra }: { label: string; value?: string; copied: boolean; onCopy: () => void; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        {extra}
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-3">
        <code className="min-w-0 flex-1 truncate text-[13px]">{value ?? "Chargement…"}</code>
        <button type="button" onClick={onCopy} disabled={!value}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40">
          {copied ? <><CheckIcon width={14} height={14} /> Copié</> : <><LinkIcon width={14} height={14} /> Copier</>}
        </button>
      </div>
    </div>
  );
}
