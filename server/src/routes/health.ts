/**
 * src/routes/health.ts
 *
 * GET /health — Health check endpoint.
 *
 * What does a health check endpoint do?
 * It lets monitoring tools, load balancers, and the developer quickly verify:
 *   1. Is the server process running and accepting requests?
 *   2. Can the server reach the database?
 *
 * Response shape:
 * {
 *   "status":    "ok" | "error",
 *   "timestamp": "2025-08-26T10:30:00.000Z",  // ISO 8601
 *   "uptime":    12345.6,                       // seconds since server start
 *   "db":        "ok" | "error",
 *   "dbMessage": "..."                          // only present when db is "error"
 * }
 *
 * HTTP status:
 *   200 — everything is healthy
 *   503 — service unavailable (DB ping failed)
 *
 * Why ping the DB from the health endpoint?
 * A server can be "up" but unable to reach the database (network partition,
 * DB restart, credentials rotation). Health checks that only verify the
 * process is alive miss this class of failures.
 * A load balancer checking /health will stop routing traffic to an instance
 * that can't reach its DB.
 */

import type { FastifyInstance } from "fastify";
import { rawClient } from "../db/index.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      // Fastify schema for request/response used for:
      //   1. Serialization speed (Fastify uses fast-json-stringify)
      //   2. Documentation (swagger can pick this up later)
      schema: {
        description: "Health check — verifies server and database are reachable",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "error"] },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              db: { type: "string", enum: ["ok", "error"] },
            },
          },
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
              uptime: { type: "number" },
              db: { type: "string" },
              dbMessage: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const timestamp = new Date().toISOString();
      const uptime = process.uptime(); // seconds since Node process started

      // Ping the database with the lightest possible query.
      // "SELECT 1" is a no-op query that confirms the connection is alive.
      let dbStatus: "ok" | "error" = "ok";
      let dbMessage: string | undefined;

      try {
        await rawClient`SELECT 1`;
      } catch (err: unknown) {
        dbStatus = "error";
        dbMessage = err instanceof Error ? err.message : "Unknown database error";
        app.log.error({ err }, "Health check: database ping failed");
      }

      if (dbStatus === "error") {
        return reply.status(503).send({
          status: "error",
          timestamp,
          uptime,
          db: "error",
          dbMessage,
        });
      }

      return reply.status(200).send({
        status: "ok",
        timestamp,
        uptime,
        db: "ok",
      });
    }
  );
}
