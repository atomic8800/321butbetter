import { getCurrentUser } from "@/lib/auth";
import { getFriendStatus } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = Number(new URL(req.url).searchParams.get("userId"));
  if (!Number.isInteger(userId)) return Response.json({ error: "Invalid user." }, { status: 400 });
  return Response.json({ status: await getFriendStatus(me.id, userId) });
}
