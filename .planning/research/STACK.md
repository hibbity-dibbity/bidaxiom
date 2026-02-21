# Technology Stack — UX Redesign (Procore-Style Dense UI)

**Project:** BIDAXIOM UX Redesign Milestone
**Domain:** Dense enterprise construction SaaS UI — data grids, micro-interactions, form layouts
**Researched:** 2026-02-21
**Confidence:** HIGH (all versions verified against npm registry, Feb 2026)

---

## Context: What Already Exists (Do NOT Re-add)

The following are already installed and working — researching alternatives would be redundant:

| Already Installed | Version | Notes |
|-------------------|---------|-------|
| `@tanstack/react-table` | 8.21.3 | Headless table logic — keep, extend |
| `tailwindcss` | 3.4.x | CSS framework — keep |
| `tailwindcss-animate` | 1.0.7 | Keyframe animations — keep |
| `class-variance-authority` (CVA) | 0.7.1 | Component variants — keep |
| `tailwind-merge` | 2.6.0 | Class merging — keep |
| `shadcn/ui` primitives | Various | Radix-based components — keep |
| `react-hook-form` | 7.71.1 | Form state — keep |
| `@hookform/resolvers` | 5.2.2 | Zod validation — keep |
| `cmdk` | 1.1.1 | Command palette — keep |
| `sonner` | 2.0.7 | Toast notifications — keep |
| `lucide-react` | 0.460.0 | Icons — keep |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 6.3.1 / 10.0.0 | Drag-and-drop — keep |
| `recharts` | 3.7.0 | Charts — keep |
| `zustand` | 5.0.11 | Local state — keep |
| `nuqs` | 2.8.8 | URL state — keep |
| `react-day-picker` | 9.13.2 | Date picker — keep |
| `use-mask-input` | 3.6.1 | Input masking — keep |

---

## Recommended Stack Additions

### Priority 1 — Critical (Dense Data Tables)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@tanstack/react-virtual` | 3.13.18 | Row virtualization for large datasets | Part of TanStack family; already use react-table; virtualizes 10K+ rows at 60fps with sticky headers; pairs directly with TanStack Table |
| `react-resizable-panels` | 4.6.4 | Split-pane layouts (list + detail) | Already backing shadcn `Resizable` component — just needs to be used; enables Procore-style master-detail panels |

**Why `@tanstack/react-virtual` over react-virtuoso:**
TanStack Virtual is the TanStack-family pairing for `@tanstack/react-table`, which is already installed. The official TanStack Table docs include a [virtualized rows example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows) using `@tanstack/react-virtual`. react-virtuoso has simpler API but requires bridging to TanStack Table manually. Since the codebase already uses TanStack conventions, staying in-family reduces integration surface area.

---

### Priority 2 — High Value (Micro-interactions and Transitions)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `motion` | 12.34.3 | Smooth UI transitions, sidebar animations, panel expansions | Formerly Framer Motion; rebranded as `motion` npm package in late 2024; 34kb standard bundle, 4.6kb with `LazyMotion`; must use `"use client"` directive in Next.js App Router — not a blocker for UI components |

**Why `motion` over CSS-only approaches:**
`tailwindcss-animate` (already installed) handles entrance/exit keyframes well but cannot do spring physics, layout animations between component states, or gesture-driven interactions (hover velocity, drag momentum). For Procore-level polish — collapsible sidebar sliding with spring, row expansion with height animation, panel transitions — CSS transitions are brittle. `motion` solves this with 10 lines of code where CSS would require 50 lines of JS.

**Why not GSAP:**
GSAP's license requires a paid Greensock Club membership for SaaS products. Motion is MIT-licensed.

**Next.js App Router constraint:**
All Motion-wrapped components require `"use client"`. This is a non-issue for interactive UI components (tables, sidebars, modals) which are already client components. Keep Server Components for page shells; client components for any animated UI.

---

### Priority 3 — Form Infrastructure Gaps

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-number-format` | 5.4.4 | Currency inputs, percentage inputs, formatted number fields | Budget tables, change orders, payment apps all need $1,234.56 masking with proper decimal handling; `use-mask-input` (already installed) handles phone/date patterns but is not designed for numeric formats with currency symbols |
| `vaul` | 1.1.2 | Mobile bottom-sheet drawer (snap points, gesture-driven) | Already backs shadcn `Drawer` component; needed when redesigning mobile-responsive detail panels; iOS-style snap points for dense forms on tablet |

**Why `react-number-format` over `use-mask-input` for currency:**
`use-mask-input` handles character-by-character masks (phone numbers, dates). It does not handle numeric formatting semantics — decimal precision enforcement, currency symbol positioning, numeric value extraction vs. display value. `react-number-format` v5 supports both masked input (`PatternFormat`) and numeric input (`NumericFormat`), and is the community standard for financial inputs in React.

---

### Priority 4 — Optional / Conditional

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `@radix-ui/react-scroll-area` | 1.2.10 | Custom-scrollbar overflow containers | Already in package.json — just use it; needed for tables inside fixed-height panels with styled scrollbars |
| `tailwind-variants` | latest | Slot-based component variants (alternative to CVA) | **Only if** CVA variant patterns become unwieldy with compound component slots; CVA is already installed and working — do not add unless specifically needed |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ag-grid-react` | Apache 2 license has restrictions for SaaS; 2.6MB bundle; too heavyweight; styling fights Tailwind completely | TanStack Table + `@tanstack/react-virtual` (already have headless logic; add virtualization) |
| `react-virtuoso` | Excellent library but redundant with `@tanstack/react-virtual` when already using TanStack Table — creates two virtualization systems | `@tanstack/react-virtual` — stays in-family |
| `react-data-grid` | Opinionated styling; CSS override hell with Tailwind; not headless | TanStack Table — already installed and headless |
| `framer-motion` (old package name) | Rebranded to `motion`; installing `framer-motion` still works but installs the legacy package — unnecessary confusion | `motion` npm package (v12.34.3) |
| `animate.css` | Global keyframe stylesheet; conflicts with Tailwind's purging; adds 80KB for animations already available via `tailwindcss-animate` | `tailwindcss-animate` (already installed) + `motion` |
| `styled-components` or `emotion` | CSS-in-JS adds runtime overhead; conflicts with Tailwind utility approach; breaks App Router streaming | Tailwind utilities + CVA (already in place) |
| `react-table` (v7) | Deprecated; superseded by TanStack Table v8 | TanStack Table v8 (already installed) |
| `react-window` or `react-virtualized` | Older generation; not maintained; react-window has no TypeScript-first support | `@tanstack/react-virtual` v3 |
| `@mui/material` or `antd` | Full component library; class conflicts with Tailwind; adds 400KB+ to bundle; fights shadcn/ui | shadcn/ui (already installed) |

---

## Dense Table Architecture Pattern

The correct pattern for Procore-style dense tables with this stack:

```
TanStack Table (logic layer — already installed)
  + @tanstack/react-virtual (DOM virtualization — ADD)
  + shadcn Table primitives (Radix-based HTML structure — already installed)
  + Tailwind utilities for density (py-1 rows, text-xs cells — configuration only)
  + motion (optional row expansion/collapse animations)
```

**Do NOT:**
- Wrap in `@radix-ui/react-scroll-area` for tables with sticky headers — Radix ScrollArea uses `display: table` internally which breaks `position: sticky`. Use a plain `div` with `overflow-auto` + `max-h-[Xpx]` instead.
- Use `position: sticky` on `<thead>` inside a `ScrollArea` — known Radix bug (GitHub issue #2783).

**DO:**
```tsx
// Correct pattern for sticky header + virtualized body
<div className="relative overflow-auto" style={{ height: '600px' }}>
  <table className="w-full">
    <thead className="sticky top-0 z-10 bg-background">
      {/* headers */}
    </thead>
    <tbody>
      {/* @tanstack/react-virtual row virtualization here */}
    </tbody>
  </table>
</div>
```

---

## Density Configuration (No New Libraries Required)

Procore-style density is achieved through Tailwind class conventions, not libraries.

### Row Height Targets

| Density | Row Height | Tailwind Classes | Use Case |
|---------|------------|-----------------|---------|
| Compact | 32px | `h-8 py-1 text-xs` | Budget line items, SOV rows, trade lists |
| Default | 40px | `h-10 py-2 text-sm` | Project lists, RFQ tables, document lists |
| Comfortable | 48px | `h-12 py-3 text-sm` | Detail views, settings forms |

### Typography Scale (Procore-Inspired)

| Element | Size | Weight | Tailwind |
|---------|------|--------|---------|
| Table header | 11px | 600 | `text-[11px] font-semibold uppercase tracking-wider` |
| Table cell | 12px | 400 | `text-xs` |
| Section label | 11px | 500 | `text-[11px] font-medium text-muted-foreground` |
| Body text | 13-14px | 400 | `text-sm` |
| Page title | 16-18px | 600 | `text-base font-semibold` or `text-lg font-semibold` |

These are Tailwind class patterns — no additional library needed.

---

## Installation Commands

```bash
# In apps/web directory
npm install @tanstack/react-virtual@^3.13.18
npm install motion@^12.34.3
npm install react-number-format@^5.4.4

# vaul is likely already a transitive dep of shadcn Drawer — verify first:
npm ls vaul
# If not present:
npm install vaul@^1.1.2
```

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|----------------|-------|
| `@tanstack/react-virtual` | 3.13.18 | `@tanstack/react-table` 8.x, React 18 | TanStack family; designed to pair together |
| `motion` | 12.34.3 | Next.js 14 App Router, React 18 | Requires `"use client"` directive on animated components |
| `react-number-format` | 5.4.4 | `react-hook-form` 7.x via Controller | Wrap in `<Controller>` for RHF integration; not standalone input |
| `vaul` | 1.1.2 | Next.js 14, React 18 | Already backing shadcn Drawer — verify it's installed |
| `react-resizable-panels` | 4.6.4 | Next.js 14, React 18 | Already backing shadcn Resizable — no new install needed |

---

## Integration Points with Existing Stack

### react-number-format + react-hook-form + shadcn Input

```tsx
// Pattern: wrap NumericFormat in Controller for RHF integration
import { NumericFormat } from 'react-number-format';
import { Controller } from 'react-hook-form';

<Controller
  name="amount"
  control={control}
  render={({ field }) => (
    <NumericFormat
      {...field}
      customInput={Input}  // shadcn Input component
      thousandSeparator
      prefix="$"
      decimalScale={2}
      fixedDecimalScale
      placeholder="$0.00"
      className="text-right font-mono text-sm"
    />
  )}
/>
```

### @tanstack/react-virtual + TanStack Table

```tsx
// Minimal virtualization pattern for a 10K-row budget table
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const { rows } = table.getRowModel();

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 32,  // compact row height
  overscan: 10,
});

// Render only virtualizer.getVirtualItems()
```

### motion + Next.js App Router

```tsx
// Pattern: isolate motion in client components
'use client';
import { motion, AnimatePresence } from 'motion';

// motion components work normally in client components
// Do NOT import motion in Server Components (layout.tsx, page.tsx) without 'use client'
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Virtualization | `@tanstack/react-virtual` | `react-virtuoso` | Not in TanStack family; requires bridging to TanStack Table; both solve the same problem — pick one |
| Animation | `motion` | `GSAP` | GSAP requires paid license for commercial SaaS; Motion is MIT |
| Animation | `motion` | CSS only (`tailwindcss-animate`) | CSS can't do spring physics, layout-aware animations, or gesture velocity |
| Currency input | `react-number-format` | `cleave.js` | cleave.js unmaintained since 2022; last commit 2021 |
| Currency input | `react-number-format` | `use-mask-input` (already installed) | `use-mask-input` is character masking, not numeric formatting semantics |
| Component library | Keep shadcn/ui | AG Grid, MUI DataGrid | Too opinionated; CSS conflicts; bundle bloat; licensing |

---

## Sources

- [TanStack Table v8 Docs — Virtualized Rows Example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows) — HIGH confidence (official)
- [TanStack Virtual Installation](https://tanstack.com/virtual/latest/docs/installation) — HIGH confidence (official); version 3.13.18 verified via npm registry
- [Motion npm package](https://www.npmjs.com/package/motion) — version 12.34.3 verified via npm registry Feb 2026
- [Motion Reduce Bundle Size Guide](https://motion.dev/docs/react-reduce-bundle-size) — HIGH confidence; LazyMotion reduces to 4.6kb
- [Motion Upgrade Guide (Framer Motion → motion)](https://motion.dev/docs/react-upgrade-guide) — HIGH confidence (official)
- [react-resizable-panels shadcn update to v4](https://github.com/shadcn-ui/ui/issues/9197) — MEDIUM confidence; updated Feb 2025; version 4.6.4 verified npm
- [Radix ScrollArea + sticky positioning bug](https://github.com/radix-ui/primitives/issues/2783) — HIGH confidence (open GitHub issue); critical pitfall for table layouts
- [react-number-format npm](https://www.npmjs.com/package/react-number-format) — version 5.4.4 verified via npm registry Feb 2026
- [shadcn/ui Inline Edit Table Block](https://ui.shadcn.com/blocks/tables-inline-edit) — MEDIUM confidence; official shadcn blocks
- [vaul v1.1.2 release](https://github.com/emilkowalski/vaul) — HIGH confidence; version 1.1.2 verified npm
- [TanStack Virtual v3 GitHub](https://github.com/TanStack/virtual) — HIGH confidence; 922 npm dependents
- [LogRocket: Best React Animation Libraries 2026](https://blog.logrocket.com/best-react-animation-libraries/) — MEDIUM confidence (editorial)

---

*Stack research for: BIDAXIOM UX Redesign — Procore-Style Dense UI Milestone*
*Researched: 2026-02-21*
*Scope: New additions only — does not duplicate existing stack documentation*
