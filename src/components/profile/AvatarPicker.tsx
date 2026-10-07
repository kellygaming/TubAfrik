"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "../Avatar";
import { CameraIcon } from "../icons";

// ═══════════════════════════════════════════════════════════════
// PHOTO DE PROFIL
//
// La photo est recadrée en carré et réduite à 384 px AVANT l'envoi:
// une photo de téléphone de 5 Mo devient ~30 Ko. Essentiel ici, où
// chaque avatar s'affiche des milliers de fois dans le fil.
// Toujours le même nom de fichier (avatar.webp, ou avatar.jpg sur
// iPhone, écrasé à chaque changement) + un numéro de version dans l'adresse pour que les
// navigateurs montrent la nouvelle photo tout de suite.
// ═══════════════════════════════════════════════════════════════
const SIZE = 384;

async function squareResize(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Image illisible"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(SIZE, side);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    // Safari (iPhone) ne sait pas encoder le WebP: il rend un PNG lourd à
    // la place. On le détecte et on repasse en JPEG, accepté partout.
    let blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") {
      blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
    }
    if (!blob) throw new Error("Conversion impossible");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarPicker({
  userId,
  name,
  value,
  onChange,
}: {
  userId: string;
  name: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // La photo s'enregistre sur le profil tout de suite, sans attendre le
  // bouton « Enregistrer » du formulaire (qu'on oublie souvent).
  // À l'inscription le profil n'existe pas encore: la mise à jour ne
  // touche aucune ligne et le formulaire s'en charge à la création.
  async function persist(url: string | null) {
    onChange(url);
    await supabaseBrowser().from("tub_profiles").update({ avatar_url: url }).eq("id", userId);
    setSaved(true);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaved(false);
    if (!file.type.startsWith("image/")) return setError("Choisis une image (JPG, PNG ou WebP).");
    setBusy(true);
    try {
      const blob = await squareResize(file);
      const supabase = supabaseBrowser();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from("tub-avatars")
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("tub-avatars").getPublicUrl(path);
      await persist(`${data.publicUrl}?v=${Date.now()}`);
    } catch (e) {
      console.error("[avatar]", e);
      setError("Envoi impossible. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Changer ma photo de profil"
        className="group relative shrink-0 rounded-full transition active:scale-95 disabled:opacity-60"
      >
        <Avatar src={value} name={name} size={80} className={busy ? "opacity-40" : ""} />
        <span className="absolute -right-0.5 -bottom-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-text text-bg">
          <CameraIcon width={15} height={15} />
        </span>
        {busy && <span className="absolute inset-0 grid place-items-center text-xs font-medium">…</span>}
      </button>
      <div className="text-sm text-muted">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="font-medium text-text underline underline-offset-4">
          {busy ? "Envoi en cours…" : "Changer ma photo"}
        </button>
        {value && !busy && (
          <button type="button" onClick={() => persist(null)} className="mt-1 block text-xs underline underline-offset-4">
            Retirer la photo
          </button>
        )}
        {saved && !busy && !error && <p className="mt-1 text-xs text-ok">Photo enregistrée ✓</p>}
        {error && <p role="alert" className="mt-1 text-xs text-like">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
