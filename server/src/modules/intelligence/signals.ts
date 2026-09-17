/**
 * src/modules/intelligence/signals.ts
 *
 * Deterministic business signals calculation functions.
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import type {
  CustomerSignals,
  InvoiceWithAllocation,
  SettledInvoiceHistory,
} from "./types.js";

/**
 * Calculates deterministic business signals for a customer as of assessmentDate.
 */
export function calculateCustomerSignals(params: {
  customerId: number;
  customerName: string;
  assessmentDate: string; // YYYY-MM-DD or ISO
  invoices: InvoiceWithAllocation[];
  settledHistory: SettledInvoiceHistory[];
  customerLTVPaise: number;
  totalPortfolioLTVPaise: number;
}): CustomerSignals {
  const {
    customerId,
    customerName,
    assessmentDate,
    invoices,
    settledHistory,
    customerLTVPaise,
    totalPortfolioLTVPaise,
  } = params;

  const assessmentDt = parseISO(assessmentDate);

  // Filter strictly open invoices (where outstandingBalancePaise > 0)
  const openInvoices = invoices.filter((inv) => inv.outstandingBalancePaise > 0);

  // 1. Outstanding Exposure (Ec)
  const outstandingExposurePaise = openInvoices.reduce(
    (sum, inv) => sum + inv.outstandingBalancePaise,
    0
  );

  // 2. Overdue Exposure and Max Overdue Days (Dc)
  let overdueExposurePaise = 0;
  let maxOverdueDays = 0;
  let hasUpcomingInvoiceWithin5Days = false;
  let oldestOpenIssuedAt: Date | null = null;

  for (const inv of openInvoices) {
    const dueDt = parseISO(inv.dueDate);
    const issuedDt = parseISO(inv.issuedAt);

    const overdueDays = Math.max(0, differenceInCalendarDays(assessmentDt, dueDt));
    const daysUntilDue = differenceInCalendarDays(dueDt, assessmentDt);

    if (overdueDays > 0) {
      overdueExposurePaise += inv.outstandingBalancePaise;
      if (overdueDays > maxOverdueDays) {
        maxOverdueDays = overdueDays;
      }
    }

    if (daysUntilDue >= 0 && daysUntilDue <= 5) {
      hasUpcomingInvoiceWithin5Days = true;
    }

    if (!oldestOpenIssuedAt || issuedDt < oldestOpenIssuedAt) {
      oldestOpenIssuedAt = issuedDt;
    }
  }

  // 3. Overdue Exposure Ratio (Rc)
  const overdueExposureRatio =
    outstandingExposurePaise > 0
      ? overdueExposurePaise / outstandingExposurePaise
      : 0;

  // 4. Open-Cycle Days (OCc)
  const openCycleDays =
    openInvoices.length > 0 && oldestOpenIssuedAt
      ? Math.max(0, differenceInCalendarDays(assessmentDt, oldestOpenIssuedAt))
      : 0;

  // 5. Historical Baseline Payment Days (P_bar)
  let historicalBaselinePaymentDays: number | null = null;
  let baselineAvailable = false;

  if (settledHistory.length > 0) {
    const totalDays = settledHistory.reduce((sum, item) => sum + item.elapsedDays, 0);
    historicalBaselinePaymentDays = totalDays / settledHistory.length;
    baselineAvailable = true;
  }

  // 6. Open-Cycle Drift (Delta_c)
  let openCycleDriftDays = 0;
  if (openInvoices.length > 0 && baselineAvailable && historicalBaselinePaymentDays !== null) {
    openCycleDriftDays = Math.max(0, openCycleDays - historicalBaselinePaymentDays);
  }

  // 7. Customer Revenue Concentration Ratio (Cc)
  const revenueConcentrationRatio =
    totalPortfolioLTVPaise > 0
      ? (customerLTVPaise / totalPortfolioLTVPaise) * 100
      : 0;

  return {
    customerId,
    customerName,
    outstandingExposurePaise,
    overdueExposurePaise,
    overdueExposureRatio,
    maxOverdueDays,
    openCycleDays,
    historicalBaselinePaymentDays,
    baselineAvailable,
    openCycleDriftDays,
    customerLTVPaise,
    revenueConcentrationRatio,
    openInvoicesCount: openInvoices.length,
    hasUpcomingInvoiceWithin5Days,
  };
}
