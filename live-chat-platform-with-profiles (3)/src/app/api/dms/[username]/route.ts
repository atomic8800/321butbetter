import { eq } from "drizzle-orm";
import { db } from "@/db";
import { directMessages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { LIMITS } from "@/lib/constants";
import { getThread, mapDm, markRead } from "@/lib/social";
import { isMediaError, saveMedia } from "@/lib/server-utils";
import { membersOnly, sendBlocked } from "@/lib/server-utils";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ username: string }> };

async function resolve(req: Request, ctx: Ctx) {
  const me = await getCurrentUser(req);
  if (!me) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const denied = membersOnly(me);
  if (denied) return { error: denied };
  const { username } = await ctx.params;
  const [other] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (!other) return { error: Response.json({ error: "User not found." }, { status: 404 }) };
  if (other.id === me.id) return { error: Response.json({ error: "You can't message yourself." }, { status: 400 }) };
  if (other.role === "guest") {
    return { error: Response.json({ error: "Guests can't receive DMs." }, { status: 400 }) };
  }
  return { me, other };
}

export async function GET(req: Request, ctx: Ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  await markRead(r.me.id, r.other.id);
  return Response.json({ user: toPublicUser(r.other), messages: await getThread(r.me.id, r.other.id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const blocked = sendBlocked(r.me);
  if (blocked) return blocked;

  const form = await req.formData();
  const content = String(form.get("content") ?? "").replace(/\r/g, "").trim();
  if (content.length > LIMITS.message) {
    return Response.json({ error: `Messages are limited to ${LIMITS.message} characters.` }, { status: 400 });
  }
  const media = await saveMedia(form.get("file"), r.me.id, "dm");
  if (isMediaError(media)) return Response.json({ error: media.error }, { status: 400 });
  if (!content && !media) return Response.json({ error: "Message is empty." }, { status: 400 });

  const [row] = await db
    .insert(directMessages)
    .values({
      senderId: r.me.id,
      recipientId: r.other.id,
      content,
      attachmentFileId: media?.id ?? null,
      attachmentType: media?.type ?? null,
    })
    .returning();
  // Replying implies you've read their messages.
  await markRead(r.me.id, r.other.id);
  return Response.json({ message: mapDm(row) });
}
