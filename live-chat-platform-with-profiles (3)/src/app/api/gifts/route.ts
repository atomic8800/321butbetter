import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { gifts, messages, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CENTS, GIFT_MESSAGE_MAX, giftByKey } from "@/lib/economy";
import { membersOnly } from "@/lib/server-utils";
import { isActive } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return fail("Unauthorized", 401);
  const denied = membersOnly(me);
  if (denied) return denied;
  if (isActive(me.kickedUntil)) return fail("You are kicked.", 403);

  const body = (await req.json().catch(() => null)) as { recipientId?: number; gift?: string; message?: string } | null;
  const def = giftByKey(body?.gift ?? "");
  if (!def) return fail("Unknown gift.");
  const recipientId = Number(body?.recipientId);
  if (!Number.isInteger(recipientId) || recipientId === me.id) return fail("You can't send a gift to yourself.");
  const note = (body?.message ?? "").trim().replace(/\s+/g, " ").slice(0, GIFT_MESSAGE_MAX) || null;

  const [recipient] = await db.select().from(users).where(eq(users.id, recipientId)).limit(1);
  if (!recipient) return fail("User not found.", 404);
  if (recipient.role === "guest") return fail("Guests can't receive gifts.");

  const price = def.price * CENTS;
  const result = await db.transaction(async (tx) => {
    const [paid] = await tx
      .update(users)
      .set({ coins: sql`${users.coins} - ${price}` })
      .where(and(eq(users.id, me.id), gte(users.coins, price)))
      .returning({ coins: users.coins });
    if (!paid) return null;
    await tx.insert(gifts).values({ senderId: me.id, recipientId, gift: def.key, message: note, price });
    await tx.insert(messages).values({
      kind: "system",
      userId: me.id,
      content: `🎁 ${me.displayName} sent ${recipient.displayName} a ${def.name} ${def.emoji}${note ? ` — “${note}”` : ""}`,
    });
    return paid.coins;
  });
  if (result == null) return fail(`You need ${def.price} coins to send a ${def.name}.`);
  return Response.json({ ok: true, coins: result });
}
