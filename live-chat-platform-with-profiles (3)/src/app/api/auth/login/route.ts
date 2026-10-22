import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { touchUser } from "@/lib/chat";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || user.role === "guest" || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const current = await getCurrentUser();
  if (current) await destroySession(req);

  const token = await createSession(user.id);
  await touchUser(user.id);
  return Response.json({ user: toPublicUser(user), token });
}
