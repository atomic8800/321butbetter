import { notFound } from "next/navigation";
import { eq, gt, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ONLINE_WINDOW_SECONDS } from "@/lib/chat";
import { toPublicUser, toSelfUser } from "@/lib/types";
import { PublicProfileShell } from "@/components/Shells";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [row] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  if (!row) notFound();

  const [viewer, [onlineRow]] = await Promise.all([
    getCurrentUser(),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, row.id), gt(users.lastSeenAt, sql`now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})`)))
      .limit(1),
  ]);

  return (
    <PublicProfileShell
      initialViewer={viewer ? toSelfUser(viewer) : null}
      user={toPublicUser(row)}
      online={!!onlineRow}
    />
  );
}
