import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { banAndDelete } from "@/lib/server-utils";
import { bans, messages, modActions, users, type User } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { postSystemMessage } from "@/lib/chat";
import {
  LIMITS_BY_RANK,
  PERMANENT_DATE,
  PERMANENT_MINUTES,
  canModerate,
  formatDuration,
  isActive,
  rankOf,
} from "@/lib/moderation";
import { toPublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  action?: string;
  targetId?: number;
  messageId?: number;
  minutes?: number;
  reason?: string;
};

const fail = (error: string, status = 400) => Response.json({ error }, { status });

async function log(actorId: number, target: User | null, action: string, reason: string | null, until: Date | null) {
  await db.insert(modActions).values({
    actorId,
    targetId: target?.id ?? null,
    targetName: target?.displayName ?? null,
    action,
    reason,
    until,
  });
}

export async function POST(req: Request) {
  const actor = await getCurrentUser(req);
  if (!actor) return fail("Unauthorized", 401);
  const actorRank = rankOf(actor);
  if (actorRank === "user") return fail("You don't have moderation permissions.", 403);
  if (isActive(actor.kickedUntil)) return fail("You are currently kicked.", 403);

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const action = body.action ?? "";
  const reason = (body.reason ?? "").trim().replace(/\s+/g, " ").slice(0, 200) || null;
  const limits = LIMITS_BY_RANK[actorRank];

  // ---- Owner-only actions that don't target a user -------------------------
  if (action === "clear_chat") {
    if (actorRank !== "owner") return fail("Only the owner can clear the chat.", 403);
    await db.update(messages).set({ deletedAt: new Date() }).where(isNull(messages.deletedAt));
    await log(actor.id, null, "clear_chat", reason, null);
    await postSystemMessage(`🧹 The chat was cleared by ${actor.displayName}${reason ? ` — ${reason}` : ""}`, actor.id);
    return Response.json({ ok: true });
  }

  if (action === "lift_bans") {
    if (actorRank !== "owner") return fail("Only the owner can lift bans.", 403);
    await db.delete(bans);
    await log(actor.id, null, "lift_bans", null, null);
    return Response.json({ ok: true });
  }

  if (action === "delete_message") {
    if (actorRank !== "owner") return fail("Only the owner can delete messages.", 403);
    const id = Number(body.messageId);
    if (!Number.isInteger(id)) return fail("Invalid message.");
    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, id));
    await log(actor.id, null, "delete_message", `message #${id}`, null);
    return Response.json({ ok: true });
  }

  // ---- Actions on a target user ------------------------------------------
  const targetId = Number(body.targetId);
  if (!Number.isInteger(targetId)) return fail("Invalid target user.");
  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return fail("User not found.", 404);

  if (action === "promote" || action === "demote") {
    if (actorRank !== "owner") return fail("Only the owner can change moderator rank.", 403);
    if (target.id === actor.id || rankOf(target) === "owner") return fail("You can't change your own rank.");
    if (action === "promote") {
      if (target.role === "guest") return fail("Guests can't be moderators — they need a full account first.");
      if (target.rank === "moderator") return fail("That user is already a moderator.");
    } else if (target.rank !== "moderator") {
      return fail("That user isn't a moderator.");
    }
    const [updated] = await db
      .update(users)
      .set({ rank: action === "promote" ? "moderator" : "user" })
      .where(eq(users.id, target.id))
      .returning();
    await log(actor.id, target, action, null, null);
    await postSystemMessage(
      action === "promote"
        ? `🛡️ ${target.displayName} was promoted to Moderator by ${actor.displayName}`
        : `${target.displayName} is no longer a Moderator`,
      target.id,
    );
    return Response.json({ user: toPublicUser(updated) });
  }

  if (!canModerate(actor, target)) {
    return fail(
      rankOf(target) === "owner"
        ? "The owner can't be moderated."
        : actorRank === "moderator"
          ? "Moderators can only moderate regular users and guests."
          : "You can't moderate this user.",
      403,
    );
  }

  if (action === "kick" || action === "mute") {
    const minutes = Math.round(Number(body.minutes));
    const isPerm = minutes === PERMANENT_MINUTES;
    const max = action === "kick" ? limits.kickMaxMinutes : limits.muteMaxMinutes;
    if (isPerm && !limits.allowPermanent) return fail("Only the owner can issue permanent punishments.", 403);
    if (!isPerm && (!Number.isFinite(minutes) || minutes < 1)) return fail("Duration must be at least 1 minute.");
    if (!isPerm && minutes > max) {
      return fail(`Moderators can ${action} for at most ${formatDuration(max)}.`, 403);
    }
    if (action === "kick" && limits.kickReasonRequired && (!reason || reason.length < 3)) {
      return fail("A reason (at least 3 characters) is required to kick someone.");
    }

    const until = isPerm ? PERMANENT_DATE : new Date(Date.now() + minutes * 60_000);
    const durationText = formatDuration(isPerm ? PERMANENT_MINUTES : minutes);
    const forText = isPerm ? "permanently" : `for ${durationText}`;

    // Permanent kicks ban the account and delete it entirely.
    if (action === "kick" && isPerm) {
      await log(actor.id, target, "ban", reason, until);
      await banAndDelete(target, actor.id, reason);
      await postSystemMessage(
        `⛔ ${target.displayName} was permanently banned by ${actor.displayName} and their account was deleted${reason ? ` — ${reason}` : ""}`,
        actor.id,
      );
      return Response.json({ deleted: true, userId: target.id });
    }

    let updated: User;
    if (action === "kick") {
      [updated] = await db
        .update(users)
        .set({
          kickedUntil: until,
          kickReason: reason,
          // Remember a guest's IP so they can't just rejoin as a fresh guest.
          kickedIp: target.role === "guest" ? target.lastIp : null,
          lastSeenAt: new Date(Date.now() - 10 * 60_000),
        })
        .where(eq(users.id, target.id))
        .returning();
      await postSystemMessage(
        `🚫 ${target.displayName} was ${isPerm ? "banned" : "kicked"} by ${actor.displayName} ${forText}${reason ? ` — ${reason}` : ""}`,
        target.id,
      );
    } else {
      [updated] = await db
        .update(users)
        .set({ mutedUntil: until, muteReason: reason })
        .where(eq(users.id, target.id))
        .returning();
      await postSystemMessage(
        `🔇 ${target.displayName} was muted by ${actor.displayName} ${forText}${reason ? ` — ${reason}` : ""}`,
        target.id,
      );
    }
    await log(actor.id, target, isPerm && action === "kick" ? "ban" : action, reason, until);
    return Response.json({ user: toPublicUser(updated) });
  }

  if (action === "unkick" || action === "unmute") {
    const [updated] = await db
      .update(users)
      .set(
        action === "unkick"
          ? { kickedUntil: null, kickReason: null, kickedIp: null }
          : { mutedUntil: null, muteReason: null },
      )
      .where(eq(users.id, target.id))
      .returning();
    await log(actor.id, target, action, null, null);
    await postSystemMessage(
      action === "unkick"
        ? `✅ ${target.displayName}'s kick was lifted by ${actor.displayName}`
        : `🔊 ${target.displayName} was unmuted by ${actor.displayName}`,
      target.id,
    );
    return Response.json({ user: toPublicUser(updated) });
  }

  return fail("Unknown action.");
}
