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
import { env } from "./config/env.js";
import errorHandler from "./plugins/errorHandler.js";
import { healthRoutes } from "./routes/health.js";

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
            // In production: plain JSON — easy to parse by log aggregators (Datadog, etc.)
          },

    // Assign a unique ID to each request — useful for correlating logs
    // across a request's lifecycle (e.g. "where did request abc123 fail?")
    genReqId: () => crypto.randomUUID(),
  });

  // ── Plugins ──────────────────────────────────────────────────────────────────

  // @fastify/sensible adds:
  //   - reply.notFound(), reply.badRequest(), etc. (standard HTTP helpers)
  //   - request.is() for content-type checking
  //   - Proper handling of unknown error types
  await app.register(sensible);

  // Our centralized error handler — must be registered before routes
  await app.register(errorHandler);

  // ── Routes ───────────────────────────────────────────────────────────────────

  // Health check — registered at root level (GET /health)
  await app.register(healthRoutes);

  // Future route groups will be added here with a prefix, e.g.:
  //   await app.register(customerRoutes, { prefix: "/api/v1" });
  //   await app.register(invoiceRoutes,  { prefix: "/api/v1" });

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
