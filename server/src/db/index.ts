/**
 * src/db/index.ts
 *
 * Creates and exports the single Drizzle database client instance.
 *
 * Why postgres.js (not pg/node-postgres)?
 * - postgres.js is the recommended driver for Drizzle ORM
 * - Native TypeScript support with no @types package needed
 * - Handles connection pooling automatically
 * - Cleaner async API
 *
 * We export `db` as the Drizzle client and `sql` as the raw SQL tag
 * for cases where you need a raw query (e.g. the health check ping).
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// postgres() creates a connection pool. max: 10 is a sensible default
// for a hackathon — the default is already reasonable but making it
// explicit helps during interviews ("we limit to 10 concurrent connections").
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  // Idle connections are closed after 30 seconds to avoid holding
  // open connections against the Postgres max_connections limit.
  idle_timeout: 30,
});

// drizzle() wraps the postgres.js client and gives us:
//   - db.select(), db.insert(), db.update(), db.delete() — typed query builders
//   - db.query.tableName — relational queries with joins
//   - db.execute(sql`...`) — raw SQL when needed
export const db = drizzle(queryClient, {
  schema,
  // Log SQL statements in development so you can see what's being run
  logger: env.NODE_ENV === "development",
});

// Export the raw client so health.ts can do a lightweight ping
// without going through Drizzle's schema layer.
export const rawClient = queryClient;
