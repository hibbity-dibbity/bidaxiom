# Phase 20: Configuration Foundation

**Goal:** Company admins can configure job number format, starting sequence, and auto-generation settings through a visible and functional UI.

**Status:** Ready to execute (2 plans created)

**Dependencies:** None (first phase of v1.2)

**Requirements:** JOBCFG-01, JOBCFG-02, JOBCFG-03, JOBCFG-04

## Context

Job number configuration UI was initially restored in Quick-5 (Feb 14, 2026), which added:
- Job Numbering card to company settings page
- Enable/disable toggle, template input, sequence number input
- Live preview using `previewJobNumber()`
- Persistence via `company.update` mutation

However, the v1.2 milestone identified ongoing issues with job number visibility and functionality. This phase ensures the configuration UI is fully functional and reliable.

## Plans

### Plan 01: Verify and Fix Configuration Persistence (Wave 1)
**Objective:** Ensure job number settings save correctly and persist across sessions

**Tasks:**
1. Verify company.update mutation persistence logic
2. Add data integrity migration to backfill missing settings
3. Ensure UI loads existing settings with proper fallbacks

**Files:** `apps/api/src/trpc/routers/company.ts`, `apps/api/src/tenant/migrate-tenant.ts`, `apps/web/app/(dashboard)/settings/company/page.tsx`

**Success criteria:**
- Settings save and survive company profile updates
- All tenants have valid default job_number_settings in database
- Form populates correctly on page load

---

### Plan 02: Enhanced Validation and Preview (Wave 1)
**Objective:** Improve template validation with detailed error messages and enhanced preview

**Tasks:**
1. Enhance validateJobNumberTemplate to return detailed errors
2. Add inline validation feedback in UI
3. Show multiple preview examples (next 3 job numbers)

**Files:** `packages/shared/src/types/company.ts`, `apps/web/app/(dashboard)/settings/company/page.tsx`

**Success criteria:**
- Validation catches invalid templates with clear error messages
- UI shows inline validation feedback
- Preview demonstrates token behavior with multiple examples

---

## Wave Structure

| Wave | Plans | Focus |
|------|-------|-------|
| 1 | 20-01, 20-02 | Configuration persistence and validation (parallel execution) |

Both plans can run in parallel as they touch different concerns (persistence vs validation).

## Technical Notes

**Existing foundation (from Quick-5):**
- `jobNumberSettings` JSONB column in `company_profiles` table
- `JobNumberSettings` type and schema in `packages/shared`
- `previewJobNumber()` and `validateJobNumberTemplate()` utility functions
- Job Numbering card in company settings page (lines 221-312)

**This phase strengthens:**
- Data integrity (migration to backfill missing settings)
- Validation (detailed error messages vs boolean check)
- UX (inline feedback, enhanced preview, token help)

## Success Criteria

Phase complete when:
- [x] Admin can access job number configuration in company settings
- [x] All fields (toggle, template, sequence) are visible and functional
- [x] Template validation provides clear, actionable error messages
- [x] Live preview shows accurate examples for all token types
- [x] Settings save successfully and persist across page reloads
- [x] All active tenants have valid jobNumberSettings in database
- [x] Non-admin users see read-only state
