import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { gifts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { fileUrl } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getCurrentUser(req);
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { username } = await params;
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });

  const [summaryRows, recentRows] = await Promise.all([
    db.select({ gift: gifts.gift, n: count() }).from(gifts).where(eq(gifts.recipientId, user.id)).groupBy(gifts.gift),
    db
      .select({
        id: gifts.id,
        gift: gifts.gift,
        message: gifts.message,
        createdAt: gifts.createdAt,
        senderUsername: users.username,
        senderName: users.displayName,
        senderAccent: users.accentColor,
        senderAvatar: users.avatarFileId,
      })
      .from(gifts)
      .leftJoin(users, eq(gifts.senderId, users.id))
      .where(eq(gifts.recipientId, user.id))
      .orderBy(desc(gifts.id))
      .limit(50),
  ]);

  const summary: Record<string, number> = {};
  let total = 0;
  for (const r of summaryRows) {
    summary[r.gift] = Number(r.n);
    total += Number(r.n);
  }
  return Response.json({
    total,
    summary,
    recent: recentRows.map((r) => ({
      id: r.id,
      gift: r.gift,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      sender: r.senderUsername
        ? {
            username: r.senderUsername,
            displayName: r.senderName ?? r.senderUsername,
            accentColor: r.senderAccent ?? "#fb923c",
            avatarUrl: fileUrl(r.senderAvatar),
          }
        : null,
    })),
  });
}
