"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { COMMENT_COLUMNS, type CommentRow } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Avatar } from "../Avatar";
import { Sheet } from "../Sheet";
import { loginHref, useSession } from "../session";

export function CommentsSheet({
  videoId,
  count,
  creatorId,
  onClose,
  onCountChange,
}: {
  videoId: string | null;
  count: number;
  /** Auteur de la vidéo: ses VIP sont mis en avant. */
  creatorId: string | null;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const { userId, profile } = useSession();
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vips, setVips] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const supabase = supabaseBrowser();
    supabase
      .from("tub_comments")
      .select(COMMENT_COLUMNS)
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) setComments((data as unknown as CommentRow[]) ?? []);
      });
    if (creatorId) {
      supabase
        .from("tub_vip")
        .select("fan_id")
        .eq("creator_id", creatorId)
        .gt("expires_at", new Date().toISOString())
        .then(({ data }) => {
          if (!cancelled) setVips(new Set((data ?? []).map((v) => v.fan_id)));
        });
    }
    return () => {
      cancelled = true;
      setComments(null);
      setVips(new Set());
    };
  }, [videoId, creatorId]);

  // Cadeaux d'abord, puis les VIP, puis tout le monde; du plus récent au plus ancien dans chaque groupe.
  const rank = (c: CommentRow) => (c.kind === "gift" ? 0 : vips.has(c.author_id) ? 1 : 2);
  const sorted = comments && [...comments].sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !userId || !videoId) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabaseBrowser()
      .from("tub_comments")
      .insert({ video_id: videoId, author_id: userId, body: text })
      .select(COMMENT_COLUMNS)
      .single();
    setSending(false);
    if (error) return setError("Envoi impossible, réessaie.");
    setComments((c) => [data as unknown as CommentRow, ...(c ?? [])]);
    setBody("");
    onCountChange(1);
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from("tub_comments").delete().eq("id", id);
    if (error) return;
    setComments((c) => c?.filter((x) => x.id !== id) ?? null);
    onCountChange(-1);
  }

  return (
    <Sheet open={!!videoId} onClose={onClose} title={`${count} commentaire${count > 1 ? "s" : ""}`} tall>
      <div className="no-scrollbar flex-1 overflow-y-auto px-4">
        {sorted === null ? (
          <div className="space-y-4 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse gap-3">
                <span className="h-9 w-9 rounded-full bg-surface-2" />
                <span className="h-9 flex-1 rounded-lg bg-surface-2" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Sois le premier à commenter 🔥</p>
        ) : (
          <ul className="space-y-3 py-3">
            {sorted.map((c) => {
              const vip = vips.has(c.author_id);
              const gift = c.kind === "gift";
              return (
                <li key={c.id} className={`flex gap-3 ${gift || vip ? "vip-card p-3 pl-4" : ""}`}>
                  <Link href={`/u/${c.author?.username}`} className="shrink-0">
                    <Avatar src={c.author?.avatar_url} name={c.author?.display_name ?? "?"} size={36}
                      className={vip ? "ring-2 ring-gold" : ""} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                      <Link href={`/u/${c.author?.username}`} className={`font-semibold ${vip ? "text-gold" : "text-text/80"}`}>
                        {c.author?.display_name}
                      </Link>
                      {vip && <span className="vip-badge">★ VIP</span>}
                      <span>· {timeAgo(c.created_at)}</span>
                    </p>
                    {gift && c.gift && (
                      <p className="mt-1 text-sm font-bold">
                        <span className="mr-1 text-lg">{c.gift.emoji}</span>
                        <span className="text-gold-grad">a offert {c.gift.name}</span>
                      </p>
                    )}
                    {!(gift && c.body.startsWith("a envoyé ")) && (
                      <p className={`mt-0.5 break-words text-sm ${gift || vip ? "font-medium text-white" : ""}`}>{c.body}</p>
                    )}
                    {c.author_id === userId && (
                      <button onClick={() => remove(c.id)} className="mt-1 text-xs text-muted hover:text-like">
                        Supprimer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-3">
        {userId && profile ? (
          <form onSubmit={send} className="flex items-center gap-2">
            <Avatar src={profile.avatar_url} name={profile.display_name} size={32} />
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={300}
              placeholder="Ajouter un commentaire…"
              aria-label="Ton commentaire"
              className="h-10 flex-1 rounded-full bg-surface-2 px-4 text-base outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/50"
            />
            <button
              disabled={!body.trim() || sending}
              className="h-10 rounded-full px-3 text-sm font-semibold text-brand disabled:text-muted"
            >
              Envoyer
            </button>
          </form>
        ) : (
          <Link href={loginHref()} className="bg-brand block rounded-full py-2.5 text-center text-sm font-semibold text-bg">
            Connecte-toi pour commenter
          </Link>
        )}
        {error && <p className="mt-2 text-center text-xs text-like">{error}</p>}
      </div>
    </Sheet>
  );
}
