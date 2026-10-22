import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getDeletedSince,
  getMessagesAfter,
  getPresence,
  getRecentMessages,
  presenceSignature,
  touchUser,
} from "@/lib/chat";
import { getConversations, getDmsAfter, maxDmId } from "@/lib/social";
import { pendingIncomingCount } from "@/lib/social";
import { clientIp, isActive } from "@/lib/moderation";
import { findBan } from "@/lib/server-utils";
import { toSelfUser } from "@/lib/types";

export const dynamic = "force-dynamic";
// Vercel ends a function after its max duration (300s on the Hobby plan), so each stream
// closes itself a little earlier and tells the browser to reconnect immediately.
export const maxDuration = 300;
const STREAM_LIFETIME_MS = Number(process.env.STREAM_LIFETIME_MS) || 240_000;

const TICK_MS = 1000;
const PRESENCE_EVERY = 3; // ticks
const TOUCH_EVERY = 10; // ticks
const PING_EVERY = 20; // ticks

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  let lastId = Number(url.searchParams.get("after") ?? "0") || 0;
  let lastDmId = Number(url.searchParams.get("dmAfter") ?? "0") || 0;
  const isMember = user.role !== "guest";
  const ip = clientIp(req.headers);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", close);

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const kickedCheck = (u: User) => {
        if (isActive(u.kickedUntil)) {
          send("kicked", toSelfUser(u));
          closed = true;
          return true;
        }
        return false;
      };

      try {
        if (kickedCheck(user)) return;
        await touchUser(user.id, ip);
        let deletedSince = new Date();

        const initial = lastId > 0 ? await getMessagesAfter(lastId) : await getRecentMessages();
        if (initial.length) lastId = initial[initial.length - 1].id;

        const presence = await getPresence();
        let presenceSig = presenceSignature(presence);

        let conversations = null;
        let friendRequests = 0;
        let catchUpDms = null;
        if (isMember) {
          if (lastDmId > 0) catchUpDms = await getDmsAfter(user.id, lastDmId);
          else lastDmId = await maxDmId();
          conversations = await getConversations(user.id);
          friendRequests = await pendingIncomingCount(user.id);
        }

        send("init", {
          messages: initial,
          presence,
          me: toSelfUser(user),
          conversations,
          dmLastId: lastDmId,
          friendRequests,
        });
        if (catchUpDms?.length) {
          lastDmId = catchUpDms[catchUpDms.length - 1].id;
          send("dms", catchUpDms);
        }

        let tick = 0;
        const endsAt = Date.now() + STREAM_LIFETIME_MS;
        while (!closed) {
          await sleep(TICK_MS);
          if (closed) break;
          if (Date.now() >= endsAt) {
            send("reconnect", {});
            break;
          }
          tick++;

          const fresh = await getMessagesAfter(lastId);
          if (fresh.length) {
            lastId = fresh[fresh.length - 1].id;
            send("messages", fresh);
          }

          if (isMember) {
            const dms = await getDmsAfter(user.id, lastDmId);
            if (dms.length) {
              lastDmId = dms[dms.length - 1].id;
              send("dms", dms);
            }
          }

          const deleted = await getDeletedSince(deletedSince);
          if (deleted.ids.length) {
            send("deleted", deleted.ids);
            if (deleted.latest) deletedSince = deleted.latest;
          }

          if (tick % PRESENCE_EVERY === 0) {
            const [current] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
            if (!current) {
              // Account was banned & deleted while connected.
              const ban = await findBan({ username: user.username });
              send("banned", { reason: ban?.reason ?? null });
              break;
            }
            if (kickedCheck(current)) break;
            send("self", toSelfUser(current));

            const p = await getPresence();
            const sig = presenceSignature(p);
            if (sig !== presenceSig) {
              presenceSig = sig;
              send("presence", p);
            }
            if (isMember) {
              const n = await pendingIncomingCount(user.id);
              if (n !== friendRequests) {
                friendRequests = n;
                send("counts", { friendRequests: n });
              }
            }
          }
          if (tick % TOUCH_EVERY === 0) await touchUser(user.id, ip);
          if (tick % PING_EVERY === 0 && !closed) {
            try {
              controller.enqueue(encoder.encode(`: ping\n\n`));
            } catch {
              closed = true;
            }
          }
        }
      } catch {
        // connection dropped or DB error – just end the stream
      } finally {
        req.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
