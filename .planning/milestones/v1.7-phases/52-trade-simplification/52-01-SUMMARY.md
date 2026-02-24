---
phase: 52-trade-simplification
plan: "01"
subsystem: subcontractor-directory
tags: [trades, schema, migration, shared-constants]
dependency_graph:
  requires: []
  provides:
    - SIMPLE_TRADES constant in @construction/shared
    - trade and tradeOther columns on subcontractor_directory
    - idempotent migration script for existing tenants
  affects:
    - packages/shared
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
tech_stack:
  added: []
  patterns:
    - zod enum from const array (tradeValueEnum)
    - Drizzle JSONB with .$type annotation for string[]
    - Idempotent tenant-loop migration (ADD COLUMN IF NOT EXISTS)
key_files:
  created:
    - packages/shared/src/constants/trades.ts
    - apps/api/src/db/migrations/migrate-phase52.ts
  modified:
    - packages/shared/src/constants/index.ts
    - apps/api/src/db/schema/tenant.ts
    - apps/api/src/tenant/provision.ts
decisions:
  - "Preserve old trades JSONB (number[]) column for RFQ compatibility — do not repurpose"
  - "New trade column uses JSONB string[] to support multi-trade selection"
  - "Clear existing CSI number[] data on migration — no auto-mapping to new 12 trades"
metrics:
  duration: "~10 minutes"
  completed: "2026-02-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 3
---

# Phase 52 Plan 01: Trade Simplification Foundation Summary

SIMPLE_TRADES constant (12 plain-English trades) added to shared package with zod enum, plus trade JSONB and trade_other TEXT columns added to subcontractor_directory schema and migrated to all active tenant schemas.

## Tasks Completed

| Task | Name | Commit | Key Files |
| ---- | ---- | ------ | --------- |
| 1 | Create SIMPLE_TRADES constant | 81e478e | packages/shared/src/constants/trades.ts, index.ts |
| 2 | Add trade columns to Drizzle schema and provision.ts | 3ae6d95 | apps/api/src/db/schema/tenant.ts, provision.ts |
| 3 | Write and run phase-52 migration | a1704a7 | apps/api/src/db/migrations/migrate-phase52.ts |

## What Was Built

### SIMPLE_TRADES Constant (packages/shared)
- Created `packages/shared/src/constants/trades.ts` exporting `SIMPLE_TRADES` as const array of 12 trades: Plumbing, Electrical, HVAC, Concrete, Metal Buildings, Framing, Roofing, Painting, Flooring, Drywall, General, Other
- Exported `TradeValue` TypeScript type (union of all 12 string literals)
- Exported `tradeValueEnum` as `z.enum(SIMPLE_TRADES)` for tRPC/Zod validation
- Wired into `packages/shared/src/constants/index.ts` — available as `import { SIMPLE_TRADES, tradeValueEnum } from "@construction/shared"`

### Drizzle Schema Update (apps/api/src/db/schema/tenant.ts)
- Added `trade: jsonb("trade").notNull().default([]).$type<string[]>()` to `subcontractorDirectory` table
- Added `tradeOther: text("trade_other")` to `subcontractorDirectory` table
- Preserved existing `trades: jsonb("trades").notNull().default([]).$type<number[]>()` column (RFQ compatibility)

### Provision.ts Raw SQL Update (apps/api/src/tenant/provision.ts)
- Added `trade JSONB NOT NULL DEFAULT '[]'::jsonb` and `trade_other TEXT` to the raw SQL CREATE TABLE for `subcontractor_directory`
- New tenants provisioned after this migration will include both columns from the start

### Migration Script (apps/api/src/db/migrations/migrate-phase52.ts)
- Loops over all active tenants from the `tenants` table
- For each schema: ADD COLUMN IF NOT EXISTS trade JSONB, ADD COLUMN IF NOT EXISTS trade_other TEXT, UPDATE trades = '[]'
- Fully idempotent — safe to re-run
- Ran successfully: 1 tenant migrated, 0 failures

## Verification Results

- `packages/shared/src/constants/trades.ts` has all 12 trades in specified order
- `packages/shared/src/constants/index.ts` exports from trades.ts
- TypeScript compile on packages/shared: no errors
- TypeScript compile on apps/api (modified files): no errors
- Migration output: "Done: 1 succeeded, 0 failed"
- DB column verification on `tenant_vpa_g9edvkmrj3ao2oebusov.subcontractor_directory`:
  - `trade` (jsonb) - present
  - `trade_other` (text) - present
  - `trades` (jsonb) - preserved

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- packages/shared/src/constants/trades.ts: EXISTS
- packages/shared/src/constants/index.ts: UPDATED (has `export * from "./trades"`)
- apps/api/src/db/schema/tenant.ts: UPDATED (trade + tradeOther columns present)
- apps/api/src/tenant/provision.ts: UPDATED (trade JSONB + trade_other TEXT in raw SQL)
- apps/api/src/db/migrations/migrate-phase52.ts: EXISTS
- Commit 81e478e: FOUND
- Commit 3ae6d95: FOUND
- Commit a1704a7: FOUND
