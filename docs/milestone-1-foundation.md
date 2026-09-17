# Milestone 1 — Backend Infrastructure & Foundation

Milestone 1 establishes the deterministic data layer, server foundation, error handling, and seed data for **OpsMitra**.

---

## 1. Technology Stack & Toolchain

- **Runtime**: Node.js v22+
- **Language**: TypeScript 5.7+ (Target: ES2022, bundler module resolution)
- **Web Framework**: Fastify v5 (with `@fastify/sensible` and `@fastify/cors`)
- **Database Driver**: `postgres.js` (`postgres` package v3.4+)
- **ORM & Migrations**: Drizzle ORM v0.41+ & `drizzle-kit` v0.30+
- **Validation**: Zod v3.24+
- **Date Utilities**: `date-fns` v4.1+
- **Package Manager**: `pnpm` v12+

---

## 2. Directory Structure

```text
server/
├── drizzle/                               # Generated SQL migrations
│   ├── 0000_giant_charles_xavier.sql
│   └── meta/
├── dist/                                  # Production bundle (tsup)
├── src/
│   ├── config/
│   │   └── env.ts                         # Zod-validated environment config
│   ├── db/
│   │   ├── index.ts                       # Drizzle client & connection pool
│   │   ├── schema.ts                      # Domain tables + enums (Paise-based)
│   │   └── seed.ts                        # Idempotent MSME seed script
│   ├── plugins/
│   │   └── errorHandler.ts                # Centralized Fastify error handler
│   ├── routes/
│   │   └── health.ts                      # GET /health check endpoint
│   └── index.ts                           # Server entrypoint & graceful shutdown
├── .env / .env.example
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Database Schema Design

### Key Architectural Decisions
1. **Integer Paise Storage**: All monetary fields use `BIGINT` (in TypeScript: `number`) stored as integer paise (₹1 = 100 paise). Avoids all floating-point rounding errors.
2. **Serial Primary Keys**: Simple, performant auto-incrementing IDs (`serial`).
3. **Mode: "string" Timestamps & Dates**: Dates are stored in `YYYY-MM-DD` and ISO strings to prevent Node.js timezone truncation.
4. **Authoritative Junction Table**: `payment_allocations` cleanly models split payments across multiple invoices and multi-payment settlements.

### Domain Tables

- **`customers`**: `id`, `name`, `region`, `gstin`, `phone`, `email`, `created_at`
- **`sales`**: `id`, `customer_id` (FK), `sale_date`, `total_amount_paise`, `notes`, `created_at`
- **`invoices`**: `id`, `customer_id` (FK), `sale_id` (FK, nullable), `invoice_number` (UNIQUE), `issued_at`, `due_date`, `total_amount_paise`, `paid_amount_paise`, `status` (`draft` | `sent` | `partial` | `paid` | `overdue`), `notes`, `created_at`
- **`payments`**: `id`, `customer_id` (FK), `received_at`, `amount_paise`, `method` (`cash` | `upi` | `bank_transfer` | `cheque` | `neft` | `rtgs`), `reference`, `notes`, `created_at`
- **`payment_allocations`**: `id`, `payment_id` (FK), `invoice_id` (FK), `allocated_amount_paise`, `created_at`

---

## 4. Seed Data

Seed script (`server/src/db/seed.ts`) populates:
- **5 Core MSME Customers**: Mehta Traders (North), Patel Electronics (West), Singh & Co (South), Gupta & Sons (East), Kapoor Textiles (West).
- **60 Monthly Sales Records**: 12-month revenue curve matching frontend chart (Sep 2024: ₹8.2L $\rightarrow$ Aug 2025: ₹18.7L, Total: ₹1.487 Cr).
- **Target Invoices**:
  - `INV-2408` (Mehta Traders): Total ₹2,40,000, Paid ₹1,16,000, Outstanding ₹1,24,000, Status: `overdue` (43 days past due).
  - `INV-2412` (Patel Electronics): Total ₹87,400, Outstanding ₹87,400, Status: `sent`.
  - `INV-2415` (Gupta & Sons): Total ₹2,31,000, Outstanding ₹2,31,000, Status: `sent`.
  - `INV-2418` (Singh & Co): Total ₹56,800, Paid ₹56,800, Outstanding ₹0, Status: `paid`.
  - `INV-2421` (Kapoor Textiles): Total ₹1,08,500, Outstanding ₹1,08,500, Status: `sent`.
- **Payment Allocations**: Allocated payments for `INV-2408` (₹1,16,000) and `INV-2418` (₹56,800).

---

## 5. Health Check & Error Handling

- **`GET /health`**: Returns HTTP 200 with `{ status: "ok", timestamp: "...", uptime: ..., db: "ok" }` when PostgreSQL is healthy, or HTTP 503 with `{ status: "error", db: "error" }` when disconnected.
- **Centralized Error Handler**: Translates `ZodError` to HTTP 400 with structured field errors, client errors to 4xx, and unhandled server errors to structured 500 JSON.
