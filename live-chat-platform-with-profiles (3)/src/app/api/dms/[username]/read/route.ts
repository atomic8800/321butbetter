import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { markRead } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { username } = await params;
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (other) await markRead(me.id, other.id);
  return Response.json({ ok: true });
}
