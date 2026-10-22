"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { LIMITS } from "@/lib/constants";
import type { MentionUser } from "@/lib/format";
import { Avatar } from "@/components/ui";

export type SuggestUser = MentionUser & { avatarUrl?: string | null; accentColor?: string };

type Props = {
  placeholder: string;
  disabled?: boolean;
  banner?: React.ReactNode;
  allowVideo?: boolean;
  mentionUsers?: SuggestUser[];
  /** Return an error string to show, or null on success. */
  onSend: (content: string, file: File | null) => Promise<string | null>;
};

export function Composer({ placeholder, disabled = false, banner, allowVideo = true, mentionUsers, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);

  const suggestions =
    mention && mentionUsers
      ? mentionUsers
          .filter((u) => {
            const q = mention.query.toLowerCase();
            return u.username.toLowerCase().startsWith(q) || u.displayName.toLowerCase().startsWith(q);
          })
          .slice(0, 6)
      : [];

  function updateMention(value: string, caret: number) {
    if (!mentionUsers?.length) return setMention(null);
    const m = /(^|\s)@([\p{L}\p{N}_]{0,20})$/u.exec(value.slice(0, caret));
    if (m) {
      setMention({ query: m[2], start: caret - m[2].length - 1 });
      setActive(0);
    } else setMention(null);
  }

  function insertMention(u: SuggestUser) {
    if (!mention) return;
    const el = textRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const insert = `${u.username} `;
    const next = (draft.slice(0, mention.start) + insert + draft.slice(caret)).slice(0, LIMITS.message);
    setDraft(next);
    setMention(null);
    const pos = mention.start + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function pick(f: File | null | undefined) {
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !(allowVideo && isVideo)) {
      setError(allowVideo ? "Only images and videos can be sent." : "Only images can be sent.");
      return;
    }
    const limit = isImage ? LIMITS.chatImage : LIMITS.chatVideo;
    if (f.size > limit) {
      setError(`${isImage ? "Images" : "Videos"} must be under ${limit / 1024 / 1024}MB.`);
      return;
    }
    setError(null);
    setFile(f);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const content = draft.trim();
    if ((!content && !file) || sending || disabled) return;
    setSending(true);
    setError(null);
    const err = await onSend(content, file);
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setDraft("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[Math.min(active, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const f = e.clipboardData.files?.[0];
    if (f) {
      e.preventDefault();
      pick(f);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-white/5 p-3">
      {banner}
      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
      {file && preview && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          {file.type.startsWith("video/") ? (
            <video src={preview} className="h-16 w-24 rounded-lg bg-black object-cover" muted />
          ) : (
            <img src={preview} alt="Attachment preview" className="h-16 w-16 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium text-zinc-200">{file.name}</p>
            <p className="text-zinc-500">
              {file.type.startsWith("video/") ? "🎬 Video" : "🖼️ Image"} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <button type="button" onClick={() => setFile(null)} className="btn-ghost !px-2 !py-1 text-xs" aria-label="Remove attachment">
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || sending}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/15 text-2xl font-light leading-none text-orange-300 transition hover:bg-orange-500/25 disabled:opacity-40"
          title={allowVideo ? "Send an image or video" : "Send an image"}
          aria-label="Attach file"
        >
          +
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={allowVideo ? "image/*,video/*" : "image/*"}
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <div className="relative flex-1">
        {suggestions.length > 0 && (
          <ul className="animate-fade-up absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm overflow-hidden rounded-xl border border-white/10 bg-[#1d1d1f] py-1 shadow-2xl">
            <li className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mention someone</li>
            {suggestions.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm ${i === active ? "bg-orange-500/20" : ""}`}
                >
                  <Avatar src={u.avatarUrl ?? null} name={u.displayName} accent={u.accentColor ?? "#fb923c"} size={24} />
                  <span className="truncate font-semibold text-zinc-100">{u.displayName}</span>
                  <span className="truncate text-xs text-zinc-500">@{u.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textRef}
          className="input max-h-40 min-h-[44px] w-full resize-none"
          rows={1}
          value={draft}
          onChange={(e) => {
            const v = e.target.value.slice(0, LIMITS.message);
            setDraft(v);
            updateMention(v, e.target.selectionStart ?? v.length);
          }}
          onBlur={() => setTimeout(() => setMention(null), 120)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          maxLength={LIMITS.message}
          disabled={disabled}
        />
        </div>
        <button type="submit" disabled={sending || disabled || (!draft.trim() && !file)} className="btn-primary h-[44px] shrink-0">
          {sending ? "…" : "Send"}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Enter to send · Shift+Enter new line · @ to mention · + or paste to attach</span>
        <span>
          {draft.length}/{LIMITS.message}
        </span>
      </div>
    </form>
  );
}
