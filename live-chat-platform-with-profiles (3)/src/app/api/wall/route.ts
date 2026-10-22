import { db } from "@/db";
import { postMedia, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { LIMITS } from "@/lib/constants";
import { isMediaError, saveMedia, type SavedMedia } from "@/lib/server-utils";
import { getFriendIds } from "@/lib/social";
import { membersOnly, sendBlocked } from "@/lib/server-utils";
import { getWall } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const denied = membersOnly(me);
  if (denied) return denied;
  const url = new URL(req.url);
  const before = Number(url.searchParams.get("before")) || undefined;
  const friendIds = await getFriendIds(me.id);
  const list = await getWall([me.id, ...friendIds], before);
  return Response.json({ posts: list, hasMore: list.length === 20 });
}

export async function POST(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const denied = membersOnly(me) ?? sendBlocked(me);
  if (denied) return denied;

  const form = await req.formData();
  const content = String(form.get("content") ?? "").replace(/\r/g, "").trim();
  if (content.length > LIMITS.post) {
    return Response.json({ error: `Posts are limited to ${LIMITS.post} characters.` }, { status: 400 });
  }
  const uploads = form.getAll("files").filter((f) => f instanceof File && f.size > 0);
  if (uploads.length > LIMITS.postMedia) {
    return Response.json({ error: `You can attach up to ${LIMITS.postMedia} files.` }, { status: 400 });
  }

  const totalBytes = uploads.reduce((n, f) => n + (f as File).size, 0);
  if (totalBytes > LIMITS.postTotal) {
    return Response.json(
      { error: `All photos/videos in one post must add up to under ${LIMITS.postTotal / 1024 / 1024}MB.` },
      { status: 400 },
    );
  }

  const saved: SavedMedia[] = [];
  for (const f of uploads) {
    const m = await saveMedia(f, me.id, "post");
    if (isMediaError(m)) return Response.json({ error: m.error }, { status: 400 });
    if (m) saved.push(m);
  }
  if (!content && !saved.length) return Response.json({ error: "Write something or add a photo/video." }, { status: 400 });

  const [post] = await db.insert(posts).values({ authorId: me.id, content }).returning();
  if (saved.length) {
    await db.insert(postMedia).values(saved.map((m, i) => ({ postId: post.id, fileId: m.id, type: m.type, position: i })));
  }
  const [created] = await getWall([me.id], post.id + 1, 1);
  return Response.json({ post: created });
}
