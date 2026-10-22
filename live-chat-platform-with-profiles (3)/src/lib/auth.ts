import { cookies, headers } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

export const SESSION_COOKIE = "pulse_session";
export const SESSION_HEADER = "x-session-token";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Is the current request being served over HTTPS (directly or via a proxy)? */
async function isHttpsRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "";
    if (proto.split(",")[0].trim() === "https") return true;
    const origin = h.get("origin") ?? h.get("referer") ?? "";
    return origin.startsWith("https://");
  } catch {
    return false;
  }
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });

  const https = await isHttpsRequest();
  const store = await cookies();
  // On HTTPS use SameSite=None so the cookie also works when the app is embedded in a frame.
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    path: "/",
    expires: expiresAt,
    secure: https,
    sameSite: https ? "none" : "lax",
  });
  return token;
}

/** Resolve the session token from cookie, header, bearer auth, or (optionally) a `token` query param. */
export async function resolveToken(req?: Request): Promise<string | null> {
  try {
    const store = await cookies();
    const c = store.get(SESSION_COOKIE)?.value;
    if (c) return c;
  } catch {
    /* no cookie store available */
  }
  try {
    const h = await headers();
    const x = h.get(SESSION_HEADER);
    if (x) return x;
    const auth = h.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  } catch {
    /* no headers available */
  }
  if (req) {
    const q = new URL(req.url).searchParams.get("token");
    if (q) return q;
  }
  return null;
}

export async function destroySession(req?: Request): Promise<void> {
  const token = await resolveToken(req);
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  try {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  } catch {
    /* ignore */
  }
}

export async function getCurrentUser(req?: Request): Promise<User | null> {
  const token = await resolveToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function randomGuestSuffix(): string {
  return randomBytes(3).toString("hex");
}
