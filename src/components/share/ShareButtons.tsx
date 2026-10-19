"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon, ShareIcon, WhatsAppIcon } from "../icons";

// WhatsApp d'abord: c'est par là que les vidéos circulent en Afrique.
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener"
        className="flex flex-col items-center gap-2 text-xs">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white">
          <WhatsAppIcon width={28} height={28} />
        </span>
        WhatsApp
      </a>
      <button type="button" onClick={copy} className="flex flex-col items-center gap-2 text-xs">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2">
          {copied ? <CheckIcon className="text-ok" /> : <LinkIcon />}
        </span>
        {copied ? "Copié !" : "Copier le lien"}
      </button>
      {canNativeShare && (
        <button type="button" onClick={() => navigator.share({ title: "TubAfrik", text, url }).catch(() => {})}
          className="flex flex-col items-center gap-2 text-xs">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2">
            <ShareIcon />
          </span>
          Autres
        </button>
      )}
    </div>
  );
}
