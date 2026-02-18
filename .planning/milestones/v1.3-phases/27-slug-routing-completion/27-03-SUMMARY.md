# Plan 27-03 Summary: UAT Verification — Slug Routing Completion

**Phase:** 27-slug-routing-completion
**Plan:** 03
**Status:** Complete
**Date:** 2026-02-17

## What Was Done

Human UAT verification of all four SLUG requirements (SLUG-01 through SLUG-04) in the browser.

During UAT, a bug was discovered and fixed: the slug generation for customers and subcontractors was including a UUID prefix (`cust-{uuid8}-` / `sub-{uuid8}-`), producing URLs like `/customers/cust-a8fcee5b-cool-beans-bro` instead of `/customers/cool-beans-bro`.

**Bug fix applied:**
- Added `generateNameSlug(name: string)` to `apps/api/src/utils/slug.ts`
- Updated all 4 call sites (customer create, customer update, subcontractor create, subcontractor update) to use `generateNameSlug` instead of `generateSlug` with UUID prefix
- Ran one-time migration (`fix-customer-sub-slugs.ts`) to re-slug all 4 existing DB records

## UAT Results

| Step | Requirement | Result |
|------|-------------|--------|
| 1. Customer list → detail URL | SLUG-01 | ✅ Pass (after slug fix) |
| 2. Project header customer link | SLUG-01 | ✅ Pass (after slug fix) |
| 3. Edit button visible on customer detail | SLUG-02 | ✅ Pass |
| 4. Edit dialog pre-populated | SLUG-02 | ✅ Pass |
| 5. Save without name change — URL unchanged | SLUG-02 | ✅ Pass |
| 6. Save with name change — URL updates to new slug | SLUG-02 | ✅ Pass |
| 7. Subcontractor list → detail URL | SLUG-03 | ✅ Pass (after slug fix) |
| 8. Edit button visible on subcontractor detail | SLUG-04 | ✅ Pass |
| 9. Save without name change — URL unchanged | SLUG-04 | ✅ Pass |
| 10. Save with name change — URL updates to new slug | SLUG-04 | ✅ Pass |

**10/10 steps passed. User typed "approved".**

## Commits

- `093932d` — feat(27-01): fix UUID customer link in project-header + add edit dialog to customer detail page
- `9c1da3b` — feat(27-02): thread updated slug through SubcontractorForm onSuccess for post-rename navigation
- `20967fb` — fix(27): drop UUID prefix from customer and subcontractor slug generation

## Requirements Satisfied

- ✅ SLUG-01: Customer detail pages use human-readable slug URLs; project header link uses slug
- ✅ SLUG-02: Customer detail page has Edit button; post-rename navigation to new slug URL
- ✅ SLUG-03: Subcontractor detail pages use human-readable slug URLs
- ✅ SLUG-04: Subcontractor edit navigates to new slug URL on name change
