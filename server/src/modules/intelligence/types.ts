/**
 * src/modules/intelligence/types.ts
 *
 * Core type definitions and enums for the Milestone 2 Intelligence Engine.
 */

export type RiskCategory = "LOW" | "MEDIUM" | "HIGH";

export type RecommendationAction =
  | "ESCALATE_IMMEDIATELY"
  | "SEND_FORMAL_REMINDER"
  | "PROACTIVE_CHECKIN"
  | "SCHEDULE_COURTESY_REMINDER"
  | "MONITOR";

export const REASON_CODES = {
  HIGH_OVERDUE: "HIGH_OVERDUE",
  MODERATE_OVERDUE: "MODERATE_OVERDUE",
  HIGH_EXPOSURE: "HIGH_EXPOSURE",
  PAYMENT_DETERIORATION: "PAYMENT_DETERIORATION",
  CYCLE_DRIFT: "CYCLE_DRIFT",
  HIGH_CONCENTRATION: "HIGH_CONCENTRATION",
  UPCOMING_DUE_DATE: "UPCOMING_DUE_DATE",
  HEALTHY_HISTORY: "HEALTHY_HISTORY",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

export interface InvoiceWithAllocation {
  id: number;
  invoiceNumber: string;
  issuedAt: string; // YYYY-MM-DD
  dueDate: string;  // YYYY-MM-DD
  totalAmountPaise: number;
  allocatedAmountPaise: number;
  outstandingBalancePaise: number;
  isOverdue: boolean;
  overdueDays: number;
  daysUntilDue: number;
}

export interface SettledInvoiceHistory {
  id: number;
  issuedAt: string;
  paymentReceivedAt: string;
  elapsedDays: number;
}

export interface CustomerSignals {
  customerId: number;
  customerName: string;
  outstandingExposurePaise: number;
  overdueExposurePaise: number;
  overdueExposureRatio: number;
  maxOverdueDays: number;
  openCycleDays: number;
  historicalBaselinePaymentDays: number | null;
  baselineAvailable: boolean;
  openCycleDriftDays: number;
  customerLTVPaise: number;
  revenueConcentrationRatio: number; // percentage 0 - 100
  openInvoicesCount: number;
  hasUpcomingInvoiceWithin5Days: boolean;
}

export interface RiskEvaluation {
  agingSeverityScore: number;     // 0 - 45
  openCycleDriftScore: number;    // 0 - 35
  overdueExposureScore: number;   // 0 - 20
  totalRiskScore: number;         // 0 - 100 (rounded)
  riskCategory: RiskCategory;
}

export interface PriorityEvaluation {
  normalizedExposureScore: number; // 0 - 100
  concentrationScore: number;      // 0 - 100
  priorityScore: number;           // 0 - 100 (rounded)
  priorityRank?: number;
}

export interface RecommendationEvaluation {
  action: RecommendationAction;
  matchedRule: string;
  reasonCodes: ReasonCode[];
}

export interface CustomerAssessment {
  customerId: number;
  customerName: string;
  assessmentDate: string;
  signals: CustomerSignals;
  risk: RiskEvaluation;
  priority: PriorityEvaluation;
  recommendation: RecommendationEvaluation;
  openInvoices: InvoiceWithAllocation[];
}

export interface PortfolioAssessment {
  assessmentDate: string;
  totalPortfolioOutstandingPaise: number;
  totalPortfolioOverduePaise: number;
  totalPortfolioLTVPaise: number;
  highExposureThresholdPaise: number;
  customersCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  rankings: CustomerAssessment[];
}
