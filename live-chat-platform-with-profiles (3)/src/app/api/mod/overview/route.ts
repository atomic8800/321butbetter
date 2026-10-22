import { aliasedTable, desc, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { modActions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { banCount, purgeLegacyPermanentKicks } from "@/lib/server-utils";
import { rankOf } from "@/lib/moderation";
import { toPublicUser, toSelfUser, type ModLogEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const viewer = await getCurrentUser(req);
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rank = rankOf(viewer);
  if (rank === "user") return Response.json({ error: "Forbidden" }, { status: 403 });

  // Accounts permanently kicked before auto-deletion existed get cleaned up here.
  await purgeLegacyPermanentKicks();

  const actor = aliasedTable(users, "actor");
  const target = aliasedTable(users, "target");

  const [logRows, modRows, punishedRows, bansOnRecord] = await Promise.all([
    rank === "owner"
      ? db
          .select({
            id: modActions.id,
            action: modActions.action,
            reason: modActions.reason,
            until: modActions.until,
            createdAt: modActions.createdAt,
            actor: actor.displayName,
            target: sql<string | null>`coalesce(${target.displayName}, ${modActions.targetName})`,
          })
          .from(modActions)
          .leftJoin(actor, eq(modActions.actorId, actor.id))
          .leftJoin(target, eq(modActions.targetId, target.id))
          .orderBy(desc(modActions.id))
          .limit(100)
      : Promise.resolve([]),
    db.select().from(users).where(eq(users.rank, "moderator")).orderBy(users.displayName),
    db
      .select()
      .from(users)
      .where(or(gt(users.kickedUntil, sql`now()`), gt(users.mutedUntil, sql`now()`)))
      .orderBy(users.displayName),
    rank === "owner" ? banCount() : Promise.resolve(0),
  ]);

  const log: ModLogEntry[] = logRows.map((r) => ({
    id: r.id,
    action: r.action,
    reason: r.reason,
    until: r.until ? r.until.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    actor: r.actor,
    target: r.target,
  }));

  return Response.json({
    log,
    moderators: modRows.map(toPublicUser).filter((u) => u.rank === "moderator"),
    punished: punishedRows.map(toSelfUser),
    bans: bansOnRecord,
  });
}
