---
phase: 41-design-foundation
plan: 03
subsystem: frontend-design-system
tags: [design-tokens, dark-mode, StatusBadge, bidding, projects, customers, subcontractors]
dependency_graph:
  requires: [41-01]
  provides: [token-compliant-project-pages, token-compliant-bidding-components]
  affects: [apps/web/app/(dashboard), apps/web/components/bidding]
tech_stack:
  added: []
  patterns: [StatusBadge-variant-mapping, phaseToVariant-helpers, bidStatusToVariant-helpers, text-financial-positive, text-financial-negative, text-destructive]
key_files:
  created: []
  modified:
    - apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/lifecycle-phase-badge.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/estimates/page.tsx
    - apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx
    - apps/web/app/(dashboard)/projects/components/columns.tsx
    - apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
    - apps/web/app/(dashboard)/subcontractors/page.tsx
    - apps/web/components/bidding/bid-card.tsx
    - apps/web/components/bidding/bid-comparison-table.tsx
    - apps/web/components/bidding/bid-history-table.tsx
    - apps/web/components/bidding/invitation-manager.tsx
    - apps/web/components/bidding/rfq-form.tsx
decisions:
  - Winning bid highlight in bid-comparison-table uses text-financial-positive on amount text only (not row background), consistent with locked decision from 41-RESEARCH
  - Exclusions column in bid-comparison-table uses text-financial-negative (numeric financial context), not text-destructive
  - rfq-form.tsx validation errors use text-destructive (form errors, not financial values)
  - Invitation "declined" status uses StatusBadge variant="rejected" (correct semantic match)
  - Phase-to-variant mapping shared between lifecycle-phase-badge.tsx and projects/columns.tsx (identical logic, duplicated inline — acceptable for colocation)
  - Award dialog warning callout uses bg-muted/border-border/text-muted-foreground (informational note, not a destructive warning)
metrics:
  duration: "4 minutes"
  completed_date: "2026-02-21"
  tasks_completed: 2
  files_modified: 13
---

# Phase 41 Plan 03: Group C + Group D Token Migration Summary

Token migration of 13 project/customer/subcontractor pages and bidding components — replacing all inline palette color records (statusColors, phaseColors, bidStatusColors) with StatusBadge component calls and financial/semantic token classes.

## What Was Built

**Group C — 8 project/customer/subcontractor files:**
- `lifecycle-phase-badge.tsx`: Replaced `phaseColors` Record (9 palette strings) with `phaseToVariant()` helper function + `StatusBadge` component
- `projects/columns.tsx`: Same phaseColors → phaseToVariant() + StatusBadge pattern for read-only list column badges
- `customers/[customerSlug]/page.tsx`: `statusColors` Record for ProjectStatus → `projectStatusToVariant()` + StatusBadge; removed Badge import
- `subcontractors/[subcontractorSlug]/page.tsx`: `getStatusColor()` function → `subStatusToVariant()` + StatusBadge
- `subcontractors/page.tsx`: Same getStatusColor() → subStatusToVariant() + StatusBadge pattern
- `project-header.tsx`: `border-amber-200 bg-amber-50 text-amber-800` restored banner → `border-border bg-muted text-muted-foreground`; `bg-slate-500/10 text-slate-600` mode badge → `bg-muted text-muted-foreground`
- `estimates/page.tsx`: Inline ternary className string for status badges → StatusBadge with draft/pending/approved/rejected variants
- `projects/[projectSlug]/page.tsx`: `phaseStatusColors` object values `text-gray-400/text-blue-500/text-green-500` → token classes; fallback also updated

**Group D — 5 bidding components:**
- `bid-card.tsx`: `bidStatusColors` Record (6 palette strings) → `bidStatusToVariant()` + StatusBadge; amendment warning `text-orange-600` → `text-muted-foreground`
- `bid-comparison-table.tsx`: `levelingCategories` palette color strings → StatusBadge variant property; winning bid highlight `bg-green-500/20 text-green-800 border-2 border-green-500` → `bg-muted/50 text-financial-positive`; exclusions `text-red-600` → `text-financial-negative`; awarded status badge → StatusBadge; award dialog warning callout → bg-muted tokens; removed Badge import (replaced by StatusBadge for all badge usages)
- `bid-history-table.tsx`: `getStatusColor()` function → `bidStatusToVariant()` + StatusBadge; removed Badge import
- `invitation-manager.tsx`: `invitationStatusColors` Record → `invitationStatusToVariant()` + StatusBadge; removed Badge import
- `rfq-form.tsx`: All 5 instances of `text-red-500` validation errors → `text-destructive`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a9ea259 | feat(41-03): migrate Group C — project/customer/sub pages to design tokens |
| Task 2 | e6a2a0c | feat(41-03): migrate Group D — bidding components to design tokens |

## Deviations from Plan

None — plan executed exactly as written. All palette class replacements were mechanical and matched the specified patterns precisely.

## Self-Check: PASSED

- All 13 modified files confirmed present on disk
- Both commits confirmed in git log (a9ea259, e6a2a0c)
- Combined grep verification: 0 palette class matches across all 13 files
