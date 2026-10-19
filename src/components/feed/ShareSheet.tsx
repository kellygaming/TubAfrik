"use client";

import type { FeedItem } from "@/lib/types";
import { Sheet } from "../Sheet";
import { ShareButtons } from "../share/ShareButtons";

export function ShareSheet({ item, onClose }: { item: FeedItem | null; onClose: () => void }) {
  if (!item) return null;
  const url = `${window.location.origin}/v/${item.id}`;
  const text = `${item.caption ? item.caption.slice(0, 80) + " — " : ""}@${item.username} sur TubAfrik`;
  return (
    <Sheet open onClose={onClose} title="Partager">
      <div className="px-4 pt-2 pb-5">
        <ShareButtons url={url} text={text} />
      </div>
    </Sheet>
  );
}
