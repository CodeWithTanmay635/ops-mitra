# Milestone 2 — Receivables Intelligence Engine Specification

**Document Status**: COMPLETED & VERIFIED (Implementation & Test Suite 100% Passed)  
**Target Module**: `server/src/modules/intelligence/`

---

## 1. Executive Definition & Core Principles

> **Canonical Definition**:  
> *"Risk measures how vulnerable a customer's current receivables position is based on observed aging, open-cycle drift, and overdue exposure."*

### Architectural Constraints & Rules
1. **Deterministic Vulnerability Metric**: Risk Score is a deterministic customer receivables vulnerability score ($0 - 100$). It is **NOT** a probability of default model.
2. **Authoritative Data Source**: Outstanding balance for any invoice $i$ **must** be derived strictly from:
   $$\text{OutstandingBalance}(i) = \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a$$
   Do not use `invoices.paidAmountPaise` as the calculation source.
3. **Integer Currency Precision**: Monetary values are stored and calculated in integer paise (₹1 = 100 paise).
4. **Separation of Concerns**:
   - **Risk**: *"How vulnerable is the customer's current receivables position?"*
   - **Priority**: *"Where should the business owner spend recovery effort first?"*

---

## 2. Business Signals Formalization

Given an **Assessment Date** $T$ (e.g. `2025-08-26`) and a customer $c$:

### 2.1 Outstanding Exposure ($E_c$)
Sum of outstanding balances across all open invoices:
$$E_c = \sum_{i \in \text{OpenInvoices}(c)} \left( \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a \right)$$
*If the customer has no open invoices, $E_c = 0$.*

### 2.2 Max Overdue Days ($D_c$)
Maximum days past due across all open invoices:
$$D_c = \max_{i \in \text{OpenInvoices}(c)} \max(0, \; T - \text{dueDate}_i)$$
*If the customer has no open invoices, $D_c = 0$.*

### 2.3 Open-Cycle Days ($\text{OC}_c$)
Calendar days elapsed since the oldest open invoice was issued:
$$\text{OC}_c = \begin{cases} 
T - \min_{i \in \text{OpenInvoices}(c)} (\text{issuedAt}_i), & \text{if } |\text{OpenInvoices}(c)| > 0 \\
0, & \text{otherwise}
\end{cases}$$

### 2.4 Historical Baseline Payment Days ($\bar{P}_c$)
Average elapsed days from invoice issuance to payment receipt across settled historical invoices:
$$\bar{P}_c = \frac{1}{N} \sum_{k=1}^{N} (\text{receivedAt}_k - \text{issuedAt}_k)$$
*If $N = 0$ (no settled historical invoices), `HistoricalBaselineAvailable = false` and $\bar{P}_c = \text{undefined}$.*

### 2.5 Open-Cycle Drift ($\Delta_c$)
Operational proxy for payment-cycle deterioration:
$$\Delta_c = \begin{cases}
0, & \text{if } |\text{OpenInvoices}(c)| = 0 \text{ or HistoricalBaselineAvailable is false} \\
\max(0, \; \text{OC}_c - \bar{P}_c), & \text{otherwise}
\end{cases}$$

### 2.6 Overdue Exposure ($O_c$) & Overdue Exposure Ratio ($R_c$)
$$O_c = \sum_{\substack{i \in \text{OpenInvoices}(c) \\ \text{dueDate}_i < T}} \left( \text{totalAmountPaise}_i - \sum_{a \in \text{Allocations}(i)} \text{allocatedAmountPaise}_a \right)$$

$$R_c = \begin{cases}
\frac{O_c}{E_c}, & \text{if } E_c > 0 \\
0, & \text{if } E_c = 0
\end{cases}$$

### 2.7 Customer Revenue Concentration ($C_c$)
$$C_c = \begin{cases}
\frac{\text{CustomerLTV}}{\text{TotalPortfolioLTV}} \times 100, & \text{if TotalPortfolioLTV} > 0 \\
0, & \text{otherwise}
\end{cases}$$

---

## 3. Risk Score Model ($0 - 100$)

$$\text{RiskScore} = \text{AgingSeverityScore} + \text{OpenCycleDriftScore} + \text{OverdueExposureScore}$$

$$\text{Final RiskScore} = \min(100, \; \max(0, \; \text{round}(\text{RiskScore})))$$

### 3.1 Aging Severity Score ($0 - 45\text{ pts}$)
Evaluated based on $D_c$ (Max Overdue Days):
- $D_c = 0\text{ days} \implies \mathbf{0\text{ pts}}$
- $1 \le D_c \le 15\text{ days} \implies \mathbf{15\text{ pts}}$
- $16 \le D_c \le 30\text{ days} \implies \mathbf{30\text{ pts}}$
- $31 \le D_c \le 60\text{ days} \implies \mathbf{40\text{ pts}}$
- $D_c > 60\text{ days} \implies \mathbf{45\text{ pts}}$
*(If no open invoices: $D_c = 0$, $\text{AgingSeverityScore} = 0$).*

### 3.2 Open-Cycle Drift Score ($0 - 35\text{ pts}$)
Evaluated based on $\Delta_c$ (Open-Cycle Drift):
- $\Delta_c \le 0\text{ days} \implies \mathbf{0\text{ pts}}$
- $1 \le \Delta_c \le 10\text{ days} \implies \mathbf{10\text{ pts}}$
- $11 \le \Delta_c \le 20\text{ days} \implies \mathbf{20\text{ pts}}$
- $\Delta_c > 20\text{ days} \implies \mathbf{35\text{ pts}}$
*(If no open invoices or no historical baseline: $\Delta_c = 0$, $\text{OpenCycleDriftScore} = 0$).*

### 3.3 Overdue Exposure Score ($0 - 20\text{ pts}$)
Evaluated based on $R_c$ (Overdue Exposure Ratio):
$$\text{OverdueExposureScore} = R_c \times 20$$
- $0\% \text{ overdue} \implies \mathbf{0\text{ pts}}$
- $25\% \text{ overdue} \implies \mathbf{5\text{ pts}}$
- $50\% \text{ overdue} \implies \mathbf{10\text{ pts}}$
- $75\% \text{ overdue} \implies \mathbf{15\text{ pts}}$
- $100\% \text{ overdue} \implies \mathbf{20\text{ pts}}$

### 3.4 Risk Classification
- **$0 - 39$**: `LOW`
- **$40 - 69$**: `MEDIUM`
- **$70 - 100$**: `HIGH`

---

## 4. Priority Score Model ($0 - 100$)

$$\text{PriorityScore} = \min\Big(100, \; \text{round}\big(0.40 \times \text{RiskScore} \;+\; 0.40 \times \text{NormalizedExposureScore} \;+\; 0.20 \times \text{ConcentrationScore}\big)\Big)$$

### 4.1 Normalized Exposure Score ($0 - 100$)
**Linear normalization** against the maximum single-customer exposure across the active portfolio:
$$\text{NormalizedExposureScore} = \begin{cases}
\min\left(100, \; \frac{E_c}{\max_{all}(E)} \times 100\right), & \text{if } \max_{all}(E) > 0 \\
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

```text
RULE 1:
IF RiskScore ≥ 70 AND Exposure > HighExposureThreshold:
    Action = ESCALATE_IMMEDIATELY

RULE 2:
IF RiskScore ≥ 70 AND Exposure ≤ HighExposureThreshold:
    Action = SEND_FORMAL_REMINDER

RULE 3:
IF RiskScore ≥ 40 AND RiskScore < 70 AND OpenCycleDrift > 10:
    Action = PROACTIVE_CHECKIN

RULE 4:
IF RiskScore < 40 AND at least one open invoice has (0 ≤ DueDate - AssessmentDate ≤ 5 days):
    Action = SCHEDULE_COURTESY_REMINDER

RULE 5 (Default):
OTHERWISE:
    Action = MONITOR
```
*(HighExposureThreshold default for MSME portfolio = ₹1,00,000 / 10,000,000 paise).*

---

## 6. Canonical Reason Codes Catalog

Every action is supported by deterministic reason codes:

| Canonical Reason Code | Trigger Condition |
| :--- | :--- |
| `HIGH_OVERDUE` | $D_c > 30\text{ days}$ |
| `MODERATE_OVERDUE` | $1 \le D_c \le 30\text{ days}$ |
| `HIGH_EXPOSURE` | $E_c > \text{HighExposureThreshold}$ |
| `PAYMENT_DETERIORATION` | $\Delta_c > 15\text{ days}$ |
| `CYCLE_DRIFT` | $10 < \Delta_c \le 15\text{ days}$ |
| `HIGH_CONCENTRATION` | $C_c > 25\%$ |
| `UPCOMING_DUE_DATE` | At least one open invoice has $0 \le (\text{dueDate} - T) \le 5\text{ days}$ |
| `HEALTHY_HISTORY` | Customer has baseline history and $D_c = 0 \land \Delta_c = 0$ |

---

## 7. Authoritative Recalculated Seed Evaluation (As of 2025-08-26)

**Portfolio Context**:  
- Total Portfolio LTV: ₹1,48,70,000 (148,700,000 paise)  
- Portfolio Max Customer Exposure $\max(E)$: ₹2,31,000 (Gupta & Sons)  
- Configured High-Exposure Threshold: ₹1,00,000 (10,000,000 paise)

```
┌──────────────────────────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Metric / Evaluation Field            │ Mehta Traders   │ Gupta & Sons    │ Kapoor Textiles │ Patel Electron. │ Singh & Co      │
├──────────────────────────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ 1. Outstanding Exposure (Ec)         │ ₹1,24,000       │ ₹2,31,000       │ ₹1,08,500       │ ₹87,400         │ ₹0              │
│ 2. Max Overdue Days (Dc)             │ 43 days         │ 0 days          │ 0 days          │ 0 days          │ 0 days          │
│ 3. Baseline Payment Days (P_bar)     │ 18 days         │ 30 days         │ 30 days         │ 30 days         │ 21 days         │
│ 4. Open-Cycle Days (OCc)             │ 61 days         │ 8 days          │ 4 days          │ 11 days         │ 0 days          │
│ 5. Open-Cycle Drift (Δc)             │ 25 days         │ 0 days          │ 0 days          │ 0 days          │ 0 days          │
│ 6. Overdue Exposure                  │ ₹1,24,000       │ ₹0              │ ₹0              │ ₹0              │ ₹0              │
│ 7. Overdue Exposure Ratio (Rc)       │ 1.0 (100%)      │ 0.0 (0%)        │ 0.0 (0%)        │ 0.0 (0%)        │ 0.0 (0%)        │
│ 8. Aging Severity Score (0-45)       │ 40              │ 0               │ 0               │ 0               │ 0               │
│ 9. Open-Cycle Drift Score (0-35)     │ 35              │ 0               │ 0               │ 0               │ 0               │
│ 10. Overdue Exposure Score (0-20)    │ 20              │ 0               │ 0               │ 0               │ 0               │
│ 11. Risk Score (0-100)               │ 95              │ 0               │ 0               │ 0               │ 0               │
│ 12. Risk Category                    │ HIGH            │ LOW             │ LOW             │ LOW             │ LOW             │
│ 13. Normalized Exposure Score (0-100)│ 53.68           │ 100.00          │ 46.97           │ 37.84           │ 0.00            │
│ 14. Revenue Concentration (Cc)       │ 32.0%           │ 15.0%           │ 13.0%           │ 22.0%           │ 18.0%           │
│ 15. Concentration Score (0-100)      │ 64.00           │ 30.00           │ 26.00           │ 44.00           │ 36.00           │
│ 16. Priority Score (0-100)           │ 72 (Rank #1)    │ 46 (Rank #2)    │ 24 (Rank #3)    │ 24 (Rank #4)    │ 7 (Rank #5)     │
│ 17. Recommendation Action            │ ESCALATE_IMM... │ MONITOR         │ MONITOR         │ MONITOR         │ MONITOR         │
│     (Matched Rule)                   │ (Rule 1)        │ (Rule 5)        │ (Rule 5)        │ (Rule 5)        │ (Rule 5)        │
│ 18. Reason Codes                     │ HIGH_OVERDUE,   │ HIGH_EXPOSURE,  │ HIGH_EXPOSURE,  │ HEALTHY_HISTORY │ HEALTHY_HISTORY │
│                                      │ PAYMENT_DETER., │ HEALTHY_HISTORY │ HEALTHY_HISTORY │                 │                 │
│                                      │ HIGH_EXPOSURE,  │                 │                 │                 │                 │
│                                      │ HIGH_CONCENTR.  │                 │                 │                 │                 │
└──────────────────────────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```
