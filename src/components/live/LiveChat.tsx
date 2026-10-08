"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LiveMessage } from "./useLiveChat";
import { cachedGifts } from "@/lib/giftCatalog";
import { GiftArt } from "../gifts/GiftArt";
import { Avatar } from "../Avatar";
import { CloseIcon } from "../icons";
import { loginHref, useSession } from "../session";

// Le chat, par-dessus le bas de la vidéo, comme sur TikTok: les messages
// montent et s'estompent vers le haut. Les cadeaux ressortent en or.
export function LiveChat({
  messages,
  creatorId,
  canWrite,
  onSend,
  onRemove,
  actions,
}: {
  messages: LiveMessage[];
  creatorId: string;
  canWrite: boolean;
  onSend: (body: string) => Promise<string | null>;
  onRemove: (id: number) => void;
  actions?: React.ReactNode;
}) {
  const { userId } = useSession();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const err = await onSend(text);
    setSending(false);
    setError(err);
    if (!err) setBody("");
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <ul
        ref={list}
        className="no-scrollbar max-h-[34dvh] space-y-1.5 overflow-y-auto pr-16 [mask-image:linear-gradient(to_bottom,transparent,black_28%)]"
        aria-live="polite"
      >
        {messages.map((m) => {
          const gift = m.kind === "gift" ? cachedGifts()?.find((g) => g.slug === m.gift_slug) : null;
          const mine = m.author_id === userId;
          return (
            <li key={m.id} className="animate-pop-in flex items-start gap-2">
              <Avatar src={m.author?.avatar_url} name={m.author?.display_name ?? "?"} size={26} />
              <div
                className={`min-w-0 rounded-2xl px-2.5 py-1 text-[13px] leading-snug backdrop-blur ${
                  m.kind === "gift" ? "bg-gold/25 ring-1 ring-gold/60" : "bg-black/35"
                }`}
              >
                <Link href={`/u/${m.author?.username}`} className={`mr-1.5 font-semibold ${m.author_id === creatorId ? "text-gold" : "text-white/70"}`}>
                  {m.author?.display_name}
                  {m.author_id === creatorId && " ★"}
                </Link>
                {m.kind === "gift" && gift && <GiftArt gift={gift} size={18} className="mr-1 align-[-3px]" />}
                <span className={`break-words ${m.kind === "gift" ? "font-semibold text-gold" : "text-white"}`}>{m.body}</span>
              </div>
              {(mine || userId === creatorId) && m.kind === "text" && (
                <button onClick={() => onRemove(m.id)} aria-label="Retirer ce message" className="mt-1 shrink-0 text-white/40 hover:text-white">
                  <CloseIcon width={14} height={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="text-xs text-like">{error}</p>}

      <div className="flex items-center gap-2">
        {canWrite && userId ? (
          <form onSubmit={submit} className="flex-1">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              placeholder="Écris un message…"
              aria-label="Message dans le live"
              className="h-10 w-full rounded-full bg-black/45 px-4 text-base text-white outline-none backdrop-blur placeholder:text-white/50 focus:ring-2 focus:ring-white/40"
            />
          </form>
        ) : !userId ? (
          <Link href={loginHref()} className="flex h-10 flex-1 items-center rounded-full bg-black/45 px-4 text-sm text-white/70 backdrop-blur">
            Connecte-toi pour discuter
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {actions}
      </div>
    </div>
  );
}
