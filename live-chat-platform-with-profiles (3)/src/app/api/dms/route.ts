import { getCurrentUser } from "@/lib/auth";
import { getConversations } from "@/lib/social";
import { membersOnly } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const denied = membersOnly(me);
  if (denied) return denied;
  return Response.json({ conversations: await getConversations(me.id) });
}
