/**
 * src/modules/intelligence/risk-engine.ts
 *
 * Deterministic Risk Score evaluation engine.
 *
 * Risk measures how vulnerable a customer's current receivables position is
 * based on observed aging, payment-cycle drift, and overdue exposure.
 */

import type { CustomerSignals, RiskCategory, RiskEvaluation } from "./types.js";

/**
 * Evaluates Aging Severity Score (0 - 45 points).
 * Based on maximum overdue days among open invoices.
 */
export function calculateAgingSeverityScore(maxOverdueDays: number): number {
  if (maxOverdueDays <= 0) return 0;
  if (maxOverdueDays <= 15) return 15;
  if (maxOverdueDays <= 30) return 30;
  if (maxOverdueDays <= 60) return 40;
  return 45;
}

/**
 * Evaluates Open-Cycle Drift Score (0 - 35 points).
 * Measures operational deviation beyond historical baseline payment cycle.
 */
export function calculateOpenCycleDriftScore(openCycleDriftDays: number): number {
  if (openCycleDriftDays <= 0) return 0;
  if (openCycleDriftDays <= 10) return 10;
  if (openCycleDriftDays <= 20) return 20;
  return 35;
}

/**
 * Evaluates Overdue Exposure Score (0 - 20 points).
 * Ratio of overdue balance vs total outstanding balance multiplied by 20.
 */
export function calculateOverdueExposureScore(overdueExposureRatio: number): number {
  if (overdueExposureRatio <= 0) return 0;
  return Math.min(20, overdueExposureRatio * 20);
}

/**
 * Classifies numerical Risk Score into standard bands:
 * 0–39  → LOW
 * 40–69 → MEDIUM
 * 70–100 → HIGH
 */
export function classifyRiskCategory(riskScore: number): RiskCategory {
  if (riskScore >= 70) return "HIGH";
  if (riskScore >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Evaluates the full Risk model for a customer from extracted signals.
 */
export function evaluateCustomerRisk(signals: CustomerSignals): RiskEvaluation {
  const agingSeverityScore = calculateAgingSeverityScore(signals.maxOverdueDays);
  const openCycleDriftScore = calculateOpenCycleDriftScore(signals.openCycleDriftDays);
  const overdueExposureScore = calculateOverdueExposureScore(signals.overdueExposureRatio);

  const rawTotal = agingSeverityScore + openCycleDriftScore + overdueExposureScore;
  const totalRiskScore = Math.min(100, Math.max(0, Math.round(rawTotal)));
  const riskCategory = classifyRiskCategory(totalRiskScore);

  return {
    agingSeverityScore,
    openCycleDriftScore,
    overdueExposureScore,
    totalRiskScore,
    riskCategory,
  };
}
