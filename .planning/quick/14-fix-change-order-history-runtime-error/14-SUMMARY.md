---
type: quick
wave: 1
subsystem: change-orders
tags: [bugfix, type-safety, runtime-error]

dependency-graph:
  requires: []
  provides: [type-safe-history-rendering]
  affects: [change-order-detail-page]

tech-stack:
  added: []
  patterns: [type-guards, safe-type-conversion]

key-files:
  created: []
  modified:
    - apps/web/components/change-order/change-order-history.tsx

decisions: []

metrics:
  duration: 2 min
  tasks-completed: 1
  files-modified: 1
  completed: 2026-02-16T00:24:00Z
---

# Quick Task 14: Fix Change Order History Runtime Error

**One-liner:** Fixed runtime error where `.replace()` was called on non-string JSONB values in change order history component.

## Problem

The change order history component assumed `oldValue` and `newValue` were always strings, but the database schema defines them as JSONB (`$type<unknown>()`), allowing strings, numbers, objects, or arrays. Lines 74 and 78 called `.replace(/_/g, " ")` without type checking, causing runtime errors when values were non-string types.

## Solution

Added type-safe value formatting:

1. **formatHistoryValue helper function** - Safely converts any value type to string:
   - Returns "(empty)" for null/undefined
   - Returns string values as-is
   - Converts numbers and booleans using String()
   - Serializes objects using JSON.stringify()

2. **Updated field_update case** - Uses formatHistoryValue for both oldValue and newValue to handle any data type

3. **Updated status_change case** - Type-checks values before calling .replace():
   - If string: formats underscores to spaces
   - Otherwise: uses formatHistoryValue helper

## Changes

### Modified Files

**apps/web/components/change-order/change-order-history.tsx**
- Added formatHistoryValue helper (lines 59-65)
- Updated field_update rendering to use helper (lines 73-74)
- Updated status_change rendering with type guards (lines 82, 86)
- Maintains backward compatibility with existing string values

## Verification

**Code changes:**
- Component safely handles all JSONB value types
- String status values still display with spaces instead of underscores
- No runtime errors when rendering different value types

**Type safety:**
- .replace() only called on verified string values
- All other types safely converted to strings
- Handles edge cases (null, undefined, objects, arrays)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| 0bbb083 | fix(quick-14): add type-safe value formatting to change order history |

## Self-Check: PASSED

**Created files:** N/A (modification only)

**Modified files:**
- FOUND: apps/web/components/change-order/change-order-history.tsx

**Commits:**
- FOUND: 0bbb083

All changes verified and committed successfully.
