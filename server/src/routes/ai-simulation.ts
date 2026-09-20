/**
 * src/routes/ai-simulation.ts
 *
 * REST API routes for Milestone 4 AI Explanation & What-If Simulation.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { intelligenceService } from "../modules/intelligence/intelligence.service.js";
import { buildCustomerEvidence } from "../modules/intelligence/evidence-builder.js";
import { aiService } from "../modules/ai/ai.service.js";
import { simulationService } from "../modules/intelligence/simulation.service.js";

const customerParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .optional(),
});

const simulationBodySchema = z.object({
  recoveryAmountPaise: z.coerce.number().min(0, "recoveryAmountPaise must be non-negative"),
});

export async function aiSimulationRoutes(app: FastifyInstance) {
  // POST /api/v1/ai/customers/:id/explanation
  app.post(
    "/api/v1/ai/customers/:id/explanation",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = customerParamsSchema.parse(request.params);
      const query = querySchema.parse(request.query);

      const customerAssessment = await intelligenceService.assessCustomer(params.id, {
        assessmentDate: query.date,
      });

      if (!customerAssessment) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: `Customer with ID ${params.id} was not found.`,
        });
      }

      const evidence = buildCustomerEvidence(customerAssessment);
      const aiResult = await aiService.generateExplanation(evidence);

      return reply.status(200).send({
        success: true,
        data: {
          evidence,
          explanation: aiResult.explanation,
          keyPoints: aiResult.keyPoints,
          suggestedAction: aiResult.suggestedAction,
        },
      });
    }
  );

  // POST /api/v1/ai/customers/:id/follow-up
  app.post(
    "/api/v1/ai/customers/:id/follow-up",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = customerParamsSchema.parse(request.params);
      const query = querySchema.parse(request.query);

      const customerAssessment = await intelligenceService.assessCustomer(params.id, {
        assessmentDate: query.date,
      });

      if (!customerAssessment) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: `Customer with ID ${params.id} was not found.`,
        });
      }

      const evidence = buildCustomerEvidence(customerAssessment);
      const followUpResult = await aiService.generateFollowUpMessage(evidence);

      return reply.status(200).send({
        success: true,
        data: {
          evidence,
          message: followUpResult.message,
        },
      });
    }
  );

  // POST /api/v1/simulation/customers/:id
  app.post(
    "/api/v1/simulation/customers/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = customerParamsSchema.parse(request.params);
      const query = querySchema.parse(request.query);
      const body = simulationBodySchema.parse(request.body);

      const simulationResult = await simulationService.simulateRecovery({
        customerId: params.id,
        recoveryAmountPaise: body.recoveryAmountPaise,
        assessmentDate: query.date,
      });

      if (!simulationResult) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: `Customer with ID ${params.id} was not found.`,
        });
      }

      const aiExplanation = await aiService.generateSimulationExplanation(
        simulationResult.current,
        simulationResult.simulated,
        body.recoveryAmountPaise
      );

      return reply.status(200).send({
        success: true,
        data: {
          customerId: simulationResult.customerId,
          customerName: simulationResult.customerName,
          recoveryAmountPaise: simulationResult.recoveryAmountPaise,
          current: simulationResult.current,
          simulated: simulationResult.simulated,
          aiExplanation,
        },
      });
    }
  );
}
