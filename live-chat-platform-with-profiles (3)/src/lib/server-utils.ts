import { bans, files, messages, type User, users } from "@/db/schema";
import { formatDuration, isActive, isPermanent } from "@/lib/moderation";
import { db } from "@/db";
import { LIMITS } from "@/lib/constants";
import { and, count, eq, gte, isNull, or, sql } from "drizzle-orm";
import { CENTS, DAILY_BONUS, DAILY_COOLDOWN_HOURS, INCOME_MAX_CATCHUP_MINUTES, INCOME_PER_MINUTE } from "@/lib/economy";

// ===================================================================== guards

/** Returns an error Response if the user may not send content right now, otherwise null. */
export function sendBlocked(user: User): Response | null {
  if (isActive(user.kickedUntil)) {
    return Response.json({ error: "You are kicked from the chat.", kicked: true }, { status: 403 });
  }
  if (isActive(user.mutedUntil)) {
    const left = isPermanent(user.mutedUntil)
      ? "permanently"
      : `for another ${formatDuration(Math.max(1, Math.ceil((user.mutedUntil!.getTime() - Date.now()) / 60000)))}`;
    return Response.json({ error: `You are muted ${left}.`, muted: true }, { status: 403 });
  }
  return null;
}

/** Members-only features (DMs, friends, wall). */
export function membersOnly(user: User): Response | null {
  if (user.role === "guest") {
    return Response.json(
      { error: "Create a free account to use DMs, friends and the wall." },
      { status: 403 },
    );
  }
  return null;
}

// ===================================================================== files

export type MediaType = "image" | "video";

export type SavedMedia = { id: string; type: MediaType };

/** Validates and stores an uploaded image/video. Returns a saved record, null (no file) or an error string. */
export async function saveMedia(
  file: FormDataEntryValue | null,
  ownerId: number,
  kind: "chat" | "dm" | "post",
  allow: MediaType[] = ["image", "video"],
): Promise<SavedMedia | null | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return null;
  const mime = file.type || "";
  const type: MediaType | null = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : null;
  if (!type || !allow.includes(type)) {
    return { error: allow.includes("video") ? "Only images and videos can be sent." : "Only images can be sent." };
  }
  const limit = type === "image" ? LIMITS.chatImage : LIMITS.chatVideo;
  if (file.size > limit) {
    return { error: `${type === "image" ? "Images" : "Videos"} must be under ${limit / 1024 / 1024}MB.` };
  }
  const data = Buffer.from(await file.arrayBuffer());
  const [row] = await db
    .insert(files)
    .values({ ownerId, kind, mime, size: file.size, name: file.name.slice(0, 120), data })
    .returning({ id: files.id });
  return { id: row.id, type };
}

export function isMediaError(v: unknown): v is { error: string } {
  return !!v && typeof v === "object" && "error" in v;
}

// ===================================================================== economy-server

/**
 * Grants passive income: INCOME_PER_MINUTE coins for each full minute since the last payout.
 * Only a few minutes can be caught up, so income is earned while you're actually around,
 * not while offline. Atomic, so multiple tabs can't double-pay.
 */
export async function accrueIncome(userId: number): Promise<number | null> {
  const rate = INCOME_PER_MINUTE * CENTS;
  const cap = INCOME_MAX_CATCHUP_MINUTES;
  const rows = await db.execute<{ coins: string | number }>(sql`
    UPDATE users SET
      coins = coins + LEAST(floor(extract(epoch from (now() - last_income_at)) / 60), ${cap})::int * ${rate},
      last_income_at = CASE
        WHEN now() - last_income_at > make_interval(mins => ${cap}) THEN now()
        ELSE last_income_at + floor(extract(epoch from (now() - last_income_at)) / 60) * interval '1 minute'
      END
    WHERE id = ${userId} AND role <> 'guest' AND now() - last_income_at >= interval '1 minute'
    RETURNING coins
  `);
  const row = rows.rows[0];
  return row ? Number(row.coins) : null;
}

export async function getWallet(userId: number) {
  const [row] = await db
    .select({ coins: users.coins, lastIncomeAt: users.lastIncomeAt, lastDailyAt: users.lastDailyAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  const dailyAvailableAt = row.lastDailyAt
    ? new Date(row.lastDailyAt.getTime() + DAILY_COOLDOWN_HOURS * 3600_000)
    : new Date(0);
  return {
    coins: row.coins,
    nextIncomeAt: new Date(row.lastIncomeAt.getTime() + 60_000).toISOString(),
    dailyAvailableAt: dailyAvailableAt.toISOString(),
    incomePerMinute: INCOME_PER_MINUTE,
    dailyBonus: DAILY_BONUS,
  };
}

export async function claimDaily(userId: number): Promise<number | null> {
  const rows = await db
    .update(users)
    .set({ coins: sql`${users.coins} + ${DAILY_BONUS * CENTS}`, lastDailyAt: new Date() })
    .where(
      and(
        eq(users.id, userId),
        sql`(${users.lastDailyAt} IS NULL OR ${users.lastDailyAt} <= now() - make_interval(hours => ${DAILY_COOLDOWN_HOURS}))`,
      ),
    )
    .returning({ coins: users.coins });
  return rows[0]?.coins ?? null;
}

/** Atomically applies `delta` (may be negative) if the balance can cover `required`. Returns the new balance or null. */
export async function adjustCoins(userId: number, delta: number, required = 0): Promise<number | null> {
  const rows = await db
    .update(users)
    .set({ coins: sql`${users.coins} + ${delta}` })
    .where(and(eq(users.id, userId), gte(users.coins, required)))
    .returning({ coins: users.coins });
  return rows[0]?.coins ?? null;
}

// ===================================================================== bans

export type BanRecord = typeof bans.$inferSelect;

/** Finds a permanent ban matching a username and/or IP address. */
export async function findBan({ username, ip }: { username?: string | null; ip?: string | null }): Promise<BanRecord | null> {
  const conds = [];
  if (username) conds.push(eq(bans.username, username.toLowerCase()));
  if (ip) conds.push(eq(bans.ip, ip));
  if (!conds.length) return null;
  const [row] = await db.select().from(bans).where(or(...conds)).limit(1);
  return row ?? null;
}

/**
 * Permanently bans an account and deletes it.
 * - Records the username (and the IP for guests) so the account can't simply come back.
 * - Soft-deletes their lounge messages so they disappear live for everyone.
 * - Deletes the user row; sessions, files, DMs, friendships and wall posts cascade away.
 */
export async function banAndDelete(target: User, actorId: number | null, reason: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(bans).values({
      username: target.username,
      // IPs are only recorded for guests, so members sharing a network aren't caught by it.
      ip: target.role === "guest" ? (target.lastIp ?? target.kickedIp) : null,
      displayName: target.displayName,
      reason,
      actorId,
    });
    await tx
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(and(eq(messages.userId, target.id), isNull(messages.deletedAt)));
    await tx.delete(users).where(eq(users.id, target.id));
  });
}

/** Deletes any accounts that were permanently kicked before auto-deletion existed. */
export async function purgeLegacyPermanentKicks(): Promise<number> {
  const legacy = await db.select().from(users).where(gte(users.kickedUntil, new Date("9999-01-01T00:00:00Z")));
  for (const u of legacy) {
    await banAndDelete(u, null, u.kickReason);
  }
  return legacy.length;
}

export async function banCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(bans);
  return Number(row?.n ?? 0);
}
