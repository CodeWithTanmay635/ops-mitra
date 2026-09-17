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

  // CORS: Allow the Vite frontend dev server (port 8443) and any localhost
  // origin to call the API. In production this should be locked to the
  // specific deployed frontend origin via the CORS_ORIGIN env variable.
  await app.register(cors, {
    origin: [
      "http://localhost:8443",
      "http://127.0.0.1:8443",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "OPTIONS"],
    credentials: false,
  });

  // ── Routes ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(intelligenceRoutes);

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
      // "0.0.0.0" means listen on all network interfaces.
      // "127.0.0.1" would only be accessible from localhost.
      // For a hackathon demo server, 0.0.0.0 is fine.
      host: "0.0.0.0",
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
