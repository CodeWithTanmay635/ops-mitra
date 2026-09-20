# Milestone 5 — Demo Hardening & Final QA Specification

**Document Status**: COMPLETED & FULLY VERIFIED (Hackathon Freeze Ready)  
**Target Modules**: Full Application Stack (`server/src/`, `src/`)  
**Test Suites**: `server/src/test/milestone4.test.ts`, `server/src/test/intelligence.test.ts` (54/54 Tests Passed)

---

## 1. Executive Summary & Freeze Objectives

Milestone 5 represents the final hardening, quality assurance, and verification freeze for OpsMitra prior to submission. No new business features or speculative refactorings were added.

### Freeze Principles
1. **Zero Architecture Drift**: Preserve existing deterministic intelligence calculation engines and isolated AI service layers.
2. **Deterministic Grounding Verification**: Verify that LLM responses remain strictly interpreter-based and never compute financial metrics.
3. **Primary Demo Journey Validation**: Validate end-to-end user workflows from portfolio dashboard overview down to AI explanation and What-If simulation.
4. **Edge-Case Safety Matrix**: Verify graceful handling of zero recovery, full recovery, negative amounts, overflow attempts, invalid customer IDs, and offline AI fallbacks.
5. **Zero Database Mutation Guarantee**: Ensure simulation calls leave PostgreSQL tables completely untouched.

---

## 2. Primary Demo Journey Verification

The canonical demo journey follows **Mehta Traders** (High Risk, Priority #1):

```
[ Dashboard Overview ] ──> Identify Mehta Traders (Priority Rank #1, Risk Score 95, Action: ESCALATE_IMMEDIATELY)
                              │
                              ▼
[ Expand Insight Card ] ──> Click "View details & AI"
                              │
                              ▼
[ AI Explanation ] ────> View "Why this matters", Key Signals Chips & Suggested Action
                              │
                              ▼
[ Draft Follow-Up ] ────> Click "Draft follow-up" -> Render drafted message -> Click "Copy message" (✓ Copied!)
                              │
                              ▼
[ What-If Simulation ] ─> Input ₹75,000 recovery -> Click "Simulate" -> Inspect Current vs Simulated comparison table & AI Impact Summary
```

### Verified Target Metrics for Mehta Traders
- **Outstanding Exposure**: ₹1,24,000 (12,400,000 paise)
- **Maximum Overdue Days**: 43 days
- **Open Cycle Days**: 61 days
- **Historical Baseline**: 18 days
- **Open-Cycle Drift**: 43 days (61 - 18)
- **Risk Score**: 95 (HIGH)
- **Priority Score**: 72
- **Recommended Action**: `ESCALATE_IMMEDIATELY`

---

## 3. What-If Simulation Safety & Non-Mutation

Located at: [`server/src/modules/intelligence/simulation.service.ts`](file:///E:/ops-mitra/server/src/modules/intelligence/simulation.service.ts)

### 3.1 Non-Mutation Proof
Simulation calls execute in-memory debt allocations using cloned invoice data structures:
- `invoices` table row count before and after: **Unchanged**
- `payment_allocations` table row count before and after: **Unchanged**
- Outstanding DB invoice totals before and after: **₹1,24,000**

### 3.2 Recovery Impact Analysis (₹75,000 Simulation)
- **Current Outstanding**: ₹1,24,000 → **Simulated Outstanding**: ₹49,000
- **Current Risk Score**: 95 (HIGH) → **Simulated Risk Score**: 40 (MEDIUM)
- **Current Priority Score**: 72 → **Simulated Priority Score**: 45
- **Current Action**: `ESCALATE_IMMEDIATELY` → **Simulated Action**: `PROACTIVE_CHECKIN`

---

## 4. Edge Cases & Safety Matrix

| Scenario | Input | System Behavior | HTTP Status | Verdict |
|---|---|---|---|---|
| **Zero Recovery** | `recoveryAmountPaise: 0` | Outstanding balance remains ₹1,24,000; risk score remains 95 | 200 OK | ✅ PASS |
| **Exact Outstanding Recovery** | `recoveryAmountPaise: 12400000` | Simulated balance = ₹0; risk score = 0 (LOW); action = MONITOR | 200 OK | ✅ PASS |
| **Excess Recovery** | `recoveryAmountPaise: 20000000` | Simulated balance capped at ₹0; no negative balances | 200 OK | ✅ PASS |
| **Negative Recovery** | `recoveryAmountPaise: -500` | Zod schema rejects non-negative input | 400 Bad Request | ✅ PASS |
| **Overflow Attempt** | `recoveryAmountPaise: 999999999999` | Handled safely without numeric truncation | 200 OK | ✅ PASS |
| **Invalid Customer ID** | `POST /api/v1/ai/customers/99999` | Intelligence lookup returns 404 | 404 Not Found | ✅ PASS |
| **Repeat Simulation** | 2 identical simulation calls | 100% identical JSON outputs produced | 200 OK | ✅ PASS |
| **Offline / Missing API Key** | `GEMINI_API_KEY` unset | Automatic fallback engine generates rule-based text | 200 OK | ✅ PASS |

---

## 5. AI Guardrails & Deterministic Fallback Engine

Located at: [`server/src/modules/ai/ai.service.ts`](file:///E:/ops-mitra/server/src/modules/ai/ai.service.ts)

### Architecture Rules:
1. **Calculations are strictly off-limits to LLMs**: Monetary values, overdue days, risk scores, priority scores, and recommendation rules are computed deterministically before prompt construction.
2. **Supplied Evidence Bounding**: Prompts are constrained to JSON evidence packets.
3. **Deterministic Fallbacks**: In the absence of an API key or upon network timeouts (5s limit), fallback generators return evidence-derived business text, preventing UI crashes.

---

## 6. QA Bugs Identified & Resolved

1. **Header Parsing Issue on Empty-Body POST Requests**:
   - *Symptom*: Calling `POST /api/v1/ai/customers/:id/explanation` sent `Content-Type: application/json` without a request body, causing Fastify to return HTTP 400 (`Body cannot be empty when content-type is set to 'application/json'`).
   - *Fix*: Modified `apiFetchPost` in `src/lib/api.ts` to omit the `Content-Type` header when `payload === undefined`.
2. **Historical Baseline Alignment**:
   - *Symptom*: Seed dataset historical payment date generated a 33-day baseline instead of 18 days.
   - *Fix*: Updated payment received date in `server/src/db/seed.ts` to `"2025-07-20"` for Mehta Traders' historical settled invoice, achieving an exact **18-day baseline** and **43-day open-cycle drift**.

---

## 7. Final Build & Verification Commands

All build and test suites pass 100%:

```powershell
# 1. Backend Test Suite (54/54 Tests Passed)
powershell -ExecutionPolicy Bypass -Command "pnpm --prefix server test"

# 2. Backend Server Build (tsup ESM & DTS)
powershell -ExecutionPolicy Bypass -Command "pnpm --prefix server build"

# 3. Frontend Production Build (Vite Bundle)
powershell -ExecutionPolicy Bypass -Command "pnpm build"
```
