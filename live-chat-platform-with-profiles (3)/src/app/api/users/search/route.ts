import { and, ilike, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 32);
  if (q.length < 1) return Response.json({ users: [] });
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db
    .select()
    .from(users)
    .where(and(ne(users.role, "guest"), ne(users.id, me.id), or(ilike(users.username, pattern), ilike(users.displayName, pattern))))
    .orderBy(users.username)
    .limit(20);
  return Response.json({ users: rows.map(toPublicUser) });
}
