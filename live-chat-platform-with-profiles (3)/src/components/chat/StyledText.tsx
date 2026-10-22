"use client";

import { tokenize, type MentionMatcher } from "@/lib/format";
import { DEFAULT_NAME_COLOR, hasCustomStyle, messageCss, nameCss, type UserStyle } from "@/lib/style";
import type { Rank } from "@/lib/moderation";

type NameUser = Partial<UserStyle> & { displayName: string };

export function StyledName({
  user,
  fallback = DEFAULT_NAME_COLOR,
  className = "",
}: {
  user: NameUser;
  fallback?: string;
  className?: string;
}) {
  return (
    <span className={`inline-block max-w-full truncate align-bottom ${className}`} style={nameCss(user, fallback)}>
      {user.displayName}
    </span>
  );
}

/** Small icon before a username: 👑 owner, 🛡️ moderator, 💎 custom style, otherwise a person silhouette. */
export function RankIcon({ rank, user, size = 15 }: { rank: Rank; user: Partial<UserStyle>; size?: number }) {
  if (rank === "owner") return <span title="Owner" style={{ fontSize: size }}>👑</span>;
  if (rank === "moderator") return <span title="Moderator" style={{ fontSize: size }}>🛡️</span>;
  if (hasCustomStyle(user)) return <span title="Styled member" style={{ fontSize: size * 0.95 }}>💎</span>;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0 text-zinc-400">
      <circle cx="8" cy="4.6" r="3.1" fill="currentColor" />
      <path d="M1.8 15c0-3.6 2.8-6.1 6.2-6.1s6.2 2.5 6.2 6.1z" fill="currentColor" />
    </svg>
  );
}

export function MessageText({
  content,
  style,
  matcher,
  meId,
  onMention,
}: {
  content: string;
  style: Partial<UserStyle>;
  matcher: MentionMatcher | null;
  meId: number;
  onMention?: (username: string) => void;
}) {
  const css = messageCss(style);
  return (
    <>
      {tokenize(content, matcher).map((t, i) => {
        if (t.type === "mention") {
          const isMe = t.user.id === meId;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMention?.(t.user.username)}
              className={`mx-[1px] inline-block rounded-full px-2.5 py-[1px] align-baseline font-normal not-italic leading-snug text-white transition hover:brightness-110 ${
                isMe ? "bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.45)]" : "bg-[#2b5f93]"
              }`}
              title={`@${t.user.username}`}
            >
              {t.value}
            </button>
          );
        }
        if (t.type === "emoji") return <span key={i}>{t.value}</span>;
        return (
          <span key={i} style={css}>
            {t.value}
          </span>
        );
      })}
    </>
  );
}
