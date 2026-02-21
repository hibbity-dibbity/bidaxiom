---
phase: 41-design-foundation
plan: 01
subsystem: design-tokens
tags: [css-variables, tailwind, financial-tokens, dark-mode, dependencies]
dependency_graph:
  requires: []
  provides:
    - financial-css-tokens
    - financial-tailwind-classes
    - react-virtual-v3
    - motion-v12
    - react-number-format-v5
    - canonical-class-recipes
  affects:
    - apps/web/app/globals.css
    - apps/web/tailwind.config.ts
    - apps/web/package.json
    - apps/web/COMPONENT-ORGANIZATION.md
tech_stack:
  added:
    - "@tanstack/react-virtual@^3.13.18"
    - "motion@^12.34.3"
    - "react-number-format@^5.4.4"
  patterns:
    - "CSS variable token pattern: HSL tuples in :root and .dark, consumed by hsl(var()) Tailwind extensions"
    - "Flat Tailwind color entries for tokens with no foreground variant"
key_files:
  modified:
    - apps/web/app/globals.css
    - apps/web/tailwind.config.ts
    - apps/web/package.json
    - apps/web/COMPONENT-ORGANIZATION.md
decisions:
  - "Financial tokens use flat string format (not nested object) in tailwind.config.ts — no foreground variant needed"
  - "motion v12 import path is 'motion/react' not 'framer-motion' — documented in COMPONENT-ORGANIZATION.md"
  - "Dark mode financial tokens use lighter palette steps (emerald-400, rose-400, amber-400) vs light mode (emerald-600, rose-600, amber-600)"
metrics:
  duration: "~1 minute"
  tasks_completed: 3
  files_modified: 4
  completed_date: "2026-02-21"
---

# Phase 41 Plan 01: Design Foundation Tokens Summary

Financial CSS tokens (emerald/rose/amber in light+dark), three Wave 2 dependency packages installed, and canonical class recipes documented — all 56 Wave 2 file migrations are now unblocked.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add financial semantic tokens | 61ba659 | apps/web/app/globals.css, apps/web/tailwind.config.ts |
| 2 | Install 3 npm packages | 38a6891 | apps/web/package.json, package-lock.json |
| 3 | Add Canonical Class Recipes section | db7f9d8 | apps/web/COMPONENT-ORGANIZATION.md |

## What Was Built

### Financial Semantic Tokens (Task 1)

Added 3 CSS variables to `globals.css` in both `:root` (light mode) and `.dark` (dark mode) blocks:

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--financial-positive` | emerald-600 `160 84% 39%` | emerald-400 `160 60% 60%` |
| `--financial-negative` | rose-600 `347 77% 50%` | rose-400 `347 77% 68%` |
| `--financial-pending` | amber-600 `38 92% 50%` | amber-400 `32 95% 60%` |

Added 3 flat color extensions to `tailwind.config.ts` using `hsl(var(--financial-*))` pattern. This generates:
- `text-financial-positive`, `bg-financial-positive`, `border-financial-positive`
- `text-financial-negative`, `bg-financial-negative`, `border-financial-negative`
- `text-financial-pending`, `bg-financial-pending`, `border-financial-pending`

### npm Package Installs (Task 2)

| Package | Version | Purpose |
|---------|---------|---------|
| `@tanstack/react-virtual` | ^3.13.18 | Virtualized list/table rendering for large data sets |
| `motion` | ^12.34.3 | Rebranded Framer Motion — animations and transitions |
| `react-number-format` | ^5.4.4 | Numeric input formatting (currency, percentages) |

### Canonical Class Recipes (Task 3)

Appended a new "## Canonical Class Recipes" section to `COMPONENT-ORGANIZATION.md` covering:
1. **Table rows** — `h-9 py-1.5 text-sm` (36px locked density)
2. **Column headers** — `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`
3. **Form inputs** — `h-9 text-sm` (36px, matching rows)
4. **Page header action area** — VISUAL-03 `flex items-center gap-2` with primary action leftmost
5. **Financial token usage rules** — apply to number text and adjacent icons ONLY; never on backgrounds
6. **Dark mode forbidden classes** — bg-white, bg-amber-50, text-gray-*, text-slate-* and their replacements
7. **Package import paths** — `import { motion } from "motion/react"`, NumericFormat, useVirtualizer

## Verification Results

1. `globals.css` — `--financial-positive` found at lines 45 (:root) and 97 (.dark)
2. `tailwind.config.ts` — all 3 `hsl(var(--financial-*))` extensions present at lines 75-77
3. `package.json` — `@tanstack/react-virtual@^3.13.18`, `motion@^12.34.3`, `react-number-format@^5.4.4` present
4. `COMPONENT-ORGANIZATION.md` — "Canonical Class Recipes" section count: 1

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Flat vs nested Tailwind color format** — Financial tokens use flat string `'financial-positive': 'hsl(var(--financial-positive))'` rather than nested object because there is no foreground variant for these semantic colors. Follows same pattern as other flat entries (`border`, `input`, `ring`) in the config.

2. **motion v12 import path** — Documented `import { motion } from "motion/react"` in COMPONENT-ORGANIZATION.md. The package name changed from `framer-motion` to `motion`; the import path for React-specific hooks also changed from `framer-motion` to `motion/react`.

3. **Dark mode lightness adjustment** — Dark mode uses lighter palette steps (400 vs 600) to maintain WCAG contrast against dark backgrounds. Light mode: emerald-600, rose-600, amber-600. Dark mode: emerald-400, rose-400, amber-400.

## Self-Check: PASSED

Files verified to exist:
- FOUND: apps/web/app/globals.css (--financial-positive in lines 45 and 97)
- FOUND: apps/web/tailwind.config.ts (financial-positive in lines 75-77)
- FOUND: apps/web/COMPONENT-ORGANIZATION.md (Canonical Class Recipes section appended)

Commits verified:
- FOUND: 61ba659 — feat(41-01): add financial semantic tokens
- FOUND: 38a6891 — feat(41-01): install packages
- FOUND: db7f9d8 — docs(41-01): add Canonical Class Recipes section
