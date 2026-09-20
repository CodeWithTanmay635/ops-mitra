/**
 * src/db/seed.ts
 *
 * Seeds realistic MSME demo data that matches the OpsMitra frontend UI.
 *
 * Run with: pnpm db:seed
 *
 * What "realistic MSME demo data" means:
 * - Customer names match the frontend exactly (Mehta Traders, Patel Electronics, etc.)
 * - Revenue numbers match the frontend chart (₹18.7L for August 2025)
 * - Invoice numbers match (INV-2408 through INV-2421) with correct statuses
 * - DSO (Days Sales Outstanding) is approximately 34 days as shown in the UI
 * - All amounts stored as integer paise (₹1 = 100 paise)
 *
 * Monetary conversion helper:
 *   rupees(18_70_000) means ₹18,70,000 → stored as 187_000_000 paise
 *   rupees(1_24_000)  means ₹1,24,000  → stored as 12_400_000 paise
 *
 * This seed is idempotent: it deletes all existing data before inserting.
 * Safe to run multiple times during development.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { subDays, subMonths, format } from "date-fns";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

// Helper: convert rupee amount to paise (integer)
// Example: rupees(124_000) = 12400000 paise = ₹1,24,000
function rupees(amount: number): number {
  return Math.round(amount * 100);
}

// Helper: format a date as YYYY-MM-DD string for date columns
function dateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// Reference date: we treat "today" as 2025-08-26 to match the frontend's "August 2025"
const TODAY = new Date("2025-08-26");

async function seed() {
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🌱 Starting seed...\n");

  // ── 1. Clear existing data (order matters: FK children before parents) ──────
  console.log("🗑️  Clearing existing data...");
  await db.delete(schema.paymentAllocations);
  await db.delete(schema.payments);
  await db.delete(schema.invoices);
  await db.delete(schema.sales);
  await db.delete(schema.customers);
  console.log("   ✓ Tables cleared\n");

  // ── 2. Customers ─────────────────────────────────────────────────────────────
  // These names match the OpsMitra frontend exactly.
  console.log("👥 Seeding customers...");
  const insertedCustomers = await db
    .insert(schema.customers)
    .values([
      {
        name: "Mehta Traders",
        region: "North",
        gstin: "07AAACM1234A1Z5",
        phone: "+91-9811001100",
        email: "accounts@mehtatraders.com",
      },
      {
        name: "Patel Electronics",
        region: "West",
        gstin: "24AAACP5678B1Z3",
        phone: "+91-9820002200",
        email: "purchase@patelelectronics.in",
      },
      {
        name: "Singh & Co",
        region: "South",
        gstin: "29AAACS9012C1Z1",
        phone: "+91-9844003300",
        email: "finance@singhandco.com",
      },
      {
        name: "Gupta & Sons",
        region: "East",
        gstin: "19AAACG3456D1Z9",
        phone: "+91-9830004400",
        email: "billing@guptasons.com",
      },
      {
        name: "Kapoor Textiles",
        region: "West",
        gstin: "24AAACK7890E1Z7",
        phone: "+91-9821005500",
        email: "accounts@kapoortextiles.com",
      },
    ])
    .returning();

  // Map name → id for easy reference below
  const custByName = Object.fromEntries(
    insertedCustomers.map((c) => [c.name, c.id])
  ) as Record<string, number>;

  console.log(`   ✓ ${insertedCustomers.length} customers inserted`);
  insertedCustomers.forEach((c) => console.log(`     - [${c.id}] ${c.name}`));
  console.log();

  // ── 3. Sales ─────────────────────────────────────────────────────────────────
  // Historical monthly sales matching the revenue chart in the frontend:
  // Sep→Aug: 8.2, 9.4, 7.8, 10.1, 11.3, 12.8, 10.9, 13.4, 15.2, 14.8, 16.1, 18.7 (lakhs)
  // (months are Sep 2024 through Aug 2025)
  console.log("💰 Seeding historical sales...");

  // Monthly revenue targets in rupees (from frontend RevenueBar data)
  const monthlyRevenue = [
    { monthsAgo: 11, amountRupees: 820_000 },   // Sep 2024: ₹8.2L
    { monthsAgo: 10, amountRupees: 940_000 },   // Oct 2024: ₹9.4L
    { monthsAgo: 9,  amountRupees: 780_000 },   // Nov 2024: ₹7.8L
    { monthsAgo: 8,  amountRupees: 1_010_000 }, // Dec 2024: ₹10.1L
    { monthsAgo: 7,  amountRupees: 1_130_000 }, // Jan 2025: ₹11.3L
    { monthsAgo: 6,  amountRupees: 1_280_000 }, // Feb 2025: ₹12.8L
    { monthsAgo: 5,  amountRupees: 1_090_000 }, // Mar 2025: ₹10.9L
    { monthsAgo: 4,  amountRupees: 1_340_000 }, // Apr 2025: ₹13.4L
    { monthsAgo: 3,  amountRupees: 1_520_000 }, // May 2025: ₹15.2L
    { monthsAgo: 2,  amountRupees: 1_480_000 }, // Jun 2025: ₹14.8L
    { monthsAgo: 1,  amountRupees: 1_610_000 }, // Jul 2025: ₹16.1L
    { monthsAgo: 0,  amountRupees: 1_870_000 }, // Aug 2025: ₹18.7L (current month)
  ];

  // Distribute each month's revenue across the 5 customers
  const customerIds = insertedCustomers.map((c) => c.id);

  // Fixed distribution percentages (adds to 100%)
  // Matches approximate LTV proportions from the frontend customers list
  const dist = [0.32, 0.22, 0.18, 0.15, 0.13]; // Mehta, Patel, Singh, Gupta, Kapoor

  const salesValues: schema.NewSale[] = [];
  for (const month of monthlyRevenue) {
    const saleDate = subMonths(TODAY, month.monthsAgo);
    // Set to the 10th of that month for a clean date
    saleDate.setDate(10);

    for (let i = 0; i < customerIds.length; i++) {
      const portion = dist[i] ?? 0.2;
      salesValues.push({
        customerId: customerIds[i] as number,
        saleDate: dateStr(saleDate),
        totalAmountPaise: rupees(Math.round(month.amountRupees * portion)),
        notes: `Monthly order — ${format(saleDate, "MMM yyyy")}`,
      });
    }
  }

  const insertedSales = await db
    .insert(schema.sales)
    .values(salesValues)
    .returning({ id: schema.sales.id });

  console.log(`   ✓ ${insertedSales.length} sales records inserted\n`);

  // ── 4. Invoices ──────────────────────────────────────────────────────────────
  // These specific invoice numbers match the OpsMitra frontend DataTable exactly.
  // Statuses: INV-2408 → overdue, INV-2412 → pending, INV-2415 → pending,
  //           INV-2418 → paid, INV-2421 → pending
  console.log("🧾 Seeding invoices...");

  const mehta = custByName["Mehta Traders"] as number;
  const patel = custByName["Patel Electronics"] as number;
  const singh = custByName["Singh & Co"] as number;
  const gupta = custByName["Gupta & Sons"] as number;
  const kapoor = custByName["Kapoor Textiles"] as number;

  // Frontend shows: Aug 2025 dates, 43-day overdue for Mehta, 30-day pending for others
  const invoiceData: schema.NewInvoice[] = [
    {
      // INV-2408: Mehta Traders — OVERDUE (43 days overdue as of Aug 26)
      // Issued Jun 26, due Jul 26, now 43 days past due
      customerId: mehta,
      invoiceNumber: "INV-2408",
      issuedAt: "2025-06-26",
      dueDate: "2025-07-14",
      totalAmountPaise: rupees(240_000), // ₹2,40,000 (matches insight card)
      paidAmountPaise: rupees(116_000),  // partial payment received
      status: "overdue",
      notes: "Industrial components batch — Q2",
    },
    {
      // INV-2412: Patel Electronics — PENDING (30 days, due ~Sep 14)
      customerId: patel,
      invoiceNumber: "INV-2412",
      issuedAt: "2025-08-15",
      dueDate: "2025-09-14",
      totalAmountPaise: rupees(87_400),
      paidAmountPaise: 0,
      status: "sent",
      notes: "Electronic components — August batch",
    },
    {
      // INV-2415: Gupta & Sons — PENDING (30 days, due ~Sep 17)
      customerId: gupta,
      invoiceNumber: "INV-2415",
      issuedAt: "2025-08-18",
      dueDate: "2025-09-17",
      totalAmountPaise: rupees(231_000),
      paidAmountPaise: 0,
      status: "sent",
      notes: "Wholesale goods — August shipment",
    },
    {
      // INV-2418: Singh & Co — PAID
      customerId: singh,
      invoiceNumber: "INV-2418",
      issuedAt: "2025-08-20",
      dueDate: "2025-09-19",
      totalAmountPaise: rupees(56_800),
      paidAmountPaise: rupees(56_800), // fully paid
      status: "paid",
      notes: "Consulting services — August",
    },
    {
      // INV-2421: Kapoor Textiles — PENDING (30 days, due ~Sep 21)
      customerId: kapoor,
      invoiceNumber: "INV-2421",
      issuedAt: "2025-08-22",
      dueDate: "2025-09-21",
      totalAmountPaise: rupees(108_500),
      paidAmountPaise: 0,
      status: "sent",
      notes: "Textile materials — August order",
    },
    // Additional historical invoices to support realistic DSO calculation (~34 days)
    {
      customerId: mehta,
      invoiceNumber: "INV-2401",
      issuedAt: dateStr(subDays(TODAY, 55)),
      dueDate: dateStr(subDays(TODAY, 25)),
      totalAmountPaise: rupees(186_000),
      paidAmountPaise: rupees(186_000),
      status: "paid",
      notes: "Q1 industrial components",
    },
    {
      customerId: patel,
      invoiceNumber: "INV-2402",
      issuedAt: dateStr(subDays(TODAY, 50)),
      dueDate: dateStr(subDays(TODAY, 20)),
      totalAmountPaise: rupees(74_200),
      paidAmountPaise: rupees(74_200),
      status: "paid",
    },
    {
      customerId: singh,
      invoiceNumber: "INV-2403",
      issuedAt: dateStr(subDays(TODAY, 48)),
      dueDate: dateStr(subDays(TODAY, 18)),
      totalAmountPaise: rupees(92_000),
      paidAmountPaise: rupees(92_000),
      status: "paid",
    },
    {
      customerId: gupta,
      invoiceNumber: "INV-2404",
      issuedAt: dateStr(subDays(TODAY, 45)),
      dueDate: dateStr(subDays(TODAY, 15)),
      totalAmountPaise: rupees(198_000),
      paidAmountPaise: rupees(198_000),
      status: "paid",
    },
    {
      customerId: kapoor,
      invoiceNumber: "INV-2405",
      issuedAt: dateStr(subDays(TODAY, 40)),
      dueDate: dateStr(subDays(TODAY, 10)),
      totalAmountPaise: rupees(84_600),
      paidAmountPaise: rupees(84_600),
      status: "paid",
    },
  ];

  const insertedInvoices = await db
    .insert(schema.invoices)
    .values(invoiceData)
    .returning();

  console.log(`   ✓ ${insertedInvoices.length} invoices inserted`);
  insertedInvoices.forEach((inv) =>
    console.log(
      `     - ${inv.invoiceNumber} | ${inv.status} | ₹${(inv.totalAmountPaise / 100).toLocaleString("en-IN")}`
    )
  );
  console.log();

  // ── 5. Payments ───────────────────────────────────────────────────────────────
  console.log("💳 Seeding payments...");

  // Map invoice number → id for allocation references
  const invByNumber = Object.fromEntries(
    insertedInvoices.map((inv) => [inv.invoiceNumber, inv.id])
  ) as Record<string, number>;

  const paymentData: schema.NewPayment[] = [
    // Partial payment on the overdue Mehta invoice (INV-2408)
    {
      customerId: mehta,
      receivedAt: "2025-07-20",
      amountPaise: rupees(116_000),
      method: "bank_transfer",
      reference: "UTR2025072012345",
      notes: "Partial payment against INV-2408",
    },
    // Full payment for Singh INV-2418
    {
      customerId: singh,
      receivedAt: "2025-08-22",
      amountPaise: rupees(56_800),
      method: "upi",
      reference: "UPI202508221234567890",
      notes: "Full payment INV-2418",
    },
    // Historical payments for older invoices
    {
      customerId: mehta,
      receivedAt: "2025-07-20", // Issued 2025-07-02 (subDays 55) -> 18 days baseline
      amountPaise: rupees(186_000),
      method: "neft",
      reference: "NEFT20250720001",
    },
    {
      customerId: patel,
      receivedAt: dateStr(subDays(TODAY, 17)),
      amountPaise: rupees(74_200),
      method: "upi",
      reference: "UPI20250809002",
    },
    {
      customerId: singh,
      receivedAt: dateStr(subDays(TODAY, 15)),
      amountPaise: rupees(92_000),
      method: "cheque",
      reference: "CHQ0045821",
    },
    {
      customerId: gupta,
      receivedAt: dateStr(subDays(TODAY, 12)),
      amountPaise: rupees(198_000),
      method: "bank_transfer",
      reference: "UTR2025081400567",
    },
    {
      customerId: kapoor,
      receivedAt: dateStr(subDays(TODAY, 8)),
      amountPaise: rupees(84_600),
      method: "upi",
      reference: "UPI20250818003",
    },
  ];

  const insertedPayments = await db
    .insert(schema.payments)
    .values(paymentData)
    .returning();

  console.log(`   ✓ ${insertedPayments.length} payments inserted\n`);

  // ── 6. Payment Allocations ────────────────────────────────────────────────────
  console.log("🔗 Seeding payment allocations...");

  // Allocate each payment to its corresponding invoice(s)
  const allocations: schema.NewPaymentAllocation[] = [
    // Payment[0]: ₹1,16,000 partial → INV-2408
    {
      paymentId: insertedPayments[0]!.id,
      invoiceId: invByNumber["INV-2408"] as number,
      allocatedAmountPaise: rupees(116_000),
    },
    // Payment[1]: ₹56,800 full → INV-2418
    {
      paymentId: insertedPayments[1]!.id,
      invoiceId: invByNumber["INV-2418"] as number,
      allocatedAmountPaise: rupees(56_800),
    },
    // Payment[2]: ₹1,86,000 → INV-2401
    {
      paymentId: insertedPayments[2]!.id,
      invoiceId: invByNumber["INV-2401"] as number,
      allocatedAmountPaise: rupees(186_000),
    },
    // Payment[3]: ₹74,200 → INV-2402
    {
      paymentId: insertedPayments[3]!.id,
      invoiceId: invByNumber["INV-2402"] as number,
      allocatedAmountPaise: rupees(74_200),
    },
    // Payment[4]: ₹92,000 → INV-2403
    {
      paymentId: insertedPayments[4]!.id,
      invoiceId: invByNumber["INV-2403"] as number,
      allocatedAmountPaise: rupees(92_000),
    },
    // Payment[5]: ₹1,98,000 → INV-2404
    {
      paymentId: insertedPayments[5]!.id,
      invoiceId: invByNumber["INV-2404"] as number,
      allocatedAmountPaise: rupees(198_000),
    },
    // Payment[6]: ₹84,600 → INV-2405
    {
      paymentId: insertedPayments[6]!.id,
      invoiceId: invByNumber["INV-2405"] as number,
      allocatedAmountPaise: rupees(84_600),
    },
  ];

  const insertedAllocations = await db
    .insert(schema.paymentAllocations)
    .values(allocations)
    .returning();

  console.log(`   ✓ ${insertedAllocations.length} payment allocations inserted\n`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("✅ Seed complete!\n");
  console.log("Summary:");
  console.log(`  Customers:           ${insertedCustomers.length}`);
  console.log(`  Sales records:       ${insertedSales.length}`);
  console.log(`  Invoices:            ${insertedInvoices.length}`);
  console.log(`  Payments:            ${insertedPayments.length}`);
  console.log(`  Payment allocations: ${insertedAllocations.length}`);
  console.log();
  console.log("All monetary amounts are stored as integer paise.");
  console.log("Divide by 100 to get rupees at the API boundary.");

  await client.end();
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
