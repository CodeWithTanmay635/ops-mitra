# Milestone 2 — Receivables Intelligence Engine Specification

**Document Status**: FINAL SPECIFICATION (Ready for Implementation)  
**Target Module**: `server/src/modules/intelligence/`

---

## 1. Executive Definition & Core Principles

> **Definition**:  
> *"Risk measures how vulnerable a customer's current receivables position is based on observed aging, payment-cycle drift, and overdue exposure."*

### Architectural Constraints
1. **Deterministic Execution**: Pure TypeScript functions. Zero external heuristics, zero random/arbitrary weights, zero LLM intervention.
2. **Authoritative Data Source**: Outstanding balance for any invoice $i$ **must** be derived from:
   $$\text{OutstandingBalance}(i) = \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a$$
   Do not blindly rely on cached column fields.
3. **Integer & Strict Units**: Monetary calculations are in paise. Date math uses exact calendar day differences via `date-fns`.

---

## 2. Business Signals Formalization

Given an **Assessment Date** $T$ (e.g. `2025-08-26`) and a customer $c$:

### 2.1 Outstanding Exposure ($E_c$)
Total unpaid balance across all open invoices:
$$E_c = \sum_{i \in \text{OpenInvoices}(c)} \left( \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a \right)$$
*If customer has no open invoices, $E_c = 0$.*

### 2.2 Max Overdue Days ($D_c$)
Maximum calendar days past due across all open invoices:
$$D_c = \max_{i \in \text{OpenInvoices}(c)} \max(0, \; T - \text{dueDate}_i)$$
*If customer has no open invoices, $D_c = 0$.*

### 2.3 Open-Cycle Days ($\text{OC}_c$)
Calendar days elapsed since the oldest open invoice was issued:
$$\text{OC}_c = \begin{cases} 
T - \min_{i \in \text{OpenInvoices}(c)} (\text{issuedAt}_i), & \text{if } |\text{OpenInvoices}(c)| > 0 \\
0, & \text{otherwise}
\end{cases}$$

### 2.4 Historical Baseline Payment Days ($\bar{P}_c$)
Average elapsed days from invoice issuance to payment receipt across settled historical invoices:
$$\bar{P}_c = \frac{1}{N} \sum_{k=1}^{N} (\text{receivedAt}_k - \text{issuedAt}_k)$$
*If $N = 0$ (no settled historical invoices), $\bar{P}_c$ is undefined and `baselineAvailable = false`.*

### 2.5 Open-Cycle Drift ($\Delta_c$)
Operational proxy for payment delay deterioration beyond normal baseline:
$$\Delta_c = \begin{cases}
0, & \text{if } |\text{OpenInvoices}(c)| = 0 \text{ or baselineAvailable is false} \\
\max(0, \; \text{OC}_c - \bar{P}_c), & \text{otherwise}
\end{cases}$$

### 2.6 Overdue Exposure ($O_c$) & Overdue Ratio ($R_c$)
$$\text{OverdueExposure}_c = \sum_{\substack{i \in \text{OpenInvoices}(c) \\ \text{dueDate}_i < T}} \left( \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a \right)$$

$$R_c = \begin{cases}
\frac{\text{OverdueExposure}_c}{E_c}, & \text{if } E_c > 0 \\
0, & \text{if } E_c = 0
\end{cases}$$

### 2.7 Customer Revenue Concentration ($C_c$)
$$C_c = \begin{cases}
\frac{\text{LTV}(c)}{\sum_{all} \text{LTV}} \times 100, & \text{if } \sum \text{LTV} > 0 \\
0, & \text{otherwise}
\end{cases}$$

---

## 3. Risk Score Model ($0 - 100$)

$$\text{RiskScore} = \text{round}\big(\text{AgingSeverityScore} + \text{OpenCycleDriftScore} + \text{OverdueExposureScore}\big)$$

### 3.1 Aging Severity Score ($0 - 45$ points)
Evaluated based on $D_c$ (Max Overdue Days):
- $D_c = 0\text{ days} \implies \mathbf{0\text{ pts}}$
- $1 \le D_c \le 15\text{ days} \implies \mathbf{15\text{ pts}}$ (Grace period delay)
- $16 \le D_c \le 30\text{ days} \implies \mathbf{30\text{ pts}}$ (Standard commercial friction)
- $31 \le D_c \le 60\text{ days} \implies \mathbf{40\text{ pts}}$ (Critical MSME cash stress band)
- $D_c > 60\text{ days} \implies \mathbf{45\text{ pts}}$ (Severe default vulnerability)

### 3.2 Open-Cycle Drift Score ($0 - 35$ points)
Evaluated based on $\Delta_c$ (Open-Cycle Drift):
- $\Delta_c \le 0\text{ days} \implies \mathbf{0\text{ pts}}$
- $1 \le \Delta_c \le 10\text{ days} \implies \mathbf{10\text{ pts}}$
- $11 \le \Delta_c \le 20\text{ days} \implies \mathbf{20\text{ pts}}$
- $\Delta_c > 20\text{ days} \implies \mathbf{35\text{ pts}}$ (Active behavioral breakdown)

### 3.3 Overdue Exposure Score ($0 - 20$ points)
Evaluated based on $R_c$ (Overdue Exposure Ratio):
$$\text{OverdueExposureScore} = R_c \times 20$$
*(e.g., $0\% \rightarrow 0\text{ pts}, 25\% \rightarrow 5\text{ pts}, 50\% \rightarrow 10\text{ pts}, 75\% \rightarrow 15\text{ pts}, 100\% \rightarrow 20\text{ pts}$)*

### 3.4 Risk Classification
- **$0 - 39$**: `LOW`
- **$40 - 69$**: `MEDIUM`
- **$70 - 100$**: `HIGH`

---

## 4. Priority Score Model ($0 - 100$)

> **Core Axiom**:  
> **Risk** answers: *"How vulnerable is the receivables position?"*  
> **Priority** answers: *"Where should the business owner spend recovery effort first?"*

$$\text{PriorityScore} = \min\Big(100, \; \text{round}\big(0.40 \times \text{RiskScore} \;+\; 0.40 \times \text{NormalizedExposureScore} \;+\; 0.20 \times \text{ConcentrationScore}\big)\Big)$$

### 4.1 Normalized Exposure Score ($0 - 100$)
Linear normalization against the highest single-customer exposure in the portfolio:
$$\text{NormalizedExposureScore} = \begin{cases}
\min\left(100, \; \frac{E_c}{\max_{all} (E)} \times 100\right), & \text{if } \max_{all}(E) > 0 \\
0, & \text{otherwise}
\end{cases}$$

### 4.2 Concentration Score ($0 - 100$)
$$\text{ConcentrationScore} = \begin{cases}
\min(100, \; C_c \times 2), & \text{if TotalPortfolioLTV} > 0 \\
0, & \text{otherwise}
\end{cases}$$

---

## 5. Recommendation Decision Matrix

The Recommendation Engine evaluates rules strictly in top-to-bottom order:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ RULE 1                                                                                 │
│ IF RiskScore ≥ 70 AND Ec ≥ HighExposureThreshold:                                      │
│    THEN Action = ESCALATE_IMMEDIATELY                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RULE 2                                                                                 │
│ IF RiskScore ≥ 70 AND Ec < HighExposureThreshold:                                      │
│    THEN Action = SEND_FORMAL_REMINDER                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RULE 3                                                                                 │
│ IF 40 ≤ RiskScore < 70 AND OpenCycleDrift > 10:                                        │
│    THEN Action = PROACTIVE_CHECKIN                                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RULE 4                                                                                 │
│ IF RiskScore < 40 AND ∃ open invoice with (0 ≤ DueDate - AssessmentDate ≤ 5 days):     │
│    THEN Action = SCHEDULE_COURTESY_REMINDER                                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ RULE 5 (Default)                                                                       │
│ OTHERWISE:                                                                             │
│    THEN Action = MONITOR                                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
*(High-exposure threshold default for MSME portfolio = ₹1,00,000 / 10,000,000 paise).*

---

## 6. Canonical Reason Codes Catalog

Every action is supported by deterministic reason codes:

| Reason Code | Trigger Condition |
| :--- | :--- |
| `HIGH_OVERDUE` | $D_c > 30\text{ days}$ |
| `MODERATE_OVERDUE` | $1 \le D_c \le 30\text{ days}$ |
| `HIGH_EXPOSURE` | $E_c \ge \text{HighExposureThreshold}$ (or top 20% of portfolio) |
| `PAYMENT_DETERIORATION` | $\Delta_c > 15\text{ days}$ |
| `CYCLE_DRIFT` | $10 < \Delta_c \le 15\text{ days}$ |
| `HIGH_CONCENTRATION` | $C_c > 25\%$ |
| `UPCOMING_DUE_DATE` | At least one open invoice due in $0 \le (\text{dueDate} - T) \le 5\text{ days}$ |
| `HEALTHY_HISTORY` | Customer has baseline history and $D_c = 0$ and $\Delta_c = 0$ |

---

## 7. Authoritative Evaluation on Seeded Dataset (As of 2025-08-26)

Portfolio total LTV = ₹1,48,70,000.  
Max single customer exposure $\max(E) =$ ₹2,31,000 (Gupta & Sons).  
High-exposure threshold = ₹1,00,000 (10,000,000 paise).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. MEHTA TRADERS                                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Invoices: INV-2408 (Issued 2025-06-26, Due 2025-07-14, Total ₹2.40L, Paid ₹1.16L, Balance ₹1.24L)         │
│ • Outstanding Exposure (Ec): ₹1,24,000 | Overdue Exposure: ₹1,24,000 (Ratio = 1.0)                          │
│ • Max Overdue (Dc): 43 days (Due 2025-07-14 vs 2025-08-26)                                                  │
│ • Open-Cycle Days (OCc): 61 days (Issued 2025-06-26) | Baseline Avg: 18 days | Open-Cycle Drift (Δc): 25d   │
│ • Scoring:                                                                                                  │
│     Aging Severity Score:      40 pts  (31–60d band)                                                        │
│     Open-Cycle Drift Score:    35 pts  (>20d drift band)                                                    │
│     Overdue Exposure Score:    20 pts  (100% overdue)                                                       │
│   → Risk Score:                95 / 100  (HIGH)                                                             │
│ • Priority:                                                                                                 │
│     Normalized Exposure:       (1,24,000 / 2,31,000) × 100 = 53.68                                          │
│     Concentration:             32.0% LTV → min(100, 32 × 2) = 64.00                                         │
│     Priority Score:            min(100, round(0.40×95 + 0.40×53.68 + 0.20×64)) = min(100, round(72.27)) = 72│
│ • Recommendation:              ESCALATE_IMMEDIATELY (Rule 1)                                                │
│ • Reason Codes:                HIGH_OVERDUE, PAYMENT_DETERIORATION, HIGH_EXPOSURE, HIGH_CONCENTRATION        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. GUPTA & SONS                                                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Invoices: INV-2415 (Issued 2025-08-18, Due 2025-09-17, Total ₹2.31L, Paid ₹0, Balance ₹2.31L)             │
│ • Outstanding Exposure (Ec): ₹2,31,000 | Overdue Exposure: ₹0 (Ratio = 0.0)                                 │
│ • Max Overdue (Dc): 0 days (Due 2025-09-17, 22 days in future)                                              │
│ • Open-Cycle Days (OCc): 8 days | Baseline Avg: 30 days | Open-Cycle Drift (Δc): 0 days                     │
│ • Scoring:                                                                                                  │
│     Aging Severity Score:       0 pts                                                                       │
│     Open-Cycle Drift Score:     0 pts                                                                       │
│     Overdue Exposure Score:     0 pts                                                                       │
│   → Risk Score:                 0 / 100  (LOW)                                                              │
│ • Priority:                                                                                                 │
│     Normalized Exposure:       (2,31,000 / 2,31,000) × 100 = 100.00                                         │
│     Concentration:             15.0% LTV → min(100, 15 × 2) = 30.00                                         │
│     Priority Score:            min(100, round(0.40×0 + 0.40×100 + 0.20×30)) = 46                            │
│ • Recommendation:              MONITOR (Rule 5)                                                             │
│ • Reason Codes:                HIGH_EXPOSURE, HEALTHY_HISTORY                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. KAPOOR TEXTILES                                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Invoices: INV-2421 (Issued 2025-08-22, Due 2025-09-21, Total ₹1.085L, Paid ₹0, Balance ₹1.085L)           │
│ • Outstanding Exposure (Ec): ₹1,08,500 | Overdue Exposure: ₹0 (Ratio = 0.0)                                 │
│ • Max Overdue (Dc): 0 days (Due 2025-09-21, 26 days in future)                                              │
│ • Open-Cycle Days (OCc): 4 days | Baseline Avg: 30 days | Open-Cycle Drift (Δc): 0 days                     │
│ • Scoring:                                                                                                  │
│     Aging Severity Score:       0 pts                                                                       │
│     Open-Cycle Drift Score:     0 pts                                                                       │
│     Overdue Exposure Score:     0 pts                                                                       │
│   → Risk Score:                 0 / 100  (LOW)                                                              │
│ • Priority:                                                                                                 │
│     Normalized Exposure:       (1,08,500 / 2,31,000) × 100 = 46.97                                          │
│     Concentration:             13.0% LTV → min(100, 13 × 2) = 26.00                                         │
│     Priority Score:            min(100, round(0.40×0 + 0.40×46.97 + 0.20×26)) = 24                         │
│ • Recommendation:              MONITOR (Rule 5)                                                             │
│ • Reason Codes:                HEALTHY_HISTORY                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. PATEL ELECTRONICS                                                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Invoices: INV-2412 (Issued 2025-08-15, Due 2025-09-14, Total ₹0.874L, Paid ₹0, Balance ₹87,400)          │
│ • Outstanding Exposure (Ec): ₹87,400 | Overdue Exposure: ₹0 (Ratio = 0.0)                                   │
│ • Max Overdue (Dc): 0 days (Due 2025-09-14, 19 days in future)                                              │
│ • Open-Cycle Days (OCc): 11 days | Baseline Avg: 30 days | Open-Cycle Drift (Δc): 0 days                    │
│ • Scoring:                                                                                                  │
│     Aging Severity Score:       0 pts                                                                       │
│     Open-Cycle Drift Score:     0 pts                                                                       │
│     Overdue Exposure Score:     0 pts                                                                       │
│   → Risk Score:                 0 / 100  (LOW)                                                              │
│ • Priority:                                                                                                 │
│     Normalized Exposure:       (87,400 / 2,31,000) × 100 = 37.84                                            │
│     Concentration:             22.0% LTV → min(100, 22 × 2) = 44.00                                         │
│     Priority Score:            min(100, round(0.40×0 + 0.40×37.84 + 0.20×44)) = 24                         │
│ • Recommendation:              MONITOR (Rule 5)                                                             │
│ • Reason Codes:                HEALTHY_HISTORY                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. SINGH & CO                                                                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • Invoices: INV-2418 (Issued 2025-08-20, Due 2025-09-19, Total ₹56,800, Paid in full on 2025-08-22)         │
│ • Outstanding Exposure (Ec): ₹0 | Overdue Exposure: ₹0                                                      │
│ • Max Overdue (Dc): 0 days | Open-Cycle Days: 0 days | Open-Cycle Drift (Δc): 0 days                       │
│ • Scoring:                                                                                                  │
│     Aging Severity Score:       0 pts                                                                       │
│     Open-Cycle Drift Score:     0 pts                                                                       │
│     Overdue Exposure Score:     0 pts                                                                       │
│   → Risk Score:                 0 / 100  (LOW)                                                              │
│ • Priority:                                                                                                 │
│     Normalized Exposure:       0.00                                                                         │
│     Concentration:             18.0% LTV → min(100, 18 × 2) = 36.00                                         │
│     Priority Score:            min(100, round(0 + 0 + 0.20×36)) = 7                                         │
│ • Recommendation:              MONITOR (Rule 5)                                                             │
│ • Reason Codes:                HEALTHY_HISTORY                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
