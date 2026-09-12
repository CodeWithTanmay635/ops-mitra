/**
 * src/plugins/errorHandler.ts
 *
 * Centralized error handling for the Fastify application.
 *
 * Why centralize error handling?
 * Without this, every route would need its own try/catch and its own
 * error response format. Inconsistent error shapes make frontend integration
 * and debugging harder. This plugin ensures ALL errors — whether thrown
 * intentionally or unexpectedly — return the same JSON structure.
 *
 * Error response shape:
 * {
 *   "error":   "VALIDATION_ERROR",  // machine-readable error code (uppercase)
 *   "message": "Human readable description of what went wrong",
 *   "details": {}                   // optional — Zod field errors, stack trace in dev
 * }
 *
 * HTTP status mapping:
 *   Zod validation errors → 400 Bad Request
 *   Fastify's own errors  → their built-in statusCode (404, 405, etc.)
 *   Everything else       → 500 Internal Server Error
 */

import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

// The shape we return for every error response.
// Keeping it consistent makes the frontend's error handling predictable.
interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler(
    (error: FastifyError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // ── Zod validation errors (from our own input validation) ─────────────
      if (error instanceof ZodError) {
        const response: ErrorResponse = {
          error: "VALIDATION_ERROR",
          message: "Request validation failed. Check the details field for specific field errors.",
          details: error.flatten().fieldErrors,
        };
        return reply.status(400).send(response);
      }

      // ── Fastify's own errors (404 Not Found, 405 Method Not Allowed, etc.) ─
      // FastifyError has a statusCode property
      const statusCode = "statusCode" in error && typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

      if (statusCode >= 400 && statusCode < 500) {
        const response: ErrorResponse = {
          error: error.name ?? "CLIENT_ERROR",
          message: error.message,
        };
        return reply.status(statusCode).send(response);
      }

      // ── Unexpected server errors ──────────────────────────────────────────
      // Log the full error server-side (for debugging)
      app.log.error(
        { err: error, requestId: request.id },
        "Unexpected server error"
      );

      const response: ErrorResponse = {
        error: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
        // In development, include the stack trace to make debugging easier.
        // In production, never expose stack traces to the client.
        details: process.env["NODE_ENV"] === "development"
          ? { stack: error.stack, name: error.name }
          : undefined,
      };

      return reply.status(500).send(response);
    }
  );
}

// fastify-plugin is needed so that our setErrorHandler is applied globally
// to the entire app (not scoped to a child context).
// Without fp(), Fastify would scope the error handler to only the plugin's context.
export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
