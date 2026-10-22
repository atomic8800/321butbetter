import { getCurrentUser } from "@/lib/auth";
import { touchUser } from "@/lib/chat";
import { accrueIncome, getWallet } from "@/lib/server-utils";
import { clientIp } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/** Wallet heartbeat: grants passive income, keeps you "online", returns the balance. */
export async function GET(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role === "guest") return Response.json({ wallet: null });
  await Promise.all([accrueIncome(me.id), touchUser(me.id, clientIp(req.headers))]);
  return Response.json({ wallet: await getWallet(me.id) });
}
