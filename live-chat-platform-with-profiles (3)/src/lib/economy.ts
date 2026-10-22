
// ===================================================================== economy

/** Client-safe economy constants & helpers. Balances are stored in hundredths of a coin. */
export const CENTS = 100;
export const STARTING_COINS = 500;
export const INCOME_PER_MINUTE = 5;
export const INCOME_MAX_CATCHUP_MINUTES = 3;
export const DAILY_BONUS = 250;
export const DAILY_COOLDOWN_HOURS = 24;
export const GIFT_MESSAGE_MAX = 100;

export const GIFTS = [
  { key: "heart", name: "Heart", price: 10, image: "/gifts/heart.png", emoji: "❤️" },
  { key: "donut", name: "Donut", price: 25, image: "/gifts/donut.png", emoji: "🍩" },
  { key: "beer", name: "Beer", price: 50, image: "/gifts/beer.png", emoji: "🍺" },
  { key: "kiss", name: "Kiss", price: 100, image: "/gifts/kiss.png", emoji: "💋" },
] as const;

export type GiftKey = (typeof GIFTS)[number]["key"];
export type GiftDef = (typeof GIFTS)[number];

export function giftByKey(key: string): GiftDef | undefined {
  return GIFTS.find((g) => g.key === key);
}

/** Formats hundredths of a coin, e.g. 123450 -> "1,234.5". */
export function formatCoins(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return (cents / CENTS).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ===================================================================== plinko

/** Shared Plinko configuration (used by both the game UI and the server). */
export type Risk = "low" | "medium" | "high";

export const RISKS: Risk[] = ["low", "medium", "high"];
export const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export const MIN_BET = 0.1;
export const MAX_BET = 100000;
export const MAX_BALLS_PER_DROP = 250;
export const FLOOD_OPTIONS = [100, 250] as const;

/** Half of each table (edge → centre); the full row is mirrored. */
const HALF: Record<number, Record<Risk, number[]>> = {
  8: { low: [5.6, 2.1, 1.1, 1, 0.5], medium: [13, 3, 1.3, 0.7, 0.4], high: [29, 4, 1.5, 0.3, 0.2] },
  9: { low: [5.6, 2, 1.6, 1, 0.7], medium: [18, 4, 1.7, 0.9, 0.5], high: [43, 7, 2, 0.6, 0.2] },
  10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5], medium: [22, 5, 2, 1.4, 0.6, 0.4], high: [76, 10, 3, 0.9, 0.3, 0.2] },
  11: { low: [8.4, 3, 1.9, 1.3, 1, 0.7], medium: [24, 6, 3, 1.8, 0.7, 0.5], high: [120, 14, 5.2, 1.4, 0.4, 0.2] },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2],
  },
  13: {
    low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7],
    medium: [43, 13, 6, 3, 1.3, 0.7, 0.4],
    high: [260, 37, 11, 4, 1, 0.2, 0.2],
  },
  14: {
    low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5],
    medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2],
    high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2],
  },
  15: {
    low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7],
    medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3],
    high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5],
    medium: [110, 39, 9.7, 4.8, 3, 1.5, 0.9, 0.5, 0.3],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2],
  },
};

const cache = new Map<string, number[]>();

/** Multipliers for each of the rows+1 bins, left to right. */
export function getMultipliers(rows: number, risk: Risk): number[] {
  const key = `${rows}:${risk}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const half = HALF[rows]?.[risk];
  if (!half) throw new Error("Invalid plinko config");
  // Even rows have an odd bin count (shared centre bin); odd rows mirror fully.
  const full = rows % 2 === 0 ? [...half, ...half.slice(0, -1).reverse()] : [...half, ...[...half].reverse()];
  cache.set(key, full);
  return full;
}

export function maxMultiplier(rows: number, risk: Risk): number {
  return getMultipliers(rows, risk)[0];
}

export function isRisk(v: unknown): v is Risk {
  return v === "low" || v === "medium" || v === "high";
}

export function isValidRows(v: unknown): v is number {
  return typeof v === "number" && (ROW_OPTIONS as readonly number[]).includes(v);
}

export function formatMultiplier(m: number): string {
  return m >= 100 ? String(Math.round(m)) : String(m);
}
