import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { directMessages, friendships, postMedia, posts, users } from "@/db/schema";
import { type Conversation, type DirectMessage, type FriendStatus, type PublicUser, toAttachment, toPublicUser, type WallPost } from "@/lib/types";

// ===================================================================== friends

type Row = typeof friendships.$inferSelect;

export async function findFriendship(a: number, b: number): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function statusFrom(me: number, other: number, row: Row | null): FriendStatus {
  if (me === other) return "self";
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requesterId === me ? "outgoing" : "incoming";
}

export async function getFriendStatus(me: number, other: number): Promise<FriendStatus> {
  if (me === other) return "self";
  return statusFrom(me, other, await findFriendship(me, other));
}

export async function getFriendIds(me: number): Promise<number[]> {
  const rows = await db
    .select({ r: friendships.requesterId, a: friendships.addresseeId })
    .from(friendships)
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me))));
  return rows.map((x) => (x.r === me ? x.a : x.r));
}

export async function getFriendData(me: number): Promise<{
  friends: PublicUser[];
  incoming: PublicUser[];
  outgoing: PublicUser[];
}> {
  const rows = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)));
  const ids = rows.map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId));
  if (!ids.length) return { friends: [], incoming: [], outgoing: [] };
  const userRows = await db.select().from(users).where(inArray(users.id, ids));
  const byId = new Map(userRows.map((u) => [u.id, toPublicUser(u)]));

  const friends: PublicUser[] = [];
  const incoming: PublicUser[] = [];
  const outgoing: PublicUser[] = [];
  for (const r of rows) {
    const other = byId.get(r.requesterId === me ? r.addresseeId : r.requesterId);
    if (!other) continue;
    if (r.status === "accepted") friends.push(other);
    else if (r.requesterId === me) outgoing.push(other);
    else incoming.push(other);
  }
  friends.sort((x, y) => x.displayName.localeCompare(y.displayName));
  return { friends, incoming, outgoing };
}

export async function pendingIncomingCount(me: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(friendships)
    .where(and(eq(friendships.addresseeId, me), eq(friendships.status, "pending")));
  return Number(row?.n ?? 0);
}

// ===================================================================== dms

type DmRow = typeof directMessages.$inferSelect;

export function mapDm(r: DmRow): DirectMessage {
  return {
    id: r.id,
    senderId: r.senderId,
    recipientId: r.recipientId,
    content: r.content,
    attachment: toAttachment(r.attachmentFileId, r.attachmentType),
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
  };
}

const involves = (me: number) => or(eq(directMessages.senderId, me), eq(directMessages.recipientId, me));

const between = (a: number, b: number) =>
  or(
    and(eq(directMessages.senderId, a), eq(directMessages.recipientId, b)),
    and(eq(directMessages.senderId, b), eq(directMessages.recipientId, a)),
  );

export async function getConversations(me: number): Promise<Conversation[]> {
  const recent = await db
    .select()
    .from(directMessages)
    .where(involves(me))
    .orderBy(desc(directMessages.id))
    .limit(1000);

  const lastByUser = new Map<number, DmRow>();
  for (const r of recent) {
    const other = r.senderId === me ? r.recipientId : r.senderId;
    if (!lastByUser.has(other)) lastByUser.set(other, r);
  }
  if (!lastByUser.size) return [];

  const ids = [...lastByUser.keys()];
  const [userRows, unreadRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, ids)),
    db
      .select({ senderId: directMessages.senderId, n: count() })
      .from(directMessages)
      .where(and(eq(directMessages.recipientId, me), isNull(directMessages.readAt)))
      .groupBy(directMessages.senderId),
  ]);
  const unread = new Map(unreadRows.map((r) => [r.senderId, Number(r.n)]));
  const byId = new Map(userRows.map((u) => [u.id, u]));

  return ids
    .filter((id) => byId.has(id))
    .map((id) => ({
      user: toPublicUser(byId.get(id)!),
      lastMessage: mapDm(lastByUser.get(id)!),
      unread: unread.get(id) ?? 0,
    }));
}

export async function getThread(me: number, other: number, limit = 150): Promise<DirectMessage[]> {
  const rows = await db
    .select()
    .from(directMessages)
    .where(between(me, other))
    .orderBy(desc(directMessages.id))
    .limit(limit);
  return rows.reverse().map(mapDm);
}

export async function markRead(me: number, other: number): Promise<void> {
  await db
    .update(directMessages)
    .set({ readAt: new Date() })
    .where(
      and(eq(directMessages.recipientId, me), eq(directMessages.senderId, other), isNull(directMessages.readAt)),
    );
}

export async function getDmsAfter(me: number, afterId: number): Promise<DirectMessage[]> {
  const rows = await db
    .select()
    .from(directMessages)
    .where(and(gt(directMessages.id, afterId), involves(me)))
    .orderBy(asc(directMessages.id))
    .limit(200);
  return rows.map(mapDm);
}

export async function maxDmId(): Promise<number> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(${directMessages.id}), 0)` }).from(directMessages);
  return Number(row?.max ?? 0);
}

export async function unreadTotal(me: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(directMessages)
    .where(and(eq(directMessages.recipientId, me), isNull(directMessages.readAt)));
  return Number(row?.n ?? 0);
}

// ===================================================================== wall

export async function getWall(authorIds: number[], before?: number, limit = 20): Promise<WallPost[]> {
  if (!authorIds.length) return [];
  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(inArray(posts.authorId, authorIds), before ? lt(posts.id, before) : undefined))
    .orderBy(desc(posts.id))
    .limit(limit);
  if (!rows.length) return [];

  const media = await db
    .select()
    .from(postMedia)
    .where(inArray(postMedia.postId, rows.map((r) => r.post.id)))
    .orderBy(asc(postMedia.position));
  const byPost = new Map<number, typeof media>();
  for (const m of media) byPost.set(m.postId, [...(byPost.get(m.postId) ?? []), m]);

  return rows.map(({ post, author }) => ({
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: toPublicUser(author),
    media: (byPost.get(post.id) ?? []).map((m) => toAttachment(m.fileId, m.type)!),
  }));
}
