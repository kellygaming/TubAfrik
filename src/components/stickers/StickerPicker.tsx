/* eslint-disable @next/next/no-img-element -- stickers de 320 px déjà compressés en WebP */
"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { STICKER_COLUMNS, stickerUrl, type Sticker } from "@/lib/stickers";
import { CameraIcon } from "../icons";
import { useSession } from "../session";

type Tab = "mine" | "popular";

// Le tiroir à stickers, sous la zone de saisie des commentaires.
// Premier carreau: en fabriquer un depuis la vidéo en cours.
export function StickerPicker({
  onPick,
  onCreate,
  refreshKey,
}: {
  onPick: (s: Sticker) => void;
  onCreate: () => void;
  refreshKey: number;
}) {
  const { userId } = useSession();
  const [tab, setTab] = useState<Tab>("mine");
  const [lists, setLists] = useState<Record<Tab, Sticker[] | null>>({ mine: null, popular: null });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = supabaseBrowser();
    Promise.all([
      supabase
        .from("tub_sticker_saves")
        .select(`created_at, sticker:tub_stickers(${STICKER_COLUMNS})`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("tub_stickers")
        .select(STICKER_COLUMNS)
        .eq("status", "active")
        .order("uses_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
    ]).then(([mine, popular]) => {
      if (cancelled) return;
      const saved = ((mine.data ?? []) as unknown as { sticker: Sticker | null }[])
        .map((r) => r.sticker)
        .filter((s): s is Sticker => !!s);
      setLists({ mine: saved, popular: (popular.data as Sticker[] | null) ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const list = lists[tab];

  return (
    <div className="animate-fade mt-2">
      <div role="tablist" className="mb-2 flex gap-1 text-xs font-semibold">
        {(["mine", "popular"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 transition ${tab === t ? "bg-white text-black" : "bg-surface-2 text-muted"}`}>
            {t === "mine" ? "Mes stickers" : "Populaires 🔥"}
          </button>
        ))}
      </div>
      <div className="no-scrollbar grid max-h-48 grid-cols-4 gap-2 overflow-y-auto pb-1">
        <button type="button" onClick={onCreate}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gold/60 bg-gold/5 text-gold transition active:scale-95">
          <CameraIcon width={22} height={22} />
          <span className="px-1 text-center text-[10px] font-semibold leading-tight">Depuis la vidéo</span>
        </button>
        {list === null
          ? [0, 1, 2].map((i) => <span key={i} className="aspect-square animate-pulse rounded-2xl bg-surface-2" />)
          : list.map((s) => (
              <button key={s.id} type="button" onClick={() => onPick(s)} title={s.caption ?? "Sticker"}
                className="aspect-square overflow-hidden rounded-2xl border-2 border-white/90 bg-surface-2 transition active:scale-95">
                <img src={stickerUrl(s.image_path)} alt={s.caption ?? "Sticker"} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
      </div>
      {list?.length === 0 && (
        <p className="mt-1 text-center text-[11px] text-muted">
          {tab === "mine"
            ? "Fige un moment de cette vidéo, ou garde ceux que tu vois dans les commentaires."
            : "Aucun sticker pour l'instant: crée le premier !"}
        </p>
      )}
    </div>
  );
}
