/**
 * src/db/schema.ts
 *
 * All Drizzle ORM table definitions for OpsMitra.
 *
 * Design decisions:
 *
 * 1. BIGINT for all monetary amounts (stored as integer paise).
 *    ₹18,700 = 1,870,000 paise. No floating-point precision problems.
 *    Convert to rupees only at the API boundary: paise / 100.
 *    All amount columns are named *Paise to make the unit explicit.
 *
 * 2. No derived/intelligence fields in this schema.
 *    Risk scores, overdue risk, priority scores, recommendations
 *    belong to the Intelligence milestone and will be computed by the
 *    deterministic engine, not persisted here.
 *
 * 3. timestamps use mode: "string" so Drizzle returns ISO strings, not
 *    Date objects. Date objects in Node.js lose timezone info — ISO strings
 *    are safer to serialise to JSON.
 *
 * 4. Every table has a serial primary key (auto-increment integer).
 *    Simple, fast, and easy to explain. UUIDs add no value at hackathon scale.
 *
 * 5. Invoice.status uses a pgEnum to enforce the allowed set at the DB level —
 *    not just in application code.
 */

import {
  bigint,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Invoice lifecycle states.
 * draft    — created but not sent to customer yet
 * sent     — delivered to customer, payment not yet received
 * partial  — partial payment received, balance outstanding
 * paid     — fully paid
 * overdue  — past due date with balance outstanding
 */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
]);

/**
 * Payment method options for Indian MSME context.
 */
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "upi",
  "bank_transfer",
  "cheque",
  "neft",
  "rtgs",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * customers — The businesses or individuals that purchase from the MSME owner.
 *
 * gstin: GST Identification Number — 15-char alphanumeric. Optional because
 *        some small buyers may not be GST-registered.
 * region: Used for regional sales breakdown shown on the Insights screen.
 */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(), // e.g. "North", "West", "South", "East", "Central"
  gstin: text("gstin"), // nullable — not all customers are GST-registered
  phone: text("phone"), // nullable — contact number
  email: text("email"), // nullable
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

/**
 * sales — A sale event. One sale can produce one or more invoices.
 *
 * totalAmountPaise: Total value of goods/services sold.
 *                   Stored as integer paise (₹1 = 100 paise).
 */
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  customerId: serial("customer_id")
    .notNull()
    .references(() => customers.id),
  saleDate: date("sale_date", { mode: "string" }).notNull(), // YYYY-MM-DD
  totalAmountPaise: bigint("total_amount_paise", { mode: "number" }).notNull(), // integer paise
  notes: text("notes"), // optional free-text description of goods/services
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

/**
 * invoices — A request for payment issued to a customer.
 *
 * invoiceNumber: Human-readable identifier (e.g. "INV-2408"). Unique.
 * issuedAt:      Date the invoice was issued.
 * dueDate:       Payment due date. Used to calculate days-past-due.
 * totalAmountPaise: Full invoice value in paise.
 * paidAmountPaise:  Amount received so far in paise. Defaults to 0.
 *                   Outstanding = total - paid.
 * status:        Enforced by pgEnum above.
 *
 * saleId is nullable: invoices can exist without a linked sale record
 * (e.g. imported from legacy data).
 */
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  customerId: serial("customer_id")
    .notNull()
    .references(() => customers.id),
  saleId: bigint("sale_id", { mode: "number" }).references(() => sales.id), // nullable
  invoiceNumber: text("invoice_number").notNull().unique(),
  issuedAt: date("issued_at", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  totalAmountPaise: bigint("total_amount_paise", { mode: "number" }).notNull(),
  paidAmountPaise: bigint("paid_amount_paise", { mode: "number" })
    .notNull()
    .default(0),
  status: invoiceStatusEnum("status").notNull().default("sent"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

/**
 * payments — A payment received from a customer.
 *
 * A single payment can be allocated across multiple invoices
 * (e.g. a customer pays ₹1L which covers Invoice A fully and Invoice B partially).
 * The payment_allocations table handles this many-to-many relationship.
 *
 * amountPaise: Total amount of this payment in paise.
 * reference:   Cheque number, UTR number, UPI transaction ID, etc.
 */
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: serial("customer_id")
    .notNull()
    .references(() => customers.id),
  receivedAt: date("received_at", { mode: "string" }).notNull(),
  amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  reference: text("reference"), // nullable — UTR, cheque no., etc.
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

/**
 * payment_allocations — Links payments to invoices.
 *
 * When a payment is received, the business owner allocates it to specific
 * invoices. This table records those allocations.
 *
 * allocatedAmountPaise: The portion of the payment applied to this invoice.
 *                       Sum of all allocations for a payment <= payment amount.
 *
 * Why a separate table?
 * One payment can pay off multiple invoices.
 * One invoice can be paid by multiple payments (partial payments).
 * This junction table cleanly models both scenarios.
 */
export const paymentAllocations = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  paymentId: serial("payment_id")
    .notNull()
    .references(() => payments.id),
  invoiceId: serial("invoice_id")
    .notNull()
    .references(() => invoices.id),
  allocatedAmountPaise: bigint("allocated_amount_paise", {
    mode: "number",
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────
// Drizzle infers TypeScript types directly from the table definitions.
// $inferSelect = the shape of a row read from the DB.
// $inferInsert = the shape of data you pass when inserting.

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type NewPaymentAllocation = typeof paymentAllocations.$inferInsert;
