---
phase: quick-17
plan: 17
type: summary
completed: 2026-02-16
subsystem: branding
tags: [ui, branding, cleanup]
dependency_graph:
  requires: []
  provides: [static-bidaxiom-branding]
  affects: [sidebar, top-bar, sign-in, company-settings]
tech_stack:
  added: []
  patterns: [static-assets, dark-mode-invert]
key_files:
  created:
    - apps/web/public/bidaxiom-logo.png
    - apps/web/public/bidaxiom-icon.png
  modified:
    - apps/web/components/layout/sidebar.tsx
    - apps/web/components/layout/top-bar.tsx
    - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - apps/web/app/(dashboard)/settings/company/page.tsx
    - apps/api/src/trpc/routers/company.ts
    - apps/api/src/storage/presigned.ts
    - apps/api/src/db/schema/tenant.ts
  deleted:
    - apps/web/components/branding/company-logo.tsx
    - apps/web/components/branding/logo-upload.tsx
decisions:
  - Used CSS dark:invert filter for dark mode logo compatibility
  - Commented out schema column instead of creating migration
  - Removed branding section from company settings page entirely
metrics:
  duration: 4
  tasks: 5
  files: 12
  commits: 4
---

# Quick Task 17: Replace Company Branding with Static BidAxiom Logos

**One-liner:** Replaced dynamic company branding system with static BidAxiom logos using Next.js Image component with dark mode inversion via CSS filter.

## What Was Done

### Task 1: Copy Logo Files and Update UI Components
- Copied `BidAxiom-DarkFont-TransparentBG.png` → `apps/web/public/bidaxiom-logo.png`
- Copied `BidAxiom-IconOnly-TransparentBG.png` → `apps/web/public/bidaxiom-icon.png`
- **Sidebar:** Replaced `<CompanyLogo>` with Next.js `<Image>` components
  - Full logo (140x32) when expanded: `group-data-[collapsible=icon]:hidden`
  - Icon (32x32) when collapsed: `hidden group-data-[collapsible=icon]:block`
  - Dark mode: Added `dark:invert` CSS filter to both images
- **Top bar:** Removed logo completely (was `<CompanyLogo variant="topbar">`)
- **Sign-in page:** Replaced `<CompanyLogo variant="auth">` with static Image (200x48)
- All images use `priority` prop for above-the-fold optimization

**Commit:** `f809be8`

### Task 2: Delete Company Branding Components
- Deleted `apps/web/components/branding/company-logo.tsx` (tRPC query for logo URL, fallback icon)
- Deleted `apps/web/components/branding/logo-upload.tsx` (S3 presigned upload UI)
- Removed LogoUpload section from `apps/web/app/(dashboard)/settings/company/page.tsx`
- Verified no remaining references to `CompanyLogo` or `LogoUpload` in web app

**Commit:** `d2d235a`

### Task 3: Remove Logo Procedures from Backend
- **Company router:** Removed 3 procedures from `apps/api/src/trpc/routers/company.ts`
  - `uploadLogo` (generated presigned PUT URL, updated logoStorageKey)
  - `getLogo` (generated presigned GET URL)
  - `deleteLogo` (deleted from S3, cleared DB reference)
- **Presigned storage:** Removed 3 helper functions from `apps/api/src/storage/presigned.ts`
  - `generateLogoUploadUrl`
  - `generateLogoDownloadUrl`
  - `deleteLogoFromStorage`
- Document-related presigned URL functions remain intact

**Commit:** `2cb9f10`

### Task 4: Schema Cleanup
- Commented out `logoStorageKey: text("logo_storage_key")` in `apps/api/src/db/schema/tenant.ts`
- Added comment: "Logo columns removed in quick-17 (static BidAxiom branding)"
- No database migration created (existing columns remain in database for backward compatibility)
- Future tenant provisioning won't include the column

**Commit:** `8a9c376`

### Task 5: Final Verification
- ✅ No references to `CompanyLogo` in apps/web
- ✅ No references to `company-logo` or `logo-upload` in apps/web
- ✅ No references to `uploadLogo`, `getLogo`, `deleteLogo` in apps/api
- ✅ Logo files exist in `apps/web/public/`
- ✅ No new TypeScript compilation errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created public directory**
- **Found during:** Task 1
- **Issue:** `apps/web/public/` directory did not exist
- **Fix:** Created directory with `mkdir -p apps/web/public` before copying logo files
- **Files modified:** N/A (directory creation)
- **Commit:** Included in `f809be8`

**2. [Rule 2 - Missing functionality] Removed branding section from settings page**
- **Found during:** Task 2
- **Issue:** LogoUpload component used in company settings page (not listed in plan context)
- **Fix:** Removed LogoUpload import and entire "Company Branding" section from settings page
- **Files modified:** `apps/web/app/(dashboard)/settings/company/page.tsx`
- **Commit:** `d2d235a`

**3. [Rule 1 - Correctness] Added dark mode CSS filter**
- **Found during:** Task 1
- **Issue:** User requirement specified logo has dark font on transparent background (invisible in dark mode)
- **Fix:** Added `dark:invert` CSS class to all BidAxiom images for automatic color inversion in dark mode
- **Files modified:** sidebar.tsx, sign-in page.tsx
- **Commit:** `f809be8`

## Key Decisions

### 1. Dark Mode Handling via CSS Filter
**Decision:** Use `dark:invert` CSS filter instead of providing separate dark mode logo files.

**Rationale:**
- Simpler implementation (single logo file per variant)
- TailwindCSS built-in utility class
- Automatic color inversion handles all shades without manual editing

**Trade-offs:**
- Less control over exact dark mode appearance
- Filter affects entire image (not selective)
- Acceptable for logo use case (simple graphics invert well)

### 2. Schema Column Commented, Not Removed
**Decision:** Comment out `logoStorageKey` column definition instead of creating a migration to drop it.

**Rationale:**
- Existing databases have the column (migration would be required for all tenants)
- Column is harmless if unused (no performance impact)
- Prevents future tenant provisioning from including the column
- Avoids migration complexity for cleanup task

**Alternative considered:** Create `ALTER TABLE DROP COLUMN` migration, rejected due to scope creep.

### 3. Remove Logo from Top Bar
**Decision:** Completely remove logo from top bar (not just make it static).

**Rationale:**
- Plan explicitly stated "Top bar shows no logo (removed)"
- Sidebar logo provides sufficient branding
- Top bar space better used for functional elements (search, notifications)

## Testing Notes

**Build verification:**
- ❌ Next.js build fails due to pre-existing TypeScript error in `apps/api/src/integrations/quickbooks/oauth.ts` (unrelated to this task)
- ✅ API TypeScript compilation shows no new errors in modified files
- ✅ Logo files verified in public directory (2.0 MB logo, 2.1 MB icon)

**Pre-existing issues noted:**
- intuit-oauth type declarations missing (affects build, not related to branding changes)
- Multiple TypeScript errors in bid/estimate lifecycle code (unrelated)

**Visual verification required:**
1. Start dev servers: `cd apps/web && npm run dev` + `cd apps/api && npx tsx src/server.ts`
2. Navigate to app in browser
3. Verify sidebar shows BidAxiom logo (full when expanded, icon when collapsed)
4. Toggle dark mode → verify logo inverts to light color
5. Visit sign-in page → verify BidAxiom logo appears centered above card
6. Check top bar → verify NO logo (only sidebar trigger)
7. Visit Settings > Company Profile → verify no branding section

## Self-Check

✅ **Created files verified:**
- `apps/web/public/bidaxiom-logo.png` (2.0 MB)
- `apps/web/public/bidaxiom-icon.png` (2.1 MB)

✅ **Commits verified:**
- `f809be8`: feat(quick-17): replace dynamic company branding with static BidAxiom logos
- `d2d235a`: chore(quick-17): delete company branding components
- `2cb9f10`: refactor(quick-17): remove logo procedures from company router and presigned storage
- `8a9c376`: refactor(quick-17): comment out logoStorageKey column in companyProfiles schema

✅ **Code search verification:**
- No references to `CompanyLogo` in apps/web
- No references to `uploadLogo`, `getLogo`, `deleteLogo` in apps/api
- No references to logo helper functions in storage/presigned.ts

## Self-Check: PASSED

All created files exist, all commits verified, no remaining references to removed code.

## Output Artifacts

- Logo files: `apps/web/public/bidaxiom-{logo,icon}.png`
- Updated UI components: sidebar, top-bar, sign-in page
- Cleaned API router: company.ts (3 procedures removed)
- Cleaned storage module: presigned.ts (3 functions removed)
- Schema documentation: tenant.ts (logoStorageKey commented out)

## Follow-up Items

None. Quick task is self-contained and complete.
