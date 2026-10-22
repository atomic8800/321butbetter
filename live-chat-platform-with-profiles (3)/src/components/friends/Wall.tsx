"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui";
import { MediaView } from "@/components/ui";
import { RoleBadge } from "@/components/ui";
import { apiFetch } from "@/lib/client";
import { LIMITS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import type { SelfUser, WallPost } from "@/lib/types";

type Picked = { file: File; url: string };

export function Wall({ me, friendCount, onFindFriends }: { me: SelfUser; friendCount: number; onFindFriends: () => void }) {
  const [posts, setPosts] = useState<WallPost[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before?: number) => {
    const res = await apiFetch(`/api/wall${before ? `?before=${before}` : ""}`);
    if (!res.ok) return;
    const data = (await res.json()) as { posts: WallPost[]; hasMore: boolean };
    setPosts((prev) => (before && prev ? [...prev, ...data.posts] : data.posts));
    setHasMore(data.hasMore);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    if (!window.confirm("Delete this post?")) return;
    const res = await apiFetch(`/api/wall/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((p) => p?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="space-y-5">
      <PostComposer me={me} onPosted={(p) => setPosts((prev) => [p, ...(prev ?? [])])} />

      {friendCount === 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-4 text-sm text-zinc-300">
          Your wall only shows posts from you and your friends.{" "}
          <button onClick={onFindFriends} className="font-semibold text-orange-300 hover:underline">
            Find people to add →
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Latest posts</h2>
        <button onClick={() => void load()} className="btn-ghost !px-3 !py-1 text-xs">
          ↻ Refresh
        </button>
      </div>

      {posts === null ? (
        <p className="text-sm text-zinc-500">Loading wall…</p>
      ) : posts.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-zinc-500">
          <p className="text-3xl">🧱</p>
          <p className="mt-2">Nothing on the wall yet. Be the first to post!</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id} className="glass animate-fade-up rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Link href={`/u/${p.author.username}`}>
                  <Avatar src={p.author.avatarUrl} name={p.author.displayName} accent={p.author.accentColor} size={42} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/u/${p.author.username}`} className="font-semibold hover:underline" style={{ color: p.author.accentColor }}>
                      {p.author.displayName}
                    </Link>
                    <RoleBadge role={p.author.role} rank={p.author.rank} />
                    <span className="text-xs text-zinc-500" title={new Date(p.createdAt).toLocaleString()}>
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                  {p.content && <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-100">{p.content}</p>}
                </div>
                {(p.author.id === me.id || me.rank === "owner") && (
                  <button onClick={() => remove(p.id)} className="btn-ghost !px-2 !py-1 text-xs hover:!text-rose-200" title="Delete post">
                    🗑️
                  </button>
                )}
              </div>
              {p.media.length > 0 && (
                <div className={`mt-3 grid gap-2 ${p.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {p.media.map((m, i) =>
                    p.media.length === 1 ? (
                      <div key={i} className="flex justify-center rounded-xl bg-black/30">
                        <MediaView media={m} />
                      </div>
                    ) : (
                      <div key={i} className="aspect-square overflow-hidden rounded-xl bg-black/30">
                        <MediaView media={m} fill />
                      </div>
                    ),
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasMore && posts && (
        <div className="text-center">
          <button
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(posts[posts.length - 1]?.id);
              setLoadingMore(false);
            }}
            className="btn-ghost text-sm"
          >
            {loadingMore ? "Loading…" : "Load older posts"}
          </button>
        </div>
      )}
    </div>
  );
}

function PostComposer({ me, onPosted }: { me: SelfUser; onPosted: (p: WallPost) => void }) {
  const [content, setContent] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef(picked);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);

  useEffect(() => () => pickedRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const muted = !!me.mutedUntil && new Date(me.mutedUntil).getTime() > Date.now();

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...picked];
    let total = next.reduce((n, p) => n + p.file.size, 0);
    for (const f of Array.from(list)) {
      if (next.length >= LIMITS.postMedia) {
        setError(`Up to ${LIMITS.postMedia} photos/videos per post.`);
        break;
      }
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      if (!isImage && !isVideo) {
        setError("Only images and videos are allowed.");
        continue;
      }
      const limit = isImage ? LIMITS.chatImage : LIMITS.chatVideo;
      if (f.size > limit) {
        setError(`${isImage ? "Images" : "Videos"} must be under ${limit / 1024 / 1024}MB.`);
        continue;
      }
      if (total + f.size > LIMITS.postTotal) {
        setError(`All photos/videos in one post must add up to under ${LIMITS.postTotal / 1024 / 1024}MB.`);
        continue;
      }
      total += f.size;
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPicked(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeAt(i: number) {
    URL.revokeObjectURL(picked[i].url);
    setPicked(picked.filter((_, j) => j !== i));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || (!content.trim() && !picked.length)) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("content", content);
    picked.forEach((p) => fd.append("files", p.file));
    const res = await apiFetch("/api/wall", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { post?: WallPost; error?: string };
    setBusy(false);
    if (!res.ok || !data.post) return setError(data.error ?? "Could not post.");
    picked.forEach((p) => URL.revokeObjectURL(p.url));
    setPicked([]);
    setContent("");
    onPosted(data.post);
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-4">
      <div className="flex gap-3">
        <Avatar src={me.avatarUrl} name={me.displayName} accent={me.accentColor} size={42} />
        <textarea
          className="input min-h-[80px] flex-1 resize-y"
          placeholder={muted ? "You are muted and can't post right now." : `What's on your mind, ${me.displayName}?`}
          value={content}
          maxLength={LIMITS.post}
          disabled={muted}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {picked.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 pl-[54px]">
          {picked.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {p.file.type.startsWith("video/") ? (
                <video src={p.url} className="h-full w-full object-cover" muted />
              ) : (
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white"
                aria-label="Remove"
              >
                ✕
              </button>
              {p.file.type.startsWith("video/") && (
                <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px]">🎬</span>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 pl-[54px] text-xs text-rose-300">{error}</p>}
      <div className="mt-3 flex items-center justify-between pl-[54px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={muted || picked.length >= LIMITS.postMedia}
            onClick={() => inputRef.current?.click()}
            className="btn-ghost !px-3 !py-1.5 text-xs"
          >
            🖼️ Photo / 🎬 Video
          </button>
          <span className="text-[11px] text-zinc-500">
            {picked.length}/{LIMITS.postMedia} · {content.length}/{LIMITS.post}
          </span>
          <input ref={inputRef} type="file" hidden multiple accept="image/*,video/*" onChange={(e) => addFiles(e.target.files)} />
        </div>
        <button type="submit" disabled={busy || muted || (!content.trim() && !picked.length)} className="btn-primary !py-2 text-sm">
          {busy ? "Posting…" : "Post to wall"}
        </button>
      </div>
    </form>
  );
}
