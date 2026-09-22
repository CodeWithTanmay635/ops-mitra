/**
 * src/config/env.ts
 *
 * Single source of truth for all environment variables.
 *
 * Why Zod here?
 * process.env values are all `string | undefined`. Zod lets us:
 *   1. Assert that required vars actually exist at startup (fail fast).
 *   2. Coerce types (e.g. PORT string → number).
 *   3. Provide safe defaults for optional vars.
 *
 * Anything that needs an env var imports from here — never from process.env directly.
 * This makes it trivially easy to see every config value the app depends on.
 */

import "dotenv/config"; // must run before z.object() reads process.env
import { z } from "zod";

const envSchema = z.object({
  // PostgreSQL connection string — required, no default
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid postgres:// URL"),

  // Server port — optional, defaults to 3001
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // Server host — optional, defaults to "::" to support Railway IPv6/IPv4 binding
  HOST: z.string().default("::"),

  // CORS Origin for production
  CORS_ORIGIN: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Optional AI provider API keys
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

// parse() throws a ZodError with a clear message if anything is missing/wrong.
// This crash-at-startup approach is intentional: a misconfigured server
// should not start silently and fail at runtime.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
