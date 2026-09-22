/**
 * src/lib/api.ts
 *
 * API client for the OpsMitra Milestone 2 Intelligence Engine.
 *
 * This module contains:
 *   1. TypeScript interfaces that mirror the exact backend response shapes.
 *   2. fetchPortfolio() — calls GET /api/v1/intelligence/portfolio
 *   3. fetchCustomer()  — calls GET /api/v1/intelligence/customers/:id
 *
 * Rules:
 *   - No business logic, score calculations, or risk derivations here.
 *   - All values come from the backend deterministic engine.
 *   - The base URL is read from VITE_API_URL (injected by Vite at build time).
 *   - Non-2xx responses throw a typed ApiError so callers can distinguish
 *     network failures from application errors.
 */

// ─── Base URL ─────────────────────────────────────────────────────────────────

const API_BASE: string = import.meta.env.PROD
  ? (import.meta.env["VITE_API_URL"] as string | undefined) || ""
  : (import.meta.env["VITE_API_URL"] as string | undefined) || "http://localhost:3001";

// ─── Enums / Literal Types ────────────────────────────────────────────────────

/** Deterministic customer receivables vulnerability category. */
export type RiskCategory = "LOW" | "MEDIUM" | "HIGH";

/** Deterministic action recommendation from the Milestone 2 engine. */
export type RecommendationAction =
  | "ESCALATE_IMMEDIATELY"
  | "SEND_FORMAL_REMINDER"
  | "PROACTIVE_CHECKIN"
  | "SCHEDULE_COURTESY_REMINDER"
  | "MONITOR";

/** Canonical reason codes produced by the Recommendation Engine. */
export type ReasonCode =
  | "HIGH_OVERDUE"
  | "MODERATE_OVERDUE"
  | "HIGH_EXPOSURE"
  | "PAYMENT_DETERIORATION"
  | "CYCLE_DRIFT"
  | "HIGH_CONCENTRATION"
  | "UPCOMING_DUE_DATE"
  | "HEALTHY_HISTORY";

// ─── Domain Interfaces ────────────────────────────────────────────────────────

/**
 * A single open invoice enriched with the authoritative outstanding balance
 * computed from payment_allocations (not from invoices.paidAmountPaise).
 */
export interface ApiInvoice {
  id: number;
  invoiceNumber: string;
  /** ISO date: YYYY-MM-DD */
  issuedAt: string;
  /** ISO date: YYYY-MM-DD */
  dueDate: string;
  /** Integer paise. Divide by 100 to get rupees. */
  totalAmountPaise: number;
  /** Integer paise. Sum of all payment_allocations for this invoice. */
  allocatedAmountPaise: number;
  /** Integer paise. totalAmountPaise - allocatedAmountPaise. */
  outstandingBalancePaise: number;
  isOverdue: boolean;
  /** 0 if not overdue. */
  overdueDays: number;
  /** Negative if already past due. */
  daysUntilDue: number;
}

/**
 * Deterministic business signals extracted for a customer as of the
 * assessment date. No LLM involved.
 */
export interface ApiCustomerSignals {
  customerId: number;
  customerName: string;
  /** E_c: Sum of outstanding balances across all open invoices (integer paise). */
  outstandingExposurePaise: number;
  /** O_c: Outstanding balance of overdue-only invoices (integer paise). */
  overdueExposurePaise: number;
  /** R_c: O_c / E_c. 0 when E_c = 0. */
  overdueExposureRatio: number;
  /** D_c: Maximum overdue days among open invoices. 0 when no open invoices. */
  maxOverdueDays: number;
  /** OC_c: Calendar days since oldest open invoice was issued. */
  openCycleDays: number;
  /** P̄_c: Average days from issuance to payment across settled invoices. null when no history. */
  historicalBaselinePaymentDays: number | null;
  /** false when no settled invoices exist to form a baseline. */
  baselineAvailable: boolean;
  /** Δ_c: max(0, OC_c - P̄_c). 0 when no open invoices or no baseline. */
  openCycleDriftDays: number;
  /** Integer paise. Sum of all sales for this customer. */
  customerLTVPaise: number;
  /** C_c: CustomerLTV / TotalPortfolioLTV × 100. Percentage 0–100. */
  revenueConcentrationRatio: number;
  openInvoicesCount: number;
  hasUpcomingInvoiceWithin5Days: boolean;
}

/** Deterministic vulnerability score from the Risk Engine (0–100). */
export interface ApiRiskEvaluation {
  /** 0–45 pts based on max overdue days band. */
  agingSeverityScore: number;
  /** 0–35 pts based on open-cycle drift band. */
  openCycleDriftScore: number;
  /** 0–20 pts: overdueExposureRatio × 20. */
  overdueExposureScore: number;
  /** agingSeverityScore + openCycleDriftScore + overdueExposureScore, capped 0–100. */
  totalRiskScore: number;
  riskCategory: RiskCategory;
}

/** Deterministic action urgency score from the Priority Engine (0–100). */
export interface ApiPriorityEvaluation {
  /** Linear normalization: E_c / max(E) × 100. */
  normalizedExposureScore: number;
  /** min(100, C_c × 2). */
  concentrationScore: number;
  /** 0.40×Risk + 0.40×NormalizedExposure + 0.20×Concentration, capped 0–100. */
  priorityScore: number;
  /** 1-based rank within the portfolio. Present on portfolio responses. */
  priorityRank?: number;
}

/** Deterministic recommendation from the Recommendation Engine (Rules 1–5). */
export interface ApiRecommendationEvaluation {
  action: RecommendationAction;
  /** Machine-readable identifier of the matched rule, e.g. "RULE_1_HIGH_RISK_HIGH_EXPOSURE". */
  matchedRule: string;
  /** Canonical reason codes that justify the recommendation. */
  reasonCodes: ReasonCode[];
}

/** Full deterministic assessment for a single customer. */
export interface ApiCustomerAssessment {
  customerId: number;
  customerName: string;
  /** ISO date string: YYYY-MM-DD */
  assessmentDate: string;
  signals: ApiCustomerSignals;
  risk: ApiRiskEvaluation;
  priority: ApiPriorityEvaluation;
  recommendation: ApiRecommendationEvaluation;
  /** Only open invoices (outstandingBalancePaise > 0). */
  openInvoices: ApiInvoice[];
}

/** Portfolio-level assessment covering all customers, ranked by priority. */
export interface ApiPortfolioAssessment {
  /** ISO date string: YYYY-MM-DD */
  assessmentDate: string;
  /** Integer paise. Sum of E_c across all customers. */
  totalPortfolioOutstandingPaise: number;
  /** Integer paise. Sum of overdue exposure across all customers. */
  totalPortfolioOverduePaise: number;
  /** Integer paise. Sum of all sales across all customers. */
  totalPortfolioLTVPaise: number;
  /** Integer paise. Configured threshold separating Rule 1 from Rule 2. */
  highExposureThresholdPaise: number;
  customersCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  /** Customers ranked: PriorityScore DESC → Exposure DESC → Concentration DESC → Name ASC. */
  rankings: ApiCustomerAssessment[];
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

/** Successful 2xx response envelope from the backend. */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Error response envelope from the backend (4xx / 5xx). */
export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

// ─── Error Class ──────────────────────────────────────────────────────────────

/**
 * Thrown by API client functions when the server returns a non-2xx status.
 * Callers can inspect `status` and `body` to render appropriate UI feedback.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(`API Error ${status}: ${body.message}`);
    this.name = "ApiError";
  }
}

// ─── Milestone 4 Domain Interfaces ──────────────────────────────────────────

export interface ApiStructuredEvidence {
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

export interface ApiExplanationData {
  evidence: ApiStructuredEvidence;
  explanation: string;
  keyPoints: string[];
  suggestedAction: string;
}

export interface ApiFollowUpData {
  evidence: ApiStructuredEvidence;
  message: string;
}

export interface ApiSimulationData {
  customerId: number;
  customerName: string;
  recoveryAmountPaise: number;
  current: ApiStructuredEvidence;
  simulated: ApiStructuredEvidence;
  aiExplanation: {
    explanation: string;
    keyPoints: string[];
  };
}

// ─── Internal Fetch Helpers ───────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`);
  } catch (cause) {
    throw new Error(
      `Network error while requesting ${path}. Is the backend running on ${API_BASE}?`,
      { cause },
    );
  }

  if (!res.ok) {
    let body: ApiErrorResponse;
    try {
      body = (await res.json()) as ApiErrorResponse;
    } catch {
      body = {
        error: "UNKNOWN_ERROR",
        message: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    throw new ApiError(res.status, body);
  }

  const json = (await res.json()) as ApiSuccessResponse<T>;
  return json.data;
}

async function apiFetchPost<T>(path: string, payload?: unknown): Promise<T> {
  let res: Response;
  try {
    const headers = payload !== undefined ? { "Content-Type": "application/json" } : undefined;
    const body = payload !== undefined ? JSON.stringify(payload) : undefined;
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body,
    });
  } catch (cause) {
    throw new Error(
      `Network error while requesting ${path}. Is the backend running on ${API_BASE}?`,
      { cause },
    );
  }

  if (!res.ok) {
    let body: ApiErrorResponse;
    try {
      body = (await res.json()) as ApiErrorResponse;
    } catch {
      body = {
        error: "UNKNOWN_ERROR",
        message: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    throw new ApiError(res.status, body);
  }

  const json = (await res.json()) as ApiSuccessResponse<T>;
  return json.data;
}

// ─── Public API Client Functions ──────────────────────────────────────────────

/**
 * Fetches the full portfolio assessment ranked by priority score.
 */
export async function fetchPortfolio(
  date?: string,
): Promise<ApiPortfolioAssessment> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<ApiPortfolioAssessment>(
    `/api/v1/intelligence/portfolio${params}`,
  );
}

/**
 * Fetches the full assessment for a single customer by their numeric ID.
 */
export async function fetchCustomer(
  id: number,
  date?: string,
): Promise<ApiCustomerAssessment> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<ApiCustomerAssessment>(
    `/api/v1/intelligence/customers/${id}${params}`,
  );
}

/**
 * Fetches AI explanation and key signals for a customer.
 */
export async function fetchCustomerExplanation(
  id: number,
  date?: string,
): Promise<ApiExplanationData> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetchPost<ApiExplanationData>(
    `/api/v1/ai/customers/${id}/explanation${params}`,
  );
}

/**
 * Generates draft follow-up payment message for a customer.
 */
export async function fetchCustomerFollowUp(
  id: number,
  date?: string,
): Promise<ApiFollowUpData> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetchPost<ApiFollowUpData>(
    `/api/v1/ai/customers/${id}/follow-up${params}`,
  );
}

/**
 * Runs a deterministic What-If simulation for a hypothetical recovery payment.
 */
export async function simulateCustomerRecovery(
  id: number,
  recoveryAmountPaise: number,
  date?: string,
): Promise<ApiSimulationData> {
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetchPost<ApiSimulationData>(
    `/api/v1/simulation/customers/${id}${params}`,
    { recoveryAmountPaise },
  );
}
