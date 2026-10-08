/* eslint-disable @next/next/no-img-element -- image déjà réduite avant l'envoi */
"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/resizeImage";
import { CameraIcon } from "../icons";

// ═══════════════════════════════════════════════════════════════
// PHOTO DE COUVERTURE
//
// Bannière 3:1 en haut du profil, recadrée et réduite à 1200 × 400
// avant l'envoi (~80 Ko). Même bucket que l'avatar, dans le dossier de
// l'utilisateur; enregistrée sur le profil dès qu'elle est envoyée.
// ═══════════════════════════════════════════════════════════════
export function CoverPicker({ userId, value, onChange }: { userId: string; value: string | null; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(url: string | null) {
    onChange(url);
    const { error } = await supabaseBrowser().from("tub_profiles").update({ cover_url: url }).eq("id", userId);
    if (error) setError("Enregistrement impossible, réessaie.");
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choisis une image (JPG, PNG ou WebP).");
    setBusy(true);
    try {
      const blob = await resizeImage(file, 1200, 400);
      const supabase = supabaseBrowser();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/cover.${ext}`;
      const { error } = await supabase.storage
        .from("tub-avatars")
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = supabase.storage.from("tub-avatars").getPublicUrl(path);
      await persist(`${data.publicUrl}?v=${Date.now()}`);
    } catch (e) {
      console.error("[cover]", e);
      setError("Envoi impossible. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Photo de couverture</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label="Changer ma photo de couverture"
        className="cover-fallback group relative block aspect-[3/1] w-full overflow-hidden rounded-2xl border border-line transition active:scale-[0.99] disabled:opacity-60"
      >
        {value && <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-100 transition group-hover:bg-black/40">
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-2 text-sm font-semibold backdrop-blur">
            <CameraIcon width={16} height={16} />
            {busy ? "Envoi en cours…" : value ? "Changer la couverture" : "Ajouter une couverture"}
          </span>
        </span>
      </button>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
        <span>Format paysage conseillé · affichée en haut de ton profil</span>
        {value && !busy && (
          <button type="button" onClick={() => persist(null)} className="underline underline-offset-4">Retirer</button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-like">{error}</p>}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
