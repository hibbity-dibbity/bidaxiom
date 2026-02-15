---
phase: 13-navigation-and-theme-foundation
plan: 05
subsystem: ui-design-system
tags: [theme, design-tokens, procore-style, tailwind, css-variables]
completed_at: 2026-02-15T00:13:40Z
duration_minutes: 2

dependencies:
  requires:
    - phase: 13
      plan: 01
      feature: theme-provider
  provides:
    - procore-style-design-tokens
    - compact-spacing-utilities
    - construction-accent-color
  affects:
    - all-ui-components

tech_stack:
  added:
    - design-tokens.ts (TypeScript design constants)
  patterns:
    - CSS custom properties for theme tokens
    - Tailwind theme extension with utility classes
    - 4px base grid spacing system

key_files:
  created:
    - apps/web/lib/design-tokens.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/tailwind.config.ts

decisions: []

metrics:
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 2
---

# Phase 13 Plan 05: Procore-Style Visual Design System Summary

Implemented Procore-style visual design system with compact spacing, sharp corners, consistent typography, and construction accent color.

## What Was Built

### Design Token System

**CSS Variables (globals.css):**
- Reduced `--radius` from 0.5rem to 0.25rem for sharp corners
- Added compact spacing tokens (xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px)
- Added construction accent color (HSL: 25 95% 53% light, 58% dark)
- Added typography scale tokens (xs: 12px through 2xl: 24px)
- All tokens follow 4px base grid system

**Tailwind Extensions (tailwind.config.ts):**
- Construction color utility: `text-construction`, `bg-construction`
- Sharp border-radius: `rounded-sharp` (0), `rounded-sharp-sm` (2px)
- Compact spacing: `p-compact-md`, `m-compact-lg`, etc.
- Typography sizes: `text-xs`, `text-sm`, etc. (references CSS variables)

**TypeScript Constants (design-tokens.ts):**
- `SPACING` constants for programmatic use
- `COLORS.CONSTRUCTION` for light/dark modes
- `TYPOGRAPHY.SIZE` and `TYPOGRAPHY.WEIGHT`
- `RADIUS` constants for border-radius values
- Full TypeScript autocomplete and type safety

## Architecture Decisions

None - implemented design system foundation as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b767a53 | Define Procore-style design tokens in globals.css |
| 2 | de3d066 | Extend Tailwind config and create design token constants |

## Impact Analysis

**Benefits:**
- Enterprise-grade visual density matching Procore UX
- Consistent spacing and typography across all components
- Sharp corners create professional construction software aesthetic
- Construction accent color provides brand differentiation
- Type-safe design tokens for programmatic styling

**Usage Patterns:**

```tsx
// Tailwind utility classes
<div className="p-compact-md rounded-sharp bg-construction">
  <h2 className="text-xl font-semibold">Project Dashboard</h2>
</div>

// Programmatic styling
import { SPACING, COLORS } from "@/lib/design-tokens";

<div style={{ padding: SPACING.COMPACT_MD }}>
  <span style={{ color: COLORS.CONSTRUCTION.LIGHT }}>Status</span>
</div>
```

**Next Steps:**
- Plan 13-06 will apply these tokens to Navigation components
- All existing shadcn components automatically use reduced border-radius
- Compact spacing can be progressively adopted in dense data tables

## Self-Check: PASSED

**Files created:**
```
FOUND: apps/web/lib/design-tokens.ts
```

**Files modified:**
```
FOUND: apps/web/app/globals.css
FOUND: apps/web/tailwind.config.ts
```

**Commits exist:**
```
FOUND: b767a53
FOUND: de3d066
```

All deliverables verified on disk.
