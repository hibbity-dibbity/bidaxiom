# Pitfalls Research: Large-Scale UX Redesign

**Domain:** Large-scale UX redesign of an existing Next.js 14 + Tailwind + shadcn/ui SaaS (BIDAXIOM)
**Researched:** 2026-02-21
**Confidence:** HIGH — all pitfalls grounded in direct codebase inspection + stack-specific analysis

---

## Critical Pitfalls

### Pitfall 1: Over-Scoping Kills Momentum on a Phase-Based System

**What goes wrong:**
A UX redesign spans many pages. The temptation is to define one giant phase ("redesign all project pages") rather than slicing it into atomic, independently-shippable units. The phase stalls because it touches too many files simultaneously, merge conflicts accumulate, and nothing can be verified in isolation.

**Why it happens:**
UX changes are visually interconnected — tabs, headers, tables, and forms feel like one surface. This makes it tempting to change everything at once to achieve visual cohesion. In a codebase of 164K lines across 40 phases, each phase introduces dependencies on the previous, so the cost of a stalled phase is high.

**How to avoid:**
- Define each phase around a single rendering surface: one page layout, one component category, one interaction pattern. Never mix "redesign project header" with "redesign budget table" in the same phase.
- Use the GSD rule: a phase is done when it can be shipped independently and verified by a UAT checklist without requiring another phase to be complete.
- Sequence surface-to-surface: start with the shared chrome (sidebar, topbar, project header/tabs) before touching tab content. Tab content depends on the chrome being stable.
- Hard limit: if a single plan file has more than 8 atomic tasks, split it.

**Warning signs:**
- A plan file defines changes to more than 3 different page files simultaneously.
- A plan requires "this change is visible only after Phase X+2 is done."
- The phase description uses "and" more than twice ("redesign budget page AND CO list AND estimate table").
- A UAT checklist cannot be completed without another phase being merged first.

**Phase to address:**
This is a phase-structure pitfall. Address it in the roadmap definition step. Each roadmap phase should have a scope statement that explicitly says what it does NOT touch.

---

### Pitfall 2: Breaking Dark Mode with Hardcoded Tailwind Color Classes

**What goes wrong:**
New UI elements use raw Tailwind palette classes (`bg-amber-50`, `text-slate-600`, `bg-white`, `bg-gray-100`) instead of semantic CSS variable classes (`bg-muted`, `text-muted-foreground`, `bg-background`, `bg-card`). These look correct in light mode. In dark mode, the CSS variable `--background` resolves to `240 10% 3.9%` (near-black) per `globals.css`, but `bg-amber-50` is always light amber — the redesigned element becomes unreadable or invisible.

**Why it happens:**
This codebase already has this pattern in production. Direct codebase audit found:
- `project-header.tsx` line 173: `bg-amber-50 border-amber-200 text-amber-800` on the restored-project banner — no dark mode variants
- `project-header.tsx` line 126: `bg-slate-500/10 text-slate-600 border-slate-200` on the mode badge — `text-slate-600` is too dark on dark backgrounds
- `budget-summary-cards.tsx`: `text-amber-600` hardcoded without dark variant
- `forecast-metrics.tsx`: `bg-amber-50` hardcoded without `.dark:` prefix
- 52 TSX files across `apps/web/` contain hardcoded palette color classes (confirmed via grep)

The pattern exists precisely because the semantic token system only partially covers semantic states (warning, info, success). When developers need an amber warning banner and `bg-destructive` does not fit the semantics, they reach for `bg-amber-50` directly.

**How to avoid:**
- When introducing any warning/info banner, use the pattern already established in `field-mapping-client.tsx` line 344: `"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"` — always pair a palette class with its dark variant inline.
- Better approach: add a `warning` variant to the shadcn `Alert` component (which already has `default` and `destructive` in this codebase). One component fix eliminates the pattern at all call sites.
- Color classes safe to use without dark pairing: none used for backgrounds or text. The one exception is `CurrencyDisplay`'s `colorize` prop which already manages `text-green-600` / `text-red-600` semantics internally.
- Forbidden in redesign phases: any `bg-white`, `bg-gray-*`, `text-gray-*`, `bg-amber-*`, `bg-slate-*` without a companion `dark:` variant on the same element.

**Warning signs:**
- Any new JSX contains `bg-amber-`, `bg-white`, `bg-gray-`, or `bg-slate-` without a `dark:` companion class.
- A redesigned page has never been toggled to dark mode during development — it was only verified in the browser's default theme.
- A new component uses a pattern like `className="bg-white p-4"` (present in `mfa-setup/page.tsx` line 279 — pre-existing debt).
- The restored-project banner in `project-header.tsx` is copied as a template for new banners without adding dark variants.

**Phase to address:**
Address in the first redesign phase that touches the project header/tabs (shared chrome). Add a UAT step to every subsequent phase: "Toggle dark mode — verify no white, amber, or gray backgrounds appear on the redesigned surface."

---

### Pitfall 3: Tailwind Class Explosion and Design Drift Across Phases

**What goes wrong:**
Each phase author adds their own ad-hoc spacing, sizing, and border radius variants directly on JSX elements. After several phases, visually adjacent components have incompatible densities. This already exists in the codebase: `ProjectsTable` uses `py-2 text-sm` on `TableCell` while the change-order form line items use `p-4 border rounded-lg` for card wrappers. Neither is wrong individually, but the absence of a canonical recipe means each new table or form panel author picks their own values.

**Why it happens:**
Tailwind's strength (no abstraction layer) is also the pitfall: every component inline-defines its own spacing. Without enforcement, 10 redesign phases produce 10 slightly different table densities. `className="py-2 text-sm"` vs `className="py-3 text-sm"` is invisible in isolation but jarring when two adjacent tables on the same project have different row heights.

**How to avoid:**
- Before any redesign phase ships new tables or forms, document a canonical recipe set in `COMPONENT-ORGANIZATION.md`. The following are the established patterns in this codebase that must be used:
  - **Table row:** `py-2 text-sm` on `TableCell` (source: `projects-table.tsx` line 201)
  - **Page content wrapper:** `container mx-auto py-6 space-y-6` (source: `budget/page.tsx` line 62)
  - **Form field group:** `space-y-2` with `<Label>` + input (source: `change-order-form.tsx` throughout)
  - **Card section:** `<Card><CardHeader><CardTitle>` + `<CardContent className="space-y-4">` (source: `change-order-form.tsx` step cards)
- Use CVA for any component that has 2+ visual variants. The `button.tsx` and `status-badge.tsx` pattern is the model. Never branch on variant with a ternary inside `className` if the same branch appears in 3+ places — extract to CVA.
- During PR review, grep for `py-` and `text-` classes on any new `TableCell` element. If they differ from the canonical `py-2 text-sm`, flag for correction.

**Warning signs:**
- A new `TableCell` uses `py-3` or `py-4` instead of the canonical `py-2`.
- Two adjacent pages both show tables but with different visual density, visible when switching between project tabs.
- A phase plan says "style the table" rather than "apply the canonical table pattern."
- A ternary like `className={condition ? "text-primary font-medium" : "text-muted-foreground"}` appears more than twice in different components — it should be a CVA variant.
- A new form panel uses `p-6` where all existing form panels use `space-y-4` + `CardContent`.

**Phase to address:**
Define canonical recipes in a design foundation phase (Phase 1 of the redesign, before any page-level changes). Every subsequent phase is constrained to use those recipes. The recipes should live as comments in `COMPONENT-ORGANIZATION.md`.

---

### Pitfall 4: Form State Regression During Layout Changes

**What goes wrong:**
The `ChangeOrderForm` (`components/change-order/change-order-form.tsx`) and similar multi-step forms use React Hook Form with `useForm`, `useFieldArray`, `Controller`, and conditional step rendering (`{step === 1 && ...}`). When a redesign wraps the form in a new layout component or changes the step rendering pattern, three specific regressions occur:

1. **Controller unmount/remount**: Adding a conditionally-rendered wrapper around a `<Controller>` component (line 441 in `change-order-form.tsx`) causes React to unmount and remount the controller, resetting its registered value to `undefined`. The Zod resolver validates `undefined` as missing — the field appears empty but the error may not surface visually because the error path (`errors.lineItems[i].amountChange`) depends on the step being visible.

2. **Select value loss**: The Radix-based `<Select>` + `<Controller>` pattern (lines 379-394 in the form) stores value in React Hook Form's internal state via `field.onChange`. If the Select's parent element is wrapped in a new animated container that remounts on transition, the value resets. The visual display (SelectTrigger placeholder) correctly shows empty, but the RHF state may show the old value if the wrapper does not remount — creating a silent mismatch between visual and submitted data.

3. **useFieldArray key stability**: The `fields.map((field, index) => ...)` pattern uses `key={field.id}` (line 362) — this is correct. If a layout change replaces `key={field.id}` with `key={index}` anywhere (an easy mistake when copying the JSX structure), React remounts field array items on re-order or removal, losing controlled input values.

**Why it happens:**
Layout changes feel safe because they only add wrapper elements. But React Hook Form registers fields via refs and depends on stable component identity. A layout change that wraps a `Controller` in a new conditionally-rendered container can trigger full unmount/remount. The `useForm<any>` cast in `change-order-form.tsx` line 63 (`resolver: zodResolver(createChangeOrderSchema) as any`) suppresses TypeScript on field access — meaning field deregistration is invisible to the compiler and only detectable at runtime.

**How to avoid:**
- Never put a `Controller`-wrapped input inside a new conditionally-rendered wrapper. If a layout panel needs to show/hide, use CSS (`hidden` / `opacity-0 pointer-events-none`) not `{condition && <Wrapper>}`.
- When adding animation to step transitions (e.g., CSS fade between steps), use transitions on the outer step container, not JS-controlled conditional mounting. The existing `{step === 1 && (...)}` pattern is safe because the `<form>` element stays mounted across all steps.
- After any layout change to a form-containing page, run the full form happy path: fill all fields, advance all steps, submit. Verify the submitted payload in the browser's Network tab matches the Zod schema shape.
- Verify `key={field.id}` is preserved on every `fields.map()` — never use `key={index}`.

**Warning signs:**
- A layout PR adds a wrapping `<div>` or `<Card>` around a form section that was previously at the same nesting level as the `<form>` tag.
- A step transition uses an animated component (`AnimatePresence`, `Transition`) that mounts/unmounts children.
- After a layout change, Radix Select inputs show the correct placeholder visually but submit `undefined` (the classic uncontrolled-to-controlled regression in RHF + Radix Select).
- A `useFieldArray` item's `key` prop has been changed to `key={index}`.
- TypeScript build passes but a form field submits as `undefined` — this is the `any` cast hiding the deregistration.

**Phase to address:**
Every phase that redesigns a form-containing page (change order new/edit, payment app forms, estimate forms, project edit). Each such phase must include a UAT step: "Submit the form with every field type populated — verify the network payload matches the expected Zod schema."

---

### Pitfall 5: User Disorientation from Navigation Pattern Changes

**What goes wrong:**
BIDAXIOM uses a URL-based tab navigation pattern in `project-tabs.tsx` — each tab is a `<Link href={fullHref} scroll={false}>` that updates the URL. Switching from this to a client-side state tab pattern (Radix `<Tabs>` storing state in React) would break:
1. Browser back button: users expect back to return to the previous tab
2. Direct URL sharing: a URL sent to a team member no longer lands on the correct tab
3. The existing hover-prefetch system at `project-tabs.tsx` line 139 — `onMouseEnter` calls tRPC prefetch handlers. This only works because the tab target is a URL, not a React state toggle. State-based tabs have no `onMouseEnter` prefetch hook.
4. Bookmarks and copy-link functionality that construction PMs use to share specific project views.

A second navigation pitfall exists in `project-header.tsx` line 157: `window.location.href = "/projects"` fires on delete success. If a redesign wraps the delete action in a new dialog/sheet flow that has its own closing animation, this hard navigation fires before the closing animation completes — producing a flash of the projects list while the dialog close animation is still running.

**Why it happens:**
Redesigns reach for the Radix `<Tabs>` shadcn component because it is visually polished and already installed in `components/ui/tabs.tsx`. The mistake is using it for navigation-level tabs (Budget, Change Orders, etc.) vs. in-page sub-tabs where URL persistence is not needed. There is also a shallow familiarity pattern: Radix Tabs is easy to demo, easy to style — it looks like it replaces the current Link-based pattern cleanly.

**How to avoid:**
- Preserve the `<Link href={fullHref} scroll={false}>` pattern for all top-level project tabs. Use the Radix `<Tabs>` component only for in-page sub-sections where URL persistence is not required (e.g., a detail card with "Details" / "History" sub-tabs within a single page).
- Document this distinction explicitly in `ROUTING-CONVENTIONS.md` before any redesign phase: "Navigation-level tabs = `<Link href>` pattern with URL change. In-page sub-tabs = Radix Tabs component with React state."
- When restyling the active tab indicator (currently `border-primary` at `project-tabs.tsx` line 144), preserve the `isActive` logic exactly — `section.href === "" ? pathname === fullHref : pathname.startsWith(fullHref)`.
- Preserve `scroll={false}` on all tab links — removing it causes scroll-to-top on every tab switch, which is disruptive in data-dense SaaS applications.
- When a new tab is added to `ALL_SECTIONS`, a corresponding entry in `sectionPrefetchMap` is mandatory — not optional.

**Warning signs:**
- A redesign plan replaces `<Link href={fullHref}>` with `<button onClick={() => setActiveTab(...)}>` for project-level tabs.
- After a redesign, the URL does not change when clicking a project tab (regression to state-based tabs).
- A new tab was added to `ALL_SECTIONS` but has no entry in `sectionPrefetchMap` — silent prefetch failure on hover.
- A plan uses `useSearchParams` to manage tab state — this creates hydration mismatches in Next.js 14 App Router because `useSearchParams` requires a Suspense boundary, which is missing in the current project layout structure.
- The browser back button navigates to the wrong tab after the redesign ships.

**Phase to address:**
Any phase that touches `project-tabs.tsx` or `project-header.tsx`. Routing conventions must be locked in documentation before page-level redesigns begin.

---

### Pitfall 6: Stale Component APIs When Redesigning Shared Components

**What goes wrong:**
`ProjectHeader`, `ProjectTabs`, `BudgetSummaryCards`, `StatusBadge`, and `CurrencyDisplay` are used across many pages. When a redesign changes a prop on one of these — for example, removing `budgetSummary` from `ProjectHeader` or changing variant names in `StatusBadge` — every call site must be updated simultaneously. In a 164K-line codebase with 40 phases of accumulated code, it is easy to miss call sites in less-frequently-visited files.

Specific risks in this codebase:
- `CurrencyDisplay` is referenced in 14+ places with `colorize` and `showSign` booleans. If a redesign adds a `size` variant that changes default font size, all 14+ usages are affected visually.
- `StatusBadge` has 9 CVA variants mapping to domain statuses across RFQs, estimates, and integrations (6+ call sites per `COMPONENT-ORGANIZATION.md`). If the redesign renames a variant (e.g., `"pending"` to `"draft"`), the compiler only catches this if the variant prop is typed as a string union — if typed as `string`, renaming is invisible to TypeScript and produces a silent CVA fallthrough to the default variant.
- The `project-tabs.tsx` prefetch system (`sectionPrefetchMap`) is implicitly coupled to tRPC procedure names. This already happened once: Phase 40 renamed `document.list` to `document.listUnified`, requiring a `prefetchDocuments` update. If a redesign phase renames additional tRPC queries without updating the prefetch map, the prefetch silently calls a non-existent procedure — no TypeScript error, just a cache miss that degrades perceived performance.

**Why it happens:**
Shared component changes feel local — you edit one file. TypeScript catches explicit prop renames but not semantic changes: changing what `colorize` does, changing default layout, adding `className` overrides that conflict with caller-provided classes. In Next.js App Router without a Storybook or visual regression suite, the only feedback loop is manual inspection of each call site.

**How to avoid:**
- Before changing any prop signature on a shared component, run: `grep -r "ComponentName" apps/web/ --include="*.tsx" -l` to enumerate all call sites. Review each one before the change lands.
- Prefer additive API changes (add a new optional prop with a default value) over breaking changes (rename or remove a required prop). Deprecate old prop names with a JSDoc `@deprecated` comment and a `console.warn` in dev mode.
- For `StatusBadge`: ensure the `variant` prop is typed as a discriminated string union (e.g., `"pending" | "approved" | "rejected" | ...`), not `string`. This makes variant renames a compile error.
- When renaming a tRPC query procedure, search `project-tabs.tsx` specifically — the prefetch map is the most common place where procedure renames cause silent failures.
- Add a verification step to every phase that modifies a shared component: grep for all call sites, verify each is updated or still compatible.

**Warning signs:**
- A plan modifies `status-badge.tsx` or `currency-display.tsx` without listing all affected call sites.
- A plan renames a `budgetSummary` prop on `ProjectHeader` but only updates the layout file (`[projectSlug]/layout.tsx`) that passes it — missing the `project/overview/page.tsx` call site.
- After a redesign, hovering over project tabs produces no network prefetch activity (visible in the browser Network tab filtered to XHR) — the tRPC procedure name in `sectionPrefetchMap` is stale.
- TypeScript build passes clean but a page throws "undefined is not iterable" or "Cannot read properties of undefined" at runtime — this is the signature of a removed required prop whose removal was masked by an `any` cast in the parent component.

**Phase to address:**
Any phase that modifies files in `components/ui/`, `components/shared/`, or the project header/tabs. The shared component API must be locked before page-level redesign phases begin.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `className="bg-amber-50 text-amber-800"` without `dark:` variant | Fast warning banner in 30 seconds | Dark mode breakage on every redesigned element; 52 files already have this debt | Never — always pair with `dark:` variant inline |
| `useForm<any>` cast on form types | Suppresses Zod/RHF typing noise | TypeScript cannot catch field deregistration after layout change; field submits as `undefined` silently | Existing casts are debt; do not introduce new ones in redesign phases |
| Inline `new Intl.NumberFormat(...)` in component | Avoids an import | Formatting inconsistency when global format changes; `change-order-form.tsx` already has this (line 35) | Never — use existing `formatCurrency()` utility from `lib/utils/format.ts` |
| Replacing URL-based tabs with Radix state tabs | Simpler component code | Breaks back button, URL sharing, and the hover-prefetch system | Only acceptable for in-page sub-tabs (not project-level navigation tabs) |
| Copying a card layout from one page to another without extracting | Ships faster | Two copies diverge independently; design drift within 2 phases | Only if layouts are genuinely expected to diverge per their specific context |
| Using `key={index}` instead of `key={field.id}` on useFieldArray items | Slightly simpler code | React remounts items on removal/reorder, losing controlled values | Never |
| `window.location.href` for post-action navigation | Simple, guaranteed hard nav | Fires immediately, cutting off dialog close animations | Acceptable for now; watch for flash during animated redesigns |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TanStack Table + new outer layout | Wrapping `<Table>` in a container with `overflow-hidden` clips the scroll shadow or any future sticky header | Test with > 20 rows and a narrow container before adding any overflow constraints |
| React Query (tRPC) cache + layout changes | Changing page layout triggers remount of query components if the provider moves; causes cache miss if `queryKey` changes | Verify `staleTime` (5 min globally) is preserved; no new providers should be inserted between the tRPC provider and the query components |
| nuqs `useQueryStates` + App Router | Calling `useQueryStates` anywhere that is not explicitly a Client Component causes a hydration mismatch | All `useQueryStates` calls must be in files with `"use client"` at the top — App Router defaults to Server Components |
| Radix portals (Dialog, Sheet, DropdownMenu) + layout containers | Adding CSS `transform`, `translate`, or `perspective` to the AppShell or any ancestor of a Radix portal breaks `position: fixed` — the portal exits the layout but its fixed positioning is now relative to the transformed ancestor | Never add `transform` or `perspective` to the AppShell, sidebar, or topbar containers |
| shadcn `<Tabs>` component + URL navigation | Using Radix Tabs for navigation-level project tabs removes URL-based navigation; the active tab defaults to the `defaultValue` on page load, not the current URL path | Use `<Link href>` for all navigation-level tabs; reserve Radix Tabs for in-page sub-sections |
| `scroll={false}` on Next.js `<Link>` | Removing this prop from project tab links causes scroll-to-top on every tab click, which is disruptive in data-dense views | Always include `scroll={false}` on navigation-level tab links |
| `container mx-auto` nesting | A `container` inside a `container` produces unexpected behavior at the `2xl` breakpoint (1400px max-width defined in `tailwind.config.ts`) | Use `container mx-auto` only at the top-level page div; nested content areas should use `w-full` with inner padding |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Adding new tRPC queries in a layout file (not the page file that needs it) | All child routes trigger the query on every render, not just pages that need the data | Keep tRPC queries in the page file that needs the data, not in `(dashboard)/layout.tsx` or the project `[projectSlug]/layout.tsx` | Immediately on first page load after the change ships |
| `createColumns` function called inside render without `useMemo` | Table re-creates column definitions on every parent re-render, causing full table remount and scroll position reset | Always wrap `createColumns` in `useMemo` — established correctly in `projects-table.tsx` line 63; maintain this pattern in every new table | At 50+ rows with frequent parent state changes (e.g., filter input debounce) |
| `useQueryStates` writing URL on every keystroke without debounce | Each character in a search field triggers a URL write (history entry) and a tRPC refetch | Use local React state debounced 300ms before writing to `useQueryStates` — established pattern in `projects/page.tsx` and `40-RESEARCH.md` | Immediately, visible as network request spam and sluggish search |
| Prefetch-on-hover calling all tab queries without checking cache freshness | Multiple parallel tRPC calls on rapid tab hover over entire nav | `utils.query.prefetch()` is a no-op if cache is fresh — this is safe by design; preserve the pattern and the 5-min staleTime | Not a trap at current scale; only becomes one if staleTime is accidentally removed from the tRPC client config |
| `container mx-auto` double-nesting at 1400px viewport | Unexpected horizontal whitespace or clipping at wide monitor resolutions | Use container only at the page root div | Visible at > 1400px viewport widths — wide monitor users in construction offices |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dark mode:** Every new background class has a `dark:` variant — verify by toggling the `.dark` class on `<html>` in DevTools Inspector
- [ ] **Tab navigation:** After redesigning project tabs, click every visible tab and verify the URL changes to the correct path and the correct data loads
- [ ] **Prefetch registration:** After adding a new tab to `ALL_SECTIONS` in `project-tabs.tsx`, verify `sectionPrefetchMap` has a corresponding entry and that the hovered tab fires a prefetch in the Network tab
- [ ] **Form submission:** After any layout change to a form-containing page, fill all fields, advance all steps, submit — verify the Network payload matches the Zod schema (no `undefined` fields)
- [ ] **Empty state:** Every redesigned table or list must show its empty state — verify by running with no data in the tenant
- [ ] **Skeleton state:** Every `isLoading` path renders a skeleton — verify by throttling to Slow 3G in DevTools
- [ ] **Mobile tab overflow:** The project tabs `overflow-x-auto` container must scroll horizontally at 375px width — verify in DevTools responsive mode
- [ ] **CVA variant coverage:** Any new StatusBadge or CVA component usage has a defined variant — no `variant={undefined}` fallthrough to silent default
- [ ] **React Query invalidation:** After any mutation in a redesigned form, verify that the relevant list query is invalidated (`onSuccess` has `utils.[query].invalidate()`)
- [ ] **TypeScript build:** Run `npx tsc --noEmit` from `apps/web/` after any shared component API change — do not rely only on the dev server's on-demand compilation
- [ ] **useFieldArray keys:** Confirm every `fields.map()` call uses `key={field.id}` not `key={index}`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dark mode broken across multiple redesigned files | MEDIUM | Grep all new/modified files for bare palette classes (`bg-amber`, `bg-white`, `bg-gray`); add `dark:` variants; verify with `.dark` class toggle in DevTools |
| Form submission broken after layout change | LOW if caught in UAT / HIGH if in production | Revert the layout wrapper that introduced conditional rendering around Controllers; re-implement the layout change as CSS visibility toggle (`hidden` / `opacity-0 pointer-events-none`) |
| URL-based tabs accidentally replaced with state tabs | MEDIUM | Restore `<Link href={fullHref} scroll={false}>` pattern; restore `onMouseEnter` prefetch handlers; test browser back button after switching two tabs |
| Shared component API change breaks 14+ call sites | MEDIUM | Run `grep -r ComponentName apps/web/ --include="*.tsx" -l`; add the old prop as an alias with the new prop as the canonical; do not re-rename without full-codebase grep |
| Tailwind class explosion discovered post-facto across 5+ phases | HIGH | Requires a dedicated design audit + CVA extraction phase; cannot be fixed inline; plan it as a named phase in the roadmap |
| tRPC prefetch silently broken after procedure rename | LOW | Search `project-tabs.tsx` for the old procedure name; update `sectionPrefetchMap`; verify in Network tab on hover |
| Over-scoped phase stalls | MEDIUM | Split the phase at the current completed surface; ship what is done; open a new phase plan for the remainder |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Over-scoping / stalled phases | Roadmap definition (before any code) | Each phase plan has a single surface area and a UAT checklist completable without other phases |
| Dark mode breakage | Phase 1 of redesign (shared chrome: header, tabs) — lock the dark mode pairing rule | Toggle `.dark` class; grep new files for unparied palette classes before merging |
| Tailwind class explosion / design drift | Phase 1 (canonical recipe documentation before page phases) | Canonical recipe doc added to `COMPONENT-ORGANIZATION.md`; PR review checks `TableCell` padding consistency |
| Form state regression (Controller remount, Select value loss) | Per-phase UAT on every form-containing page | Submit form with all fields populated; verify network payload in DevTools |
| Navigation pattern change (state tabs replacing URL tabs) | Routing foundation phase (document the rule before page phases) | URL changes on tab click; back button returns to previous tab; Network tab shows prefetch on hover |
| Stale shared component APIs | Shared Component Foundation phase (before page-level phases) | Grep call sites after every shared component change; TypeScript build (`npx tsc --noEmit`) passes |

---

## Sources

- Direct codebase inspection: `apps/web/app/globals.css` (CSS variable / dark mode token system — confirms `--background: 240 10% 3.9%` in dark mode)
- Direct codebase inspection: `apps/web/tailwind.config.ts` (custom tokens including `brand-slate`, `construction`, `sidebar`; `darkMode: ["class"]` strategy)
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-tabs.tsx` (URL-based tab pattern, `onMouseEnter` prefetch system, `sectionPrefetchMap`)
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/components/project-header.tsx` (hardcoded `bg-amber-50 text-amber-800` on restored-project banner; `bg-slate-500/10 text-slate-600` on mode badge; `window.location.href` hard nav)
- Direct codebase inspection: `apps/web/components/change-order/change-order-form.tsx` (multi-step form, `Controller` at line 441, `useFieldArray` with `key={field.id}` at line 362, `useForm<any>` cast at line 63)
- Direct codebase inspection: `apps/web/components/ui/button.tsx` (CVA variant pattern reference — `buttonVariants`)
- Direct codebase inspection: `apps/web/components/ui/tabs.tsx` (Radix Tabs — documents its existence and contrast with URL-based tab pattern)
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/components/projects-table.tsx` (TanStack Table pattern, `useMemo` column creation, `py-2 text-sm` on TableCell)
- Direct codebase inspection: `apps/web/app/(dashboard)/projects/[projectSlug]/budget/page.tsx` (`container mx-auto py-6 space-y-6` page wrapper canonical pattern)
- Direct codebase inspection: `apps/web/COMPONENT-ORGANIZATION.md` (extraction threshold, shared component rules, StatusBadge 6+ uses, CurrencyDisplay 14+ uses)
- Direct codebase inspection: `.planning/phases/40-document-system-redesign/40-RESEARCH.md` (tRPC query rename `document.list` → `document.listUnified` as real example of stale prefetch; nuqs debounce pattern)
- Grep audit: 52 TSX files in `apps/web/` contain hardcoded Tailwind palette color classes (confirmed via `grep -r "bg-white\|bg-gray-\|text-gray-\|bg-blue-\|text-blue-\|bg-green-\|text-green-\|bg-red-\|text-red-"`)
- Grep audit: `bg-amber-50` found in 3 production files without dark variants (`project-header.tsx`, `settings/company/page.tsx`, `settings/document-naming/page.tsx`, `forecast-metrics.tsx`)

---
*Pitfalls research for: BIDAXIOM UX redesign — Next.js 14 + Tailwind + shadcn/ui + TanStack Table*
*Researched: 2026-02-21*
