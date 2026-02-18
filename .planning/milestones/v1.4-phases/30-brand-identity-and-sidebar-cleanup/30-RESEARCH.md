# Phase 30: Brand Identity & Sidebar Cleanup - Research

**Researched:** 2026-02-17
**Domain:** Next.js 14 metadata API, React component branding, Tailwind CSS styling
**Confidence:** HIGH

---

## Summary

This phase is a low-risk, purely cosmetic changeset. There are exactly four discrete tasks:

1. Fix the root `metadata.title` in `app/layout.tsx` (one string change, one structural change for title templating)
2. Add `metadata` exports to each page route that needs a browser tab title
3. Resize and re-pad the logo image on the sign-in form (one component, two render paths)
4. Remove the version number div and its containing `SidebarFooter` from the sidebar (five lines of JSX)

There is no backend work, no data migration, no new dependencies, and no architectural decisions to make. Every change is a direct find-and-edit on a small number of files. The entire phase can be completed mechanically once the file locations are confirmed.

The biggest decision for BRAND-02 is whether to use Next.js 14's built-in `title.template` feature (set once in root layout, all child pages inherit the suffix) or to manually add `| BIDAXIOM` to each page's metadata title. The template approach is cleaner and is the idiomatic Next.js 14 pattern.

**Primary recommendation:** Use `title: { template: "%s | BIDAXIOM", default: "BIDAXIOM" }` in `app/layout.tsx`. Each page then only needs `title: "Page Name"` — no repetition of the brand suffix.

---

## Current State

### Where "ConstructionSaaS" Appears in Runtime Code

Only ONE file in `apps/web` contains "ConstructionSaaS" as user-visible content:

| File | Line | Current Value | Requirement |
|------|------|--------------|-------------|
| `apps/web/app/layout.tsx` | 10 | `title: "ConstructionSaaS"` | Change to BIDAXIOM with template |
| `apps/web/app/layout.tsx` | 11 | `description: "Construction management platform for GCs and subcontractors"` | Update description |

The root `package.json` has `"name": "construction-saas"` but this is an internal package identifier — it does not appear in the UI anywhere and is out of scope per BRAND-01 (which targets site labels, navigation text, and copy).

Planning documents (`.planning/`) contain "ConstructionSaaS" as a project name, but these are developer-internal files with no user-facing rendering — out of scope.

### How Page Titles Work

Next.js 14 metadata is set exclusively in the root layout:

```tsx
// apps/web/app/layout.tsx (current)
export const metadata: Metadata = {
  title: "ConstructionSaaS",
  description: "Construction management platform for GCs and subcontractors",
};
```

**Zero pages or sub-layouts** currently set their own `metadata` or `generateMetadata`. This means:
- Every browser tab currently reads "ConstructionSaaS" regardless of what page you're on
- The auth layout (`app/(auth)/layout.tsx`) has no metadata export
- The dashboard layout (`app/(dashboard)/layout.tsx`) has no metadata export
- The project layout (`app/(dashboard)/projects/[projectSlug]/layout.tsx`) has no metadata export (and is a `"use client"` component, so it cannot export metadata — more on this in Risk Assessment)

### Sign-In Logo

The sign-in form component has TWO render paths, each with its own logo block:

**Path 1: MFA step (lines 168-178 of `sign-in-form.tsx`)**
```tsx
{/* BidAxiom logo */}
<div className="flex justify-center">
  <Image
    src="/bidaxiom-logo.png"
    alt="BidAxiom"
    width={320}
    height={74}
    className="mx-auto dark:invert"
    priority
  />
</div>
```

**Path 2: Normal sign-in step (lines 232-242 of `sign-in-form.tsx`)**
```tsx
{/* BidAxiom logo */}
<div className="flex justify-center">
  <Image
    src="/bidaxiom-logo.png"
    alt="BidAxiom"
    width={320}
    height={74}
    className="mx-auto dark:invert"
    priority
  />
</div>
```

Both paths use identical props: `width={320}`, `height={74}`.

**25% reduction math:** 320 * 0.75 = 240, 74 * 0.75 = 55.5 → round to `width={240}` `height={56}`.

The wrapper `<div>` currently has no bottom padding. To add 25px bottom padding the cleanest approach is `pb-[25px]` (Tailwind arbitrary value) on the wrapper `<div className="flex justify-center">`.

The sign-up page (`sign-up/[[...sign-up]]/page.tsx`) does NOT show a logo — no changes needed there.
The mfa-setup page (`mfa-setup/page.tsx`) does NOT show a logo — no changes needed there.
The reset-password page — not checked but pattern is consistent.

### Sidebar Version Number

The version number and its container are in `apps/web/components/layout/sidebar.tsx`, lines 82-86:

```tsx
<SidebarFooter className="border-t p-2">
  <div className="text-xs text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
    v0.0.1
  </div>
</SidebarFooter>
```

CLEAN-01 requires removing both the version number display AND the horizontal divider above it. The divider IS the `border-t` class on `SidebarFooter`. These are tightly coupled — removing the entire `<SidebarFooter>` block removes both.

Note: There is no separate `<hr>` or `<Separator>` element. The divider is purely the `border-t` Tailwind class applied to `SidebarFooter`. Removing the whole block is the clean solution.

### Where Logo Appears in the Dashboard

For reference, these logo usages are already using "BidAxiom" branding and do NOT need brand name changes (just `alt` text if you want to be thorough):

| Component | Usage | Action for BRAND-01 |
|-----------|-------|---------------------|
| `sidebar.tsx` line 60-67 | Expanded sidebar logo | `alt` is "BidAxiom" — update to "BIDAXIOM" if copy standard requires |
| `top-bar.tsx` line 26-34 | Collapsed sidebar logo in topbar | same |
| `sign-in-form.tsx` lines 168-178, 232-242 | Sign-in logo | resize per BRAND-04; update `alt` to "BIDAXIOM" |

The BRAND-01 requirement targets "site labels, navigation text, and copy." The only user-visible string that says "ConstructionSaaS" is the browser tab title.

---

## Implementation Approach

### BRAND-01 + BRAND-02: Browser title and app name

**Single file change** to `apps/web/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: {
    template: "%s | BIDAXIOM",
    default: "BIDAXIOM",
  },
  description: "Construction management software for general contractors and subcontractors",
};
```

With this template in place, any page that exports `export const metadata = { title: "Projects" }` will produce the browser tab text "Projects | BIDAXIOM". Pages with no metadata export will show the default "BIDAXIOM".

**Per-page metadata for BRAND-02** — each server component page can export a static metadata object. The route inventory (server-renderable pages only, since "use client" pages cannot export metadata):

| Route File | Suggested Title |
|------------|----------------|
| `app/(dashboard)/page.tsx` | `Dashboard` |
| `app/(dashboard)/projects/page.tsx` | `Projects` |
| `app/(dashboard)/projects/new/page.tsx` | `New Project` |
| `app/(dashboard)/customers/page.tsx` | `Customers` |
| `app/(dashboard)/customers/[customerSlug]/page.tsx` | `Customer` |
| `app/(dashboard)/subcontractors/page.tsx` | `Subcontractors` |
| `app/(dashboard)/subcontractors/new/page.tsx` | `New Subcontractor` |
| `app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx` | `Subcontractor` |
| `app/(dashboard)/reports/page.tsx` | `Reports` |
| `app/(dashboard)/reports/create/page.tsx` | `Create Report` |
| `app/(dashboard)/reports/templates/page.tsx` | `Report Templates` |
| `app/(dashboard)/reports/[reportId]/page.tsx` | `Report` |
| `app/(dashboard)/settings/page.tsx` | `Settings` |
| `app/(dashboard)/settings/account/page.tsx` | `Account Settings` |
| `app/(dashboard)/settings/company/page.tsx` | `Company Settings` |
| `app/(dashboard)/settings/members/page.tsx` | `Team Members` |
| `app/(dashboard)/settings/integrations/page.tsx` | `Integrations` |
| `app/(dashboard)/settings/activity/page.tsx` | `Activity` |
| `app/(auth)/sign-in/[[...sign-in]]/page.tsx` | `Sign In` |
| `app/(auth)/sign-up/[[...sign-up]]/page.tsx` | `Sign Up` |
| `app/(auth)/mfa-setup/page.tsx` | `MFA Setup` |
| `app/(auth)/reset-password/page.tsx` | `Reset Password` |
| `app/(auth)/verify-email/page.tsx` | `Verify Email` |

**Project sub-pages** — these live under `app/(dashboard)/projects/[projectSlug]/` and cannot use static metadata (dynamic slug). They could use `generateMetadata` but since the project layout is `"use client"`, the individual page files may also be client components. Investigation during planning will determine which project sub-pages are server components eligible for `generateMetadata`. The fallback is to rely on the default "BIDAXIOM" tab title for project-level pages — which satisfies the spirit of BRAND-02.

**Onboarding page**: `app/(dashboard)/onboarding/page.tsx` — add `title: "Setup"` or `title: "Onboarding"`.

### BRAND-04: Sign-in logo resize

**File:** `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx`

Two identical logo blocks at lines ~168 and ~232. Both need:
- `width={320}` → `width={240}`
- `height={74}` → `height={56}`
- Wrapper div: `className="flex justify-center"` → `className="flex justify-center pb-[25px]"`

### CLEAN-01: Remove sidebar version + divider

**File:** `apps/web/components/layout/sidebar.tsx`

Remove lines 82-86 entirely:

```tsx
// DELETE THIS ENTIRE BLOCK:
<SidebarFooter className="border-t p-2">
  <div className="text-xs text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
    v0.0.1
  </div>
</SidebarFooter>
```

The `SidebarFooter` import at line 9 will become unused after this removal — remove it from the import statement too.

---

## Files to Modify

**Exhaustive list:**

### 1. Root layout (BRAND-01 + BRAND-02 foundation)
- **File:** `apps/web/app/layout.tsx`
- **Change:** Replace `title: "ConstructionSaaS"` with title template object; update description

### 2. Sign-in form (BRAND-04)
- **File:** `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx`
- **Change:** Two logo blocks — reduce width/height by 25%, add `pb-[25px]` to wrapper div

### 3. Sidebar (CLEAN-01)
- **File:** `apps/web/components/layout/sidebar.tsx`
- **Change:** Remove the entire `<SidebarFooter>` block (lines 82-86); remove `SidebarFooter` from import

### 4. Per-page metadata (BRAND-02) — server component pages only

Each of these pages needs a `metadata` export added at the top of the file:

```
apps/web/app/(dashboard)/page.tsx
apps/web/app/(dashboard)/onboarding/page.tsx
apps/web/app/(dashboard)/projects/page.tsx
apps/web/app/(dashboard)/projects/new/page.tsx
apps/web/app/(dashboard)/customers/page.tsx
apps/web/app/(dashboard)/customers/[customerSlug]/page.tsx
apps/web/app/(dashboard)/subcontractors/page.tsx
apps/web/app/(dashboard)/subcontractors/new/page.tsx
apps/web/app/(dashboard)/subcontractors/[subcontractorSlug]/page.tsx
apps/web/app/(dashboard)/reports/page.tsx
apps/web/app/(dashboard)/reports/create/page.tsx
apps/web/app/(dashboard)/reports/templates/page.tsx
apps/web/app/(dashboard)/reports/[reportId]/page.tsx
apps/web/app/(dashboard)/settings/page.tsx
apps/web/app/(dashboard)/settings/account/page.tsx
apps/web/app/(dashboard)/settings/company/page.tsx
apps/web/app/(dashboard)/settings/members/page.tsx
apps/web/app/(dashboard)/settings/integrations/page.tsx
apps/web/app/(dashboard)/settings/activity/page.tsx
apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx
apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx
apps/web/app/(auth)/mfa-setup/page.tsx
apps/web/app/(auth)/reset-password/page.tsx
apps/web/app/(auth)/verify-email/page.tsx
```

The integration callback pages (`settings/integrations/calendar/callback/page.tsx`, `settings/integrations/quickbooks/callback/page.tsx`) are transient redirect pages — low priority but can receive titles like `"Connecting..."`.

**Pages that CANNOT have static metadata (are "use client" components):**

```
apps/web/app/(dashboard)/projects/[projectSlug]/page.tsx  — check "use client" directive
apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx
... all project sub-pages
```

The project slug layout is `"use client"` which means child pages that are also client components cannot export `metadata`. The planner should verify each project sub-page's `"use client"` directive status during task execution. If they are server components, add `generateMetadata` with the project name. If client components, they will use the default "BIDAXIOM" title — acceptable per BRAND-02's intent.

---

## Risk Assessment

### Risk 1: Client Component Metadata Restriction (LOW IMPACT, KNOWN)
**What:** Next.js 14 requires `metadata` and `generateMetadata` to be in Server Components. Any file with `"use client"` at the top cannot export metadata.
**Impact:** The `app/(dashboard)/projects/[projectSlug]/layout.tsx` is `"use client"`, meaning project sub-pages may not get per-page titles unless the individual page files themselves are Server Components.
**Mitigation:** The root layout's `default: "BIDAXIOM"` fallback handles this gracefully. Tabs will show "BIDAXIOM" instead of "Projects > [Name] > Budget" — still compliant with BRAND-02's requirement for "BIDAXIOM" to appear. No risk of breakage.

### Risk 2: Sign-in Logo Appears Twice (KNOWN, HANDLED)
**What:** `sign-in-form.tsx` renders the logo in two separate JSX blocks (MFA flow and normal flow) — both need identical changes.
**Impact:** Missing one block means MFA users see the old size. The planner must create a task that touches both blocks.
**Mitigation:** Both blocks are in the same file. Search for `width={320}` to find both.

### Risk 3: SidebarFooter Import Becomes Unused (TRIVIAL)
**What:** Removing `<SidebarFooter>` leaves an unused import in the import statement.
**Impact:** TypeScript/ESLint may warn. No runtime breakage.
**Mitigation:** Remove `SidebarFooter` from the import at line 9 of `sidebar.tsx` as part of the same task.

### Risk 4: Next.js Image width/height Are Layout Hints, Not Hard Constraints (LOW)
**What:** The `width` and `height` props on Next.js `<Image>` set the intrinsic dimensions and aspect ratio hint, but the actual rendered size is controlled by CSS. The current logo has `className="mx-auto dark:invert"` — no explicit `w-` or `h-` class, so it renders at the intrinsic width (320px currently).
**Impact:** Changing to `width={240}` `height={56}` WILL render the logo smaller as intended. No CSS override conflict exists.
**Mitigation:** None needed. Straightforward.

### Risk 5: Metadata Import May Be Missing in Page Files (TRIVIAL)
**What:** Most page files do not currently import `Metadata` from `"next"`. Adding a metadata export requires either the type import or using plain objects without type annotation.
**Impact:** TypeScript warning if type import is missing; no runtime error.
**Mitigation:** Add `import type { Metadata } from "next"` alongside each metadata export. The pattern is the same as `app/layout.tsx`.

---

## Code Examples

### Root layout metadata with template (Next.js 14)
```tsx
// Source: Next.js 14 official docs - Metadata > Title
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BIDAXIOM",
    default: "BIDAXIOM",
  },
  description: "Construction management software for general contractors and subcontractors",
};
```

### Per-page static metadata
```tsx
// Source: Next.js 14 official docs - Metadata > Static
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
};
// Browser tab renders: "Projects | BIDAXIOM"
```

### Logo resize (sign-in form)
```tsx
// Before
<div className="flex justify-center">
  <Image
    src="/bidaxiom-logo.png"
    alt="BidAxiom"
    width={320}
    height={74}
    className="mx-auto dark:invert"
    priority
  />
</div>

// After — 25% smaller (320 * 0.75 = 240, 74 * 0.75 = 55.5 → 56), +25px bottom padding
<div className="flex justify-center pb-[25px]">
  <Image
    src="/bidaxiom-logo.png"
    alt="BIDAXIOM"
    width={240}
    height={56}
    className="mx-auto dark:invert"
    priority
  />
</div>
```

### Sidebar footer removal
```tsx
// Before (sidebar.tsx lines 82-86) — DELETE THIS BLOCK:
<SidebarFooter className="border-t p-2">
  <div className="text-xs text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
    v0.0.1
  </div>
</SidebarFooter>

// After: nothing (entire block removed)
// Also remove SidebarFooter from the import at line 9
```

---

## Open Questions

1. **Should `alt` text on logo images be updated to "BIDAXIOM" (all caps)?**
   - Currently: `alt="BidAxiom"` in sidebar, topbar, and sign-in form
   - BRAND-01 says "BIDAXIOM" — the `alt` attribute is screenreader content and arguably "copy"
   - Recommendation: Update to `alt="BIDAXIOM"` in all logo Image components for consistency. Low-risk, same files being touched anyway.

2. **Should the sign-up page get a logo added to match sign-in?**
   - Currently no logo on sign-up page — this is out of scope for the stated requirements
   - Deferred unless explicitly requested

3. **Project sub-page titles with dynamic names (e.g., "Riverside Office Building > Budget | BIDAXIOM")?**
   - BRAND-02 only specifies the format `{Page Name} | BIDAXIOM`
   - For dynamic project pages, the title would require `generateMetadata` calling the database
   - Recommendation: Out of scope for this phase; project pages will show `"BIDAXIOM"` via default

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all file contents and line numbers confirmed by reading source files
- `apps/web/app/layout.tsx` — confirmed current metadata structure
- `apps/web/components/layout/sidebar.tsx` — confirmed version number location
- `apps/web/app/(auth)/sign-in/[[...sign-in]]/sign-in-form.tsx` — confirmed logo dimensions and two render paths

### Secondary (MEDIUM confidence)
- Next.js 14 metadata title template API — `title.template` with `%s` placeholder is documented in Next.js 14 App Router metadata docs; knowledge current as of January 2025

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies needed
- File locations: HIGH — all confirmed by direct inspection
- Implementation approach: HIGH — straightforward JSX/metadata edits
- Client component metadata restriction: HIGH — well-documented Next.js behavior
- Logo resize math: HIGH — 320 * 0.75 = 240, 74 * 0.75 = 55.5

**Research date:** 2026-02-17
**Valid until:** Indefinite — no external dependencies or fast-moving APIs involved

---

## Phase Requirements Cross-Reference

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | All site labels, navigation text, and copy reference "BIDAXIOM" | Only one runtime occurrence found: `title: "ConstructionSaaS"` in `app/layout.tsx`. All other dashboard nav uses "BidAxiom" logo images with no brand text labels. Updating root metadata title resolves this. |
| BRAND-02 | Browser/tab page titles use format "{Page Name} | BIDAXIOM" | Next.js 14 `title.template` in root layout propagates to all server-component pages. 24 page files identified for individual `metadata` exports. |
| BRAND-04 | Sign-in page logo rendered 25% smaller with 25px additional bottom padding | Logo found in `sign-in-form.tsx` at two locations (normal + MFA flow). Current `width={320}` → `width={240}`, `height={74}` → `height={56}`. Add `pb-[25px]` to wrapper div. |
| CLEAN-01 | Version number display and horizontal divider rule removed from left sidebar | Confirmed in `sidebar.tsx` lines 82-86: `<SidebarFooter className="border-t p-2">` contains `v0.0.1` text. Remove entire block including `border-t` divider. |
</phase_requirements>
