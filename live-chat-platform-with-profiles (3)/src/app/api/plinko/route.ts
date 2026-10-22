import { randomInt } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { CENTS } from "@/lib/economy";
import { adjustCoins } from "@/lib/server-utils";
import { membersOnly } from "@/lib/server-utils";
import { isActive } from "@/lib/moderation";
import { MAX_BALLS_PER_DROP, MAX_BET, MIN_BET, getMultipliers, isRisk, isValidRows } from "@/lib/economy";

export const dynamic = "force-dynamic";

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const me = await getCurrentUser(req);
  if (!me) return fail("Unauthorized", 401);
  const denied = membersOnly(me);
  if (denied) return denied;
  if (isActive(me.kickedUntil)) return fail("You are kicked.", 403);

  const body = (await req.json().catch(() => null)) as { bet?: number; rows?: number; risk?: string; count?: number } | null;
  const rows = Number(body?.rows);
  const risk = body?.risk;
  const count = Math.floor(Number(body?.count ?? 1));
  const bet = Number(body?.bet);
  if (!isValidRows(rows)) return fail("Rows must be between 8 and 16.");
  if (!isRisk(risk)) return fail("Invalid risk level.");
  if (!Number.isInteger(count) || count < 1 || count > MAX_BALLS_PER_DROP) return fail(`You can drop 1–${MAX_BALLS_PER_DROP} balls.`);
  if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) return fail(`Bet must be between ${MIN_BET} and ${MAX_BET} coins.`);

  const betCents = Math.round(bet * CENTS);
  const total = betCents * count;
  const table = getMultipliers(rows, risk);

  // Server decides every bounce — the client only animates the result.
  const results: { path: string; bin: number; multiplier: number; payout: number }[] = [];
  let totalPayout = 0;
  for (let b = 0; b < count; b++) {
    let path = "";
    let bin = 0;
    for (let r = 0; r < rows; r++) {
      const right = randomInt(2);
      path += right;
      bin += right;
    }
    const multiplier = table[bin];
    const payout = Math.round(betCents * multiplier);
    totalPayout += payout;
    results.push({ path, bin, multiplier, payout });
  }

  const balance = await adjustCoins(me.id, totalPayout - total, total);
  if (balance == null) return fail("Not enough coins for that bet.");
  return Response.json({ results, balance, bet: betCents });
}
