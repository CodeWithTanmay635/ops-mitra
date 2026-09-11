# OpsMitra Design System Guidelines

## Stance: Swiss Financial Intelligence
Strict grid, precise alignment, function declares the aesthetic. No decorative excess. Every element earns its place by communicating something meaningful.

## Color Tokens

### Palette
- `--color-navy`: #0F1B35 — primary foundation, trust, depth
- `--color-navy-mid`: #1E3258 — elevated surfaces, sidebar
- `--color-navy-light`: #2D4A7A — subtle navy accents
- `--color-off-white`: #F7F5F0 — warm page background
- `--color-surface`: #FFFFFF — card surfaces
- `--color-teal`: #0D9488 — healthy state, positive actions
- `--color-teal-light`: #CCFBF1 — teal tint backgrounds
- `--color-gold`: #B59B4E — opportunity, attention
- `--color-gold-light`: #FEF3C7 — gold tint backgrounds
- `--color-coral`: #DC4F4F — financial risk, alerts
- `--color-coral-light`: #FEE2E2 — coral tint backgrounds
- `--color-slate-400`: #94A3B8
- `--color-slate-500`: #64748B
- `--color-slate-600`: #475569
- `--color-border`: #E2E8F0

## Typography

### Font: Inter (Google Fonts)
- Display/Headings: Inter 600–700
- Body: Inter 400–500
- Data labels/KPIs: Inter 600–700 with tabular nums

### Scale
- `text-3xl` (30px/36px) — page titles, major KPIs
- `text-2xl` (24px/32px) — section headings
- `text-xl` (20px/28px) — card titles, sub-KPIs
- `text-lg` (18px/28px) — prominent labels
- `text-base` (16px/24px) — body text, AI explanations
- `text-sm` (14px/20px) — supporting metrics, captions
- `text-xs` (12px/16px) — labels, badges, meta

## Spacing System (8px base)
- 4px (0.5) — tight spacing, inline gaps
- 8px (2) — component internal padding
- 12px (3) — compact elements
- 16px (4) — standard padding
- 24px (6) — section breathing room
- 32px (8) — card padding
- 48px (12) — section gaps
- 64px (16) — major section breaks

## Corner Radii
- `rounded` (4px) — badges, tags, tight elements
- `rounded-md` (6px) — buttons, inputs
- `rounded-lg` (8px) — cards, panels
- `rounded-xl` (12px) — modals, major containers

## Shadows
- `shadow-sm` — card resting state
- `shadow-md` — card hover, dropdowns
- `shadow-lg` — modals, overlays

## Components

### KPI Cards
Navy number, teal/gold/coral delta indicator, slate label. Compact, scannable.

### AI Recommendation Cards
Left border accent (teal/gold/coral by priority), AI icon, action CTA. Never a chatbot bubble.

### Status Badges
Pill shapes: teal=healthy, gold=attention, coral=risk, slate=neutral.

### Data Tables
Alternating subtle row tints, right-aligned numbers with tabular figures, sortable headers.

### Buttons
- Primary: navy bg, white text
- Secondary: teal bg, white text
- Ghost: transparent, navy border
- Danger: coral bg, white text
