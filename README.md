# OpsMitra

> Your next business decision, not another dashboard.

[![OpsMitra Showcase](assets/brag.jpg)](assets/brag.mp4)
*Click the image above to watch the OpsMitra product showcase video!*

## Problem

MSMEs generate data across sales, invoices, payments and customers,
but business owners often lack a clear answer to:

"What should I act on next?"

## Solution

OpsMitra converts operational data into prioritized business actions.

Upload → Analyze → Detect → Prioritize → Explain → Simulate → Act

## Key Features

- Receivables intelligence
- Customer risk scoring
- Priority ranking
- Evidence-based AI explanations
- Payment follow-up generation
- What-if recovery simulation
- Deterministic financial calculations
- AI fallback when LLM unavailable

## Example

Mehta Traders:

₹1,24,000 outstanding
43 days overdue
Risk: 95 HIGH
Priority: 72

Recommended action:
Escalate immediately

What if ₹75,000 is recovered?

₹1,24,000 → ₹49,000 outstanding
95 HIGH → 40 MEDIUM
72 → 45 priority

## Architecture

Raw Data
↓
Deterministic Calculations
↓
Business Signals
↓
Risk Engine
↓
Priority Engine
↓
Recommendation
↓
Structured Evidence
↓
LLM Explanation

## Tech Stack

Frontend:
React + TypeScript + Vite + Tailwind

Backend:
Node.js + TypeScript + Fastify

Database:
PostgreSQL

ORM:
Drizzle

Validation:
Zod

AI:
Gemini/OpenAI abstraction with deterministic fallback

## Engineering Principles

- Financial calculations are deterministic.
- LLM does not calculate financial values.
- Simulations never mutate production data.
- Business rules are testable independently.
- AI failure does not break the core product.

## Running Locally

### Backend

cd server
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev

### Frontend

pnpm install
pnpm dev

## Testing

54/54 tests passing.

## Project Status

Hackathon MVP
