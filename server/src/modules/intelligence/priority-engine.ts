/**
 * src/modules/intelligence/priority-engine.ts
 *
 * Deterministic Priority Score evaluation and ranking engine.
 *
 * Risk answers: "How vulnerable is the receivables position?"
 * Priority answers: "Where should the business owner spend recovery effort first?"
 */

import type { CustomerSignals, PriorityEvaluation, RiskEvaluation } from "./types.js";

/**
 * Calculates Normalized Exposure Score (0 - 100).
 * Linear normalization against the maximum customer exposure in the portfolio.
 */
export function calculateNormalizedExposureScore(
  outstandingExposurePaise: number,
  maxPortfolioExposurePaise: number
): number {
  if (maxPortfolioExposurePaise <= 0 || outstandingExposurePaise <= 0) {
    return 0;
  }
  return Math.min(100, (outstandingExposurePaise / maxPortfolioExposurePaise) * 100);
}

/**
 * Calculates Concentration Score (0 - 100).
 * Scales customer revenue concentration percentage by 2 (capped at 100).
 */
export function calculateConcentrationScore(revenueConcentrationRatio: number): number {
  if (revenueConcentrationRatio <= 0) {
    return 0;
  }
  return Math.min(100, revenueConcentrationRatio * 2);
}

/**
 * Evaluates Priority Score (0 - 100).
 * PriorityScore = 0.40 * RiskScore + 0.40 * NormalizedExposureScore + 0.20 * ConcentrationScore
 */
export function evaluateCustomerPriority(params: {
  risk: RiskEvaluation;
  signals: CustomerSignals;
  maxPortfolioExposurePaise: number;
}): PriorityEvaluation {
  const { risk, signals, maxPortfolioExposurePaise } = params;

  const normalizedExposureScore = calculateNormalizedExposureScore(
    signals.outstandingExposurePaise,
    maxPortfolioExposurePaise
  );

  const concentrationScore = calculateConcentrationScore(
    signals.revenueConcentrationRatio
  );

  const rawScore =
    0.4 * risk.totalRiskScore +
    0.4 * normalizedExposureScore +
    0.2 * concentrationScore;

  const priorityScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    normalizedExposureScore,
    concentrationScore,
    priorityScore,
  };
}
