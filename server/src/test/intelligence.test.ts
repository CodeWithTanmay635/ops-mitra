/**
 * src/test/intelligence.test.ts
 *
 * Automated verification suite for Milestone 2 Receivables Intelligence Engine.
 */

import {
  calculateAgingSeverityScore,
  calculateOpenCycleDriftScore,
  calculateOverdueExposureScore,
  classifyRiskCategory,
  evaluateCustomerRisk,
} from "../modules/intelligence/risk-engine.js";
import {
  calculateNormalizedExposureScore,
  calculateConcentrationScore,
  evaluateCustomerPriority,
} from "../modules/intelligence/priority-engine.js";
import {
  deriveReasonCodes,
  evaluateCustomerRecommendation,
} from "../modules/intelligence/recommendation-engine.js";
import { calculateCustomerSignals } from "../modules/intelligence/signals.js";
import type { CustomerSignals, InvoiceWithAllocation } from "../modules/intelligence/types.js";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`❌ [FAIL] ${label} - Expected: ${expected}, Got: ${actual}`);
    throw new Error(`Assertion failed for ${label}`);
  }
  console.log(`✅ [PASS] ${label} = ${actual}`);
}

async function runIntelligenceTests() {
  console.log("🧪 Starting Milestone 2 Receivables Intelligence Engine Verification...\n");

  // ── 1. Pure Risk Mathematical Formula Tests ─────────────────────────────────
  console.log("--- 1. Aging Severity Scoring ---");
  assertEqual(calculateAgingSeverityScore(0), 0, "Aging 0d");
  assertEqual(calculateAgingSeverityScore(10), 15, "Aging 10d (1-15 band)");
  assertEqual(calculateAgingSeverityScore(15), 15, "Aging 15d (1-15 boundary)");
  assertEqual(calculateAgingSeverityScore(16), 30, "Aging 16d (16-30 band)");
  assertEqual(calculateAgingSeverityScore(30), 30, "Aging 30d (16-30 boundary)");
  assertEqual(calculateAgingSeverityScore(43), 40, "Aging 43d (31-60 band)");
  assertEqual(calculateAgingSeverityScore(60), 40, "Aging 60d (31-60 boundary)");
  assertEqual(calculateAgingSeverityScore(65), 45, "Aging >60d");

  console.log("\n--- 2. Open-Cycle Drift Scoring ---");
  assertEqual(calculateOpenCycleDriftScore(0), 0, "Drift 0d");
  assertEqual(calculateOpenCycleDriftScore(8), 10, "Drift 8d (1-10 band)");
  assertEqual(calculateOpenCycleDriftScore(10), 10, "Drift 10d (1-10 boundary)");
  assertEqual(calculateOpenCycleDriftScore(15), 20, "Drift 15d (11-20 band)");
  assertEqual(calculateOpenCycleDriftScore(20), 20, "Drift 20d (11-20 boundary)");
  assertEqual(calculateOpenCycleDriftScore(25), 35, "Drift 25d (>20 band)");

  console.log("\n--- 3. Overdue Exposure Scoring ---");
  assertEqual(calculateOverdueExposureScore(0), 0, "Overdue ratio 0%");
  assertEqual(calculateOverdueExposureScore(0.25), 5, "Overdue ratio 25%");
  assertEqual(calculateOverdueExposureScore(0.50), 10, "Overdue ratio 50%");
  assertEqual(calculateOverdueExposureScore(0.75), 15, "Overdue ratio 75%");
  assertEqual(calculateOverdueExposureScore(1.0), 20, "Overdue ratio 100%");

  console.log("\n--- 4. Risk Category Classification ---");
  assertEqual(classifyRiskCategory(0), "LOW", "Risk 0 -> LOW");
  assertEqual(classifyRiskCategory(39), "LOW", "Risk 39 -> LOW");
  assertEqual(classifyRiskCategory(40), "MEDIUM", "Risk 40 -> MEDIUM");
  assertEqual(classifyRiskCategory(69), "MEDIUM", "Risk 69 -> MEDIUM");
  assertEqual(classifyRiskCategory(70), "HIGH", "Risk 70 -> HIGH");
  assertEqual(classifyRiskCategory(95), "HIGH", "Risk 95 -> HIGH");

  // ── 2. Mehta Traders Ground-Truth Verification (Risk 95, Priority 72) ────────
  console.log("\n--- 5. Mehta Traders Exact Verification ---");
  const mehtaInvoices: InvoiceWithAllocation[] = [
    {
      id: 1,
      invoiceNumber: "INV-2408",
      issuedAt: "2025-06-26",
      dueDate: "2025-07-14",
      totalAmountPaise: 24_000_000,
      allocatedAmountPaise: 11_600_000,
      outstandingBalancePaise: 12_400_000,
      isOverdue: true,
      overdueDays: 43,
      daysUntilDue: -43,
    },
  ];

  const mehtaSignals = calculateCustomerSignals({
    customerId: 1,
    customerName: "Mehta Traders",
    assessmentDate: "2025-08-26",
    invoices: mehtaInvoices,
    settledHistory: [
      {
        id: 101,
        issuedAt: "2025-05-01",
        paymentReceivedAt: "2025-05-19",
        elapsedDays: 18,
      },
    ],
    customerLTVPaise: 47_584_000,
    totalPortfolioLTVPaise: 148_700_000,
  });

  assertEqual(mehtaSignals.maxOverdueDays, 43, "Mehta max overdue days");
  assertEqual(mehtaSignals.openCycleDays, 61, "Mehta open cycle days (Aug 26 - Jun 26)");
  assertEqual(mehtaSignals.openCycleDriftDays, 43, "Mehta open cycle drift (61 - 18 = 43d)");
  assertEqual(mehtaSignals.overdueExposureRatio, 1, "Mehta overdue ratio 100%");

  const mehtaRisk = evaluateCustomerRisk(mehtaSignals);
  assertEqual(mehtaRisk.agingSeverityScore, 40, "Mehta aging score");
  assertEqual(mehtaRisk.openCycleDriftScore, 35, "Mehta drift score (>20d)");
  assertEqual(mehtaRisk.overdueExposureScore, 20, "Mehta overdue exposure score");
  assertEqual(mehtaRisk.totalRiskScore, 95, "Mehta total risk score = 40+35+20 = 95");
  assertEqual(mehtaRisk.riskCategory, "HIGH", "Mehta risk category HIGH");

  const mehtaPriority = evaluateCustomerPriority({
    risk: mehtaRisk,
    signals: mehtaSignals,
    maxPortfolioExposurePaise: 23_100_000, // Gupta & Sons ₹2.31L
  });

  assertEqual(mehtaPriority.priorityScore, 72, "Mehta Priority Score = 72");

  const mehtaRecommendation = evaluateCustomerRecommendation({
    risk: mehtaRisk,
    signals: mehtaSignals,
    highExposureThresholdPaise: 10_000_000, // ₹1,00,000 threshold
  });

  assertEqual(mehtaRecommendation.action, "ESCALATE_IMMEDIATELY", "Mehta Action (Rule 1)");
  console.log("Mehta Reason Codes:", mehtaRecommendation.reasonCodes);
  assertEqual(
    mehtaRecommendation.reasonCodes.includes("HIGH_OVERDUE"),
    true,
    "Mehta has HIGH_OVERDUE"
  );
  assertEqual(
    mehtaRecommendation.reasonCodes.includes("PAYMENT_DETERIORATION"),
    true,
    "Mehta has PAYMENT_DETERIORATION"
  );
  assertEqual(
    mehtaRecommendation.reasonCodes.includes("HIGH_EXPOSURE"),
    true,
    "Mehta has HIGH_EXPOSURE"
  );
  assertEqual(
    mehtaRecommendation.reasonCodes.includes("HIGH_CONCENTRATION"),
    true,
    "Mehta has HIGH_CONCENTRATION"
  );

  // ── 3. Recommendation Rules 2, 3, 4, 5 Edge Case Verification ──────────────
  console.log("\n--- 6. Recommendation Decision Matrix Rules 2–5 ---");

  // Rule 2: High Risk + Small Exposure (< ₹1L)
  const rule2Signals: CustomerSignals = {
    ...mehtaSignals,
    outstandingExposurePaise: 5_000_000, // ₹50,000 (< ₹1L threshold)
    overdueExposurePaise: 5_000_000,
  };
  const rule2Rec = evaluateCustomerRecommendation({
    risk: mehtaRisk, // Risk 95 (>= 70)
    signals: rule2Signals,
    highExposureThresholdPaise: 10_000_000,
  });
  assertEqual(rule2Rec.action, "SEND_FORMAL_REMINDER", "Rule 2 High Risk + Small Exposure");

  // Rule 3: Medium Risk (40-69) + Drift > 10d
  const rule3Signals: CustomerSignals = {
    ...mehtaSignals,
    maxOverdueDays: 10, // Aging = 15
    openCycleDriftDays: 14, // Drift = 20
    overdueExposureRatio: 0.5, // Overdue score = 10
  };
  const rule3Risk = evaluateCustomerRisk(rule3Signals); // 15 + 20 + 10 = 45 (MEDIUM)
  assertEqual(rule3Risk.riskCategory, "MEDIUM", "Rule 3 Risk is MEDIUM");
  const rule3Rec = evaluateCustomerRecommendation({
    risk: rule3Risk,
    signals: rule3Signals,
  });
  assertEqual(rule3Rec.action, "PROACTIVE_CHECKIN", "Rule 3 Medium Risk + Drift > 10d");

  // Rule 4: Low Risk (< 40) + Invoice due in <= 5 days
  const rule4Signals: CustomerSignals = {
    ...mehtaSignals,
    maxOverdueDays: 0,
    openCycleDriftDays: 0,
    overdueExposureRatio: 0,
    hasUpcomingInvoiceWithin5Days: true,
  };
  const rule4Risk = evaluateCustomerRisk(rule4Signals); // 0 (LOW)
  assertEqual(rule4Risk.riskCategory, "LOW", "Rule 4 Risk is LOW");
  const rule4Rec = evaluateCustomerRecommendation({
    risk: rule4Risk,
    signals: rule4Signals,
  });
  assertEqual(rule4Rec.action, "SCHEDULE_COURTESY_REMINDER", "Rule 4 Low Risk + Upcoming Due in <= 5d");

  // Rule 5: Default Monitor (e.g. Gupta & Sons)
  const rule5Signals: CustomerSignals = {
    ...mehtaSignals,
    maxOverdueDays: 0,
    openCycleDriftDays: 0,
    overdueExposureRatio: 0,
    hasUpcomingInvoiceWithin5Days: false,
  };
  const rule5Risk = evaluateCustomerRisk(rule5Signals);
  const rule5Rec = evaluateCustomerRecommendation({
    risk: rule5Risk,
    signals: rule5Signals,
  });
  assertEqual(rule5Rec.action, "MONITOR", "Rule 5 Default Fallback");

  console.log("\n🎉 ALL MILESTONE 2 INTELLIGENCE ENGINE TESTS PASSED WITH 100% ACCURACY!");
}

runIntelligenceTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
