import { getCurrentUser } from "@/lib/auth";
import { getOnlineUsers } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getCurrentUser();
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ users: await getOnlineUsers() });
}
