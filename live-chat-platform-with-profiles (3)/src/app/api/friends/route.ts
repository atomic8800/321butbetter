import { eq } from "drizzle-orm";
import { db } from "@/db";
import { friendships, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { findFriendship, getFriendData, statusFrom } from "@/lib/social";
import { membersOnly } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return fail("Unauthorized", 401);
  const denied = membersOnly(me);
  if (denied) return denied;
  return Response.json(await getFriendData(me.id));
}

export async function POST(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return fail("Unauthorized", 401);
  const denied = membersOnly(me);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { action?: string; userId?: number } | null;
  const action = body?.action ?? "";
  const otherId = Number(body?.userId);
  if (!Number.isInteger(otherId) || otherId === me.id) return fail("Invalid user.");

  const [other] = await db.select().from(users).where(eq(users.id, otherId)).limit(1);
  if (!other) return fail("User not found.", 404);
  if (other.role === "guest") return fail("Guests can't be added as friends.");

  const existing = await findFriendship(me.id, other.id);
  const status = statusFrom(me.id, other.id, existing);

  switch (action) {
    case "request": {
      if (status === "friends") return fail("You're already friends.");
      if (status === "outgoing") return fail("Friend request already sent.");
      if (status === "incoming" && existing) {
        // They already asked you — accept instead.
        await db
          .update(friendships)
          .set({ status: "accepted", respondedAt: new Date() })
          .where(eq(friendships.id, existing.id));
        return Response.json({ status: "friends" });
      }
      await db.insert(friendships).values({ requesterId: me.id, addresseeId: other.id });
      return Response.json({ status: "outgoing" });
    }
    case "accept": {
      if (status !== "incoming" || !existing) return fail("No pending request from this user.");
      await db
        .update(friendships)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(friendships.id, existing.id));
      return Response.json({ status: "friends" });
    }
    case "decline":
    case "cancel":
    case "remove": {
      if (!existing) return Response.json({ status: "none" });
      await db.delete(friendships).where(eq(friendships.id, existing.id));
      return Response.json({ status: "none" });
    }
    default:
      return fail("Unknown action.");
  }
}
