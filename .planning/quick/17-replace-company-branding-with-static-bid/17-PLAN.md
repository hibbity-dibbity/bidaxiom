---
phase: quick-17
plan: 17
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/public/bidaxiom-logo.png
  - apps/web/public/bidaxiom-icon.png
  - apps/web/components/layout/sidebar.tsx
  - apps/web/components/layout/top-bar.tsx
  - apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
  - apps/web/components/branding/company-logo.tsx
  - apps/web/components/branding/logo-upload.tsx
  - apps/api/src/trpc/routers/company.ts
  - apps/api/src/storage/presigned.ts
autonomous: true

must_haves:
  truths:
    - "BidAxiom logos appear in sidebar (full logo when expanded, icon when collapsed)"
    - "BidAxiom logo appears on sign-in page"
    - "Top bar shows no logo (removed)"
    - "Company branding upload functionality no longer exists"
  artifacts:
    - path: "apps/web/public/bidaxiom-logo.png"
      provides: "Static BidAxiom logo with dark font"
      min_lines: 0
    - path: "apps/web/public/bidaxiom-icon.png"
      provides: "Static BidAxiom icon for collapsed sidebar"
      min_lines: 0
    - path: "apps/web/components/layout/sidebar.tsx"
      provides: "Sidebar with static image imports"
      contains: "/bidaxiom-logo.png"
    - path: "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      provides: "Sign-in page with static logo"
      contains: "/bidaxiom-logo.png"
  key_links:
    - from: "apps/web/components/layout/sidebar.tsx"
      to: "/bidaxiom-logo.png"
      via: "Next.js Image import"
      pattern: "Image.*src.*bidaxiom"
    - from: "apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx"
      to: "/bidaxiom-logo.png"
      via: "Next.js Image import"
      pattern: "Image.*src.*bidaxiom"
---

<objective>
Replace dynamic company branding system with static BidAxiom logos hardcoded into the application.

Purpose: Simplify the application by removing company-specific branding and replacing it with fixed BidAxiom branding.
Output: Static BidAxiom logos in sidebar and sign-in page, removed top bar logo, deleted company branding components and backend code.
</objective>

<execution_context>
@C:/Users/erict/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/erict/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

# Current components
@apps/web/components/layout/sidebar.tsx
@apps/web/components/layout/top-bar.tsx
@apps/web/components/branding/company-logo.tsx
@apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx

# Backend code to clean up
@apps/api/src/trpc/routers/company.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Copy logo files and update sidebar/top-bar/sign-in</name>
  <files>
    apps/web/public/bidaxiom-logo.png
    apps/web/public/bidaxiom-icon.png
    apps/web/components/layout/sidebar.tsx
    apps/web/components/layout/top-bar.tsx
    apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
  </files>
  <action>
    1. Copy logo files to public directory:
       - Copy C:\Users\erict\Downloads\BidAxiom-DarkFont-TransparentBG.png to apps/web/public/bidaxiom-logo.png
       - Copy C:\Users\erict\Downloads\BidAxiom-IconOnly-TransparentBG.png to apps/web/public/bidaxiom-icon.png

    2. Update sidebar.tsx:
       - Remove CompanyLogo import
       - Import Image from 'next/image'
       - Replace `<CompanyLogo variant="sidebar" />` in SidebarHeader with:
         * When expanded: Image with src="/bidaxiom-logo.png" width={140} height={32} alt="BidAxiom"
         * When collapsed: Image with src="/bidaxiom-icon.png" width={32} height={32} alt="BidAxiom"
       - Use shadcn sidebar's `group-data-[collapsible=icon]:hidden` pattern to show full logo when expanded
       - Use shadcn sidebar's `group-data-[collapsible=icon]:block hidden` pattern to show icon when collapsed

    3. Update top-bar.tsx:
       - Remove CompanyLogo import (line 9)
       - Remove CompanyLogo component from left section (line 20)
       - Keep SidebarTrigger as the only left-side element

    4. Update sign-in page:
       - Remove CompanyLogo import (line 14)
       - Replace `<CompanyLogo variant="auth" />` with Image component:
         * src="/bidaxiom-logo.png"
         * width={200}
         * height={48}
         * alt="BidAxiom"
         * className="mx-auto"
  </action>
  <verify>
    cd apps/web && npm run build
    No TypeScript errors, no import errors
  </verify>
  <done>
    - Logo files exist in apps/web/public/
    - Sidebar uses static Image imports with conditional rendering for collapsed/expanded states
    - Top bar has no logo (only SidebarTrigger on left)
    - Sign-in page uses static Image import
    - No references to CompanyLogo component in these files
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete company branding components</name>
  <files>
    apps/web/components/branding/company-logo.tsx
    apps/web/components/branding/logo-upload.tsx
  </files>
  <action>
    Delete both files:
    - apps/web/components/branding/company-logo.tsx
    - apps/web/components/branding/logo-upload.tsx

    These are no longer needed since all branding is now static.
  </action>
  <verify>
    ls apps/web/components/branding/ returns "No such file or directory" or directory is empty
    grep -r "CompanyLogo\|LogoUpload" apps/web/app apps/web/components returns no results (except in Task 3 files we haven't cleaned yet)
  </verify>
  <done>
    - company-logo.tsx deleted
    - logo-upload.tsx deleted
    - No remaining references to these components in app or components directories
  </done>
</task>

<task type="auto">
  <name>Task 3: Remove logo procedures from company router and presigned storage</name>
  <files>
    apps/api/src/trpc/routers/company.ts
    apps/api/src/storage/presigned.ts
  </files>
  <action>
    1. In apps/api/src/trpc/routers/company.ts:
       - Remove imports for generateLogoUploadUrl, generateLogoDownloadUrl, deleteLogoFromStorage (lines 10-13)
       - Remove uploadLogo procedure (starts at line 143, includes requirePermission, withAuditLog, input schema, mutation logic)
       - Remove getLogo procedure (starts at line 180, includes query logic with logoStorageKey check and generateLogoDownloadUrl call)
       - Remove deleteLogo procedure (starts at line 212, includes requirePermission, withAuditLog, mutation logic with deleteLogoFromStorage call)

    2. In apps/api/src/storage/presigned.ts:
       - Remove generateLogoUploadUrl function (presigned PUT URL for logo uploads)
       - Remove generateLogoDownloadUrl function (presigned GET URL for logo downloads)
       - Remove deleteLogoFromStorage function (S3 object deletion for logos)

       Keep all other presigned URL functions for document management.
  </action>
  <verify>
    cd apps/api && npx tsc --noEmit
    No TypeScript errors
    grep -n "uploadLogo\|getLogo\|deleteLogo\|generateLogoUploadUrl\|generateLogoDownloadUrl\|deleteLogoFromStorage" apps/api/src/trpc/routers/company.ts returns no results
  </verify>
  <done>
    - company.ts no longer has uploadLogo, getLogo, or deleteLogo procedures
    - presigned.ts no longer has logo-related helper functions
    - No TypeScript compilation errors
    - Document-related presigned URL functions remain intact
  </done>
</task>

<task type="auto">
  <name>Task 4: Remove logoUrl column from company profiles schema (optional cleanup)</name>
  <files>
    apps/api/src/db/schemas/company.ts
  </files>
  <action>
    Check if logoUrl column exists in companyProfiles table schema.

    If it exists:
    - Comment out or remove the logoUrl and logoStorageKey columns from the schema
    - Add a comment: "Logo columns removed in quick-17 (static BidAxiom branding)"

    If it doesn't exist:
    - No action needed (schema already clean)

    Note: We're NOT creating a migration to drop the column from existing databases. This is just schema cleanup to prevent future table creations from including the column.
  </action>
  <verify>
    cd apps/api && npx tsc --noEmit
    No TypeScript errors
    grep -n "logoUrl\|logoStorageKey" apps/api/src/db/schemas/company.ts returns no results or commented lines only
  </verify>
  <done>
    - companyProfiles schema no longer references logoUrl or logoStorageKey (or references are commented out)
    - No TypeScript compilation errors
  </done>
</task>

<task type="auto">
  <name>Task 5: Verify no remaining references and test build</name>
  <files>
    N/A (verification only)
  </files>
  <action>
    1. Search for remaining references:
       - grep -r "CompanyLogo" apps/web/ (should return no results)
       - grep -r "company-logo" apps/web/ (should return no results)
       - grep -r "logo-upload" apps/web/ (should return no results)
       - grep -r "uploadLogo\|getLogo\|deleteLogo" apps/api/src/trpc/ (should return no results)

    2. Build both apps to verify no errors:
       - cd apps/web && npm run build
       - cd apps/api && npx tsc --noEmit

    3. Visually verify (start dev servers):
       - Sidebar shows BidAxiom logo (full when expanded, icon when collapsed)
       - Top bar has NO logo (just sidebar trigger)
       - Sign-in page shows BidAxiom logo centered above card
  </action>
  <verify>
    All grep searches return no results
    Both builds succeed with no errors
    Dev servers start without errors
  </verify>
  <done>
    - No remaining references to company branding components or procedures
    - Web and API build successfully
    - Visual verification confirms static BidAxiom branding in correct locations
  </done>
</task>

</tasks>

<verification>
**Build verification:**
- cd apps/web && npm run build (no errors)
- cd apps/api && npx tsc --noEmit (no errors)

**Code verification:**
- grep -r "CompanyLogo" apps/web/ returns no results
- grep -r "uploadLogo\|getLogo\|deleteLogo" apps/api/ returns no results

**Visual verification:**
- Start dev servers and verify:
  * Sidebar shows BidAxiom logo (full logo when expanded, icon when collapsed)
  * Top bar has no logo
  * Sign-in page shows BidAxiom logo
</verification>

<success_criteria>
- [x] Logo files copied to apps/web/public/
- [x] Sidebar updated to use static Image imports with collapsed/expanded variants
- [x] Top bar no longer shows logo
- [x] Sign-in page uses static Image import
- [x] company-logo.tsx and logo-upload.tsx deleted
- [x] Logo procedures removed from company router
- [x] Logo helpers removed from presigned.ts
- [x] Schema cleaned up (logoUrl/logoStorageKey commented or removed)
- [x] No remaining references to company branding code
- [x] Both apps build successfully
- [x] Visual verification confirms static BidAxiom branding
</success_criteria>

<output>
After completion, create `.planning/quick/17-replace-company-branding-with-static-bid/17-SUMMARY.md`
</output>
