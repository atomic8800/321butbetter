import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, hashPassword, resolveToken, USERNAME_RE } from "@/lib/auth";
import { findIpKick, postSystemMessage } from "@/lib/chat";
import { findBan } from "@/lib/server-utils";
import { clientIp } from "@/lib/moderation";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { username?: string; password?: string; displayName?: string }
    | null;
  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";
  const requestedDisplayName = body?.displayName?.trim() ?? "";

  if (!USERNAME_RE.test(username)) {
    return Response.json({ error: "Username must be 3–20 letters, numbers or underscores." }, { status: 400 });
  }
  if (username.toLowerCase().startsWith("guest_")) {
    return Response.json({ error: "Usernames starting with guest_ are reserved." }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const ipKick = await findIpKick(ip);
  if (ipKick) {
    return Response.json(
      { error: `You're kicked from Better321${ipKick.reason ? ` (${ipKick.reason})` : ""}. Try again later.` },
      { status: 403 },
    );
  }

  const ban = await findBan({ username, ip });
  if (ban) {
    return Response.json(
      {
        error:
          ban.username === username.toLowerCase()
            ? "That username isn't available."
            : "You're permanently banned from Better321.",
      },
      { status: 403 },
    );
  }

  const taken = await db.select({ id: users.id }).from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (taken.length) {
    return Response.json({ error: "That username is already taken." }, { status: 409 });
  }

  const current = await getCurrentUser();
  const passwordHash = hashPassword(password);
  // Upgrading guests keep their nickname unless they choose a new display name.
  const displayName = (
    requestedDisplayName || (current?.role === "guest" ? current.displayName : username)
  ).slice(0, 32);

  // Upgrade an existing guest account to a full member, keeping their chat history.
  if (current && current.role === "guest") {
    const [updated] = await db
      .update(users)
      .set({ username: username.toLowerCase(), displayName, passwordHash, role: "member" })
      .where(eq(users.id, current.id))
      .returning();
    await postSystemMessage(`${updated.displayName} upgraded from guest to a full member 🎉`, updated.id);
    return Response.json({ user: toPublicUser(updated), token: await resolveToken(req) });
  }

  if (current) await destroySession(req);

  const [created] = await db
    .insert(users)
    .values({ username: username.toLowerCase(), displayName, passwordHash, role: "member" })
    .returning();
  const token = await createSession(created.id);
  await postSystemMessage(`${created.displayName} joined the chat 👋`, created.id);
  return Response.json({ user: toPublicUser(created), token });
}
