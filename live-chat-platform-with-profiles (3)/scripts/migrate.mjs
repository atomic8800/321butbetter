// Applies database migrations from ./drizzle. Runs automatically before every Vercel build
// (see vercel.json). Safe to run repeatedly: already-applied migrations are skipped.
//
// Local usage:  DATABASE_URL=postgres://... node scripts/migrate.mjs
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Migrations need a direct (non-pooled) connection when one is available.
const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

function fail(lines) {
  console.error(["", "❌ Database setup failed", "", ...lines, ""].join("\n"));
  process.exit(1);
}

if (!url) {
  fail([
    "No database connection string was found (DATABASE_URL).",
    "",
    "On Vercel: open your project → Storage → Create Database → Neon (Postgres),",
    "connect it to this project, then redeploy. That adds DATABASE_URL automatically.",
    "Or add DATABASE_URL yourself in Project Settings → Environment Variables.",
  ]);
}

if (process.env.VERCEL && /@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  fail([
    "DATABASE_URL points at localhost, which doesn't exist on Vercel.",
    "Replace it with your hosted Postgres connection string (for example from Neon).",
  ]);
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 15_000 });

try {
  const started = Date.now();
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const { rows } = await pool.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  console.log(`✅ Database ready: ${rows[0].n} tables (${Date.now() - started}ms)`);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  fail([
    msg,
    "",
    msg.includes("already exists")
      ? "The database already has tables that weren't created by these migrations. Use a fresh, empty database."
      : "Check that DATABASE_URL is correct and that the database accepts connections.",
  ]);
} finally {
  await pool.end().catch(() => {});
}
