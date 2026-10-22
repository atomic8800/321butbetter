
// ===================================================================== time

export function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ===================================================================== mentions

export type MentionUser = { id: number; username: string; displayName: string };

export type MentionMatcher = { regex: RegExp; lookup: Map<string, MentionUser> };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds a case-insensitive matcher for every user's username and display name. */
export function buildMentionMatcher(users: MentionUser[]): MentionMatcher | null {
  const lookup = new Map<string, MentionUser>();
  for (const u of users) {
    for (const name of [u.username, u.displayName]) {
      const key = name.trim().toLowerCase();
      if (key.length >= 3 && !lookup.has(key)) lookup.set(key, u);
    }
  }
  if (!lookup.size) return null;
  const names = [...lookup.keys()].sort((a, b) => b.length - a.length).map(escape);
  // Not preceded/followed by a letter, digit or underscore, so "amy" doesn't match inside "amyx".
  const regex = new RegExp(`(?<![\\p{L}\\p{N}_])@?(${names.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return { regex, lookup };
}

export type Token =
  | { type: "text"; value: string }
  | { type: "emoji"; value: string }
  | { type: "mention"; value: string; user: MentionUser };

const EMOJI = /((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u20E3|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic}|\p{Regional_Indicator}))*)+/gu;

function splitEmoji(text: string, out: Token[]) {
  let last = 0;
  for (const m of text.matchAll(EMOJI)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ type: "text", value: text.slice(last, i) });
    out.push({ type: "emoji", value: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
}

export function tokenize(text: string, matcher: MentionMatcher | null): Token[] {
  const out: Token[] = [];
  if (!matcher) {
    splitEmoji(text, out);
    return out;
  }
  matcher.regex.lastIndex = 0;
  let last = 0;
  for (const m of text.matchAll(matcher.regex)) {
    const i = m.index ?? 0;
    const user = matcher.lookup.get(m[1].toLowerCase());
    if (!user) continue;
    if (i > last) splitEmoji(text.slice(last, i), out);
    out.push({ type: "mention", value: m[1], user });
    last = i + m[0].length;
  }
  if (last < text.length) splitEmoji(text.slice(last), out);
  return out;
}

export function mentionsUser(text: string, matcher: MentionMatcher | null, userId: number): boolean {
  if (!matcher) return false;
  return tokenize(text, matcher).some((t) => t.type === "mention" && t.user.id === userId);
}
