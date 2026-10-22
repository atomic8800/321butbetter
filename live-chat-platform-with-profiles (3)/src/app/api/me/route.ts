import { getCurrentUser } from "@/lib/auth";
import { toSelfUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: toSelfUser(user) });
}
