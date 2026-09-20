/**
 * src/modules/ai/ai.service.ts
 *
 * Isolated AI Service abstraction.
 *
 * Architecture Rule:
 * The LLM MUST NOT calculate money, overdue days, risk, or priority.
 * It receives structured evidence and explains business findings.
 * If LLM API key is missing or call fails, returns a clean deterministic fallback explanation.
 */

import { env } from "../../config/env.js";
import type { StructuredEvidence } from "../intelligence/evidence-builder.js";

export interface AIExplanationResult {
  explanation: string;
  keyPoints: string[];
  suggestedAction: string;
}

export interface AIFollowUpResult {
  message: string;
}

export interface AISimulationExplanationResult {
  explanation: string;
  keyPoints: string[];
}

function formatPaiseToRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  return "₹" + rupees.toLocaleString("en-IN");
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    ESCALATE_IMMEDIATELY: "Escalate immediately",
    SEND_FORMAL_REMINDER: "Send formal reminder",
    PROACTIVE_CHECKIN: "Schedule proactive check-in",
    SCHEDULE_COURTESY_REMINDER: "Schedule courtesy reminder",
    MONITOR: "Monitor — no immediate action",
  };
  return map[action] ?? action;
}

export class AIService {
  /**
   * Generates a business explanation for a customer's deterministic assessment.
   */
  async generateExplanation(evidence: StructuredEvidence): Promise<AIExplanationResult> {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const result = await this.callLLMForExplanation(evidence, apiKey);
        if (result) return result;
      } catch (err) {
        console.warn("⚠️ AI Service call failed, returning deterministic fallback:", err);
      }
    }

    return this.buildFallbackExplanation(evidence);
  }

  /**
   * Generates a concise payment follow-up message using supplied facts only.
   */
  async generateFollowUpMessage(evidence: StructuredEvidence): Promise<AIFollowUpResult> {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const result = await this.callLLMForFollowUp(evidence, apiKey);
        if (result) return result;
      } catch (err) {
        console.warn("⚠️ AI Service follow-up call failed, returning fallback:", err);
      }
    }

    return this.buildFallbackFollowUp(evidence);
  }

  /**
   * Generates an explanation for a What-If simulation result.
   */
  async generateSimulationExplanation(
    current: StructuredEvidence,
    simulated: StructuredEvidence,
    recoveryAmountPaise: number
  ): Promise<AISimulationExplanationResult> {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const result = await this.callLLMForSimulationExplanation(
          current,
          simulated,
          recoveryAmountPaise,
          apiKey
        );
        if (result) return result;
      } catch (err) {
        console.warn("⚠️ AI Service simulation call failed, returning fallback:", err);
      }
    }

    return this.buildFallbackSimulationExplanation(current, simulated, recoveryAmountPaise);
  }

  // ─── Fallback Implementations (Deterministic, Guaranteed 0% Failure) ────────

  public buildFallbackExplanation(evidence: StructuredEvidence): AIExplanationResult {
    const outstandingStr = formatPaiseToRupees(evidence.financials.outstandingPaise);
    const overdueStr = formatPaiseToRupees(evidence.financials.overdueExposurePaise);
    const actionLabel = getActionLabel(evidence.recommendation.action);

    const keyPoints: string[] = [];

    if (evidence.signals.maxOverdueDays > 0) {
      keyPoints.push(`${evidence.signals.maxOverdueDays} days maximum overdue delay beyond agreed payment terms`);
    } else {
      keyPoints.push("Invoices currently within scheduled due terms");
    }

    keyPoints.push(`${outstandingStr} total outstanding receivables balance`);

    if (evidence.signals.openCycleDays > 0) {
      if (evidence.signals.historicalBaselinePaymentDays !== null && evidence.signals.openCycleDriftDays > 0) {
        keyPoints.push(
          `${evidence.signals.openCycleDays}-day open cycle reflecting a ${evidence.signals.openCycleDriftDays}-day drift from historical baseline (${evidence.signals.historicalBaselinePaymentDays}d avg)`
        );
      } else {
        keyPoints.push(`${evidence.signals.openCycleDays}-day current open payment cycle`);
      }
    }

    keyPoints.push(
      `Risk score evaluated at ${evidence.risk.score} (${evidence.risk.category}) with priority score ${evidence.priority.score}`
    );

    let explanation = `${evidence.customerName} has an outstanding balance of ${outstandingStr}`;
    if (evidence.financials.overdueExposurePaise > 0) {
      explanation += ` with ${overdueStr} currently overdue. `;
    } else {
      explanation += `. `;
    }

    if (evidence.signals.maxOverdueDays > 0) {
      explanation += `The longest overdue payment is ${evidence.signals.maxOverdueDays} days past due. `;
    }

    if (evidence.signals.openCycleDriftDays > 0) {
      explanation += `Payment cycle is drifting ${evidence.signals.openCycleDriftDays} days past their historical payment baseline. `;
    }

    explanation += `Based on these deterministic signals, the account is assigned a risk score of ${evidence.risk.score} (${evidence.risk.category}) and recommended for action: ${actionLabel}.`;

    return {
      explanation,
      keyPoints,
      suggestedAction: actionLabel,
    };
  }

  public buildFallbackFollowUp(evidence: StructuredEvidence): AIFollowUpResult {
    const outstandingStr = formatPaiseToRupees(evidence.financials.outstandingPaise);
    const overdueDays = evidence.signals.maxOverdueDays;

    let message = `Hello ${evidence.customerName}, we wanted to follow up regarding the outstanding balance of ${outstandingStr}.`;

    if (overdueDays > 0) {
      message += ` Our records show that payment is currently ${overdueDays} days overdue.`;
    } else {
      message += ` We would appreciate an update on when payment can be expected.`;
    }

    message += ` Please let us know the expected payment date so we can update our records.`;

    return { message };
  }

  public buildFallbackSimulationExplanation(
    current: StructuredEvidence,
    simulated: StructuredEvidence,
    recoveryAmountPaise: number
  ): AISimulationExplanationResult {
    const recoveryStr = formatPaiseToRupees(recoveryAmountPaise);
    const currentOutstandingStr = formatPaiseToRupees(current.financials.outstandingPaise);
    const simOutstandingStr = formatPaiseToRupees(simulated.financials.outstandingPaise);

    const keyPoints: string[] = [
      `Recovery payment of ${recoveryStr} reduces outstanding balance from ${currentOutstandingStr} to ${simOutstandingStr}`,
      `Risk score shifts from ${current.risk.score} (${current.risk.category}) to ${simulated.risk.score} (${simulated.risk.category})`,
      `Priority score shifts from ${current.priority.score} to ${simulated.priority.score}`,
      `Recommended action updates from ${getActionLabel(current.recommendation.action)} to ${getActionLabel(simulated.recommendation.action)}`,
    ];

    const explanation = `Applying a hypothetical recovery payment of ${recoveryStr} lowers ${current.customerName}'s outstanding exposure from ${currentOutstandingStr} to ${simOutstandingStr}. This reduces aging severity and overdue exposure, resulting in a risk score reduction from ${current.risk.score} to ${simulated.risk.score} and shifting the recommended action to ${getActionLabel(simulated.recommendation.action)}.`;

    return {
      explanation,
      keyPoints,
    };
  }

  // ─── Direct LLM Callers (Gemini / OpenAI API) ─────────────────────────────

  private async callLLMForExplanation(
    evidence: StructuredEvidence,
    apiKey: string
  ): Promise<AIExplanationResult | null> {
    const systemPrompt = `You are a financial analyst explaining deterministic receivables intelligence for an MSME.
STRICT RULES:
- Use ONLY supplied evidence.
- Do NOT invent numbers, dates, or financial figures.
- Do NOT make financial calculations.
- Do NOT predict default probabilities.
- Do NOT change the recommended action.
- Format response strictly as JSON with keys: explanation (string), keyPoints (string array), suggestedAction (string).`;

    const userPrompt = `Structured Evidence:
${JSON.stringify(evidence, null, 2)}

Provide a concise, professional business explanation of why this customer was prioritized and what action is recommended.`;

    const responseText = await this.callGeminiOrOpenAI(systemPrompt, userPrompt, apiKey);
    if (!responseText) return null;

    try {
      const parsed = JSON.parse(responseText);
      if (typeof parsed.explanation === "string" && Array.isArray(parsed.keyPoints)) {
        return {
          explanation: parsed.explanation,
          keyPoints: parsed.keyPoints,
          suggestedAction: parsed.suggestedAction || getActionLabel(evidence.recommendation.action),
        };
      }
    } catch {
      // Ignore JSON parse error and fallback
    }
    return null;
  }

  private async callLLMForFollowUp(
    evidence: StructuredEvidence,
    apiKey: string
  ): Promise<AIFollowUpResult | null> {
    const systemPrompt = `You draft concise, professional payment follow-up emails/messages to customers.
STRICT RULES:
- Use ONLY supplied facts.
- Do NOT invent invoice numbers, promises, fees, penalties, or consequences.
- Format response strictly as JSON with key: message (string).`;

    const userPrompt = `Customer: ${evidence.customerName}
Outstanding: ${formatPaiseToRupees(evidence.financials.outstandingPaise)}
Max Overdue Days: ${evidence.signals.maxOverdueDays}

Draft a concise 2-sentence follow-up message.`;

    const responseText = await this.callGeminiOrOpenAI(systemPrompt, userPrompt, apiKey);
    if (!responseText) return null;

    try {
      const parsed = JSON.parse(responseText);
      if (typeof parsed.message === "string") {
        return { message: parsed.message };
      }
    } catch {
      // Ignore JSON parse error and fallback
    }
    return null;
  }

  private async callLLMForSimulationExplanation(
    current: StructuredEvidence,
    simulated: StructuredEvidence,
    recoveryAmountPaise: number,
    apiKey: string
  ): Promise<AISimulationExplanationResult | null> {
    const systemPrompt = `You explain What-If simulation results for credit risk.
STRICT RULES:
- Use ONLY supplied numbers.
- Do NOT calculate changes yourself; describe supplied current vs simulated state.
- Format response strictly as JSON with keys: explanation (string), keyPoints (string array).`;

    const userPrompt = `Recovery Amount: ${formatPaiseToRupees(recoveryAmountPaise)}
Current State: ${JSON.stringify(current)}
Simulated State: ${JSON.stringify(simulated)}

Explain what changed and the business implication.`;

    const responseText = await this.callGeminiOrOpenAI(systemPrompt, userPrompt, apiKey);
    if (!responseText) return null;

    try {
      const parsed = JSON.parse(responseText);
      if (typeof parsed.explanation === "string" && Array.isArray(parsed.keyPoints)) {
        return {
          explanation: parsed.explanation,
          keyPoints: parsed.keyPoints,
        };
      }
    } catch {
      // Fallback
    }
    return null;
  }

  private async callGeminiOrOpenAI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 sec timeout

    try {
      if (apiKey.startsWith("AIza")) {
        // Gemini REST API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      } else {
        // OpenAI Chat Completions REST API
        const url = "https://api.openai.com/v1/chat/completions";
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        return data?.choices?.[0]?.message?.content ?? null;
      }
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }
}

export const aiService = new AIService();
