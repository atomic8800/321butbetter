import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// DATABASE_URL is set by Neon's Vercel integration (pooled). POSTGRES_URL is the legacy
// name used by older Vercel Postgres / Supabase integrations.
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Locally, put it in a .env file. On Vercel, add a Postgres database " +
      "(Storage → Neon) or set DATABASE_URL in Project Settings → Environment Variables.",
  );
}

const isServerless = !!process.env.VERCEL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Serverless instances are short-lived and numerous, so keep each one's pool small.
    max: isServerless ? 5 : 10,
    idleTimeoutMillis: isServerless ? 5_000 : 30_000,
    connectionTimeoutMillis: 10_000,
  });

globalForDb.__arenaNextJsPostgresqlPool = pool;

export const db = drizzle(pool);
