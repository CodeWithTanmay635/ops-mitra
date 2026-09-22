import { useState, useEffect, useRef, Fragment } from "react";
import {
  fetchPortfolio,
  fetchCustomerExplanation,
  fetchCustomerFollowUp,
  simulateCustomerRecovery,
  ApiError,
  type ApiPortfolioAssessment,
  type ApiCustomerAssessment,
  type ApiExplanationData,
  type ApiFollowUpData,
  type ApiSimulationData,
} from "./lib/api";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:          "#EAE5DC",
  surface:     "#EAE5DC",
  surfaceAlt:  "#F2EDE5",
  ink:         "#1C2535",
  ink2:        "#56657A",
  ink3:        "#96A3B4",
  border:      "rgba(28,37,53,0.08)",
  orange:      "#C47840",
  orangeFaint: "rgba(196,120,64,0.10)",
  sage:        "#3D8060",
  sageFaint:   "rgba(61,128,96,0.10)",
  rose:        "#B04848",
  roseFaint:   "rgba(176,72,72,0.10)",
  gold:        "#A08040",
  goldFaint:   "rgba(160,128,64,0.10)",
};

// ─── Presentation formatters (UI layer only — no financial logic) ──────────────

/** 12_400_000 paise → "₹1.24L" */
function paiseLakhs(paise: number): string {
  const lakhs = paise / 10_000_000;
  const s = lakhs.toFixed(2).replace(/\.?0+$/, "");
  return `\u20b9${s}L`;
}

/** 8_740_000 paise → "₹87,400" */
function paiseRupees(paise: number): string {
  const rupees = paise / 100;
  return "\u20b9" + rupees.toLocaleString("en-IN");
}

/** "2025-08-15" → "15 Aug" */
function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** Map backend totalRiskScore to local Pill kind. */
function riskKind(score: number): "risk" | "attention" | "healthy" {
  if (score >= 70) return "risk";
  if (score >= 40) return "attention";
  return "healthy";
}

// ─── Data-loading hook ────────────────────────────────────────────────────────

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

function usePortfolio() {
  const [state, setState] = useState<FetchState<ApiPortfolioAssessment>>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchPortfolio()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        let message = "Could not reach the OpsMitra backend.";
        if (err instanceof ApiError) {
          message = `API error ${err.status}: ${err.body.message}`;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setState({ status: "error", message });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ─── Count-up ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, decimals = 0, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const t = setTimeout(() => {
      const start = performance.now();
      const dur = 1100;
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        setVal(parseFloat((e * target).toFixed(decimals)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, decimals, delay]);
  return val;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ic = {
  Home:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Dollar:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Users:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Chart:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="4"/><line x1="12" y1="20" x2="12" y2="10"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Sliders:   () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  Database:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Settings:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Bell:      () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Search:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Menu:      () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  ArrowRight:() => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ChevRight: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevDown:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  TrendUp:   () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendDown: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Filter:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Spin:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1.2s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  AlertCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, backgroundColor: C.border }} />;
}

type Pill = "healthy" | "attention" | "risk" | "neutral";

function StatusPill({ kind, children }: { kind?: Pill; children: React.ReactNode }) {
  const map: Record<Pill, { bg: string; color: string }> = {
    healthy:   { bg: C.sageFaint,   color: C.sage   },
    attention: { bg: C.goldFaint,   color: C.gold   },
    risk:      { bg: C.roseFaint,   color: C.rose   },
    neutral:   { bg: C.border,      color: C.ink3   },
  };
  const s = map[kind ?? "neutral"];
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {children}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

function Btn({ variant = "primary", size = "md", children, onClick, disabled, icon }: {
  variant?: BtnVariant; size?: "sm" | "md";
  children?: React.ReactNode; onClick?: () => void; disabled?: boolean; icon?: React.ReactNode;
}) {
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const v: Record<BtnVariant, { bg: string; color: string; border?: string }> = {
    primary:   { bg: C.orange,   color: "#fff" },
    secondary: { bg: C.surface,  color: C.ink,  border: C.border },
    ghost:     { bg: "transparent", color: C.ink2 },
    danger:    { bg: C.rose,     color: "#fff" },
  };
  const s = v[variant];
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-medium rounded-xl cursor-pointer transition-all duration-150 select-none whitespace-nowrap s-btn-press ${sizes[size]}`}
      style={{
        backgroundColor: s.bg, color: s.color,
        border: s.border ? `1px solid ${s.border}` : "none",
        opacity: disabled ? 0.4 : 1,
        boxShadow: variant === "primary"
          ? "3px 3px 8px rgba(0,0,0,0.10), -2px -2px 5px rgba(255,255,255,0.60)"
          : variant === "secondary"
          ? "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)"
          : undefined,
      }}
      onClick={onClick} disabled={disabled}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 18 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: `linear-gradient(90deg, ${C.border} 25%, rgba(28,37,53,0.04) 50%, ${C.border} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s ease infinite",
    }} />
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "14px 18px", borderRadius: 12,
      backgroundColor: C.roseFaint,
      border: "1px solid rgba(176,72,72,0.18)",
      color: C.rose,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}><Ic.AlertCircle /></span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Unable to load intelligence data</p>
        <p style={{ fontSize: 12, opacity: 0.85 }}>{message}</p>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "overview",    label: "Overview",     icon: <Ic.Home />    },
  { id: "receivables", label: "Receivables",  icon: <Ic.Dollar />  },
  { id: "customers",   label: "Customers",    icon: <Ic.Users />   },
  { id: "insights",    label: "Insights",     icon: <Ic.Sliders /> },
  { id: "datasources", label: "Data sources", icon: <Ic.Database />},
  { id: "settings",    label: "Settings",     icon: <Ic.Settings />},
];

function Sidebar({
  active,
  onChange,
  onClose,
  highRiskCount,
}: {
  active: string;
  onChange: (id: string) => void;
  onClose?: () => void;
  highRiskCount: number;
}) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: C.bg }}>
      <div style={{ padding: "28px 20px 20px" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: "-0.3px" }}>OpsMitra</p>
      </div>
      <Divider />
      <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          // Live badge on Receivables driven by highRiskCount from backend
          const badge = item.id === "receivables" && highRiskCount > 0 ? highRiskCount : null;
          return (
            <button
              key={item.id}
              onClick={() => { onChange(item.id); onClose?.(); }}
              className="w-full flex items-center gap-2.5 text-left cursor-pointer transition-all duration-200"
              style={{
                padding: "9px 10px", borderRadius: 10, marginBottom: 2,
                color: isActive ? C.ink : C.ink2,
                backgroundColor: "transparent",
                boxShadow: isActive
                  ? "inset 2px 2px 4px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.70)"
                  : undefined,
                fontWeight: isActive ? 500 : 400, fontSize: 13.5,
              }}>
              <span style={{ color: isActive ? C.orange : C.ink3, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {badge !== null && (
                <span style={{
                  backgroundColor: C.rose, color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{badge}</span>
              )}
            </button>
          );
        })}
      </nav>
      <Divider />
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, backgroundColor: C.orange,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
          boxShadow: "2px 2px 5px rgba(0,0,0,0.10), -1px -1px 3px rgba(255,255,255,0.70)",
        }}>RK</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rajan Kumar</p>
          <p style={{ fontSize: 11, color: C.ink3 }}>Admin</p>
        </div>
      </div>
    </div>
  );
}

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar({ title, onMenuClick }: { title: string; onMenuClick?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", height: 56, flexShrink: 0,
      borderBottom: `1px solid ${C.border}`, backgroundColor: C.bg,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button onClick={onMenuClick} className="menu-btn"
          style={{ background: "none", border: "none", color: C.ink2, cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
          <Ic.Menu />
        </button>
        <h1 style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div className="hidden sm:flex" style={{
          alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 10, backgroundColor: C.bg,
          boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.70)",
        }}>
          <span style={{ color: C.ink3 }}><Ic.Search /></span>
          <input placeholder="Search" style={{ background: "none", border: "none", outline: "none", fontSize: 12.5, color: C.ink, width: 120, fontFamily: "inherit" }} />
        </div>
        <button style={{
          width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: C.bg, border: "none", cursor: "pointer", color: C.ink3, position: "relative",
          boxShadow: "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)",
        }}>
          <Ic.Bell />
          <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: "50%", backgroundColor: C.orange }} />
        </button>
        <button className="hidden sm:flex" style={{
          alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 10, backgroundColor: C.bg, border: "none",
          fontSize: 12.5, fontWeight: 500, color: C.ink2, cursor: "pointer",
          boxShadow: "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)",
        }}>
          Aug 2025 <Ic.ChevDown />
        </button>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, delta, kind, delay = 0 }: {
  label: string; value: string; sub?: string; delta?: string;
  kind?: "healthy" | "risk" | "attention" | "neutral"; delay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const deltaColor = kind === "healthy" ? C.sage : kind === "risk" ? C.rose : kind === "attention" ? C.gold : C.ink3;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: C.surface, borderRadius: 14, padding: "18px 20px",
        cursor: "default", transition: "box-shadow 0.22s ease, transform 0.22s ease",
        boxShadow: hovered
          ? "6px 6px 16px rgba(0,0,0,0.09), -3px -3px 10px rgba(255,255,255,0.88)"
          : "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}>
      <p style={{ fontSize: 11.5, fontWeight: 500, color: C.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: "-0.5px", lineHeight: 1, marginBottom: 6, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: C.ink2, marginBottom: delta ? 4 : 0 }}>{sub}</p>}
      {delta && (
        <p style={{ fontSize: 12, color: deltaColor, display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
          {kind === "healthy" ? <Ic.TrendUp /> : kind === "risk" ? <Ic.TrendDown /> : null}
          {delta}
        </p>
      )}
    </div>
  );
}

function KPICardSkeleton() {
  return (
    <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: "18px 20px",
      boxShadow: "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)" }}>
      <Skeleton w={80} h={11} />
      <div style={{ marginTop: 10, marginBottom: 6 }}><Skeleton w={110} h={24} /></div>
      <Skeleton w={130} h={12} />
    </div>
  );
}

// ─── Milestone 4 AI Explanation & What-If Simulation Component ─────────────────

function CustomerIntelligenceAndSimulation({ ranking }: { ranking: ApiCustomerAssessment }) {
  const [expData, setExpData] = useState<ApiExplanationData | null>(null);
  const [expLoading, setExpLoading] = useState<boolean>(false);
  const [expError, setExpError] = useState<string | null>(null);

  const [followUpMsg, setFollowUpMsg] = useState<string | null>(null);
  const [msgLoading, setMsgLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [simRupees, setSimRupees] = useState<string>("75000");
  const [simData, setSimData] = useState<ApiSimulationData | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setExpLoading(true);
    setExpError(null);
    fetchCustomerExplanation(ranking.customerId)
      .then((res) => {
        if (active) {
          setExpData(res);
          setExpLoading(false);
        }
      })
      .catch((err: any) => {
        if (active) {
          setExpError(err?.message || "Could not fetch AI explanation");
          setExpLoading(false);
        }
      });
    return () => { active = false; };
  }, [ranking.customerId]);

  const handleGenerateFollowUp = () => {
    setMsgLoading(true);
    setCopied(false);
    fetchCustomerFollowUp(ranking.customerId)
      .then((res) => {
        setFollowUpMsg(res.message);
        setMsgLoading(false);
      })
      .catch(() => {
        setMsgLoading(false);
      });
  };

  const handleCopyMessage = () => {
    if (followUpMsg) {
      navigator.clipboard.writeText(followUpMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRunSimulation = () => {
    const val = parseFloat(simRupees);
    if (isNaN(val) || val < 0) return;
    setSimLoading(true);
    setSimError(null);
    simulateCustomerRecovery(ranking.customerId, Math.round(val * 100))
      .then((res) => {
        setSimData(res);
        setSimLoading(false);
      })
      .catch((err: any) => {
        setSimError(err?.message || "Simulation failed");
        setSimLoading(false);
      });
  };

  const actionMap: Record<string, string> = {
    ESCALATE_IMMEDIATELY: "Escalate immediately",
    SEND_FORMAL_REMINDER: "Send formal reminder",
    PROACTIVE_CHECKIN: "Schedule proactive check-in",
    SCHEDULE_COURTESY_REMINDER: "Schedule courtesy reminder",
    MONITOR: "Monitor — no immediate action",
  };

  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── PART 2: AI EXPLANATION ── */}
      <div style={{
        padding: "14px 16px", borderRadius: 10, backgroundColor: C.surfaceAlt,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Why this matters
          </p>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.orange, fontFamily: "DM Mono, monospace", backgroundColor: C.orangeFaint, padding: "2px 8px", borderRadius: 10 }}>
            AI Explanation
          </span>
        </div>

        {expLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: C.ink3, fontSize: 12 }}>
            <Ic.Spin /> Generating evidence-based AI explanation...
          </div>
        ) : expError ? (
          <p style={{ fontSize: 12, color: C.rose }}>{expError}</p>
        ) : expData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5, margin: 0, fontWeight: 450 }}>
              {expData.explanation}
            </p>

            {/* Key Signals */}
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Key signals
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ranking.signals.maxOverdueDays > 0 && (
                  <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 6, backgroundColor: C.roseFaint, color: C.rose, fontWeight: 600 }}>
                    {ranking.signals.maxOverdueDays} days overdue
                  </span>
                )}
                <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 6, backgroundColor: "rgba(28,37,53,0.06)", color: C.ink, fontWeight: 600, fontFamily: "DM Mono, monospace" }}>
                  {paiseRupees(ranking.signals.outstandingExposurePaise)} outstanding
                </span>
                {ranking.signals.openCycleDays > 0 && (
                  <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 6, backgroundColor: C.goldFaint, color: C.gold, fontWeight: 600 }}>
                    {ranking.signals.openCycleDays}-day open cycle
                  </span>
                )}
                {ranking.signals.historicalBaselinePaymentDays !== null && (
                  <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 6, backgroundColor: C.sageFaint, color: C.sage, fontWeight: 600 }}>
                    {Math.round(ranking.signals.historicalBaselinePaymentDays)}-day historical baseline
                  </span>
                )}
              </div>
            </div>

            {/* Suggested Action & Draft Follow-up */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, flexWrap: "wrap", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Suggested action
                </p>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>
                  {actionMap[expData.suggestedAction] ?? expData.suggestedAction}
                </p>
              </div>

              {!followUpMsg && (
                <button
                  onClick={handleGenerateFollowUp}
                  disabled={msgLoading}
                  style={{
                    backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: "5px 10px", fontSize: 11.5, fontWeight: 600, color: C.ink, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
                    boxShadow: "1px 1px 3px rgba(0,0,0,0.05)",
                  }}>
                  {msgLoading ? <Ic.Spin /> : <Ic.Bell />}
                  Draft follow-up
                </button>
              )}
            </div>

            {/* Follow-up message text */}
            {followUpMsg && (
              <div style={{
                marginTop: 6, padding: "10px 12px", borderRadius: 8, backgroundColor: C.surface,
                border: `1px dashed ${C.orange}`, position: "relative",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: C.orange, textTransform: "uppercase" }}>Draft follow-up message</span>
                  <button
                    onClick={handleCopyMessage}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: copied ? C.sage : C.ink3, fontFamily: "inherit",
                    }}>
                    {copied ? "✓ Copied!" : "Copy message"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: C.ink, fontStyle: "italic", lineHeight: 1.4, margin: 0 }}>
                  "{followUpMsg}"
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* ── PART 4 & 5: WHAT-IF SIMULATION ── */}
      <div style={{
        padding: "14px 16px", borderRadius: 10, backgroundColor: C.surfaceAlt,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            What if this customer pays...
          </p>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.sage, fontFamily: "DM Mono, monospace", backgroundColor: C.sageFaint, padding: "2px 8px", borderRadius: 10 }}>
            Simulation
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: C.ink3 }}>
              ₹
            </span>
            <input
              type="number"
              value={simRupees}
              onChange={(e) => setSimRupees(e.target.value)}
              placeholder="Recovery amount"
              style={{
                width: "100%", padding: "6px 10px 6px 24px", borderRadius: 6,
                border: `1px solid ${C.border}`, backgroundColor: C.surface,
                fontSize: 13, fontFamily: "DM Mono, monospace", fontWeight: 600, color: C.ink,
                outline: "none",
              }}
            />
          </div>
          <button
            onClick={handleRunSimulation}
            disabled={simLoading}
            style={{
              backgroundColor: C.orange, color: "#FFF", border: "none", borderRadius: 6,
              padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit",
              boxShadow: "0 2px 4px rgba(196,120,64,0.25)", flexShrink: 0,
            }}>
            {simLoading ? <Ic.Spin /> : <Ic.Sliders />}
            Simulate
          </button>
        </div>

        {simError && (
          <p style={{ fontSize: 12, color: C.rose, marginTop: 4 }}>{simError}</p>
        )}

        {/* Simulation Output */}
        {simData && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`,
              backgroundColor: C.surface,
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(28,37,53,0.04)" }}>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.ink3, textTransform: "uppercase" }}>Metric</th>
                    <th style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: C.ink3, textTransform: "uppercase" }}>Current</th>
                    <th style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: C.ink3 }}>→</th>
                    <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.sage, textTransform: "uppercase" }}>Simulated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: C.ink2 }}>Outstanding</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600, color: C.ink }}>
                      {paiseRupees(simData.current.financials.outstandingPaise)}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: C.ink3 }}>→</td>
                    <td style={{ padding: "6px 10px", fontFamily: "DM Mono, monospace", fontWeight: 700, color: C.sage }}>
                      {paiseRupees(simData.simulated.financials.outstandingPaise)}
                    </td>
                  </tr>

                  <tr style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: C.ink2 }}>Risk Score</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600, color: simData.current.risk.score >= 70 ? C.rose : C.gold }}>
                      {simData.current.risk.score} ({simData.current.risk.category})
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: C.ink3 }}>→</td>
                    <td style={{ padding: "6px 10px", fontFamily: "DM Mono, monospace", fontWeight: 700, color: simData.simulated.risk.score < simData.current.risk.score ? C.sage : C.ink }}>
                      {simData.simulated.risk.score} ({simData.simulated.risk.category})
                    </td>
                  </tr>

                  <tr style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: C.ink2 }}>Priority Score</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "DM Mono, monospace", fontWeight: 600, color: C.ink }}>
                      {simData.current.priority.score}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: C.ink3 }}>→</td>
                    <td style={{ padding: "6px 10px", fontFamily: "DM Mono, monospace", fontWeight: 700, color: C.sage }}>
                      {simData.simulated.priority.score}
                    </td>
                  </tr>

                  <tr style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: C.ink2 }}>Recommendation</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, color: C.ink }}>
                      {actionMap[simData.current.recommendation.action] ?? simData.current.recommendation.action}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: C.ink3 }}>→</td>
                    <td style={{ padding: "6px 10px", fontWeight: 700, color: C.sage }}>
                      {actionMap[simData.simulated.recommendation.action] ?? simData.simulated.recommendation.action}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {simData.aiExplanation && (
              <div style={{
                padding: "8px 10px", borderRadius: 6, backgroundColor: C.surface,
                borderLeft: `3px solid ${C.sage}`,
              }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: C.sage, textTransform: "uppercase", marginBottom: 3 }}>
                  Simulation Business Impact
                </p>
                <p style={{ fontSize: 12, color: C.ink, lineHeight: 1.4, margin: 0 }}>
                  {simData.aiExplanation.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Insight card (driven by API ranking) ─────────────────────────────────────

function InsightCard({ ranking, index }: { ranking: ApiCustomerAssessment; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { signals, risk, recommendation, openInvoices } = ranking;
  const kind = riskKind(risk.totalRiskScore);
  const kindColor = { risk: C.rose, attention: C.gold, healthy: C.sage }[kind];
  const kindFaint  = { risk: C.roseFaint, attention: C.goldFaint, healthy: C.sageFaint }[kind];

  const actionLabel: Record<string, string> = {
    ESCALATE_IMMEDIATELY:       "Escalate immediately",
    SEND_FORMAL_REMINDER:       "Send formal reminder",
    PROACTIVE_CHECKIN:          "Schedule proactive check-in",
    SCHEDULE_COURTESY_REMINDER: "Schedule courtesy reminder",
    MONITOR:                    "Monitor — no immediate action",
  };

  const signalLine = signals.maxOverdueDays > 0
    ? `${signals.maxOverdueDays} days overdue`
    : signals.openCycleDriftDays > 0
      ? `Payment cycle drifting ${signals.openCycleDriftDays}d beyond baseline`
      : "Within normal payment parameters";

  const factLine = signals.baselineAvailable && signals.historicalBaselinePaymentDays !== null
    ? `Normal payment cycle: ${Math.round(signals.historicalBaselinePaymentDays)} days`
    : `Outstanding: ${paiseRupees(signals.outstandingExposurePaise)}`;

  const title = `${recommendation.action === "ESCALATE_IMMEDIATELY" ? "Recover" : "Follow up on"} ${paiseRupees(signals.outstandingExposurePaise)} from ${ranking.customerName}`;

  const evidence: { label: string; detail: string }[] = [];
  const firstInv = openInvoices[0];
  if (firstInv) {
    evidence.push({ label: "Invoice", detail: `${firstInv.invoiceNumber} issued ${fmtDate(firstInv.issuedAt)} · ${paiseRupees(firstInv.totalAmountPaise)}` });
  }
  if (signals.baselineAvailable && signals.historicalBaselinePaymentDays !== null) {
    evidence.push({ label: "Normal cycle", detail: `${Math.round(signals.historicalBaselinePaymentDays)} days avg payment time` });
  }
  if (signals.openCycleDriftDays > 0) {
    evidence.push({ label: "Cycle drift", detail: `${signals.openCycleDriftDays}d beyond their normal cycle` });
  }
  evidence.push({ label: "Risk score", detail: `${risk.totalRiskScore}/100 (${risk.riskCategory})` });
  evidence.push({ label: "Priority rank", detail: `#${ranking.priority.priorityRank ?? "—"} in portfolio` });
  if (recommendation.reasonCodes.length > 0) {
    evidence.push({ label: "Reason codes", detail: recommendation.reasonCodes.join(", ") });
  }

  return (
    <div
      className={`rise-${Math.min(index + 1, 3)}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: C.surface, borderRadius: 14,
        transition: "box-shadow 0.22s ease, transform 0.22s ease",
        boxShadow: hovered
          ? "6px 6px 16px rgba(0,0,0,0.09), -3px -3px 10px rgba(255,255,255,0.88)"
          : "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        overflow: "hidden",
      }}>
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ width: 3, backgroundColor: kindColor, borderRadius: "14px 0 0 14px", flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.3, margin: 0 }}>{title}</h3>
            <StatusPill kind={kind}>
              {kind === "risk" ? "Overdue" : kind === "attention" ? "Watch" : "On track"}
            </StatusPill>
          </div>
          <p style={{ fontSize: 13, color: C.rose, fontWeight: 500, marginBottom: 3 }}>{signalLine}</p>
          <p style={{ fontSize: 12.5, color: C.ink3, marginBottom: 14 }}>{factLine}</p>
          <Divider />
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Recommended action</p>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{actionLabel[recommendation.action] ?? recommendation.action}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" size="sm" icon={<Ic.ArrowRight />}>
              {kind === "risk" ? "Send reminder" : kind === "attention" ? "Schedule outreach" : "View trend"}
            </Btn>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12.5, color: C.ink3, display: "flex", alignItems: "center", gap: 4,
                padding: "6px 0", fontFamily: "inherit",
              }}>
              <span style={{ transition: "transform 0.3s ease", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-flex" }}>
                <Ic.ChevRight />
              </span>
              {expanded ? "Hide details" : "View details & AI"}
            </button>
          </div>

          {expanded && (
            <div>
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, backgroundColor: kindFaint }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Deterministic Signals</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {evidence.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink2, width: 130, flexShrink: 0, lineHeight: 1.4 }}>{e.label}</p>
                      <p style={{ fontSize: 12, color: C.ink2, lineHeight: 1.4 }}>{e.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestone 4 AI Explanation & What-If Simulation */}
              <CustomerIntelligenceAndSimulation ranking={ranking} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Revenue chart — intentionally static ─────────────────────────────────────
// No Milestone 2 endpoint provides revenue history. These values match the
// seeded monthly sales distribution and remain accurate for the demo period.

function RevenueBar() {
  const data = [
    {v:8.2,m:"S"},{v:9.4,m:"O"},{v:7.8,m:"N"},{v:10.1,m:"D"},
    {v:11.3,m:"J"},{v:12.8,m:"F"},{v:10.9,m:"M"},{v:13.4,m:"A"},
    {v:15.2,m:"M"},{v:14.8,m:"J"},{v:16.1,m:"J"},{v:18.7,m:"A"},
  ];
  const max = 21;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 72 }}>
      {data.map((d, i) => {
        const h = Math.round((d.v / max) * 100);
        const isLast = i === 11;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: "100%", borderRadius: 4, height: `${h}%`,
              backgroundColor: isLast ? C.orange : C.border,
              opacity: isLast ? 1 : 0.7,
              boxShadow: isLast ? "0 2px 8px rgba(196,120,64,0.25)" : undefined,
            }} />
            <span style={{ fontSize: 9, color: C.ink3, fontFamily: "DM Mono, monospace" }}>{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Invoice table — driven by portfolio open invoices ────────────────────────

function buildRows(rankings: ApiCustomerAssessment[]) {
  return rankings.flatMap((r) =>
    r.openInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      customerName: r.customerName,
      outstandingBalancePaise: inv.outstandingBalancePaise,
      issuedAt: inv.issuedAt,
      isOverdue: inv.isOverdue,
      overdueDays: inv.overdueDays,
      daysUntilDue: inv.daysUntilDue,
    }))
  );
}

function DataTable({ rankings }: { rankings: ApiCustomerAssessment[] }) {
  const rows = buildRows(rankings);
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", boxShadow: "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: "rgba(28,37,53,0.03)" }}>
              {["Invoice","Customer","Amount","Date","Status","Age"].map((h) => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pillKind: Pill = row.isOverdue ? "risk" : "attention";
              const pillLabel = row.isOverdue ? "Overdue" : "Pending";
              const age = row.isOverdue
                ? `${row.overdueDays}d`
                : row.daysUntilDue >= 0 ? `${row.daysUntilDue}d` : "—";
              return (
                <tr key={`${row.invoiceNumber}-${i}`}
                  style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.surface)}>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 12, color: C.ink3, whiteSpace: "nowrap" }}>{row.invoiceNumber}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13.5, fontWeight: 500, color: C.ink }}>{row.customerName}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 13.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{paiseRupees(row.outstandingBalancePaise)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: C.ink3, whiteSpace: "nowrap" }}>{fmtDate(row.issuedAt)}</td>
                  <td style={{ padding: "12px 16px" }}><StatusPill kind={pillKind}>{pillLabel}</StatusPill></td>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: row.isOverdue ? C.rose : C.ink3, whiteSpace: "nowrap" }}>{age}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileTransactions({ rankings }: { rankings: ApiCustomerAssessment[] }) {
  const rows = buildRows(rankings);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((row, i) => {
        const pillKind: Pill = row.isOverdue ? "risk" : "attention";
        const pillLabel = row.isOverdue ? "Overdue" : "Pending";
        const ageLabel = row.isOverdue ? `${row.overdueDays}d overdue` : `Due in ${row.daysUntilDue}d`;
        return (
          <div key={`${row.invoiceNumber}-${i}`} className="s-card" style={{ backgroundColor: C.surface, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.customerName}</p>
                <p style={{ fontSize: 11.5, color: C.ink3, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{row.invoiceNumber} · {fmtDate(row.issuedAt)}</p>
              </div>
              <StatusPill kind={pillKind}>{pillLabel}</StatusPill>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontFamily: "DM Mono, monospace", fontVariantNumeric: "tabular-nums" }}>{paiseRupees(row.outstandingBalancePaise)}</span>
              <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", fontWeight: 600, color: row.isOverdue ? C.rose : C.ink3 }}>{ageLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Overview screen ──────────────────────────────────────────────────────────

function OverviewScreen({ portfolio }: { portfolio: ApiPortfolioAssessment }) {
  const { rankings, totalPortfolioOutstandingPaise, totalPortfolioOverduePaise, highRiskCount } = portfolio;

  // Static: revenue has no Milestone 2 backend equivalent
  const revLakhs = useCountUp(18.7, 1, 200);

  // Live: count of customers with non-MONITOR recommendations
  const actionableCount = rankings.filter((r) => r.recommendation.action !== "MONITOR").length;

  // Insight cards: only show customers needing action, up to 3
  const insightRankings = rankings.filter((r) => r.recommendation.action !== "MONITOR").slice(0, 3);

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Greeting */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, letterSpacing: "-0.3px", marginBottom: 4 }}>Good morning, Rajan</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>
            {actionableCount > 0
              ? `${actionableCount} ${actionableCount === 1 ? "item needs" : "items need"} attention today · ${portfolio.assessmentDate}`
              : `All customers within normal parameters · ${portfolio.assessmentDate}`}
          </p>
        </div>

        {/* KPI metrics */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Key metrics</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
            {/* Revenue: static — no M2 revenue endpoint */}
            <KPICard label="Revenue" value={`\u20b9${revLakhs}L`} delta="+8.4%" kind="healthy" delay={200} />
            {/* Cash at risk: live — total overdue paise from portfolio */}
            <KPICard
              label="Cash at risk"
              value={paiseLakhs(totalPortfolioOverduePaise)}
              sub={totalPortfolioOverduePaise > 0 ? `${paiseRupees(totalPortfolioOverduePaise)} overdue` : "No overdue invoices"}
              kind={totalPortfolioOverduePaise > 0 ? "risk" : "healthy"}
              delay={300}
            />
            {/* Receivables: live — total outstanding paise from portfolio */}
            <KPICard
              label="Receivables"
              value={paiseLakhs(totalPortfolioOutstandingPaise)}
              sub={`${paiseLakhs(totalPortfolioOverduePaise)} overdue`}
              kind="neutral"
              delay={400}
            />
            {/* Priority actions: live — non-MONITOR recommendation count */}
            <KPICard
              label="Priority actions"
              value={String(actionableCount)}
              sub={highRiskCount > 0 ? `${highRiskCount} high-risk customer${highRiskCount > 1 ? "s" : ""}` : "No high-risk customers"}
              kind={actionableCount > 0 ? "attention" : "healthy"}
              delay={500}
            />
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }} className="lg-3col">

          {/* Left: Insights + Table */}
          <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 28 }} className="col-span-2">

            {/* What needs attention */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>What needs attention</p>
                <button style={{ fontSize: 12.5, color: C.ink3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>View all</button>
              </div>
              {insightRankings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {insightRankings.map((r, i) => <InsightCard key={r.customerId} ranking={r} index={i} />)}
                </div>
              ) : (
                <div style={{
                  padding: "24px 20px", borderRadius: 14, textAlign: "center",
                  backgroundColor: C.surface,
                  boxShadow: "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)",
                }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, marginBottom: 4 }}>All customers on track</p>
                  <p style={{ fontSize: 12.5, color: C.ink3 }}>No immediate actions required as of {portfolio.assessmentDate}.</p>
                </div>
              )}
            </div>

            {/* Open invoices table */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Open invoices</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="secondary" size="sm" icon={<Ic.Filter />}>Filter</Btn>
                  <Btn variant="ghost" size="sm">Export</Btn>
                </div>
              </div>
              <div className="hide-mobile"><DataTable rankings={rankings} /></div>
              <div className="show-mobile"><MobileTransactions rankings={rankings} /></div>
            </div>
          </div>

          {/* Right: Supporting info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="right-col">

            {/* Revenue trend — static */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Revenue — 12 months</p>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.sage }}>+11.4%</span>
              </div>
              <RevenueBar />
            </div>

            {/* Collection risk — live: backend totalRiskScore */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Collection risk</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {rankings.map((r) => {
                  const score = r.risk.totalRiskScore;
                  const color = score >= 70 ? C.rose : score >= 40 ? C.gold : C.sage;
                  return (
                    <div key={r.customerId}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{r.customerName}</span>
                        <span style={{ fontSize: 11.5, fontFamily: "DM Mono, monospace", fontWeight: 600, color, flexShrink: 0 }}>{score}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(28,37,53,0.08)",
                        boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.06), inset -1px -1px 1px rgba(255,255,255,0.70)" }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${score}%`, backgroundColor: color, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Business status */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Business status</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  // Static: no M2 revenue endpoint
                  { label: "Sales this month",     value: "\u20b918.7L",  note: "+8.4%", color: C.sage },
                  // Live: overdue paise from portfolio
                  { label: "Overdue receivables",  value: paiseLakhs(totalPortfolioOverduePaise), note: highRiskCount > 0 ? `${highRiskCount} high-risk` : "None critical", color: totalPortfolioOverduePaise > 0 ? C.rose : C.sage },
                  // Live: customer count
                  { label: "Customers (active)",   value: String(portfolio.customersCount), note: `${highRiskCount} at risk`, color: C.ink3 },
                  // Static: no M2 DSO endpoint
                  { label: "Avg collection (days)", value: "—", note: "No M2 endpoint", color: C.ink3 },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: C.ink2, minWidth: 0 }}>{row.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, fontFamily: "DM Mono, monospace", fontVariantNumeric: "tabular-nums" }}>{row.value}</span>
                      <span style={{ fontSize: 11.5, color: row.color }}>{row.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Receivables screen ───────────────────────────────────────────────────────

function ReceivablesScreen({ portfolio }: { portfolio: ApiPortfolioAssessment }) {
  const { rankings, totalPortfolioOutstandingPaise, totalPortfolioOverduePaise } = portfolio;
  const allInvoices = rankings.flatMap((r) => r.openInvoices);
  const dueThisWeek = allInvoices.filter((inv) => inv.daysUntilDue >= 0 && inv.daysUntilDue <= 7);
  const dueThisWeekPaise = dueThisWeek.reduce((s, inv) => s + inv.outstandingBalancePaise, 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Receivables</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Outstanding invoices and collection status</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Total outstanding" value={paiseLakhs(totalPortfolioOutstandingPaise)} sub={`${allInvoices.length} open invoices`} />
          <KPICard label="Overdue ≥1 day" value={paiseLakhs(totalPortfolioOverduePaise)} kind={totalPortfolioOverduePaise > 0 ? "risk" : "healthy"} />
          <KPICard label="Due this week" value={paiseLakhs(dueThisWeekPaise)} sub={`${dueThisWeek.length} invoices`} kind="attention" />
          {/* Collected Aug: no M2 payment-history endpoint */}
          <KPICard label="Collected — Aug" value="—" sub="No payment history endpoint" kind="neutral" />
        </div>
        <div className="hide-mobile"><DataTable rankings={rankings} /></div>
        <div className="show-mobile"><MobileTransactions rankings={rankings} /></div>
      </div>
    </div>
  );
}

// ─── Customers screen ─────────────────────────────────────────────────────────

function CustomersScreen({ portfolio }: { portfolio: ApiPortfolioAssessment }) {
  const { rankings, customersCount, highRiskCount, totalPortfolioLTVPaise } = portfolio;
  const avgLTV = customersCount > 0 ? Math.round(totalPortfolioLTVPaise / customersCount) : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Customers</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Health, lifetime value, and collection risk</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Total customers" value={String(customersCount)} sub={`${portfolio.mediumRiskCount + highRiskCount} require attention`} />
          <KPICard label="High risk" value={String(highRiskCount)} sub="Risk score ≥70" kind={highRiskCount > 0 ? "risk" : "healthy"} />
          {/* Repeat rate: no M2 equivalent */}
          <KPICard label="Repeat rate" value="—" sub="No purchase history endpoint" kind="neutral" />
          {/* Avg LTV: derived from portfolio totals (presentation only, no financial calculation) */}
          <KPICard label="Avg LTV" value={paiseLakhs(avgLTV)} kind="healthy" />
        </div>
        <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, overflow: "hidden" }}>
          {rankings.map((r, i) => {
            const score = r.risk.totalRiskScore;
            const color = score >= 70 ? C.rose : score >= 40 ? C.gold : C.sage;
            const kind = riskKind(score);
            return (
              <div key={r.customerId} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "13px 20px",
                borderBottom: i < rankings.length - 1 ? `1px solid ${C.border}` : undefined,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, backgroundColor: C.orangeFaint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.orange, flexShrink: 0,
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.07), -1px -1px 3px rgba(255,255,255,0.80)",
                }}>{r.customerName[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customerName}</p>
                  <p style={{ fontSize: 11.5, color: C.ink3 }}>Rank #{r.priority.priorityRank ?? i + 1}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: "DM Mono, monospace", flexShrink: 0 }}>{paiseLakhs(r.signals.customerLTVPaise)}</span>
                <div style={{ width: 72, flexShrink: 0 }} className="hidden-xs">
                  <div style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(28,37,53,0.08)", overflow: "hidden" }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${score}%`, backgroundColor: color }} />
                  </div>
                </div>
                <StatusPill kind={kind}>{kind === "healthy" ? "Healthy" : kind === "attention" ? "Watch" : "At risk"}</StatusPill>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Insights screen — intentionally static ───────────────────────────────────
// Regional analysis, purchase-cycle prediction, and revenue forecasting have
// no Milestone 2 backend equivalent. These values match the seeded data.

function InsightsScreen() {
  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Insights</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Revenue trends, regional performance, and forecasts</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Aug revenue" value="\u20b918.7L" delta="+11.4% vs July" kind="healthy" />
          <KPICard label="New orders" value="63" delta="+7 vs last month" kind="healthy" />
          <KPICard label="Avg order value" value="\u20b929,700" delta="+4.2% vs July" kind="healthy" />
          <KPICard label="North region" value="\u20b94.1L" sub="Recovering · 6% above target" kind="attention" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="lg-2col">
          <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly revenue</p>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.sage }}>+11.4% YoY</span>
            </div>
            <RevenueBar />
          </div>
          <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>By region</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[{n:"West",p:34},{n:"North",p:22},{n:"South",p:19},{n:"East",p:15},{n:"Central",p:10}].map((r) => (
                <div key={r.n}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, color: C.ink2 }}>{r.n}</span>
                    <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", fontWeight: 600, color: C.ink }}>{r.p}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(28,37,53,0.08)", overflow: "hidden", boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.06)" }}>
                    <div style={{ height: 4, borderRadius: 2, width: `${r.p}%`, backgroundColor: C.orange }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderScreen({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{title}</p>
        <p style={{ fontSize: 13.5, color: C.ink3 }}>{sub}</p>
      </div>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div>
          <Skeleton w={240} h={22} />
          <div style={{ marginTop: 8 }}><Skeleton w={300} h={14} /></div>
        </div>
        <div>
          <div style={{ marginBottom: 14 }}><Skeleton w={80} h={11} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
            {[0,1,2,3].map((i) => <KPICardSkeleton key={i} />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0,1].map((i) => (
            <div key={i} style={{ backgroundColor: C.surface, borderRadius: 14, padding: "24px 20px",
              boxShadow: "3px 3px 8px rgba(0,0,0,0.07), -2px -2px 6px rgba(255,255,255,0.80)" }}>
              <Skeleton w="60%" h={14} />
              <div style={{ marginTop: 10 }}><Skeleton w="40%" h={12} /></div>
              <div style={{ marginTop: 8 }}><Skeleton w="80%" h={12} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Landing screen ─────────────────────────────────────────────────────────────

function LandingScreen({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);

  const start = () => {
    setLoading(true);
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <style>{`
          .wf-container { display: flex; align-items: center; width: 100%; max-width: 500px; padding: 0 32px; }
          .wf-node {
            width: 14px; height: 14px; border-radius: 50%; background-color: ${C.border};
            position: relative; z-index: 2;
          }
          .wf-line {
            flex: 1; height: 2px; background-color: ${C.border};
            position: relative; overflow: hidden; margin: 0 -1px;
          }
          .wf-label {
            position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
            font-size: 10px; font-weight: 700; color: ${C.ink3}; text-transform: uppercase;
            letter-spacing: 0.08em; white-space: nowrap; transition: color 0.2s;
          }
          .wf-fill {
            position: absolute; top: 0; left: 0; bottom: 0; width: 100%;
            background-color: ${C.orange}; transform-origin: left; transform: scaleX(0);
          }
          
          /* Animations */
          @keyframes nodeOn { to { background-color: ${C.orange}; box-shadow: 0 0 0 4px ${C.orangeFaint}; } }
          @keyframes labelOn { to { color: ${C.orange}; } }
          @keyframes lineOn { to { transform: scaleX(1); } }

          @media (prefers-reduced-motion: reduce) {
            .wf-node, .wf-fill, .wf-label { animation-duration: 0.01s !important; animation-delay: 0s !important; }
          }
        `}</style>
        <div className="wf-container">
          {["DATA", "SIGNALS", "RISK", "PRIORITY", "ACTION"].map((step, i, arr) => (
            <Fragment key={step}>
              <div className="wf-node" style={{ animation: `nodeOn 0.1s ease forwards ${i * 0.3}s` }}>
                <span className="wf-label" style={{ animation: `labelOn 0.1s ease forwards ${i * 0.3}s` }}>{step}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="wf-line">
                  <div className="wf-fill" style={{ animation: `lineOn 0.25s linear forwards ${i * 0.3 + 0.05}s` }} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: C.bg, overflowY: "auto" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "64px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: C.ink, letterSpacing: "-0.4px", marginBottom: 48 }}>OpsMitra</p>
        
        <h1 style={{ fontSize: "clamp(36px, 5vw, 48px)", fontWeight: 700, color: C.ink, letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 24 }}>
          Your next business decision,<br />not another dashboard.
        </h1>
        
        <p style={{ fontSize: "clamp(16px, 2vw, 18px)", color: C.ink2, lineHeight: 1.5, maxWidth: 600, marginBottom: 40 }}>
          OpsMitra turns sales, receivables and customer signals into prioritized actions — so business owners know what needs attention next.
        </p>
        
        <Btn size="md" onClick={start}>Let's Start →</Btn>
        
        <div style={{ marginTop: 80, width: "100%", maxWidth: 600 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, fontSize: 12, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <span>Business Data</span>
            <Ic.ArrowRight />
            <span>Analyze</span>
            <Ic.ArrowRight />
            <span>Detect</span>
            <Ic.ArrowRight />
            <span>Prioritize</span>
            <Ic.ArrowRight />
            <span>Act</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24, textAlign: "left" }}>
            <div style={{ backgroundColor: C.surfaceAlt, padding: 20, borderRadius: 14, boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.04), inset -1px -1px 3px rgba(255,255,255,0.5)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>1. Analyze</h3>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.4 }}>Turn operational data into meaningful business signals.</p>
            </div>
            <div style={{ backgroundColor: C.surfaceAlt, padding: 20, borderRadius: 14, boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.04), inset -1px -1px 3px rgba(255,255,255,0.5)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>2. Prioritize</h3>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.4 }}>Surface customers and situations that actually need attention.</p>
            </div>
            <div style={{ backgroundColor: C.surfaceAlt, padding: 20, borderRadius: 14, boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.04), inset -1px -1px 3px rgba(255,255,255,0.5)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 8 }}>3. Act</h3>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.4 }}>Explain the reason, draft the follow-up, and simulate the impact.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [nav, setNav] = useState(() => {
    return sessionStorage.getItem("opsmitra_intro") ? "overview" : "landing";
  });
  const [open, setOpen] = useState(false);
  const portfolioState = usePortfolio();

  const highRiskCount = portfolioState.status === "success"
    ? portfolioState.data.highRiskCount
    : 0;

  const SCREEN_TITLES: Record<string, string> = {
    overview:    "Good morning, Rajan",
    receivables: "Receivables",
    customers:   "Customers",
    insights:    "Insights",
    datasources: "Data sources",
    settings:    "Settings",
  };

  function renderContent(): React.ReactNode {
    // Loading / idle
    if (portfolioState.status === "idle" || portfolioState.status === "loading") {
      return <LoadingScreen />;
    }

    // Error — show banner instead of fake data on intelligence-driven screens
    if (portfolioState.status === "error") {
      if (["overview", "receivables", "customers"].includes(nav)) {
        return (
          <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
            <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
              <ErrorBanner message={portfolioState.message} />
            </div>
          </div>
        );
      }
    }

    const portfolio = portfolioState.status === "success" ? portfolioState.data : null;

    switch (nav) {
      case "overview":    return portfolio ? <OverviewScreen portfolio={portfolio} />    : null;
      case "receivables": return portfolio ? <ReceivablesScreen portfolio={portfolio} /> : null;
      case "customers":   return portfolio ? <CustomersScreen portfolio={portfolio} />   : null;
      case "insights":    return <InsightsScreen />;
      case "datasources": return <PlaceholderScreen title="Data sources" sub="Connect your accounting software, bank feeds, and sales data." />;
      case "settings":    return <PlaceholderScreen title="Settings" sub="Account preferences, notifications, and team management." />;
      default:            return portfolio ? <OverviewScreen portfolio={portfolio} /> : null;
    }
  }

  if (nav === "landing") {
    return (
      <LandingScreen onComplete={() => {
        sessionStorage.setItem("opsmitra_intro", "1");
        setNav("overview");
      }} />
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: C.bg }}>
      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes rise    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .rise-1 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.06s both; }
        .rise-2 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.14s both; }
        .rise-3 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.22s both; }
        @media (min-width: 640px)  { .md-4-col  { grid-template-columns: repeat(4, 1fr) !important; } }
        @media (min-width: 1024px) { .lg-3col { grid-template-columns: 1fr 1fr 300px !important; } .lg-2col { grid-template-columns: 1fr 1fr !important; } .col-span-2 { grid-column: span 2; } .right-col { grid-column: span 1; } }
        @media (max-width: 1023px) { .col-span-2, .right-col { grid-column: span 1; } }
        @media (min-width: 480px)  { .hidden-xs { display: block !important; } }
        @media (max-width: 479px)  { .hidden-xs { display: none !important; } }
        .hide-mobile { display: block; } .show-mobile { display: none; }
        @media (max-width: 639px)  { .hide-mobile { display: none; } .show-mobile { display: block; } }
        .s-btn-press:active { box-shadow: inset 2px 2px 4px rgba(0,0,0,0.10), inset -1px -1px 2px rgba(255,255,255,0.60) !important; transform: translateY(0) !important; }
        input::placeholder { color: #96A3B4; }
        * { box-sizing: border-box; }
      `}</style>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(28,37,53,0.25)", backdropFilter: "blur(2px)",
        }} />
      )}

      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 220, zIndex: 50,
        borderRight: `1px solid ${C.border}`,
        boxShadow: "4px 0 16px rgba(0,0,0,0.08)",
        backgroundColor: C.bg,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
      }}>
        <Sidebar
          active={nav}
          onChange={(id) => { setNav(id); setOpen(false); }}
          highRiskCount={highRiskCount}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar title={SCREEN_TITLES[nav] ?? "OpsMitra"} onMenuClick={() => setOpen((o) => !o)} />
        {renderContent()}
      </div>
    </div>
  );
}
