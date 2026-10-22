import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, randomGuestSuffix } from "@/lib/auth";
import { findIpKick, postSystemMessage } from "@/lib/chat";
import { findBan } from "@/lib/server-utils";
import { clientIp } from "@/lib/moderation";
import { toPublicUser } from "@/lib/types";
import { ACCENT_COLORS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { nickname?: string } | null;
  const nickname = body?.nickname?.trim().replace(/\s+/g, " ").slice(0, 24) ?? "";

  const ip = clientIp(req.headers);
  const ipKick = await findIpKick(ip);
  if (ipKick) {
    return Response.json(
      { error: `You're kicked from Better321${ipKick.reason ? ` (${ipKick.reason})` : ""}. Try again later.` },
      { status: 403 },
    );
  }

  if (await findBan({ ip })) {
    return Response.json({ error: "You're permanently banned from Better321." }, { status: 403 });
  }

  const current = await getCurrentUser();
  if (current) await destroySession(req);

  // Retry a few times in the unlikely event of a suffix collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomGuestSuffix();
    const username = `guest_${suffix}`;
    const displayName = nickname || `Guest ${suffix.toUpperCase()}`;
    const accentColor = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
    try {
      const [created] = await db
        .insert(users)
        .values({ username, displayName, role: "guest", accentColor, passwordHash: null })
        .returning();
      const token = await createSession(created.id);
      await postSystemMessage(`${created.displayName} joined as a guest 👋`, created.id);
      return Response.json({ user: toPublicUser(created), token });
    } catch {
      // collision – try again
    }
  }
  return Response.json({ error: "Could not create guest session. Try again." }, { status: 500 });
}
