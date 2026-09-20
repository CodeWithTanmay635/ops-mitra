# Milestone 4 — AI Explanation & What-If Simulation Specification

**Document Status**: COMPLETED & FULLY VERIFIED (Backend & Frontend 100% Operational)  
**Target Modules**: `server/src/modules/ai/`, `server/src/modules/intelligence/`, `server/src/routes/ai-simulation.ts`, `src/lib/api.ts`, `src/App.tsx`  
**Test Suites**: `server/src/test/milestone4.test.ts`, `server/src/test/intelligence.test.ts` (49/49 Tests Passed)

---

## 1. Executive Summary & Architectural Principles

Milestone 4 introduces **AI-Generated Explanations**, **Automated Payment Follow-Up Drafts**, and a **Deterministic What-If Simulation Engine** to OpsMitra.

```
+-----------------------------------------------------------------------------+
|                          OPSMITRA THREE-TIER ARCHITECTURE                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  [ TIER 1: DETERMINISTIC ENGINE (M1 + M2) ]                                 |
|  - PostgreSQL Database (Paise integer balances, Payment Allocations)       |
|  - Signals Engine (Aging, Open-Cycle Drift, Overdue Ratio, Concentration)   |
|  - Risk Engine (0-100 Vulnerability Index) & Priority Rank Engine          |
|  - Recommendation Engine (Rules 1-5 & Reason Codes)                         |
|                                     │                                       |
|                                     ▼ (Strict Fact Extraction)              |
|  [ TIER 2: EVIDENCE BUILDER & IN-MEMORY SIMULATION ]                        |
|  - StructuredEvidence Builder (Bounded JSON Fact Packets)                   |
|  - Simulation Engine (FIFO Debt Recovery Model, Zero DB Mutations)          |
|                                     │                                       |
|                                     ▼ (Ground Truth Context Injection)      |
|  [ TIER 3: ISOLATED AI & EXPLANATION LAYER ]                                |
|  - Natural Language Business Explanations (Gemini / OpenAI / Fallback)     |
|  - Context-Aware Customer Follow-Up Drafts                                  |
|  - Simulation Outcome Explainers                                            |
|  - 100% Deterministic Fallback Subsystem (Guaranteed Zero-Downtime)         |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### Core Architecture Rules — MANDATORY

1. **The LLM Never Calculates Numbers**:
   - The Large Language Model (LLM) is **strictly forbidden** from computing monetary balances, overdue days, risk scores, priority ranks, or rule triggers.
   - All arithmetic and risk classifications are calculated deterministically by Tier 1 & Tier 2. The LLM acts purely as an interpreter and narrative generator.
2. **Zero Hallucination Grounding**:
   - The AI layer is fed a strictly bounded `StructuredEvidence` object containing verified database facts.
3. **Deterministic Fallback Guarantee**:
   - If an API key is absent, the remote LLM rate-limits, or the network fails, the system automatically falls back to deterministic rule-based text generators without throwing errors to the client.
4. **Zero Database Mutation for Simulations**:
   - What-If simulations operate entirely in-memory using cloned data structures. The PostgreSQL database is never modified during simulation runs.

---

## 2. Structured Evidence Builder

Located at: [`server/src/modules/intelligence/evidence-builder.ts`](file:///E:/ops-mitra/server/src/modules/intelligence/evidence-builder.ts)

The Evidence Builder converts raw `CustomerAssessment` data into a sanitized, self-contained `StructuredEvidence` payload. This payload acts as the single source of truth for both LLM prompts and deterministic fallback generators.

### 2.1 Schema Definition

```typescript
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
```

---

## 3. AI Service & Provider Isolation

Located at: [`server/src/modules/ai/ai.service.ts`](file:///E:/ops-mitra/server/src/modules/ai/ai.service.ts)

The AI Service provides three operations:
1. `generateExplanation(evidence: StructuredEvidence)`
2. `generateFollowUpMessage(evidence: StructuredEvidence)`
3. `generateSimulationExplanation(current, simulated, recoveryAmountPaise)`

### 3.1 Prompt Constraints
The system prompts explicitly instruct models:
- Use only supplied evidence.
- Do not invent numbers, dates, or financial figures.
- Do not perform financial calculations.
- Do not claim default probabilities.
- Do not change recommended actions.

### 3.2 Deterministic Fallback Engine
When `GEMINI_API_KEY` / `OPENAI_API_KEY` is not present, or if the network call fails or times out (5 seconds limit), the service seamlessly invokes deterministic text generators:
- **Fallback Explanation**: Constructs a clean, professional summary of receivables position, max overdue days, open-cycle drift, risk score, and recommended action.
- **Fallback Follow-Up**: Drafts a concise, professional payment follow-up email/SMS mentioning exact outstanding amount and overdue days.
- **Fallback Simulation Explanation**: Explains financial impact and risk reduction resulting from the hypothetical recovery payment.

---

## 4. Deterministic What-If Simulation Engine

Located at: [`server/src/modules/intelligence/simulation.service.ts`](file:///E:/ops-mitra/server/src/modules/intelligence/simulation.service.ts)

### 4.1 Simulation Workflow
1. Fetch full customer portfolio assessment from `IntelligenceService`.
2. Clone open invoices array in memory.
3. Sort open invoices by `dueDate` ascending (FIFO debt recovery model).
4. Apply hypothetical `recoveryAmountPaise` across open invoices in memory.
5. Recalculate signals, risk score, priority score, and recommendations using Tier 1 intelligence functions (`calculateCustomerSignals`, `evaluateCustomerRisk`, `evaluateCustomerPriority`, `evaluateCustomerRecommendation`).
6. Return `current` and `simulated` structured evidence.
7. **Verified Zero DB Mutation**: No database writes occur.

---

## 5. Fastify REST API Routes

Located at: [`server/src/routes/ai-simulation.ts`](file:///E:/ops-mitra/server/src/routes/ai-simulation.ts)

### Endpoints:
- `POST /api/v1/ai/customers/:id/explanation`
- `POST /api/v1/ai/customers/:id/follow-up`
- `POST /api/v1/simulation/customers/:id` (body `{ recoveryAmountPaise: number }`)

All endpoints feature Zod input validation and standard Fastify error handling.

---

## 6. Frontend UI Integration

Located at: [`src/lib/api.ts`](file:///E:/ops-mitra/src/lib/api.ts) & [`src/App.tsx`](file:///E:/ops-mitra/src/App.tsx)

1. **AI Explanation Card ("Why this matters")**:
   - Displays natural language explanation.
   - Key signal badges (e.g. `43 days overdue`, `₹1,24,000 outstanding`, `61-day open cycle`).
   - Suggested action indicator.
2. **Draft Follow-Up Generator**:
   - Generates concise follow-up text with "Copy message" functionality.
3. **What-If Simulation Panel**:
   - Interactive recovery amount input (`₹`).
   - Side-by-side `Current → Simulated` comparison table (Outstanding, Risk Score, Priority Score, Recommendation).
   - AI Business Impact explainer.

---

## 7. Verification & Test Suite

Test suite: [`server/src/test/milestone4.test.ts`](file:///E:/ops-mitra/server/src/test/milestone4.test.ts)

Run command:
```powershell
powershell -ExecutionPolicy Bypass -Command "pnpm --prefix server test"
```

### Verification Results:
- **35/35** Milestone 2 Intelligence Engine tests PASSED.
- **14/14** Milestone 4 AI Explanation & Simulation tests PASSED.
- **Total: 49/49 tests passed with 100% accuracy.**
- Server build (`tsup`) and Frontend build (`vite build`) completed with 0 errors.
