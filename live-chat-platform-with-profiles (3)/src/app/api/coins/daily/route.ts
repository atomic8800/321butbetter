import { getCurrentUser } from "@/lib/auth";
import { claimDaily, getWallet } from "@/lib/server-utils";
import { membersOnly } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const denied = membersOnly(me);
  if (denied) return denied;
  const coins = await claimDaily(me.id);
  if (coins == null) return Response.json({ error: "Your daily bonus isn't ready yet." }, { status: 400 });
  return Response.json({ wallet: await getWallet(me.id) });
}
