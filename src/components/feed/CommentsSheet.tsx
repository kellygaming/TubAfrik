/* eslint-disable @next/next/no-img-element -- stickers de 320 px déjà compressés en WebP */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { COMMENT_COLUMNS, type CommentRow } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { stickerUrl, type Sticker } from "@/lib/stickers";
import { Avatar } from "../Avatar";
import { CloseIcon, StickerIcon, TrashIcon } from "../icons";
import { StickerMaker } from "../stickers/StickerMaker";
import { StickerPicker } from "../stickers/StickerPicker";
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
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [picker, setPicker] = useState(false);
  const [maker, setMaker] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const [stickerMenu, setStickerMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Le commentaire racine auquel on répond (les réponses restent sur un seul niveau). */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const supabase = supabaseBrowser();
    supabase
      .from("tub_comments")
      .select(COMMENT_COLUMNS)
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(200)
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
      setSticker(null);
      setPicker(false);
      setStickerMenu(null);
      setConfirming(null);
      setReplyTo(null);
      setOpen(new Set());
    };
  }, [videoId, creatorId]);

  // Cadeaux d'abord, puis les VIP, puis tout le monde; du plus récent au plus ancien dans chaque groupe.
  const rank = (c: CommentRow) => (c.kind === "gift" ? 0 : vips.has(c.author_id) ? 1 : 2);
  const ids = new Set(comments?.map((c) => c.id));
  // Une réponse dont le parent n'est pas chargé s'affiche comme un commentaire normal.
  const isReply = (c: CommentRow) => !!c.parent_id && ids.has(c.parent_id);
  const sorted =
    comments && comments.filter((c) => !isReply(c)).sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at));
  const replies = new Map<string, CommentRow[]>();
  for (const c of comments ?? []) {
    if (!isReply(c)) continue;
    const list = replies.get(c.parent_id!) ?? [];
    list.push(c);
    replies.set(c.parent_id!, list);
  }
  for (const list of replies.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));

  function startReply(c: CommentRow) {
    const root = isReply(c) ? c.parent_id! : c.id;
    const name = c.author?.display_name ?? "";
    setReplyTo({ id: root, name });
    // Répondre à une réponse: on mentionne son auteur pour garder le fil lisible.
    if (root !== c.id && c.author?.username) setBody((b) => (b.trim() ? b : `@${c.author!.username} `));
    setPicker(false);
    inputRef.current?.focus();
  }

  function toggle(id: string) {
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if ((!text && !sticker) || !userId || !videoId) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabaseBrowser()
      .from("tub_comments")
      .insert({ video_id: videoId, author_id: userId, body: text, sticker_id: sticker?.id ?? null, parent_id: replyTo?.id ?? null })
      .select(COMMENT_COLUMNS)
      .single();
    setSending(false);
    if (error) return setError("Envoi impossible, réessaie.");
    const row = data as unknown as CommentRow;
    setComments((c) => [row, ...(c ?? [])]);
    if (row.parent_id) setOpen((o) => new Set(o).add(row.parent_id!));
    setReplyTo(null);
    setBody("");
    setSticker(null);
    setPicker(false);
    onCountChange(1);
  }

  async function remove(id: string) {
    setConfirming(null);
    const { error } = await supabaseBrowser().from("tub_comments").delete().eq("id", id);
    if (error) return setError("Suppression impossible, réessaie.");
    // Supprimer un commentaire emporte ses réponses (cascade en base).
    const gone = 1 + (replies.get(id)?.length ?? 0);
    setComments((c) => c?.filter((x) => x.id !== id && x.parent_id !== id) ?? null);
    if (replyTo?.id === id) setReplyTo(null);
    onCountChange(-gone);
  }

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 2200);
  }

  async function keepSticker(s: Sticker) {
    setStickerMenu(null);
    if (!userId) return;
    const { error } = await supabaseBrowser().from("tub_sticker_saves").insert({ user_id: userId, sticker_id: s.id });
    // 23505: déjà dans la collection, c'est réussi aussi.
    if (error && error.code !== "23505") return setError("Ajout impossible, réessaie.");
    setPickerKey((k) => k + 1);
    flash("Ajouté à tes stickers ✓");
  }

  function attachSticker(s: Sticker) {
    setStickerMenu(null);
    setSticker(s);
    setPicker(false);
  }

  function renderComment(c: CommentRow, nested: boolean) {
    const vip = vips.has(c.author_id);
    const gift = c.kind === "gift";
    return (
      <div className={`flex gap-3 ${gift || vip ? "vip-card p-3 pl-4" : ""}`}>
        <Link href={`/u/${c.author?.username}`} className="shrink-0">
          <Avatar src={c.author?.avatar_url} name={c.author?.display_name ?? "?"} size={nested ? 28 : 36}
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
          {c.body && !(gift && c.body.startsWith("a envoyé ")) && (
            <p className={`mt-0.5 break-words text-sm ${gift || vip ? "font-medium text-white" : ""}`}>{c.body}</p>
          )}
          {c.sticker && (
            <div className="relative mt-1.5 w-fit">
              <button type="button" onClick={() => setStickerMenu((m) => (m === c.id ? null : c.id))}
                aria-label={c.sticker.caption ? `Sticker : ${c.sticker.caption}` : "Sticker"}
                className="block overflow-hidden rounded-2xl border-[3px] border-white shadow-lg transition active:scale-95">
                <img src={stickerUrl(c.sticker.image_path)} alt={c.sticker.caption ?? "Sticker"} loading="lazy"
                  width={128} height={128} className="h-32 w-32 object-cover" />
              </button>
              {stickerMenu === c.id && userId && (
                <div className="animate-fade absolute left-full top-0 z-10 ml-2 w-44 overflow-hidden rounded-xl border border-line bg-surface-2 text-sm shadow-xl">
                  <button type="button" onClick={() => keepSticker(c.sticker!)} className="block w-full px-3 py-2.5 text-left hover:bg-white/5">
                    ⭐ Garder ce sticker
                  </button>
                  <button type="button" onClick={() => attachSticker(c.sticker!)} className="block w-full px-3 py-2.5 text-left hover:bg-white/5">
                    💬 Répondre avec
                  </button>
                  {c.sticker.source_video_id && c.sticker.source_video_id !== videoId && (
                    <Link href={`/v/${c.sticker.source_video_id}`} className="block px-3 py-2.5 hover:bg-white/5">
                      🎬 Vidéo d&apos;origine
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {userId && profile && (
            <button type="button" onClick={() => startReply(c)}
              className="mt-1 text-xs font-semibold text-muted transition hover:text-text">
              Répondre
            </button>
          )}
        </div>
        {userId && (c.author_id === userId || creatorId === userId) && (
          confirming === c.id ? (
            <div className="animate-fade flex shrink-0 flex-col items-end gap-1 text-xs">
              <button onClick={() => remove(c.id)} className="rounded-full bg-like px-2.5 py-1 font-semibold text-white">
                Supprimer
              </button>
              <button onClick={() => setConfirming(null)} className="px-2.5 py-1 text-muted">Annuler</button>
            </div>
          ) : (
            <button onClick={() => setConfirming(c.id)} aria-label="Supprimer le commentaire"
              title={c.author_id === userId ? "Supprimer mon commentaire" : "Retirer ce commentaire de ma vidéo"}
              className="shrink-0 self-start rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-like">
              <TrashIcon width={16} height={16} />
            </button>
          )
        )}
      </div>
    );
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
              const kids = replies.get(c.id) ?? [];
              const shown = open.has(c.id);
              return (
                <li key={c.id}>
                  {renderComment(c, false)}
                  {kids.length > 0 && (
                    <div className="ml-12 mt-2">
                      {shown && <ul className="mb-2 space-y-3">{kids.map((r) => <li key={r.id}>{renderComment(r, true)}</li>)}</ul>}
                      <button type="button" onClick={() => toggle(c.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-text">
                        <span className="h-px w-6 bg-line" />
                        {shown ? "Masquer les réponses" : `Voir ${kids.length} réponse${kids.length > 1 ? "s" : ""}`}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line p-3">
        {notice && <p className="animate-fade mb-2 text-center text-xs font-semibold text-gold">{notice}</p>}
        {userId && profile ? (
          <>
            {sticker && (
              <div className="animate-fade mb-2 flex items-center gap-2">
                <div className="relative">
                  <img src={stickerUrl(sticker.image_path)} alt={sticker.caption ?? "Sticker"}
                    className="h-16 w-16 rounded-xl border-2 border-white object-cover" />
                  <button type="button" onClick={() => setSticker(null)} aria-label="Retirer le sticker"
                    className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-text ring-2 ring-surface">
                    <CloseIcon width={12} height={12} />
                  </button>
                </div>
                <span className="text-xs text-muted">Ajoute un mot ou envoie tel quel</span>
              </div>
            )}
            {replyTo && (
              <div className="animate-fade mb-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-1.5 text-xs">
                <span className="truncate text-muted">
                  Réponse à <b className="text-text">{replyTo.name}</b>
                </span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Annuler la réponse" className="shrink-0 p-1 text-muted hover:text-text">
                  <CloseIcon width={14} height={14} />
                </button>
              </div>
            )}
            <form onSubmit={send} className="flex items-center gap-2">
              <Avatar src={profile.avatar_url} name={profile.display_name} size={32} />
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onFocus={() => setPicker(false)}
                  maxLength={300}
                  placeholder={sticker ? "Ajoute un mot (facultatif)…" : replyTo ? `Répondre à ${replyTo.name}…` : "Ajouter un commentaire…"}
                  aria-label="Ton commentaire"
                  className="h-10 w-full rounded-full bg-surface-2 pl-4 pr-11 text-base outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/50"
                />
                <button type="button" onClick={() => setPicker((p) => !p)} aria-label="Stickers" aria-expanded={picker}
                  className={`absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full transition ${
                    picker ? "bg-gold text-black" : "text-muted hover:text-text"
                  }`}>
                  <StickerIcon width={20} height={20} />
                </button>
              </div>
              <button
                disabled={(!body.trim() && !sticker) || sending}
                className="h-10 rounded-full px-3 text-sm font-semibold text-brand disabled:text-muted"
              >
                Envoyer
              </button>
            </form>
            {picker && (
              <StickerPicker refreshKey={pickerKey} onPick={attachSticker} onCreate={() => setMaker(true)} />
            )}
          </>
        ) : (
          <Link href={loginHref()} className="bg-brand block rounded-full py-2.5 text-center text-sm font-semibold text-bg">
            Connecte-toi pour commenter
          </Link>
        )}
        {error && <p className="mt-2 text-center text-xs text-like">{error}</p>}
      </div>
      {maker && videoId && (
        <StickerMaker
          videoId={videoId}
          onClose={() => setMaker(false)}
          onCreated={(s) => {
            setMaker(false);
            setPickerKey((k) => k + 1);
            attachSticker(s);
          }}
        />
      )}
    </Sheet>
  );
}
