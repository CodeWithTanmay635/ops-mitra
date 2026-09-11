import { useState, useEffect, useRef } from "react";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:          "#EAE5DC",   // warm off-white canvas
  surface:     "#EAE5DC",   // cards same as bg — shadow lifts them
  surfaceAlt:  "#F2EDE5",   // slightly lighter surface for inset contexts
  ink:         "#1C2535",   // primary text
  ink2:        "#56657A",   // secondary text
  ink3:        "#96A3B4",   // captions, metadata
  border:      "rgba(28,37,53,0.08)",
  orange:      "#C47840",   // muted amber — primary accent
  orangeFaint: "rgba(196,120,64,0.10)",
  sage:        "#3D8060",   // positive / healthy
  sageFaint:   "rgba(61,128,96,0.10)",
  rose:        "#B04848",   // risk — used sparingly
  roseFaint:   "rgba(176,72,72,0.10)",
  gold:        "#A08040",   // attention
  goldFaint:   "rgba(160,128,64,0.10)",
};

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

// ─── Icons — thin stroke, restrained ─────────────────────────────────────────

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
  X:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ArrowRight:() => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ChevRight: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevDown:  () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  TrendUp:   () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendDown: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Filter:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Check:     () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  Spin:      () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1.2s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Clock:     () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
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
  const [pressed, setPressed] = useState(false);
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
        boxShadow: variant === "primary" ? "3px 3px 8px rgba(0,0,0,0.10), -2px -2px 5px rgba(255,255,255,0.60)"
          : variant === "secondary" ? "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)"
          : undefined,
      }}
      onClick={onClick} disabled={disabled}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const navItems = [
  { id: "overview",     label: "Overview",      icon: <Ic.Home />    },
  { id: "receivables",  label: "Receivables",   icon: <Ic.Dollar />, badge: 3 },
  { id: "customers",    label: "Customers",     icon: <Ic.Users />   },
  { id: "insights",     label: "Insights",      icon: <Ic.Sliders /> },
  { id: "datasources",  label: "Data sources",  icon: <Ic.Database />},
  { id: "settings",     label: "Settings",      icon: <Ic.Settings />},
];

function Sidebar({ active, onChange, onClose }: { active: string; onChange: (id: string) => void; onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: C.bg }}>
      {/* Brand */}
      <div style={{ padding: "28px 20px 20px" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: "-0.3px" }}>OpsMitra</p>
      </div>

      <Divider />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 12px", overflowY: "auto" }}>
        {navItems.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onChange(item.id); onClose?.(); }}
              className="w-full flex items-center gap-2.5 text-left cursor-pointer transition-all duration-200"
              style={{
                padding: "9px 10px",
                borderRadius: 10,
                marginBottom: 2,
                color: isActive ? C.ink : C.ink2,
                backgroundColor: "transparent",
                boxShadow: isActive
                  ? "inset 2px 2px 4px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.70)"
                  : undefined,
                fontWeight: isActive ? 500 : 400,
                fontSize: 13.5,
              }}>
              <span style={{ color: isActive ? C.orange : C.ink3, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  backgroundColor: C.rose, color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  width: 18, height: 18, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <Divider />

      {/* User */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, backgroundColor: C.orange,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
          boxShadow: "2px 2px 5px rgba(0,0,0,0.10), -1px -1px 3px rgba(255,255,255,0.70)",
        }}>RK</div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rajan Kumar</p>
          <p style={{ fontSize: 11, color: C.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Admin</p>
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
      borderBottom: `1px solid ${C.border}`,
      backgroundColor: C.bg,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button onClick={onMenuClick} className="menu-btn"
          style={{ background: "none", border: "none", color: C.ink2, cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
          <Ic.Menu />
        </button>
        <h1 style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h1>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Search */}
        <div className="hidden sm:flex" style={{
          alignItems: "center", gap: 7, padding: "6px 12px",
          borderRadius: 10, backgroundColor: C.bg,
          boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.07), inset -1px -1px 3px rgba(255,255,255,0.70)",
        }}>
          <span style={{ color: C.ink3 }}><Ic.Search /></span>
          <input placeholder="Search" style={{
            background: "none", border: "none", outline: "none",
            fontSize: 12.5, color: C.ink, width: 120, fontFamily: "inherit",
          }} />
        </div>
        {/* Bell */}
        <button style={{
          width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: C.bg, border: "none", cursor: "pointer", color: C.ink3, position: "relative",
          boxShadow: "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)",
        }}>
          <Ic.Bell />
          <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: "50%", backgroundColor: C.orange }} />
        </button>
        {/* Period */}
        <button className="hidden sm:flex" style={{
          alignItems: "center", gap: 5, padding: "6px 12px",
          borderRadius: 10, backgroundColor: C.bg, border: "none",
          fontSize: 12.5, fontWeight: 500, color: C.ink2, cursor: "pointer",
          boxShadow: "3px 3px 7px rgba(0,0,0,0.07), -2px -2px 5px rgba(255,255,255,0.80)",
        }}>
          Aug 2025 <Ic.ChevDown />
        </button>
      </div>
    </div>
  );
}


// ─── KPI Cards ────────────────────────────────────────────────────────────────

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
      <p style={{ fontSize: 11.5, fontWeight: 500, color: C.ink3, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 700, color: C.ink, letterSpacing: "-0.5px", lineHeight: 1, marginBottom: 6, fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>
        {value}
      </p>
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

// ─── Insight Card ("What needs attention") ────────────────────────────────────

interface Insight {
  id: number;
  title: string;
  signal: string;
  fact: string;
  recommendedLabel: string;
  action: string;
  kind: "risk" | "attention" | "healthy";
  evidence: { label: string; detail: string }[];
}

const insights: Insight[] = [
  {
    id: 1,
    title: "Recover ₹2.4L from Mehta Traders",
    signal: "43 days overdue",
    fact: "Normal payment cycle: 18 days",
    recommendedLabel: "Recommended action",
    action: "Contact customer today",
    kind: "risk",
    evidence: [
      { label: "Invoice",             detail: "INV-2408 issued Jun 26 · ₹2,40,000" },
      { label: "Payment history",     detail: "6 prior invoices — all paid within 15–21 days" },
      { label: "Current delay",       detail: "25 days beyond their normal 18-day cycle" },
      { label: "Portfolio exposure",  detail: "This account is 13% of total outstanding receivables" },
      { label: "Risk if unresolved",  detail: "Accounts past 60 days show 34% write-off rate historically" },
    ],
  },
  {
    id: 2,
    title: "Patel Electronics likely to reorder",
    signal: "Reorder window: next 8–10 days",
    fact: "Average purchase cycle: 91 days · Last order Jul 18",
    recommendedLabel: "Recommended action",
    action: "Schedule outreach this week",
    kind: "attention",
    evidence: [
      { label: "Purchase pattern",    detail: "Orders placed every 88–94 days across last 4 cycles" },
      { label: "Last order",          detail: "Jul 18, 2025 · ₹87,400" },
      { label: "Expected window",     detail: "Aug 16–22 based on cycle average" },
      { label: "Opportunity",         detail: "Proactive outreach in this window adds 18% to average order value" },
    ],
  },
  {
    id: 3,
    title: "North region sales on track",
    signal: "Projecting ₹4.1L for August",
    fact: "Target: ₹3.9L · 6% above target",
    recommendedLabel: "No action required",
    action: "Monitor weekly",
    kind: "healthy",
    evidence: [
      { label: "Week 1–2",     detail: "Sales dipped 12% — likely seasonal" },
      { label: "Week 3–4",     detail: "Recovered to target run-rate from Aug 11" },
      { label: "Projection",   detail: "₹4.1L by month-end (range: ₹3.8L–₹4.4L)" },
    ],
  },
];

function InsightCard({ d, index }: { d: Insight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState(0);
  useEffect(() => { if (bodyRef.current) setBodyH(bodyRef.current.scrollHeight); }, []);

  const kindColor = { risk: C.rose, attention: C.gold, healthy: C.sage }[d.kind];
  const kindFaint = { risk: C.roseFaint, attention: C.goldFaint, healthy: C.sageFaint }[d.kind];

  return (
    <div
      className={`rise-${index + 1}`}
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

      {/* Subtle left accent — 3px, not a colored bar */}
      <div style={{ display: "flex", gap: 0 }}>
        <div style={{ width: 3, backgroundColor: kindColor, borderRadius: "14px 0 0 14px", flexShrink: 0 }} />

        <div style={{ flex: 1, padding: "18px 20px" }}>
          {/* Title + kind indicator */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.3, margin: 0 }}>{d.title}</h3>
            <StatusPill kind={d.kind}>
              {d.kind === "risk" ? "Overdue" : d.kind === "attention" ? "Opportunity" : "On track"}
            </StatusPill>
          </div>

          {/* Signal + fact */}
          <p style={{ fontSize: 13, color: C.rose, fontWeight: 500, marginBottom: 3 }}>{d.signal}</p>
          <p style={{ fontSize: 12.5, color: C.ink3, marginBottom: 14 }}>{d.fact}</p>

          {/* Divider */}
          <Divider />

          {/* Recommended action */}
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {d.recommendedLabel}
            </p>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{d.action}</p>
          </div>

          {/* Actions row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" size="sm" icon={<Ic.ArrowRight />}>
              {d.kind === "risk" ? "Send reminder" : d.kind === "attention" ? "Schedule outreach" : "View trend"}
            </Btn>
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12.5, color: C.ink3, display: "flex", alignItems: "center", gap: 4,
                padding: "6px 0", fontFamily: "inherit", transition: "color 0.15s",
              }}>
              <span style={{ transition: "transform 0.3s ease", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-flex" }}>
                <Ic.ChevRight />
              </span>
              {expanded ? "Hide details" : "View details"}
            </button>
          </div>

          {/* Evidence — smooth expand */}
          <div style={{
            maxHeight: expanded ? bodyH + 16 : 0,
            opacity: expanded ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
          }}>
            <div ref={bodyRef}>
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, backgroundColor: kindFaint }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Details
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {d.evidence.map((e, i) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.ink2, width: 130, flexShrink: 0, lineHeight: 1.4 }}>{e.label}</p>
                      <p style={{ fontSize: 12, color: C.ink2, lineHeight: 1.4 }}>{e.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Revenue chart — thin, minimal ────────────────────────────────────────────

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
              transition: "opacity 0.15s",
              boxShadow: isLast ? "0 2px 8px rgba(196,120,64,0.25)" : undefined,
            }} />
            <span style={{ fontSize: 9, color: C.ink3, fontFamily: "DM Mono, monospace" }}>{d.m}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

const tableRows = [
  { id:"INV-2408", customer:"Mehta Traders",    amount:"₹1,24,000", date:"12 Aug", status:"overdue" as const, days:"43d" },
  { id:"INV-2412", customer:"Patel Electronics", amount:"₹87,400",  date:"15 Aug", status:"pending" as const, days:"30d" },
  { id:"INV-2415", customer:"Gupta & Sons",      amount:"₹2,31,000",date:"18 Aug", status:"pending" as const, days:"30d" },
  { id:"INV-2418", customer:"Singh Textiles",    amount:"₹56,800",  date:"20 Aug", status:"paid" as const,    days:"—"  },
  { id:"INV-2421", customer:"Kapoor & Co",       amount:"₹1,08,500",date:"22 Aug", status:"pending" as const, days:"30d"},
];

function DataTable() {
  const sm = {
    overdue: { label:"Overdue", kind:"risk" as Pill },
    pending: { label:"Pending", kind:"attention" as Pill },
    paid:    { label:"Settled", kind:"healthy" as Pill },
  };
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
            {tableRows.map((row, i) => {
              const s = sm[row.status];
              return (
                <tr key={row.id}
                  style={{ borderTop: `1px solid ${C.border}`, backgroundColor: C.surface, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.surface)}>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 12, color: C.ink3, whiteSpace: "nowrap" }}>{row.id}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13.5, fontWeight: 500, color: C.ink }}>{row.customer}</td>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 13.5, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{row.amount}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: C.ink3, whiteSpace: "nowrap" }}>{row.date}</td>
                  <td style={{ padding: "12px 16px" }}><StatusPill kind={s.kind}>{s.label}</StatusPill></td>
                  <td style={{ padding: "12px 16px", fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 600, color: row.status === "overdue" ? C.rose : C.ink3, whiteSpace: "nowrap" }}>{row.days}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileTransactions() {
  const sm = { overdue:{label:"Overdue",kind:"risk" as Pill}, pending:{label:"Pending",kind:"attention" as Pill}, paid:{label:"Settled",kind:"healthy" as Pill} };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tableRows.map((row) => {
        const s = sm[row.status];
        return (
          <div key={row.id} className="s-card" style={{ backgroundColor: C.surface, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.customer}</p>
                <p style={{ fontSize: 11.5, color: C.ink3, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{row.id} · {row.date}</p>
              </div>
              <StatusPill kind={s.kind}>{s.label}</StatusPill>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontFamily: "DM Mono, monospace", fontVariantNumeric: "tabular-nums" }}>{row.amount}</span>
              <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", fontWeight: 600, color: row.status === "overdue" ? C.rose : C.ink3 }}>
                {row.status === "overdue" ? `${row.days} overdue` : row.days === "—" ? "Settled" : `Due in ${row.days}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Overview screen ──────────────────────────────────────────────────────────

function OverviewScreen() {
  // Count-up KPIs
  const rev  = useCountUp(18.7, 1, 200);
  const due  = useCountUp(6.2,  1, 300);
  const cust = useCountUp(142,  0, 400);
  const dso  = useCountUp(34,   0, 500);

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Greeting */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, letterSpacing: "-0.3px", marginBottom: 4 }}>Good morning, Rajan</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>
            3 items need attention today · August 2025
          </p>
        </div>

        {/* ── KPI metrics ── */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Key metrics</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
            <KPICard label="Revenue" value={`₹${rev}L`} delta="+8.4%" kind="healthy" delay={200} />
            <KPICard label="Cash at risk" value={`₹${due}L`} sub={`₹2.8L overdue`} delta="+18% from last month" kind="risk" delay={300} />
            <KPICard label="Receivables" value="₹7.4L" sub="₹1.9L overdue" kind="neutral" delay={400} />
            <KPICard label="Priority actions" value="6" sub="2 require attention" kind="attention" delay={500} />
          </div>
        </div>

        {/* ── Main grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }} className="lg-3col">

          {/* Left: Insights + Table */}
          <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 28 }} className="col-span-2">

            {/* What needs attention */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>What needs attention</p>
                <button style={{ fontSize: 12.5, color: C.ink3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>View all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {insights.map((d, i) => <InsightCard key={d.id} d={d} index={i} />)}
              </div>
            </div>

            {/* Recent transactions */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent transactions</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="secondary" size="sm" icon={<Ic.Filter />}>Filter</Btn>
                  <Btn variant="ghost" size="sm">Export</Btn>
                </div>
              </div>
              <div className="hide-mobile"><DataTable /></div>
              <div className="show-mobile"><MobileTransactions /></div>
            </div>
          </div>

          {/* Right: Supporting info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="right-col">

            {/* Revenue trend */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Revenue — 12 months</p>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.sage }}>+11.4%</span>
              </div>
              <RevenueBar />
            </div>

            {/* Collection risk */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Collection risk</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {label:"Mehta Traders", v:78},
                  {label:"Singh & Co",    v:52},
                  {label:"Kapoor Textiles",v:45},
                  {label:"Gupta Electronics",v:22},
                  {label:"Sharma Pharma", v:14},
                ].map((r) => {
                  const color = r.v >= 70 ? C.rose : r.v >= 40 ? C.gold : C.sage;
                  return (
                    <div key={r.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{r.label}</span>
                        <span style={{ fontSize: 11.5, fontFamily: "DM Mono, monospace", fontWeight: 600, color, flexShrink: 0 }}>{r.v}</span>
                      </div>
                      <div style={{
                        height: 4, borderRadius: 2, backgroundColor: "rgba(28,37,53,0.08)",
                        boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.06), inset -1px -1px 1px rgba(255,255,255,0.70)",
                      }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${r.v}%`, backgroundColor: color, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Business status — simple */}
            <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.ink3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Business status</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label:"Sales this month",   value:"₹12.6L",   note:"+8.4%", color: C.sage },
                  { label:"Overdue receivables", value:"₹2.8L",    note:"+18%",  color: C.rose },
                  { label:"Customers (active)",  value:"142",       note:"8 new", color: C.ink3 },
                  { label:"Avg collection (days)",value:"34",       note:"+3d",   color: C.gold },
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

// ─── Other screens ────────────────────────────────────────────────────────────

function ReceivablesScreen() {
  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Receivables</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Outstanding invoices and collection status</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Total outstanding" value="₹14.3L" sub="38 invoices" />
          <KPICard label="Overdue ≥30 days" value="₹6.2L" delta="+₹1.1L this week" kind="risk" />
          <KPICard label="Due this week" value="₹3.8L" sub="12 invoices" kind="attention" />
          <KPICard label="Collected — Aug" value="₹11.4L" delta="+8.2% vs July" kind="healthy" />
        </div>
        <div className="hide-mobile"><DataTable /></div>
        <div className="show-mobile"><MobileTransactions /></div>
      </div>
    </div>
  );
}

function CustomersScreen() {
  const list = [
    { name:"Mehta Traders",    region:"North", ltv:"₹8.2L", risk:78, kind:"risk" as Pill },
    { name:"Patel Electronics",region:"West",  ltv:"₹6.1L", risk:22, kind:"healthy" as Pill },
    { name:"Singh & Co",       region:"South", ltv:"₹4.8L", risk:52, kind:"attention" as Pill },
    { name:"Gupta & Sons",     region:"East",  ltv:"₹3.9L", risk:15, kind:"healthy" as Pill },
    { name:"Kapoor Textiles",  region:"West",  ltv:"₹3.2L", risk:45, kind:"attention" as Pill },
  ];
  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Customers</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Health, lifetime value, and collection risk</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Total customers" value="142" sub="6 regions" />
          <KPICard label="At risk" value="8" sub="Overdue 45+ days" kind="risk" />
          <KPICard label="Repeat rate" value="71%" delta="+3% vs last quarter" kind="healthy" />
          <KPICard label="Avg LTV" value="₹3.4L" delta="+12% vs last year" kind="healthy" />
        </div>
        <div className="s-card" style={{ backgroundColor: C.surface, borderRadius: 14, overflow: "hidden" }}>
          {list.map((c, i) => {
            const color = c.risk >= 70 ? C.rose : c.risk >= 40 ? C.gold : C.sage;
            return (
              <div key={c.name} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "13px 20px",
                borderBottom: i < list.length - 1 ? `1px solid ${C.border}` : undefined,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, backgroundColor: C.orangeFaint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.orange, flexShrink: 0,
                  boxShadow: "2px 2px 5px rgba(0,0,0,0.07), -1px -1px 3px rgba(255,255,255,0.80)",
                }}>{c.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                  <p style={{ fontSize: 11.5, color: C.ink3 }}>{c.region}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: "DM Mono, monospace", flexShrink: 0 }}>{c.ltv}</span>
                <div style={{ width: 72, flexShrink: 0 }} className="hidden-xs">
                  <div style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(28,37,53,0.08)", overflow: "hidden" }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${c.risk}%`, backgroundColor: color }} />
                  </div>
                </div>
                <StatusPill kind={c.kind}>{c.kind === "healthy" ? "Healthy" : c.kind === "attention" ? "Watch" : "At risk"}</StatusPill>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InsightsScreen() {
  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: C.bg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Insights</h2>
          <p style={{ fontSize: 13.5, color: C.ink2 }}>Revenue trends, regional performance, and forecasts</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="md-4-col">
          <KPICard label="Aug revenue" value="₹18.7L" delta="+11.4% vs July" kind="healthy" />
          <KPICard label="New orders" value="63" delta="+7 vs last month" kind="healthy" />
          <KPICard label="Avg order value" value="₹29,700" delta="+4.2% vs July" kind="healthy" />
          <KPICard label="North region" value="₹4.1L" sub="Recovering · 6% above target" kind="attention" />
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

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [nav, setNav] = useState("overview");
  const [open, setOpen] = useState(false);

  const screens: Record<string, { title: string; content: React.ReactNode }> = {
    overview:    { title: "Good morning, Rajan",  content: <OverviewScreen /> },
    receivables: { title: "Receivables",           content: <ReceivablesScreen /> },
    customers:   { title: "Customers",             content: <CustomersScreen /> },
    insights:    { title: "Insights",              content: <InsightsScreen /> },
    datasources: { title: "Data sources",          content: <PlaceholderScreen title="Data sources" sub="Connect your accounting software, bank feeds, and sales data." /> },
    settings:    { title: "Settings",              content: <PlaceholderScreen title="Settings" sub="Account preferences, notifications, and team management." /> },
  };

  const s = screens[nav] || screens.overview;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: C.bg }}>
      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes rise  {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rise-1 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.06s both; }
        .rise-2 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.14s both; }
        .rise-3 { animation: rise 0.38s cubic-bezier(0.22,1,0.36,1) 0.22s both; }

        /* Responsive helpers */
        @media (min-width: 640px) {
          .md-4-col { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (min-width: 1024px) {
          .lg-3col { grid-template-columns: 1fr 1fr 300px !important; }
          .lg-2col { grid-template-columns: 1fr 1fr !important; }
          .col-span-2 { grid-column: span 2; }
          .right-col { grid-column: span 1; }
        }
        @media (max-width: 1023px) {
          .col-span-2, .right-col { grid-column: span 1; }
        }
        @media (min-width: 480px) {
          .hidden-xs { display: block !important; }
        }
        @media (max-width: 479px) {
          .hidden-xs { display: none !important; }
        }
        .hide-mobile  { display: block; }
        .show-mobile  { display: none; }
        @media (max-width: 639px) {
          .hide-mobile { display: none; }
          .show-mobile { display: block; }
        }

        /* Button press */
        .s-btn-press:active {
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.10), inset -1px -1px 2px rgba(255,255,255,0.60) !important;
          transform: translateY(0) !important;
        }

input::placeholder { color: #96A3B4; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Backdrop */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(28,37,53,0.25)", backdropFilter: "blur(2px)",
        }} />
      )}

      {/* Single sidebar — always a slide-in drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 220, zIndex: 50,
        borderRight: `1px solid ${C.border}`,
        boxShadow: "4px 0 16px rgba(0,0,0,0.08)",
        backgroundColor: C.bg,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
      }}>
        <Sidebar active={nav} onChange={(id) => { setNav(id); setOpen(false); }} />
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <TopBar title={s.title} onMenuClick={() => setOpen(o => !o)} />
        {s.content}
      </div>
    </div>
  );
}
