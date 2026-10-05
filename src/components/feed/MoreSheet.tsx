"use client";

import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FeedItem } from "@/lib/types";
import { Sheet } from "../Sheet";
import { CheckIcon, FlagIcon, LeafIcon, TrashIcon } from "../icons";
import { loginHref, useSession } from "../session";
import { useFeedSettings } from "./useFeedSettings";

const REASONS = [
  ["nudite", "Nudité ou contenu sexuel"],
  ["violence", "Violence ou contenu choquant"],
  ["haine", "Haine ou harcèlement"],
  ["arnaque", "Arnaque (faux diamants, faux comptes…)"],
  ["droits_auteur", "Vole le contenu de quelqu'un"],
  ["spam", "Spam"],
  ["autre", "Autre chose"],
] as const;

export function MoreSheet({
  item,
  onClose,
  onRemoved,
}: {
  item: FeedItem | null;
  onClose: () => void;
  onRemoved: (id: string) => void;
}) {
  const { userId } = useSession();
  const { dataSaver, setDataSaver } = useFeedSettings();
  const [step, setStep] = useState<"menu" | "report" | "done" | "confirm-delete">("menu");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!item) return null;
  const isOwner = item.author_id === userId;

  function close() {
    setStep("menu");
    setMessage(null);
    onClose();
  }

  async function report(reason: string) {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from("tub_reports")
      .insert({ video_id: item!.id, reporter_id: userId, reason });
    setBusy(false);
    setMessage(error?.code === "23505" ? "Tu as déjà signalé cette vidéo." : error ? "Signalement impossible." : null);
    setStep("done");
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/videos/${item!.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setMessage("Suppression impossible, réessaie.");
    onRemoved(item!.id);
    close();
  }

  const row = "flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50";

  return (
    <Sheet open onClose={close} title={step === "report" ? "Pourquoi signaler ?" : "Options"}>
      <div className="px-2 pb-4">
        {step === "menu" && (
          <>
            <button className={row} onClick={() => setDataSaver(!dataSaver)} aria-pressed={dataSaver}>
              <LeafIcon className="text-ok" />
              <span className="flex-1">
                Économie de data
                <span className="block text-xs text-muted">Qualité limitée à 360p</span>
              </span>
              <span className={`h-6 w-10 rounded-full p-0.5 transition ${dataSaver ? "bg-ok" : "bg-surface-2"}`}>
                <span className={`block h-5 w-5 rounded-full bg-white transition ${dataSaver ? "translate-x-4" : ""}`} />
              </span>
            </button>
            {isOwner ? (
              <button className={`${row} text-like`} onClick={() => setStep("confirm-delete")}>
                <TrashIcon /> Supprimer ma vidéo
              </button>
            ) : userId ? (
              <button className={row} onClick={() => setStep("report")}>
                <FlagIcon /> Signaler
              </button>
            ) : (
              <Link className={row} href={loginHref()}>
                <FlagIcon /> Connecte-toi pour signaler
              </Link>
            )}
          </>
        )}

        {step === "report" &&
          REASONS.map(([value, label]) => (
            <button key={value} className={row} disabled={busy} onClick={() => report(value)}>
              {label}
            </button>
          ))}

        {step === "done" && (
          <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
            <CheckIcon className="text-ok" width={36} height={36} />
            <p className="font-semibold">{message ?? "Merci, on regarde ça."}</p>
            <p className="text-xs text-muted">Les signalements nous aident à garder TubAfrik propre.</p>
          </div>
        )}

        {step === "confirm-delete" && (
          <div className="px-4 py-4 text-center">
            <p className="font-semibold">Supprimer définitivement cette vidéo ?</p>
            <p className="mt-1 text-xs text-muted">Les likes et commentaires seront perdus.</p>
            {message && <p className="mt-2 text-xs text-like">{message}</p>}
            <div className="mt-5 flex gap-3">
              <button className="flex-1 rounded-full bg-surface-2 py-2.5 text-sm" onClick={() => setStep("menu")}>
                Annuler
              </button>
              <button disabled={busy} className="flex-1 rounded-full bg-like py-2.5 text-sm font-semibold disabled:opacity-50" onClick={remove}>
                {busy ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
