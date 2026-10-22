import type { User } from "@/db/schema";

export const OWNER_USERNAME = "atomic8800";

export type Rank = "owner" | "moderator" | "user";

/** "Permanent" punishments are stored as a far-future date. */
export const PERMANENT_DATE = new Date("9999-12-31T00:00:00Z");
export const PERMANENT_MINUTES = -1;

export const LIMITS_BY_RANK = {
  moderator: {
    kickMaxMinutes: 7 * 24 * 60, // 7 days
    muteMaxMinutes: 24 * 60, // 1 day (as requested)
    kickReasonRequired: true,
    allowPermanent: false,
  },
  owner: {
    kickMaxMinutes: Infinity,
    muteMaxMinutes: Infinity,
    kickReasonRequired: false,
    allowPermanent: true,
  },
} as const;

export function rankOf(u: Pick<User, "username" | "rank" | "role">): Rank {
  if (u.username === OWNER_USERNAME && u.role !== "guest") return "owner";
  if (u.rank === "moderator" && u.role !== "guest") return "moderator";
  return "user";
}

export function isStaff(rank: Rank): rank is "owner" | "moderator" {
  return rank === "owner" || rank === "moderator";
}

/** Can `actor` moderate (kick/mute) `target`? */
export function canModerate(actor: User, target: User): boolean {
  if (actor.id === target.id) return false;
  const a = rankOf(actor);
  const t = rankOf(target);
  if (t === "owner") return false;
  if (a === "owner") return true;
  if (a === "moderator") return t === "user";
  return false;
}

export function isActive(until: Date | null | undefined): boolean {
  return !!until && until.getTime() > Date.now();
}

export function isPermanent(until: Date | string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getUTCFullYear() >= 9999;
}

export function clientIp(h: Headers): string | null {
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "";
  if (!raw) return null;
  // Never block on loopback / private addresses (these are proxies, not people).
  if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|::ffff:127\.)/i.test(raw)) return null;
  return raw.slice(0, 64);
}

export function formatDuration(minutes: number): string {
  if (minutes === PERMANENT_MINUTES) return "permanently";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (minutes < 1440) {
    const h = Math.round((minutes / 60) * 10) / 10;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.round((minutes / 1440) * 10) / 10;
  return `${d} day${d === 1 ? "" : "s"}`;
}
