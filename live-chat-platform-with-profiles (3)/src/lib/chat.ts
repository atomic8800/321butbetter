import { and, desc, eq, gt, isNull, isNotNull, ne, or, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { rankOf } from "@/lib/moderation";
import { fileUrl, toAttachment, toPublicUser, type ChatMessage, type Presence, type PublicUser } from "@/lib/types";

export const ONLINE_WINDOW_SECONDS = 45;

const messageSelect = {
  id: messages.id,
  kind: messages.kind,
  content: messages.content,
  attachmentFileId: messages.attachmentFileId,
  attachmentType: messages.attachmentType,
  createdAt: messages.createdAt,
  authorId: users.id,
  authorUsername: users.username,
  authorDisplayName: users.displayName,
  authorRole: users.role,
  authorRank: users.rank,
  authorAccent: users.accentColor,
  authorAvatar: users.avatarFileId,
  authorNameStyle: users.nameStyle,
  authorMessageStyle: users.messageStyle,
  authorNameFont: users.nameFont,
  authorItalic: users.messageItalic,
  authorGlow: users.nameGlow,
};

type Row = {
  id: number;
  kind: string;
  content: string;
  attachmentFileId: string | null;
  attachmentType: string | null;
  createdAt: Date;
  authorId: number | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorRole: string | null;
  authorRank: string | null;
  authorAccent: string | null;
  authorAvatar: string | null;
  authorNameStyle: string | null;
  authorMessageStyle: string | null;
  authorNameFont: string | null;
  authorItalic: boolean | null;
  authorGlow: boolean | null;
};

function mapRow(r: Row): ChatMessage {
  return {
    id: r.id,
    kind: r.kind === "system" ? "system" : "user",
    content: r.content,
    attachment: toAttachment(r.attachmentFileId, r.attachmentType),
    createdAt: r.createdAt.toISOString(),
    author:
      r.authorId != null
        ? {
            id: r.authorId,
            username: r.authorUsername ?? "unknown",
            displayName: r.authorDisplayName ?? "Unknown",
            role: r.authorRole === "guest" ? "guest" : "member",
            rank: rankOf({
              username: r.authorUsername ?? "",
              rank: r.authorRank ?? "user",
              role: r.authorRole ?? "member",
            }),
            accentColor: r.authorAccent ?? "#fb923c",
            avatarUrl: fileUrl(r.authorAvatar),
            nameStyle: r.authorNameStyle,
            messageStyle: r.authorMessageStyle,
            nameFont: r.authorNameFont,
            messageItalic: !!r.authorItalic,
            nameGlow: !!r.authorGlow,
          }
        : null,
  };
}

export async function getRecentMessages(limit = 60): Promise<ChatMessage[]> {
  const rows = await db
    .select(messageSelect)
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(isNull(messages.deletedAt))
    .orderBy(desc(messages.id))
    .limit(limit);
  return rows.reverse().map(mapRow);
}

export async function getMessagesAfter(afterId: number, limit = 200): Promise<ChatMessage[]> {
  const rows = await db
    .select(messageSelect)
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(and(gt(messages.id, afterId), isNull(messages.deletedAt)))
    .orderBy(messages.id)
    .limit(limit);
  return rows.map(mapRow);
}

export async function getMessageById(id: number): Promise<ChatMessage | null> {
  const rows = await db
    .select(messageSelect)
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(eq(messages.id, id))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Ids of messages deleted after `since`, used to push removals to connected clients. */
export async function getDeletedSince(since: Date): Promise<{ ids: number[]; latest: Date | null }> {
  const rows = await db
    .select({ id: messages.id, deletedAt: messages.deletedAt })
    .from(messages)
    .where(and(isNotNull(messages.deletedAt), gt(messages.deletedAt, since)))
    .orderBy(messages.deletedAt)
    .limit(1000);
  const latest = rows.length ? rows[rows.length - 1].deletedAt : null;
  return { ids: rows.map((r) => r.id), latest };
}

export async function getOnlineUsers(): Promise<PublicUser[]> {
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        gt(users.lastSeenAt, sql`now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})`),
        or(isNull(users.kickedUntil), lte(users.kickedUntil, sql`now()`)),
      ),
    )
    .orderBy(users.displayName);
  return rows.map(toPublicUser);
}

/** Non-guest members who are not currently online (most recently seen first). */
export async function getOfflineUsers(limit = 100): Promise<PublicUser[]> {
  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.role, "guest"),
        lte(users.lastSeenAt, sql`now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})`),
        or(isNull(users.kickedUntil), lte(users.kickedUntil, sql`now()`)),
      ),
    )
    .orderBy(desc(users.lastSeenAt))
    .limit(limit);
  return rows.map(toPublicUser);
}

export async function getPresence(): Promise<Presence> {
  const [online, offline] = await Promise.all([getOnlineUsers(), getOfflineUsers()]);
  return { online, offline };
}

/** Stable signature of presence that ignores heartbeat timestamps of online users. */
export function presenceSignature(p: Presence): string {
  return JSON.stringify([p.online.map((u) => ({ ...u, lastSeenAt: "" })), p.offline]);
}

export async function touchUser(userId: number, ip?: string | null): Promise<void> {
  await db
    .update(users)
    .set(ip ? { lastSeenAt: new Date(), lastIp: ip } : { lastSeenAt: new Date() })
    .where(eq(users.id, userId));
}

/** Returns an active kick tied to this IP (set when a guest is kicked), if any. */
export async function findIpKick(ip: string | null): Promise<{ until: Date; reason: string | null } | null> {
  if (!ip) return null;
  const [row] = await db
    .select({ until: users.kickedUntil, reason: users.kickReason })
    .from(users)
    .where(and(eq(users.kickedIp, ip), gt(users.kickedUntil, sql`now()`)))
    .limit(1);
  return row?.until ? { until: row.until, reason: row.reason } : null;
}

export async function postSystemMessage(content: string, userId?: number): Promise<void> {
  await db.insert(messages).values({ kind: "system", content, userId: userId ?? null });
}
