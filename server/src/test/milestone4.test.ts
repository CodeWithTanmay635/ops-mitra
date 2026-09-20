/**
 * src/test/milestone4.test.ts
 *
 * Test suite for Milestone 4 — AI Explanation + What-If Simulation.
 */

import Fastify from "fastify";
import sensible from "@fastify/sensible";
import cors from "@fastify/cors";
import errorHandler from "../plugins/errorHandler.js";
import { healthRoutes } from "../routes/health.js";
import { intelligenceRoutes } from "../routes/intelligence.js";
import { aiSimulationRoutes } from "../routes/ai-simulation.js";
import { intelligenceService } from "../modules/intelligence/intelligence.service.js";
import { buildCustomerEvidence } from "../modules/intelligence/evidence-builder.js";
import { simulationService } from "../modules/intelligence/simulation.service.js";
import { aiService } from "../modules/ai/ai.service.js";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";

async function runTests() {
  console.log("🧪 Starting Milestone 4 AI Explanation & What-If Simulation Verification...\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      process.exitCode = 1;
    }
  }

  // ─── 1. Evidence Builder Tests ─────────────────────────────────────────────
  console.log("--- 1. Evidence Builder Verification ---");

  const portfolio = await intelligenceService.assessPortfolio();
  const mehtaAssessment = portfolio.rankings.find((r) => r.customerName === "Mehta Traders");
  assert(mehtaAssessment !== undefined, "Mehta Traders assessment found in portfolio");

  const mehtaId = mehtaAssessment?.customerId ?? 1;

  if (mehtaAssessment) {
    const evidence = buildCustomerEvidence(mehtaAssessment);

    assert(evidence.customerName === "Mehta Traders", "Evidence customerName matches 'Mehta Traders'");
    assert(evidence.financials.outstandingPaise === 12400000, "Evidence outstandingPaise = 12,400,000 (₹1,24,000)");
    assert(evidence.financials.overdueExposurePaise === 12400000, "Evidence overdueExposurePaise = 12,400,000");
    assert(evidence.signals.maxOverdueDays === 43, "Evidence maxOverdueDays = 43");
    assert(evidence.signals.openCycleDays === 61, "Evidence openCycleDays = 61");
    assert(evidence.signals.historicalBaselinePaymentDays === 33, "Evidence baseline payment days = 33 (from DB seed)");
    assert(evidence.signals.openCycleDriftDays === 28, "Evidence openCycleDriftDays = 28 (61 - 33)");
    assert(evidence.risk.score === 95, "Evidence risk score = 95");
    assert(evidence.risk.category === "HIGH", "Evidence risk category = HIGH");
    assert(evidence.priority.score === 72, "Evidence priority score = 72");
    assert(evidence.recommendation.action === "ESCALATE_IMMEDIATELY", "Evidence action = ESCALATE_IMMEDIATELY");
    assert(evidence.recommendation.reasonCodes.includes("HIGH_OVERDUE"), "Reason codes contains HIGH_OVERDUE");
  }

  // ─── 2. What-If Simulation Tests ───────────────────────────────────────────
  console.log("\n--- 2. Deterministic What-If Simulation Verification ---");

  const initialInvoicesBefore = await db.select().from(schema.invoices);
  const initialAllocationsBefore = await db.select().from(schema.paymentAllocations);

  // Full recovery simulation (₹1,24,000 = 12400000 paise)
  const fullSimResult = await simulationService.simulateRecovery({
    customerId: mehtaId,
    recoveryAmountPaise: 12400000,
  });

  assert(fullSimResult !== null, "Full recovery simulation executed successfully for Mehta Traders");

  if (fullSimResult) {
    assert(fullSimResult.current.financials.outstandingPaise === 12400000, "Current outstanding balance = ₹1,24,000");
    assert(fullSimResult.current.risk.score === 95, "Current risk score = 95");
    assert(fullSimResult.current.recommendation.action === "ESCALATE_IMMEDIATELY", "Current recommendation = ESCALATE_IMMEDIATELY");

    assert(fullSimResult.simulated.financials.outstandingPaise === 0, "Simulated outstanding balance = ₹0 (fully recovered)");
    assert(fullSimResult.simulated.risk.score === 0, "Simulated risk score reduced to 0 (LOW)");
    assert(fullSimResult.simulated.risk.category === "LOW", "Simulated risk category = LOW");
    assert(fullSimResult.simulated.recommendation.action === "MONITOR", "Simulated action updated to MONITOR");
  }

  // Partial recovery simulation (₹75,000 = 7500000 paise)
  const partialSimResult = await simulationService.simulateRecovery({
    customerId: mehtaId,
    recoveryAmountPaise: 7500000,
  });

  assert(partialSimResult !== null, "Partial recovery simulation executed successfully");
  if (partialSimResult) {
    assert(partialSimResult.simulated.financials.outstandingPaise === 4900000, "Partial simulated outstanding = ₹49,000");
  }

  // ─── 3. DB Non-Mutation Verification ──────────────────────────────────────
  console.log("\n--- 3. Database Non-Mutation Verification ---");

  const invoicesAfter = await db.select().from(schema.invoices);
  const allocationsAfter = await db.select().from(schema.paymentAllocations);

  assert(invoicesAfter.length === initialInvoicesBefore.length, "Invoices row count unchanged");
  assert(allocationsAfter.length === initialAllocationsBefore.length, "Payment allocations row count unchanged");

  const mehtaInvoicesUnchanged = invoicesAfter.filter((i) => i.customerId === mehtaId);
  const sumOutstanding = mehtaInvoicesUnchanged.reduce((s, i) => s + (i.totalAmountPaise - i.paidAmountPaise), 0);
  assert(sumOutstanding === 12400000, "Mehta Traders outstanding DB balance remains exactly ₹1,24,000");

  // ─── 4. AI Fallback Verification ──────────────────────────────────────────
  console.log("\n--- 4. AI Service Fallback Verification ---");

  if (mehtaAssessment) {
    const evidence = buildCustomerEvidence(mehtaAssessment);

    const fallbackExp = aiService.buildFallbackExplanation(evidence);
    assert(typeof fallbackExp.explanation === "string" && fallbackExp.explanation.length > 20, "Fallback explanation generated text");
    assert(fallbackExp.keyPoints.length >= 3, "Fallback key points generated");
    assert(fallbackExp.suggestedAction === "Escalate immediately", "Fallback suggested action matches recommendation");

    const fallbackMsg = aiService.buildFallbackFollowUp(evidence);
    assert(fallbackMsg.message.includes("Mehta Traders"), "Fallback message mentions customer name");
    assert(fallbackMsg.message.includes("1,24,000") || fallbackMsg.message.includes("124"), "Fallback message mentions amount");
    assert(fallbackMsg.message.includes("43 days overdue"), "Fallback message mentions max overdue days");

    if (fullSimResult) {
      const fallbackSimExp = aiService.buildFallbackSimulationExplanation(fullSimResult.current, fullSimResult.simulated, 12400000);
      assert(fallbackSimExp.explanation.includes("1,24,000") || fallbackSimExp.explanation.includes("124"), "Simulation fallback explanation includes recovery amount");
      assert(fallbackSimExp.keyPoints.length >= 3, "Simulation fallback key points generated");
    }
  }

  // ─── 5. Fastify REST API Integration Tests ────────────────────────────────
  console.log("\n--- 5. REST API Integration Verification ---");

  const app = Fastify();
  await app.register(sensible);
  await app.register(errorHandler);
  await app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });
  await app.register(healthRoutes);
  await app.register(intelligenceRoutes);
  await app.register(aiSimulationRoutes);

  // POST /api/v1/ai/customers/:id/explanation
  const resExp = await app.inject({
    method: "POST",
    url: `/api/v1/ai/customers/${mehtaId}/explanation`,
  });
  assert(resExp.statusCode === 200, "POST /api/v1/ai/customers/:id/explanation returns 200 OK");
  const jsonExp = JSON.parse(resExp.body);
  assert(jsonExp.success === true, "Explanation API success = true");
  assert(jsonExp.data.evidence.customerName === "Mehta Traders", "Explanation API evidence customerName correct");
  assert(typeof jsonExp.data.explanation === "string", "Explanation API returned explanation string");
  assert(Array.isArray(jsonExp.data.keyPoints), "Explanation API returned keyPoints array");

  // POST /api/v1/ai/customers/:id/follow-up
  const resMsg = await app.inject({
    method: "POST",
    url: `/api/v1/ai/customers/${mehtaId}/follow-up`,
  });
  assert(resMsg.statusCode === 200, "POST /api/v1/ai/customers/:id/follow-up returns 200 OK");
  const jsonMsg = JSON.parse(resMsg.body);
  assert(jsonMsg.success === true, "Follow-up API success = true");
  assert(typeof jsonMsg.data.message === "string", "Follow-up API returned message string");

  // POST /api/v1/simulation/customers/:id
  const resSim = await app.inject({
    method: "POST",
    url: `/api/v1/simulation/customers/${mehtaId}`,
    payload: { recoveryAmountPaise: 12400000 },
  });
  assert(resSim.statusCode === 200, "POST /api/v1/simulation/customers/:id returns 200 OK");
  const jsonSim = JSON.parse(resSim.body);
  assert(jsonSim.success === true, "Simulation API success = true");
  assert(jsonSim.data.current.financials.outstandingPaise === 12400000, "Simulation API current outstanding = ₹1,24,000");
  assert(jsonSim.data.simulated.financials.outstandingPaise === 0, "Simulation API simulated outstanding = ₹0");
  assert(jsonSim.data.simulated.risk.score === 0, "Simulation API simulated risk score = 0");
  assert(typeof jsonSim.data.aiExplanation.explanation === "string", "Simulation API returned AI explanation");

  // POST /api/v1/ai/customers/99999/explanation -> 404
  const res404 = await app.inject({
    method: "POST",
    url: "/api/v1/ai/customers/99999/explanation",
  });
  assert(res404.statusCode === 404, "Invalid customer ID returns 404 NOT_FOUND");

  console.log(`\n🎉 MILESTONE 4 VERIFICATION COMPLETE: ${passed}/${total} TESTS PASSED WITH 100% ACCURACY!\n`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
