/**
 * src/modules/intelligence/intelligence.service.ts
 *
 * Coordinates data ingestion from DB and executes the deterministic intelligence pipeline.
 */

import { differenceInCalendarDays, parseISO } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { calculateCustomerSignals } from "./signals.js";
import { evaluateCustomerRisk } from "./risk-engine.js";
import { evaluateCustomerPriority } from "./priority-engine.js";
import {
  DEFAULT_HIGH_EXPOSURE_THRESHOLD_PAISE,
  evaluateCustomerRecommendation,
} from "./recommendation-engine.js";
import type {
  CustomerAssessment,
  InvoiceWithAllocation,
  PortfolioAssessment,
  SettledInvoiceHistory,
} from "./types.js";

export const DEFAULT_ASSESSMENT_DATE = "2025-08-26";

export class IntelligenceService {
  /**
   * Assesses the entire customer portfolio.
   */
  async assessPortfolio(params?: {
    assessmentDate?: string;
    highExposureThresholdPaise?: number;
  }): Promise<PortfolioAssessment> {
    const assessmentDate = params?.assessmentDate ?? DEFAULT_ASSESSMENT_DATE;
    const highExposureThresholdPaise =
      params?.highExposureThresholdPaise ?? DEFAULT_HIGH_EXPOSURE_THRESHOLD_PAISE;

    // 1. Fetch all customers, sales, invoices, payments, and allocations
    const [allCustomers, allSales, allInvoices, allPayments, allAllocations] =
      await Promise.all([
        db.select().from(schema.customers),
        db.select().from(schema.sales),
        db.select().from(schema.invoices),
        db.select().from(schema.payments),
        db.select().from(schema.paymentAllocations),
      ]);

    // Build allocation sum map by invoiceId: invoiceId -> totalAllocatedPaise
    const allocationByInvoice = new Map<number, number>();
    for (const alloc of allAllocations) {
      const current = allocationByInvoice.get(alloc.invoiceId) ?? 0;
      allocationByInvoice.set(alloc.invoiceId, current + alloc.allocatedAmountPaise);
    }

    // Build customer LTV map from sales
    const ltvByCustomer = new Map<number, number>();
    let totalPortfolioLTVPaise = 0;
    for (const sale of allSales) {
      const current = ltvByCustomer.get(sale.customerId) ?? 0;
      ltvByCustomer.set(sale.customerId, current + sale.totalAmountPaise);
      totalPortfolioLTVPaise += sale.totalAmountPaise;
    }

    // Map payments by customer and paymentId for history resolution
    const paymentById = new Map<number, schema.Payment>();
    for (const p of allPayments) {
      paymentById.set(p.id, p);
    }

    // Pre-calculate invoices with authoritative allocations for each customer
    const assessmentDt = parseISO(assessmentDate);
    const invoicesByCustomer = new Map<number, InvoiceWithAllocation[]>();
    const settledHistoryByCustomer = new Map<number, SettledInvoiceHistory[]>();

    for (const inv of allInvoices) {
      const allocatedPaise = allocationByInvoice.get(inv.id) ?? 0;
      const outstandingBalancePaise = Math.max(0, inv.totalAmountPaise - allocatedPaise);

      const dueDt = parseISO(inv.dueDate);
      const overdueDays = Math.max(0, differenceInCalendarDays(assessmentDt, dueDt));
      const daysUntilDue = differenceInCalendarDays(dueDt, assessmentDt);
      const isOverdue = overdueDays > 0 && outstandingBalancePaise > 0;

      const invoiceWithAlloc: InvoiceWithAllocation = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
        totalAmountPaise: inv.totalAmountPaise,
        allocatedAmountPaise: allocatedPaise,
        outstandingBalancePaise,
        isOverdue,
        overdueDays: isOverdue ? overdueDays : 0,
        daysUntilDue,
      };

      const list = invoicesByCustomer.get(inv.customerId) ?? [];
      list.push(invoiceWithAlloc);
      invoicesByCustomer.set(inv.customerId, list);

      // If fully settled, find associated payment date to compute historical baseline
      if (outstandingBalancePaise === 0) {
        // Find allocation
        const alloc = allAllocations.find((a) => a.invoiceId === inv.id);
        if (alloc) {
          const payment = paymentById.get(alloc.paymentId);
          if (payment) {
            const issuedDt = parseISO(inv.issuedAt);
            const receivedDt = parseISO(payment.receivedAt);
            const elapsedDays = Math.max(0, differenceInCalendarDays(receivedDt, issuedDt));

            const historyList = settledHistoryByCustomer.get(inv.customerId) ?? [];
            historyList.push({
              id: inv.id,
              issuedAt: inv.issuedAt,
              paymentReceivedAt: payment.receivedAt,
              elapsedDays,
            });
            settledHistoryByCustomer.set(inv.customerId, historyList);
          }
        }
      }
    }

    // 2. Extract signals & preliminary risk for all customers
    const intermediateAssessments: {
      customerId: number;
      customerName: string;
      signals: ReturnType<typeof calculateCustomerSignals>;
      risk: ReturnType<typeof evaluateCustomerRisk>;
      openInvoices: InvoiceWithAllocation[];
    }[] = [];

    let maxCustomerExposurePaise = 0;
    let totalPortfolioOutstandingPaise = 0;
    let totalPortfolioOverduePaise = 0;

    for (const cust of allCustomers) {
      const custInvoices = invoicesByCustomer.get(cust.id) ?? [];
      const custHistory = settledHistoryByCustomer.get(cust.id) ?? [];
      const custLTV = ltvByCustomer.get(cust.id) ?? 0;

      const signals = calculateCustomerSignals({
        customerId: cust.id,
        customerName: cust.name,
        assessmentDate,
        invoices: custInvoices,
        settledHistory: custHistory,
        customerLTVPaise: custLTV,
        totalPortfolioLTVPaise,
      });

      const risk = evaluateCustomerRisk(signals);

      if (signals.outstandingExposurePaise > maxCustomerExposurePaise) {
        maxCustomerExposurePaise = signals.outstandingExposurePaise;
      }
      totalPortfolioOutstandingPaise += signals.outstandingExposurePaise;
      totalPortfolioOverduePaise += signals.overdueExposurePaise;

      intermediateAssessments.push({
        customerId: cust.id,
        customerName: cust.name,
        signals,
        risk,
        openInvoices: custInvoices.filter((i) => i.outstandingBalancePaise > 0),
      });
    }

    // 3. Evaluate Priority and Recommendations
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    const completedAssessments: CustomerAssessment[] = intermediateAssessments.map(
      (item) => {
        if (item.risk.riskCategory === "HIGH") highRiskCount++;
        else if (item.risk.riskCategory === "MEDIUM") mediumRiskCount++;
        else lowRiskCount++;

        const priority = evaluateCustomerPriority({
          risk: item.risk,
          signals: item.signals,
          maxPortfolioExposurePaise: maxCustomerExposurePaise,
        });

        const recommendation = evaluateCustomerRecommendation({
          risk: item.risk,
          signals: item.signals,
          highExposureThresholdPaise,
        });

        return {
          customerId: item.customerId,
          customerName: item.customerName,
          assessmentDate,
          signals: item.signals,
          risk: item.risk,
          priority,
          recommendation,
          openInvoices: item.openInvoices,
        };
      }
    );

    // 4. Rank portfolio: Priority DESC -> Exposure DESC -> Concentration DESC -> Name ASC
    completedAssessments.sort((a, b) => {
      if (b.priority.priorityScore !== a.priority.priorityScore) {
        return b.priority.priorityScore - a.priority.priorityScore;
      }
      if (b.signals.outstandingExposurePaise !== a.signals.outstandingExposurePaise) {
        return b.signals.outstandingExposurePaise - a.signals.outstandingExposurePaise;
      }
      if (
        b.signals.revenueConcentrationRatio !== a.signals.revenueConcentrationRatio
      ) {
        return (
          b.signals.revenueConcentrationRatio -
          a.signals.revenueConcentrationRatio
        );
      }
      return a.customerName.localeCompare(b.customerName);
    });

    // Assign rank
    completedAssessments.forEach((item, index) => {
      item.priority.priorityRank = index + 1;
    });

    return {
      assessmentDate,
      totalPortfolioOutstandingPaise,
      totalPortfolioOverduePaise,
      totalPortfolioLTVPaise,
      highExposureThresholdPaise,
      customersCount: allCustomers.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      rankings: completedAssessments,
    };
  }

  /**
   * Assesses a single customer by ID.
   */
  async assessCustomer(
    customerId: number,
    params?: {
      assessmentDate?: string;
      highExposureThresholdPaise?: number;
    }
  ): Promise<CustomerAssessment | null> {
    const portfolio = await this.assessPortfolio(params);
    return portfolio.rankings.find((r) => r.customerId === customerId) ?? null;
  }
}

export const intelligenceService = new IntelligenceService();
