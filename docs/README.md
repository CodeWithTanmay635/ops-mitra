# OpsMitra Documentation

This directory contains the canonical specifications, architecture documents, and milestone progression guides for **OpsMitra** (AI-Powered Business Operations Intelligence for MSMEs).

---

## Documentation Index

1. [Milestone 1 — Backend Infrastructure & Foundation](./milestone-1-foundation.md)
   - Tech stack (Fastify, PostgreSQL, Drizzle ORM, Zod, date-fns, pnpm)
   - Database schema (Tables, Enums, Constraints, Paise-based integer monetary storage)
   - Seed dataset matching frontend UI
   - Health check & centralized error handling
   - Toolchain and verification commands

2. [Milestone 2 — Receivables Intelligence Engine Specification](./milestone-2-intelligence-spec.md)
   - Deterministic Business Signals
   - Corrected Risk Score Model ($0 - 100$ Vulnerability Index)
   - Corrected Priority Score Model ($0 - 100$ Action Urgency Index)
   - Deterministic Recommendation Matrix (Rules 1–5)
   - Canonical Reason Codes Catalog
   - Data Source of Truth Rules (`PaymentAllocation` authoritative balance)
   - Recalculated Seed Evaluation as of `2025-08-26`

3. [Milestone 3 — AI Explanation, Follow-Up Generation & What-If Simulation Engine](./milestone-3-ai-simulation-spec.md)
   - Structured Evidence Builder (`evidence-builder.ts`)
   - Isolated AI Service with zero hallucination guardrails (`ai.service.ts`)
   - 100% Deterministic Fallback Engine (Zero-downtime offline guarantee)
   - In-Memory What-If Financial Simulation & FIFO Allocation (`simulation.service.ts`)
   - Zero Database Mutation Contract & Verification
   - Fastify REST API Routes (`/api/v1/ai/*`, `/api/v1/simulation/*`)
   - Frontend Interactive Simulator & Customer AI Drawer UI

4. [Milestone 4 — AI Explanation & What-If Simulation Specification](./milestone-4-ai-explanation-simulation.md)
   - Comprehensive technical architecture & core rules
   - Structured evidence packets & evidence builder
   - AI service abstraction & deterministic fallback subsystem
   - In-memory simulation engine & FIFO recovery model
   - Fastify REST API endpoints & frontend UI components
   - Test suite verification results (49/49 tests passed)

5. [Milestone 5 — Demo Hardening & Final QA Specification](./milestone-5-demo-hardening.md)
   - Freeze objectives & core principles
   - Primary demo journey validation (Mehta Traders end-to-end)
   - Simulation safety & zero database mutation proof
   - Edge-case safety matrix (8/8 scenarios verified)
   - AI guardrails & deterministic fallback engine
   - Resolved QA bugs & final build verification (54/54 tests passed)



