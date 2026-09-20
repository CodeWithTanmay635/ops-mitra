/**
 * src/db/migrate.ts
 *
 * Programmatic migration runner using drizzle-orm's built-in migrator.
 *
 * Why this instead of `drizzle-kit migrate`?
 * This project uses pnpm workspaces. drizzle-kit's bin.cjs lives in the
 * pnpm virtual store at the root, and its ESM dynamic import() for
 * drizzle-orm cannot resolve the package (it lives in server/node_modules,
 * not root node_modules). This programmatic approach runs entirely within
 * the server/ workspace where drizzle-orm IS installed, avoiding the issue.
 *
 * Run with:
 *   pnpm db:migrate
 *   (which calls: tsx src/db/migrate.ts)
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env");
  process.exit(1);
}

console.log("🔌 Connecting to database...");

// Use a dedicated migration client (not the pool from db/index.ts)
// The migrator needs a single connection, not a pool.
const migrationClient = postgres(DATABASE_URL, {
  max: 1,
  onnotice: () => {}, // suppress NOTICE messages from PostgreSQL
});

const db = drizzle(migrationClient);

console.log("🚀 Running migrations...");

try {
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("✅ Migrations applied successfully!");
} catch (err) {
  console.error("❌ Migration failed:", err);
  process.exit(1);
} finally {
  await migrationClient.end();
}
