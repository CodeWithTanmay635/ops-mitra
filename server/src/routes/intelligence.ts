/**
 * src/routes/intelligence.ts
 *
 * REST API endpoints for Milestone 2 Receivables Intelligence.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { intelligenceService } from "../modules/intelligence/intelligence.service.js";

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .optional(),
  threshold: z.coerce.number().positive().optional(),
});

const customerParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function intelligenceRoutes(app: FastifyInstance) {
  // GET /api/v1/intelligence/portfolio
  app.get(
    "/api/v1/intelligence/portfolio",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = querySchema.parse(request.query);

      const assessment = await intelligenceService.assessPortfolio({
        assessmentDate: query.date,
        highExposureThresholdPaise: query.threshold,
      });

      return reply.status(200).send({
        success: true,
        data: assessment,
      });
    }
  );

  // GET /api/v1/intelligence/customers/:id
  app.get(
    "/api/v1/intelligence/customers/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = customerParamsSchema.parse(request.params);
      const query = querySchema.parse(request.query);

      const customerAssessment = await intelligenceService.assessCustomer(
        params.id,
        {
          assessmentDate: query.date,
          highExposureThresholdPaise: query.threshold,
        }
      );

      if (!customerAssessment) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: `Customer with ID ${params.id} was not found.`,
        });
      }

      return reply.status(200).send({
        success: true,
        data: customerAssessment,
      });
    }
  );
}
