"use client";

/* eslint-disable @next/next/no-img-element */
import type { Attachment, FriendStatus, PublicUser } from "@/lib/types";
import type { Rank } from "@/lib/moderation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client";

// ===================================================================== Avatar

type AvatarProps = {
  src: string | null;
  name: string;
  accent?: string;
  size?: number;
  className?: string;
  online?: boolean;
};

export function Avatar({ src, name, accent = "#fb923c", size = 40, className = "", online }: AvatarProps) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full rounded-full object-cover ring-2"
          style={{ ["--tw-ring-color" as string]: `${accent}66` }}
          draggable={false}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            fontSize: Math.max(12, size * 0.42),
          }}
        >
          {initial}
        </span>
      )}
      {online && (
        <span
          className="online-dot absolute bottom-0 right-0 block rounded-full border-2 border-[#140d08] bg-emerald-400"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
        />
      )}
    </span>
  );
}

// ===================================================================== ProfileTags

type TagUser = Pick<PublicUser, "age" | "gender" | "pronouns" | "country" | "sexuality" | "role"> &
  Partial<Pick<PublicUser, "relationship">>;

export function RoleBadge({
  role,
  rank = "user",
  className = "",
}: {
  role: "guest" | "member";
  rank?: Rank;
  className?: string;
}) {
  const base = `rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`;
  if (rank === "owner") {
    return (
      <span
        className={`${base} border border-amber-300/60 bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-[0_0_12px_rgba(251,146,60,0.45)]`}
        title="Owner"
      >
        👑 Owner
      </span>
    );
  }
  if (rank === "moderator") {
    return (
      <span className={`${base} border border-sky-400/50 bg-sky-500/20 text-sky-200`} title="Moderator">
        🛡️ Mod
      </span>
    );
  }
  return role === "guest" ? (
    <span className={`${base} border border-zinc-500/40 bg-zinc-500/15 text-zinc-300`}>Guest</span>
  ) : (
    <span className={`${base} border border-orange-400/40 bg-orange-500/15 text-orange-200`}>Member</span>
  );
}

export function ProfileTags({ user, compact = false }: { user: TagUser; compact?: boolean }) {
  const tags: { icon: string; label: string; title: string }[] = [];
  if (user.age) tags.push({ icon: "🎂", label: String(user.age), title: "Age" });
  if (user.gender) tags.push({ icon: "✨", label: user.gender, title: "Gender" });
  if (user.pronouns) tags.push({ icon: "💬", label: user.pronouns, title: "Pronouns" });
  if (user.country) tags.push({ icon: "🌍", label: user.country, title: "Country" });
  if (user.sexuality) tags.push({ icon: "🏳️‍🌈", label: user.sexuality, title: "Sexuality" });
  if (user.relationship)
    tags.push({
      icon: "💞",
      label: compact ? user.relationship : `Relationship status: ${user.relationship}`,
      title: "Relationship status",
    });

  if (!tags.length) {
    return compact ? null : <p className="text-sm text-zinc-500">No tags yet.</p>;
  }

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-2"}`}>
      {tags.map((t) => (
        <span
          key={t.title}
          title={t.title}
          className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 text-zinc-200 ${
            compact ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          }`}
        >
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </span>
      ))}
    </div>
  );
}

// ===================================================================== MediaView

export function MediaView({ media, className = "", fill = false }: { media: Attachment; className?: string; fill?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (media.type === "video") {
    return (
      <video
        src={media.url}
        controls
        preload="metadata"
        playsInline
        className={`${fill ? "h-full w-full object-cover" : "max-h-80 max-w-full"} rounded-xl border border-white/10 bg-black ${className}`}
      />
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`block overflow-hidden rounded-xl border border-white/10 ${fill ? "h-full w-full" : ""} ${className}`}>
        <img
          src={media.url}
          alt="Shared image"
          loading="lazy"
          className={`${fill ? "h-full w-full object-cover" : "max-h-80 max-w-full object-contain"} transition hover:opacity-90`}
        />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <img src={media.url} alt="Shared image" className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl" />
          <div className="absolute right-4 top-4 flex gap-2">
            <a
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-ghost !px-3 !py-1.5 text-xs"
            >
              Open original ↗
            </a>
            <button className="btn-ghost !px-3 !py-1.5 text-xs">✕</button>
          </div>
        </div>
      )}
    </>
  );
}

// ===================================================================== MusicPlayer

type MusicPlayerProps = {
  src: string;
  title: string;
  accent: string;
  autoPlay?: boolean;
  compact?: boolean;
};

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function MusicPlayer({ src, title, accent, autoPlay = false, compact = false }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.6;
    if (autoPlay) {
      a.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    }
  }, [autoPlay, src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play()
        .then(() => setBlocked(false))
        .catch(() => setBlocked(true));
    } else {
      a.pause();
    }
  }

  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] ${compact ? "p-3" : "p-4"}`}
      style={{ boxShadow: playing ? `0 0 0 1px ${accent}55, 0 10px 40px ${accent}22` : undefined }}
    >
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg text-white shadow-lg transition hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-base ${playing ? "animate-pulse" : ""}`} aria-hidden>
              🎵
            </span>
            <p className="truncate text-sm font-semibold">{title}</p>
          </div>
          <div
            className="mt-2 h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/10"
            onClick={(e) => {
              const a = audioRef.current;
              if (!a || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
            }}
          >
            <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: accent }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
      {blocked && !playing && (
        <p className="mt-2 text-[11px] text-zinc-500">Press play to hear this profile&apos;s song.</p>
      )}
    </div>
  );
}

// ===================================================================== FriendButton

export function FriendButton({ userId, onChange }: { userId: number; onChange?: (s: FriendStatus) => void }) {
  const [status, setStatus] = useState<FriendStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    apiFetch(`/api/friends/status?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { status: FriendStatus } | null) => !cancelled && d && setStatus(d.status))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function act(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const res = await apiFetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId }),
    });
    const data = (await res.json().catch(() => ({}))) as { status?: FriendStatus; error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Failed");
    if (data.status) {
      setStatus(data.status);
      onChange?.(data.status);
    }
  }

  if (!status || status === "self") return null;
  const cls = "!px-3 !py-1.5 text-xs";

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status === "none" && (
        <button disabled={busy} onClick={() => act("request")} className={`btn-primary ${cls}`}>
          ➕ Add friend
        </button>
      )}
      {status === "outgoing" && (
        <button disabled={busy} onClick={() => act("cancel")} className={`btn-ghost ${cls}`} title="Cancel request">
          ⏳ Request sent
        </button>
      )}
      {status === "incoming" && (
        <>
          <button disabled={busy} onClick={() => act("accept")} className={`btn-primary ${cls}`}>
            ✓ Accept
          </button>
          <button disabled={busy} onClick={() => act("decline")} className={`btn-ghost ${cls}`}>
            Decline
          </button>
        </>
      )}
      {status === "friends" && (
        <button
          disabled={busy}
          onClick={() => act("remove", "Remove this friend?")}
          className={`btn-ghost ${cls} hover:!border-rose-400/40 hover:!text-rose-200`}
          title="Click to remove friend"
        >
          🤝 Friends
        </button>
      )}
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
    </span>
  );
}
