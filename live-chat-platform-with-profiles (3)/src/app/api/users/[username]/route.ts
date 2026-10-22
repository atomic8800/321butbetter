import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { username } = await params;
  const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user: toPublicUser(user) });
}
