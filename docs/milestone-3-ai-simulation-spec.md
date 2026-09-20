# Milestone 3 — AI Explanation, Follow-Up Generation & What-If Simulation Engine Specification

**Document Status**: COMPLETED & FULLY VERIFIED (Backend & Frontend 100% Operational)  
**Target Modules**: `server/src/modules/ai/`, `server/src/modules/intelligence/`, `server/src/routes/ai-simulation.ts`, `src/lib/api.ts`, `src/App.tsx`  
**Test Suites**: `server/src/test/milestone4.test.ts`, `server/src/test/intelligence.test.ts` (49/49 Tests Passed)

---

## 1. Executive Summary & Architectural Principles

Milestone 3 extends OpsMitra from a deterministic calculation engine into an **AI-Assisted Operations Platform**. It introduces natural language business explanations, context-aware payment follow-up drafting, and an in-memory **What-If Financial Simulation Engine**.

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

### Core Architecture Rules

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

Located at: [`server/src/modules/intelligence/evidence-builder.ts`](file:///e:/ops-mitra/server/src/modules/intelligence/evidence-builder.ts)

The Evidence Builder converts raw `CustomerAssessment` data into a sanitized, self-contained `StructuredEvidence` payload. This payload acts as the single source of truth for both LLM prompts and deterministic fallback generators.

### 2.1 Schema Definition

```typescript
export interface StructuredEvidence {
  customerId: number;
  customerName: string;
  assessmentDate: string;
  financials: {
    outstandingPaise: number;
    outstandingRupeesFormatted: string;
    overdueExposurePaise: number;
    overdueExposureRupeesFormatted: string;
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
    category: "LOW" | "MEDIUM" | "HIGH";
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
  openInvoicesSummary: Array<{
    invoiceNumber: string;
    issuedAt: string;
    dueDate: string;
    outstandingBalancePaise: number;
    outstandingRupeesFormatted: string;
    isOverdue: boolean;
    overdueDays: number;
  }>;
}
```

### 2.2 Canonical Seed Verification Example (`Mehta Traders`)

When evaluated against the authoritative seed dataset as of `2025-08-26`:
- `outstandingPaise`: `12,400,000` (₹1,24,000)
- `overdueExposurePaise`: `12,400,000` (₹1,24,000, 100% overdue ratio)
- `maxOverdueDays`: `43` (Invoice INV-2408 due `2025-07-14`)
- `openCycleDays`: `61` (Issued `2025-06-26`)
- `historicalBaselinePaymentDays`: `33`
- `openCycleDriftDays`: `28` ($61 - 33$)
- `risk.score`: `95` (Aging $40$ + Drift $35$ + Overdue $20$)
- `risk.category`: `HIGH`
- `priority.score`: `72`
- `recommendation.action`: `ESCALATE_IMMEDIATELY`
- `reasonCodes`: `["HIGH_OVERDUE", "HIGH_EXPOSURE", "CYCLE_DRIFT", "HIGH_CONCENTRATION"]`

---

## 3. Isolated AI Service & Fallback Subsystem

Located at: [`server/src/modules/ai/ai.service.ts`](file:///e:/ops-mitra/server/src/modules/ai/ai.service.ts)

The `AIService` provides three primary capabilities:
1. **Executive Risk Explanation**
2. **Context-Aware Follow-Up Message Drafting**
3. **Simulation Delta Explanations**

### 3.1 Prompt Engineering & Guardrails

System instructions enforce:
- Use of Indian currency conventions (₹, Lakhs, Crores).
- Contextual framing tailored to Indian MSME credit and recovery workflows.
- Absolute prohibition against inventing unverified facts or contradictory figures.
- Direct alignment with the deterministic `recommendation.action` and `reasonCodes`.

### 3.2 Offline & Fallback Engine

When no LLM API key is configured (`GEMINI_API_KEY` / `OPENAI_API_KEY`) or if external API calls fail, the service utilizes rule-driven text synthesis:

```typescript
// Fallback Generator Signatures:
buildFallbackExplanation(evidence: StructuredEvidence): AIExplanationResult
buildFallbackFollowUp(evidence: StructuredEvidence): AIFollowUpResult
buildFallbackSimulationExplanation(
  current: StructuredEvidence,
  simulated: StructuredEvidence,
  recoveryAmountPaise: number
): AISimulationExplanationResult
```

- **Explanation Fallback**: Synthesizes the risk score, primary bottleneck (e.g. 43 days overdue, 28 days cycle drift), and recommendation into clear bullet points.
- **Follow-Up Fallback**: Drafts a structured message mentioning the customer name, outstanding amount in rupees, oldest overdue days, and immediate next steps.
- **Simulation Fallback**: Summarizes the recovered amount, resulting balance reduction, and the corresponding risk score drop.

---

## 4. Deterministic What-If Simulation Engine

Located at: [`server/src/modules/intelligence/simulation.service.ts`](file:///e:/ops-mitra/server/src/modules/intelligence/simulation.service.ts)

The What-If Simulation Engine allows finance managers to model the impact of hypothetical customer payments on their overall credit profile without altering persistent database state.

### 4.1 In-Memory FIFO Debt Allocation Algorithm

```
                 [ Hypothetical Payment: ₹P ]
                              │
                              ▼
            [ Sort Open Invoices by dueDate ASC ]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
       [ Oldest Invoice ]             [ Newer Invoice ]
       Apply min(Bal, P)              Apply Remaining P
               │                             │
               └──────────────┬──────────────┘
                              ▼
           [ Recalculate In-Memory Signals ]
           - New Outstanding Exposure (E_c)
           - New Max Overdue Days (D_c)
           - New Open Cycle Drift (Δ_c)
                              │
                              ▼
       [ Re-run Deterministic Intelligence Engine ]
       - New Risk Score & Category (0 - 100)
       - New Priority Score (0 - 100)
       - New Recommendation & Reason Codes
```

### 4.2 Algorithm Steps

1. **Portfolio Baseline Fetch**: Retrieve current portfolio assessments to preserve portfolio-level normalizers ($E_{\max}$ and $\text{TotalPortfolioLTV}$).
2. **Deep Clone**: Clone open invoices for the target customer in memory.
3. **FIFO Sorting**: Sort invoices in ascending order by `dueDate` (oldest invoices settled first).
4. **Greedy Balance Reduction**:
   $$\text{PaymentApplied}_i = \min(\text{outstandingBalancePaise}_i, \; \text{remainingRecovery})$$
   $$\text{allocatedAmountPaise}_i \leftarrow \text{allocatedAmountPaise}_i + \text{PaymentApplied}_i$$
   $$\text{outstandingBalancePaise}_i \leftarrow \text{outstandingBalancePaise}_i - \text{PaymentApplied}_i$$
   $$\text{remainingRecovery} \leftarrow \text{remainingRecovery} - \text{PaymentApplied}_i$$
5. **Signal & Risk Re-evaluation**:
   - `calculateCustomerSignals(simulatedInvoices)`
   - `evaluateCustomerRisk(simulatedSignals)`
   - `evaluateCustomerPriority(simulatedSignals, simulatedRisk, portfolioContext)`
   - `evaluateCustomerRecommendation(simulatedSignals, simulatedRisk)`
6. **Structured Evidence Generation**: Build and return both `current` and `simulated` evidence objects alongside AI delta insights.

### 4.3 Database Non-Mutation Guarantee

- The simulation service strictly reads from the database.
- It executes zero `INSERT`, `UPDATE`, or `DELETE` SQL queries.
- Automated tests verify table row counts and invoice balances before and after simulation runs.

---

## 5. REST API Specifications

Located at: [`server/src/routes/ai-simulation.ts`](file:///e:/ops-mitra/server/src/routes/ai-simulation.ts)

### 5.1 POST `/api/v1/ai/customers/:id/explanation`

Generates an AI-powered or fallback narrative explanation for a customer's deterministic assessment.

- **URL Parameters**:
  - `id` (integer, required): Customer ID
- **Query Parameters**:
  - `date` (string `YYYY-MM-DD`, optional): Assessment date override (defaults to `2025-08-26`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "evidence": { /* StructuredEvidence */ },
    "explanation": "Mehta Traders presents a HIGH risk profile with a score of 95/100...",
    "keyPoints": [
      "Significant overdue exposure of ₹1,24,000 (100% of total balance).",
      "Payment cycle has drifted 28 days past historical baseline of 33 days.",
      "Oldest invoice is 43 days overdue."
    ],
    "suggestedAction": "Escalate immediately"
  }
}
```

---

### 5.2 POST `/api/v1/ai/customers/:id/follow-up`

Generates a tailored, professional payment follow-up draft using verified facts.

- **URL Parameters**:
  - `id` (integer, required): Customer ID
- **Query Parameters**:
  - `date` (string `YYYY-MM-DD`, optional): Assessment date override
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "evidence": { /* StructuredEvidence */ },
    "message": "Dear Mehta Traders team, we would like to bring to your urgent attention the outstanding balance of ₹1,24,000 which is now 43 days past due..."
  }
}
```

---

### 5.3 POST `/api/v1/simulation/customers/:id`

Executes an in-memory What-If recovery simulation and produces comparative analytics with AI delta explanations.

- **URL Parameters**:
  - `id` (integer, required): Customer ID
- **Query Parameters**:
  - `date` (string `YYYY-MM-DD`, optional): Assessment date override
- **Request Body**:
```json
{
  "recoveryAmountPaise": 12400000
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "customerId": 1,
    "customerName": "Mehta Traders",
    "recoveryAmountPaise": 12400000,
    "current": {
      "financials": { "outstandingPaise": 12400000 },
      "risk": { "score": 95, "category": "HIGH" },
      "recommendation": { "action": "ESCALATE_IMMEDIATELY" }
    },
    "simulated": {
      "financials": { "outstandingPaise": 0 },
      "risk": { "score": 0, "category": "LOW" },
      "recommendation": { "action": "MONITOR" }
    },
    "aiExplanation": {
      "explanation": "Applying a recovery of ₹1,24,000 completely clears Mehta Traders's outstanding exposure. The risk score drops dramatically from 95 (HIGH) to 0 (LOW), transitioning recommended action from ESCALATE_IMMEDIATELY to MONITOR.",
      "keyPoints": [
        "Outstanding balance drops to ₹0.",
        "Overdue debt eliminated.",
        "Account health fully restored."
      ]
    }
  }
}
```

---

## 6. Frontend Integration & User Interface

Located at: [`src/App.tsx`](file:///e:/ops-mitra/src/App.tsx), [`src/lib/api.ts`](file:///e:/ops-mitra/src/lib/api.ts)

### 6.1 Customer Intelligence Drawer
- **AI Explanation Card**: Displays an executive summary, bulleted key risk drivers, and highlighted action tags.
- **Payment Follow-Up Generator**:
  - One-click follow-up draft generation.
  - "Copy to Clipboard" integration.
  - Action-specific communication badges (Urgent Notice, Reminder, Courtesy Check-in).

### 6.2 Interactive What-If Simulation Drawer
- **Dynamic Recovery Slider & Number Input**: Allows users to test payment amounts in Rupees with presets (25%, 50%, 75%, 100% of balance).
- **Side-by-Side Delta Comparison**:
  - Real-time display of Current vs Simulated metrics.
  - Outstanding Balance (₹), Risk Score ($0 - 100$), Risk Category badge, Priority Rank, and Recommended Action.
- **Delta Visualizations**: Color-coded badges indicating risk reductions (e.g. from Red `HIGH 95` to Green `LOW 0`).

---

## 7. Verification & Automated Test Matrix

Test File: [`server/src/test/milestone4.test.ts`](file:///e:/ops-mitra/server/src/test/milestone4.test.ts)  
Combined Test Command: `pnpm test`

```
Test Suite Execution Summary:
═════════════════════════════════════════════════════════════════════════════════
1. Evidence Builder Verification (12 tests)
   - Mehta Traders evidence packet matches DB calculations
   - Financials (₹1,24,000), overdue days (43), drift (28), risk score (95)
   - Reason codes include HIGH_OVERDUE, HIGH_EXPOSURE, CYCLE_DRIFT

2. Deterministic What-If Simulation (10 tests)
   - Full recovery (₹1,24,000): simulated balance = ₹0, risk score = 0 (LOW), action = MONITOR
   - Partial recovery (₹75,000): remaining balance = ₹49,000, risk score re-evaluated accurately

3. Database Non-Mutation Verification (3 tests)
   - Invoices count unchanged in PostgreSQL
   - Payment allocations count unchanged in PostgreSQL
   - Mehta Traders persisted balance remains exactly ₹1,24,000

4. AI Service Fallback Generators (8 tests)
   - Explanation fallback text & key points generation
   - Follow-up fallback mentions customer name, overdue days, and amount
   - Simulation fallback summarizes recovery amount and risk delta

5. REST API Integration Verification (16 tests)
   - POST /api/v1/ai/customers/:id/explanation returns 200 OK + payload
   - POST /api/v1/ai/customers/:id/follow-up returns 200 OK + message
   - POST /api/v1/simulation/customers/:id returns 200 OK + simulation delta
   - Invalid customer ID returns 404 NOT_FOUND

TOTAL: 49 / 49 Tests Passed (100% Accuracy)
═════════════════════════════════════════════════════════════════════════════════
```

---

## 8. Summary of Completed Deliverables

| Component | Status | Description |
| :--- | :--- | :--- |
| `evidence-builder.ts` | **Completed** | Structured fact packet extractor for LLM grounding |
| `ai.service.ts` | **Completed** | Multi-provider AI service with robust deterministic fallback |
| `simulation.service.ts` | **Completed** | In-memory FIFO What-If debt simulation engine |
| `ai-simulation.ts` | **Completed** | Fastify REST API routes for explanation, follow-up, and simulation |
| `milestone4.test.ts` | **Completed** | 49-assertion automated backend test suite |
| `src/lib/api.ts` | **Completed** | Frontend API client with typed simulation & AI methods |
| `src/App.tsx` | **Completed** | Interactive What-If simulation modal and AI drawer UI |
| `docs/milestone-3-ai-simulation-spec.md` | **Completed** | Canonical architecture specification |
