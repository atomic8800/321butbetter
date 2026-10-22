import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rankOf } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid post." }, { status: 400 });
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return Response.json({ error: "Post not found." }, { status: 404 });
  if (post.authorId !== me.id && rankOf(me) !== "owner") {
    return Response.json({ error: "You can only delete your own posts." }, { status: 403 });
  }
  await db.delete(posts).where(eq(posts.id, id));
  return Response.json({ ok: true });
}
