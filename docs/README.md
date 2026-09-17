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
