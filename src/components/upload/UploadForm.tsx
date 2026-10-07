"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Upload } from "tus-js-client";
import { GAMES, isGameSlug } from "@/lib/games";
import { CheckIcon, UploadIcon } from "../icons";

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_SECONDS = 180;

type Phase =
  | { step: "pick" }
  | { step: "edit" }
  | { step: "uploading"; pct: number }
  | { step: "processing"; id: string; pct: number; slow?: boolean }
  | { step: "done"; id: string }
  | { step: "error"; message: string; retry: boolean };

type Credentials = { endpoint: string; libraryId: string; videoId: string; expire: number; signature: string };

export function UploadForm({ username, defaultGame }: { username: string; defaultGame: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [game, setGame] = useState<string | null>(isGameSlug(defaultGame) ? defaultGame : null);
  const [phase, setPhase] = useState<Phase>({ step: "pick" });
  const [problem, setProblem] = useState<string | null>(null);
  const uploadRef = useRef<Upload | null>(null);
  // Une fois la vidéo créée chez Bunny, « Réessayer » relance l'envoi
  // vers la même vidéo au lieu d'en créer une nouvelle.
  const prepared = useRef<{ id: string; cred: Credentials } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const leaving = useRef(false);

  useEffect(() => () => {
    leaving.current = true;
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // Pendant l'envoi, quitter la page perdrait la vidéo: on prévient.
  useEffect(() => {
    if (phase.step !== "uploading") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase.step]);

  async function pick(f: File | undefined) {
    setProblem(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) return setProblem("Ce fichier n'est pas une vidéo.");
    if (f.size > MAX_BYTES) return setProblem("Vidéo trop lourde (300 Mo max). Coupe-la ou réduis la qualité.");
    const url = URL.createObjectURL(f);
    const duration = await readDuration(url);
    if (duration > MAX_SECONDS + 1) {
      URL.revokeObjectURL(url);
      return setProblem(`Vidéo trop longue (${Math.round(duration)} s). Maximum : 3 minutes.`);
    }
    setFile(f);
    setPreview(url);
    setPhase({ step: "edit" });
  }

  async function publish() {
    if (!file || !game) return;
    setPhase({ step: "uploading", pct: 0 });

    if (!prepared.current) {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption, game }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; upload?: Credentials; error?: string };
      if (!res.ok || !data.id || !data.upload) {
        return setPhase({ step: "error", message: data.error ?? "Impossible de préparer l'envoi.", retry: res.status >= 500 });
      }
      prepared.current = { id: data.id, cred: data.upload };
    }

    const { Upload } = await import("tus-js-client");
    const { id, cred } = prepared.current;
    // TUS: l'envoi se fait par morceaux et reprend tout seul après une coupure réseau.
    const upload = new Upload(file, {
      endpoint: cred.endpoint,
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000, 60000],
      chunkSize: 5 * 1024 * 1024,
      storeFingerprintForResuming: false,
      headers: {
        AuthorizationSignature: cred.signature,
        AuthorizationExpire: String(cred.expire),
        VideoId: cred.videoId,
        LibraryId: cred.libraryId,
      },
      // Le titre côté Bunny: pseudo et légende plutôt que le nom du fichier du téléphone.
      metadata: { filetype: file.type, title: `@${username} · ${caption.trim().slice(0, 60) || "TubAfrik"}` },
      onProgress: (sent, total) => setPhase({ step: "uploading", pct: Math.round((sent / total) * 100) }),
      onError: () => setPhase({ step: "error", message: "L'envoi a échoué. Vérifie ta connexion.", retry: true }),
      onSuccess: () => {
        setPhase({ step: "processing", id, pct: 0 });
        waitForEncoding(id);
      },
    });
    uploadRef.current = upload;
    upload.start();
  }

  // Bunny encode en plusieurs qualités: on interroge l'état jusqu'au bout,
  // sans limite de temps. Toutes les 4 s au début, puis toutes les 10 s.
  // Si on quitte la page, le serveur prend le relais (tâche planifiée
  // /api/cron/sync-videos) et publie la vidéo dès que Bunny a fini.
  async function waitForEncoding(id: string) {
    const start = Date.now();
    while (!leaving.current) {
      const res = await fetch(`/api/videos/${id}/sync`, { method: "POST" }).catch(() => null);
      const s = (await res?.json().catch(() => null)) as { status?: string; progress?: number } | null;
      if (s?.status === "ready") return setPhase({ step: "done", id });
      if (s?.status === "failed") return setPhase({ step: "error", message: "Le traitement de la vidéo a échoué. Essaie un autre fichier.", retry: false });
      const elapsed = Date.now() - start;
      setPhase({ step: "processing", id, pct: s?.progress ?? 0, slow: elapsed > 3 * 60_000 });
      await new Promise((r) => setTimeout(r, elapsed > 2 * 60_000 ? 10_000 : 4000));
    }
  }

  function reset() {
    uploadRef.current?.abort();
    prepared.current = null;
    setFile(null);
    setPreview(null);
    setCaption("");
    setPhase({ step: "pick" });
  }

  // ── Écrans ──────────────────────────────────────────────────────
  if (phase.step === "pick") {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className="group flex aspect-[9/14] w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/15 bg-surface transition hover:border-brand/60"
        >
          <span className="bg-brand grid h-16 w-16 place-items-center rounded-2xl text-bg transition group-hover:scale-105">
            <UploadIcon width={30} height={30} />
          </span>
          <span className="text-lg font-semibold">Choisis ta vidéo</span>
          <span className="max-w-[16rem] text-center text-sm text-muted">
            Format vertical conseillé · 3 min max · 300 Mo max
          </span>
        </button>
        <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
        {problem && <p role="alert" className="mt-4 rounded-xl bg-like/10 px-4 py-3 text-sm text-like">{problem}</p>}
        <Tips />
      </div>
    );
  }

  if (phase.step === "done") {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-ok/15 text-ok">
          <CheckIcon width={40} height={40} />
        </span>
        <h2 className="mt-5 text-2xl font-bold">C&apos;est en ligne ! 🔥</h2>
        <p className="mt-2 text-muted">Partage-la sur WhatsApp pour lancer tes premières vues.</p>
        <div className="mt-8 flex w-full flex-col gap-3">
          <Link href={`/v/${phase.id}`} className="bg-brand rounded-full py-3 font-semibold text-bg">Voir ma vidéo</Link>
          <button onClick={reset} className="rounded-full border border-line py-3 text-sm">Publier une autre vidéo</button>
        </div>
      </div>
    );
  }

  const busy = phase.step === "uploading" || phase.step === "processing";

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <video src={preview ?? undefined} className="aspect-[9/16] w-28 shrink-0 rounded-2xl bg-black object-cover" muted playsInline autoPlay loop />
        <label className="flex flex-1 flex-col">
          <span className="mb-1.5 flex justify-between text-sm font-medium">
            Légende <span className="font-normal text-muted">{caption.length}/300</span>
          </span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={300}
            disabled={busy}
            placeholder="Décris ton clip… #clutch #booyah"
            className="flex-1 resize-none rounded-xl border border-line bg-surface p-3 text-base outline-none focus:border-brand/70 focus:ring-2 focus:ring-brand/30"
          />
        </label>
      </div>

      <fieldset disabled={busy}>
        <legend className="mb-2 text-sm font-medium">Jeu <span className="text-like">*</span></legend>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <button
              type="button"
              key={g.slug}
              aria-pressed={game === g.slug}
              onClick={() => setGame(g.slug)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                game === g.slug ? "bg-brand border-transparent font-semibold text-bg" : "border-line bg-surface hover:border-white/20"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </fieldset>

      {phase.step === "error" && (
        <p role="alert" className="rounded-xl bg-like/10 px-4 py-3 text-sm text-like">{phase.message}</p>
      )}

      {busy ? (
        <Progress
          label={phase.step === "uploading" ? `Envoi… ${phase.pct} %` : `Traitement de la vidéo… ${phase.pct} %`}
          pct={phase.pct}
          hint={
            phase.step === "processing"
              ? phase.slow
                ? "Le traitement prend plus de temps que d'habitude. Ta vidéo est bien reçue : tu peux fermer cette page, elle sera publiée automatiquement."
                : `Tu peux quitter cette page : la vidéo apparaîtra sur @${username} dès qu'elle est prête.`
              : "Garde cette page ouverte pendant l'envoi."
          }
        />
      ) : (
        <div className="flex gap-3">
          <button onClick={reset} className="rounded-full border border-line px-5 py-3 text-sm">Changer</button>
          <button
            onClick={publish}
            disabled={!game || (phase.step === "error" && !phase.retry)}
            className="bg-brand flex-1 rounded-full py-3 font-semibold text-bg transition active:scale-[0.98] disabled:opacity-50"
          >
            {phase.step === "error" ? "Réessayer" : "Publier"}
          </button>
        </div>
      )}

      {phase.step === "processing" && (
        <Link href={`/u/${username}`} className="block rounded-full border border-line py-3 text-center text-sm">
          Aller sur mon profil
        </Link>
      )}
    </div>
  );
}

function Progress({ label, pct, hint }: { label: string; pct: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-brand h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Tips() {
  return (
    <ul className="mt-6 space-y-2 text-sm text-muted">
      <li>🎯 Les 2 premières secondes décident de tout : commence par l&apos;action.</li>
      <li>📱 Filme ou recadre en vertical (9:16) pour remplir l&apos;écran.</li>
      <li>🎵 Évite la musique protégée : ta vidéo pourrait être retirée.</li>
    </ul>
  );
}

function readDuration(url: string) {
  return new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}
