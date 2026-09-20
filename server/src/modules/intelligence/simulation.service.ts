/**
 * src/modules/intelligence/simulation.service.ts
 *
 * Deterministic What-If Simulation Service.
 *
 * Simulates the financial effect of a hypothetical recovery payment on a customer's
 * outstanding receivables WITHOUT persisting changes to the database.
 *
 * Reuses existing intelligence functions:
 * - calculateCustomerSignals
 * - evaluateCustomerRisk
 * - evaluateCustomerPriority
 * - evaluateCustomerRecommendation
 */

import { intelligenceService } from "./intelligence.service.js";
import { calculateCustomerSignals } from "./signals.js";
import { evaluateCustomerRisk } from "./risk-engine.js";
import { evaluateCustomerPriority } from "./priority-engine.js";
import { evaluateCustomerRecommendation } from "./recommendation-engine.js";
import { buildCustomerEvidence, type StructuredEvidence } from "./evidence-builder.js";
import type { CustomerAssessment, InvoiceWithAllocation } from "./types.js";

export interface SimulationResult {
  customerId: number;
  customerName: string;
  recoveryAmountPaise: number;
  current: StructuredEvidence;
  simulated: StructuredEvidence;
  currentAssessment: CustomerAssessment;
  simulatedAssessment: CustomerAssessment;
}

export class SimulationService {
  /**
   * Simulates a hypothetical recovery payment for a customer.
   */
  async simulateRecovery(params: {
    customerId: number;
    recoveryAmountPaise: number;
    assessmentDate?: string;
  }): Promise<SimulationResult | null> {
    const { customerId, recoveryAmountPaise } = params;

    // 1. Fetch full portfolio assessment to obtain portfolio context
    const portfolio = await intelligenceService.assessPortfolio({
      assessmentDate: params.assessmentDate,
    });

    const currentAssessment = portfolio.rankings.find((r) => r.customerId === customerId);
    if (!currentAssessment) {
      return null;
    }

    // Determine portfolio baseline values
    let maxPortfolioExposurePaise = 0;
    for (const r of portfolio.rankings) {
      if (r.signals.outstandingExposurePaise > maxPortfolioExposurePaise) {
        maxPortfolioExposurePaise = r.signals.outstandingExposurePaise;
      }
    }

    // 2. Clone and sort customer's open invoices (oldest due date first)
    const clonedInvoices: InvoiceWithAllocation[] = currentAssessment.openInvoices.map((inv) => ({
      ...inv,
    }));

    clonedInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // 3. Apply hypothetical recovery amount across open invoices in memory
    let remainingRecovery = Math.max(0, recoveryAmountPaise);

    const simulatedInvoices: InvoiceWithAllocation[] = clonedInvoices.map((inv) => {
      const copy = { ...inv };
      if (remainingRecovery > 0 && copy.outstandingBalancePaise > 0) {
        const paymentApplied = Math.min(copy.outstandingBalancePaise, remainingRecovery);
        copy.allocatedAmountPaise += paymentApplied;
        copy.outstandingBalancePaise -= paymentApplied;
        remainingRecovery -= paymentApplied;

        if (copy.outstandingBalancePaise === 0) {
          copy.isOverdue = false;
          copy.overdueDays = 0;
        }
      }
      return copy;
    });

    // 4. Recalculate signals using exact intelligence engine
    const simulatedSignals = calculateCustomerSignals({
      customerId: currentAssessment.customerId,
      customerName: currentAssessment.customerName,
      assessmentDate: currentAssessment.assessmentDate,
      invoices: simulatedInvoices,
      settledHistory: [], // Baseline remains unchanged
      customerLTVPaise: currentAssessment.signals.customerLTVPaise,
      totalPortfolioLTVPaise: portfolio.totalPortfolioLTVPaise,
    });

    // Restore baseline metrics if available from current assessment
    simulatedSignals.historicalBaselinePaymentDays = currentAssessment.signals.historicalBaselinePaymentDays;
    simulatedSignals.baselineAvailable = currentAssessment.signals.baselineAvailable;
    if (simulatedSignals.openInvoicesCount > 0 && simulatedSignals.baselineAvailable && simulatedSignals.historicalBaselinePaymentDays !== null) {
      simulatedSignals.openCycleDriftDays = Math.max(0, simulatedSignals.openCycleDays - simulatedSignals.historicalBaselinePaymentDays);
    } else {
      simulatedSignals.openCycleDriftDays = 0;
    }

    // 5. Recalculate Risk, Priority, Recommendation
    const simulatedRisk = evaluateCustomerRisk(simulatedSignals);

    const simulatedPriority = evaluateCustomerPriority({
      risk: simulatedRisk,
      signals: simulatedSignals,
      maxPortfolioExposurePaise,
    });

    const simulatedRecommendation = evaluateCustomerRecommendation({
      risk: simulatedRisk,
      signals: simulatedSignals,
      highExposureThresholdPaise: portfolio.highExposureThresholdPaise,
    });

    const simulatedAssessment: CustomerAssessment = {
      customerId: currentAssessment.customerId,
      customerName: currentAssessment.customerName,
      assessmentDate: currentAssessment.assessmentDate,
      signals: simulatedSignals,
      risk: simulatedRisk,
      priority: simulatedPriority,
      recommendation: simulatedRecommendation,
      openInvoices: simulatedInvoices.filter((i) => i.outstandingBalancePaise > 0),
    };

    return {
      customerId: currentAssessment.customerId,
      customerName: currentAssessment.customerName,
      recoveryAmountPaise,
      current: buildCustomerEvidence(currentAssessment),
      simulated: buildCustomerEvidence(simulatedAssessment),
      currentAssessment,
      simulatedAssessment,
    };
  }
}

export const simulationService = new SimulationService();
