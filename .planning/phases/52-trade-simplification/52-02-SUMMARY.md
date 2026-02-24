---
phase: 52-trade-simplification
plan: "02"
subsystem: subcontractor-directory
tags: [trades, trpc, zod, search, bidding]
dependency_graph:
  requires:
    - 52-01 (SIMPLE_TRADES constant, trade/tradeOther DB columns)
  provides:
    - createSubcontractorSchema and updateSubcontractorSchema with trade/tradeOther fields
    - subcontractor.list tRPC accepts string trade filter against new trade column
    - subcontractor.create/update tRPC persists trade[] and tradeOther
    - search.global returns trade subtitle for subcontractor results
  affects:
    - packages/shared/src/types/bidding.ts
    - apps/api/src/trpc/routers/subcontractor.ts
    - apps/api/src/trpc/routers/search.ts
tech_stack:
  added: []
  patterns:
    - zod enum array field with default([]) for create schema
    - nullable().optional() for update schema string fields
    - JSONB containment filter against string[] column
    - Conditional subtitle mapping (tradeOther substitution for "Other")
key_files:
  created: []
  modified:
    - packages/shared/src/types/bidding.ts
    - apps/api/src/trpc/routers/subcontractor.ts
    - apps/api/src/trpc/routers/search.ts
decisions:
  - "Preserve existing trades (number[]) field in all schemas — getByTrades procedure untouched for RFQ compat"
  - "list trade filter changed from z.number().int() to z.string() to accept plain trade names"
  - "Auto-fixed pre-existing address field bug in create/update procedures (Rule 1)"
metrics:
  duration: "~8 minutes"
  completed: "2026-02-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 3
---

# Phase 52 Plan 02: tRPC Layer Update for Plain-Text Trades Summary

tRPC subcontractor router and Zod schemas updated to accept, persist, and return the new trade[] / tradeOther fields; search router now computes a trade subtitle for subcontractor results.

## Tasks Completed

| Task | Name | Commit | Key Files |
| ---- | ---- | ------ | --------- |
| 1 | Add trade/tradeOther to Zod schemas in bidding.ts | a2cb2af | packages/shared/src/types/bidding.ts |
| 2 | Update subcontractor tRPC router (list/create/update) | a768174 | apps/api/src/trpc/routers/subcontractor.ts |
| 3 | Update search router for trade subtitle | 3262da3 | apps/api/src/trpc/routers/search.ts |

## What Was Built

### Zod Schema Updates (packages/shared/src/types/bidding.ts)
- Added `import { tradeValueEnum } from "../constants/trades"` at top
- `createSubcontractorSchema`: added `trade: z.array(tradeValueEnum).default([])` and `tradeOther: z.string().max(200).optional()`
- `updateSubcontractorSchema`: added `trade: z.array(tradeValueEnum).optional()` and `tradeOther: z.string().max(200).nullable().optional()`
- Existing `trades: z.array(z.number().int())` fields preserved in both schemas

### Subcontractor tRPC Router (apps/api/src/trpc/routers/subcontractor.ts)
- `list` procedure: trade filter input changed from `z.number().int().optional()` to `z.string().optional()`; JSONB containment filter now targets `schema.subcontractorDirectory.trade` (string[] column) instead of `.trades`
- `create` procedure: insert values block now includes `trade: input.trade ?? []` and `tradeOther: input.tradeOther ?? null`
- `update` procedure: updateValues block now conditionally sets `trade` and `tradeOther` when present in input
- `getByTrades` procedure: untouched (RFQ compatibility)

### Search Router (apps/api/src/trpc/routers/search.ts)
- Subcontractor search query now selects `trade` and `tradeOther` columns in addition to id/companyName/slug
- Result mapping computes subtitle: comma-joined trade names, with `tradeOther` value substituted for "Other" when custom text exists; `null` for subs with empty trade array

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing address field mismatch in subcontractor router**
- **Found during:** Task 2 (TypeScript compile verification)
- **Issue:** `create` and `update` procedures in subcontractor.ts were accessing `input.address?.street1`, `input.address?.city` etc., but `createSubcontractorSchema` and `updateSubcontractorSchema` have individual `street1`, `street2`, `city`, `state`, `zip` fields at the top level — not nested under `address`. This caused 11 TypeScript errors.
- **Fix:** Changed create insert block to use `input.street1 || null`, `input.city || null` etc. directly. Changed update block from a single `if (input.address !== undefined)` guard to individual guards per field (`if (input.street1 !== undefined)` etc.).
- **Files modified:** `apps/api/src/trpc/routers/subcontractor.ts`
- **Commit:** a768174

## Self-Check: PASSED

- packages/shared/src/types/bidding.ts: UPDATED (trade + tradeOther in both schemas, tradeValueEnum imported)
- apps/api/src/trpc/routers/subcontractor.ts: UPDATED (list/create/update all have trade/tradeOther support)
- apps/api/src/trpc/routers/search.ts: UPDATED (selects trade/tradeOther; subtitle computed)
- Commit a2cb2af: FOUND
- Commit a768174: FOUND
- Commit 3262da3: FOUND
- packages/shared TypeScript compile: CLEAN
- apps/api TypeScript compile (modified files): CLEAN
