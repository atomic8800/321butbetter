import { db } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getMessageById, getRecentMessages, touchUser } from "@/lib/chat";
import { LIMITS } from "@/lib/constants";
import { isMediaError, saveMedia } from "@/lib/server-utils";
import { sendBlocked } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ messages: await getRecentMessages() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = sendBlocked(user);
  if (blocked) return blocked;

  let content = "";
  let file: FormDataEntryValue | null = null;
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    content = String(form.get("content") ?? "");
    file = form.get("file");
  } else {
    const body = (await req.json().catch(() => null)) as { content?: string } | null;
    content = body?.content ?? "";
  }

  content = content.replace(/\r/g, "").trim();
  if (content.length > LIMITS.message) {
    return Response.json({ error: `Messages are limited to ${LIMITS.message} characters.` }, { status: 400 });
  }

  const media = await saveMedia(file, user.id, "chat");
  if (isMediaError(media)) return Response.json({ error: media.error }, { status: 400 });
  if (!content && !media) return Response.json({ error: "Message is empty." }, { status: 400 });

  const [inserted] = await db
    .insert(messages)
    .values({
      userId: user.id,
      content,
      kind: "user",
      attachmentFileId: media?.id ?? null,
      attachmentType: media?.type ?? null,
    })
    .returning({ id: messages.id });
  await touchUser(user.id);
  const message = await getMessageById(inserted.id);
  return Response.json({ message });
}
