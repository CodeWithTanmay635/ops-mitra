/**
 * src/modules/intelligence/recommendation-engine.ts
 *
 * Deterministic recommendation and canonical reason code generator.
 */

import {
  REASON_CODES,
  type CustomerSignals,
  type ReasonCode,
  type RecommendationAction,
  type RecommendationEvaluation,
  type RiskEvaluation,
} from "./types.js";

// Default high-exposure threshold for MSME portfolio (₹1,00,000 = 10,000,000 paise)
export const DEFAULT_HIGH_EXPOSURE_THRESHOLD_PAISE = 10_000_000;

/**
 * Derives canonical deterministic reason codes from customer signals.
 */
export function deriveReasonCodes(params: {
  signals: CustomerSignals;
  highExposureThresholdPaise: number;
}): ReasonCode[] {
  const { signals, highExposureThresholdPaise } = params;
  const codes: ReasonCode[] = [];

  // Overdue severity
  if (signals.maxOverdueDays > 30) {
    codes.push(REASON_CODES.HIGH_OVERDUE);
  } else if (signals.maxOverdueDays >= 1) {
    codes.push(REASON_CODES.MODERATE_OVERDUE);
  }

  // Open-cycle drift severity
  if (signals.openCycleDriftDays > 15) {
    codes.push(REASON_CODES.PAYMENT_DETERIORATION);
  } else if (signals.openCycleDriftDays > 10) {
    codes.push(REASON_CODES.CYCLE_DRIFT);
  }

  // Financial exposure
  if (signals.outstandingExposurePaise >= highExposureThresholdPaise) {
    codes.push(REASON_CODES.HIGH_EXPOSURE);
  }

  // Portfolio concentration
  if (signals.revenueConcentrationRatio > 25) {
    codes.push(REASON_CODES.HIGH_CONCENTRATION);
  }

  // Upcoming due date
  if (signals.hasUpcomingInvoiceWithin5Days) {
    codes.push(REASON_CODES.UPCOMING_DUE_DATE);
  }

  // Healthy history
  if (
    signals.maxOverdueDays === 0 &&
    signals.openCycleDriftDays === 0 &&
    signals.baselineAvailable
  ) {
    codes.push(REASON_CODES.HEALTHY_HISTORY);
  }

  return codes;
}

/**
 * Evaluates the deterministic recommendation rules in strict sequential order.
 */
export function evaluateCustomerRecommendation(params: {
  risk: RiskEvaluation;
  signals: CustomerSignals;
  highExposureThresholdPaise?: number;
}): RecommendationEvaluation {
  const {
    risk,
    signals,
    highExposureThresholdPaise = DEFAULT_HIGH_EXPOSURE_THRESHOLD_PAISE,
  } = params;

  const isHighExposure = signals.outstandingExposurePaise >= highExposureThresholdPaise;
  let action: RecommendationAction = "MONITOR";
  let matchedRule = "RULE_5_DEFAULT_MONITOR";

  // RULE 1: RiskScore >= 70 AND High Exposure
  if (risk.totalRiskScore >= 70 && isHighExposure) {
    action = "ESCALATE_IMMEDIATELY";
    matchedRule = "RULE_1_HIGH_RISK_HIGH_EXPOSURE";
  }
  // RULE 2: RiskScore >= 70 AND Not High Exposure
  else if (risk.totalRiskScore >= 70 && !isHighExposure) {
    action = "SEND_FORMAL_REMINDER";
    matchedRule = "RULE_2_HIGH_RISK_MODERATE_EXPOSURE";
  }
  // RULE 3: 40 <= RiskScore < 70 AND OpenCycleDrift > 10
  else if (
    risk.totalRiskScore >= 40 &&
    risk.totalRiskScore < 70 &&
    signals.openCycleDriftDays > 10
  ) {
    action = "PROACTIVE_CHECKIN";
    matchedRule = "RULE_3_MEDIUM_RISK_DRIFT";
  }
  // RULE 4: RiskScore < 40 AND open invoice due within <= 5 days
  else if (risk.totalRiskScore < 40 && signals.hasUpcomingInvoiceWithin5Days) {
    action = "SCHEDULE_COURTESY_REMINDER";
    matchedRule = "RULE_4_LOW_RISK_UPCOMING_DUE";
  }
  // RULE 5: Default fallback
  else {
    action = "MONITOR";
    matchedRule = "RULE_5_DEFAULT_MONITOR";
  }

  const reasonCodes = deriveReasonCodes({
    signals,
    highExposureThresholdPaise,
  });

  return {
    action,
    matchedRule,
    reasonCodes,
  };
}
