/**
 * drizzle.config.ts
 *
 * Configuration for drizzle-kit CLI (migration generation and running).
 * drizzle-kit reads this file when you run:
 *   pnpm db:generate  — reads schema, generates SQL migration files
 *   pnpm db:migrate   — applies pending migrations to the database
 *
 * Why separate config file?
 * drizzle-kit needs to know where your schema lives and how to reach the DB
 * without starting the full application. This avoids circular imports.
 */

import "dotenv/config"; // load .env before reading process.env
import { defineConfig } from "drizzle-kit";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is required in .env to run drizzle-kit commands");
}

export default defineConfig({
  // Where your table definitions live
  schema: "./src/db/schema.ts",

  // Where drizzle-kit puts the generated SQL migration files
  out: "./drizzle",

  // We are using PostgreSQL
  dialect: "postgresql",

  dbCredentials: {
    url: process.env["DATABASE_URL"],
  },

  // Log every SQL statement drizzle-kit runs (useful during development)
  verbose: true,

  // Drizzle-kit will refuse to run destructive operations (DROP, etc.)
  // unless you pass --force. Protects you from accidental data loss.
  strict: true,
});
