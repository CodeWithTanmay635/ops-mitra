/**
 * src/modules/intelligence/evidence-builder.ts
 *
 * Deterministic evidence builder.
 * Extracts structured evidence from existing CustomerAssessment without duplicating calculations.
 */

import type {
  CustomerAssessment,
  ReasonCode,
  RecommendationAction,
  RiskCategory,
} from "./types.js";

export interface StructuredEvidence {
  customerId: number;
  customerName: string;
  assessmentDate: string;

  financials: {
    outstandingPaise: number;
    overdueExposurePaise: number;
    overdueExposureRatioPercent: number;
  };

  signals: {
    maxOverdueDays: number;
    openCycleDays: number;
    historicalBaselinePaymentDays: number | null;
    openCycleDriftDays: number;
    revenueConcentrationRatioPercent: number;
    openInvoicesCount: number;
    hasUpcomingInvoiceWithin5Days: boolean;
  };

  risk: {
    score: number;
    category: RiskCategory;
    agingSeverityScore: number;
    openCycleDriftScore: number;
    overdueExposureScore: number;
  };

  priority: {
    score: number;
    rank?: number;
  };

  recommendation: {
    action: RecommendationAction;
    matchedRule: string;
    reasonCodes: ReasonCode[];
  };
}

/**
 * Builds structured evidence object from authoritative CustomerAssessment.
 */
export function buildCustomerEvidence(assessment: CustomerAssessment): StructuredEvidence {
  const { signals, risk, priority, recommendation } = assessment;

  return {
    customerId: assessment.customerId,
    customerName: assessment.customerName,
    assessmentDate: assessment.assessmentDate,

    financials: {
      outstandingPaise: signals.outstandingExposurePaise,
      overdueExposurePaise: signals.overdueExposurePaise,
      overdueExposureRatioPercent: Math.round(signals.overdueExposureRatio * 100),
    },

    signals: {
      maxOverdueDays: signals.maxOverdueDays,
      openCycleDays: signals.openCycleDays,
      historicalBaselinePaymentDays: signals.historicalBaselinePaymentDays !== null
        ? Math.round(signals.historicalBaselinePaymentDays)
        : null,
      openCycleDriftDays: signals.openCycleDriftDays,
      revenueConcentrationRatioPercent: Math.round(signals.revenueConcentrationRatio * 100) / 100,
      openInvoicesCount: signals.openInvoicesCount,
      hasUpcomingInvoiceWithin5Days: signals.hasUpcomingInvoiceWithin5Days,
    },

    risk: {
      score: risk.totalRiskScore,
      category: risk.riskCategory,
      agingSeverityScore: risk.agingSeverityScore,
      openCycleDriftScore: risk.openCycleDriftScore,
      overdueExposureScore: risk.overdueExposureScore,
    },

    priority: {
      score: priority.priorityScore,
      rank: priority.priorityRank,
    },

    recommendation: {
      action: recommendation.action,
      matchedRule: recommendation.matchedRule,
      reasonCodes: recommendation.reasonCodes,
    },
  };
}
