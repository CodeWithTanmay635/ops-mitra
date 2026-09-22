/**
 * src/index.ts
 *
 * Application entry point.
 *
 * This file:
 *   1. Creates the Fastify server instance with structured logging
 *   2. Registers global plugins (CORS, sensible defaults, error handler)
 *   3. Registers route modules
 *   4. Starts listening on the configured port
 *
 * Why Fastify instead of Express?
 * - Built-in TypeScript support (full types out of the box)
 * - JSON schema-based request/response validation and serialisation
 * - ~2x faster than Express on benchmarks due to fast-json-stringify
 * - Plugin system with proper encapsulation (avoids spaghetti middleware)
 * - Built-in structured logging via pino
 */

import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import errorHandler from "./plugins/errorHandler.js";
import { healthRoutes } from "./routes/health.js";
import { intelligenceRoutes } from "./routes/intelligence.js";
import { aiSimulationRoutes } from "./routes/ai-simulation.js";

// @ts-ignore - The IDE language server sometimes struggles to resolve @fastify/static types even though tsup compiles it fine
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildApp() {
  const app = Fastify({
    // Pino logger — structured JSON logging, much better than console.log
    // in production. In development, we pretty-print for readability.
    logger:
      env.NODE_ENV === "development"
        ? {
            level: "info",
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
              },
            },
          }
        : {
            level: "info",
          },

    // Assign a unique ID to each request
    genReqId: () => crypto.randomUUID(),
  });

  // ── Plugins ──────────────────────────────────────────────────────────────────
  await app.register(sensible);
  await app.register(errorHandler);

  // CORS: Dynamic origin configuration based on environment
  const localOrigins = [
    "http://localhost:8443",
    "http://127.0.0.1:8443",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ];

  // Dynamically match any OpsMitra Vercel URL (e.g. ops-mitra-6py7.vercel.app)
  const vercelRegex = /^https:\/\/ops-mitra.*\.vercel\.app$/;

  let allowedOrigins: (string | RegExp)[] = [...localOrigins, vercelRegex];

  if (env.NODE_ENV === "production") {
    if (env.CORS_ORIGIN) {
      allowedOrigins = [
        ...env.CORS_ORIGIN.split(",").map((o) => o.trim()),
        vercelRegex,
      ];
    } else {
      // If production but no CORS_ORIGIN is set, default to vercel regex to be safe
      allowedOrigins = [vercelRegex];
    }
  } else if (env.CORS_ORIGIN) {
    // In development/test, append explicitly defined origins to the local ones
    allowedOrigins = [
      ...localOrigins,
      ...env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      vercelRegex,
    ];
  }

  await app.register(cors, {
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: false,
  });

  // ── Routes ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(intelligenceRoutes);
  await app.register(aiSimulationRoutes);

  // ── Frontend / Static Files ──────────────────────────────────────────────────
  // Serve the React production build from the root dist directory
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "../../dist"),
    prefix: "/",
    wildcard: false, // Do not intercept all routes automatically
  });

  // SPA Fallback: Explicit route for all unmatched GET requests
  app.get("/*", (request, reply) => {
    if (!request.url.startsWith("/api")) {
      return (reply as any).sendFile("index.html");
    }
    // If it's an API route that wasn't matched, return the standard 404 JSON
    return reply.status(404).send({ 
      error: "Not Found", 
      message: `Route ${request.method}:${request.url} not found` 
    });
  });

  // Catch-all for non-GET methods (e.g., POST /missing)
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ 
      error: "Not Found", 
      message: `Route ${request.method}:${request.url} not found` 
    });
  });

  return app;
}

async function main() {
  let app;

  try {
    app = await buildApp();
  } catch (err) {
    console.error("Failed to build application:", err);
    process.exit(1);
  }

  // Graceful shutdown: when the process receives SIGTERM or SIGINT
  // (e.g. Ctrl+C, Docker stop), we close the server cleanly instead
  // of dropping in-flight requests.
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      app.log.info("Server closed.");
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));

  // Start listening
  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    app.log.info(`🚀 OpsMitra server running at ${address}`);
    app.log.info(`   Environment: ${env.NODE_ENV}`);
    app.log.info(`   Health check: ${address}/health`);
  } catch (err) {
    app.log.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

void main();
