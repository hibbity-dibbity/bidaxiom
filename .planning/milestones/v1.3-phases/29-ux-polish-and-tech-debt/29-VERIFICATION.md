---
phase: 29-ux-polish-and-tech-debt
verified: 2026-02-17T00:00:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
human_verification:
  - test: "Visually confirm empty state renders with icon, heading, description, and CTA button on change orders list"
    expected: "Dashed-border card with FilePlus icon, 'No change orders yet' heading, description text, and 'New Change Order' button"
    why_human: "Component rendering and visual layout cannot be verified programmatically"
  - test: "Confirm filter-active empty state shows simpler text-only message (no icon) when filters applied"
    expected: "'No change orders match the selected filters' text without icon container"
    why_human: "Conditional branch depends on runtime filter state"
  - test: "Visually confirm skeleton rows appear briefly during members page load (not 'Loading members...' text)"
    expected: "Three gray skeleton bars visible during network fetch, then replaced by member rows"
    why_human: "Loading state is transient and requires network throttling or live observation"
  - test: "Confirm query error triggers exactly one toast notification with 'Failed to load data' title"
    expected: "Single toast appears; does NOT multiply on re-renders (deduplication via id:'query-error' prevents this)"
    why_human: "Toast fire behavior depends on live network conditions and React Query retry cycle"
  - test: "Confirm mutation errors (e.g., failed project create) show only one toast, NOT two (no double-toasting from QueryCache + mutation onError)"
    expected: "Only the mutation's own onError toast appears; no second 'Failed to load data' toast from QueryCache"
    why_human: "Interaction between mutation error path and QueryCache requires runtime observation"
  - test: "Manually set job number on edit project page, save, then verify nextSequenceNumber advanced in Company Settings"
    expected: "Settings page shows nextSequenceNumber = (manualSequence + 1) after project save"
    why_human: "End-to-end flow requires browser interaction, DB write, and cache invalidation all working together"
---

# Phase 29: UX Polish and Tech Debt — Verification Report

**Phase Goal:** Every list and table view communicates clearly when empty, loading states are consistent across the app, API errors always surface via toast notifications, and manually editing a job number on the edit page correctly advances the auto-generation counter.
**Verified:** 2026-02-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | List and table views with no records display an informative empty state instead of a blank table body | VERIFIED | change-order-list.tsx L132-147: FilePlus icon + heading + description + CTA button in dashed border container. commitment-list.tsx L121-131: FileText icon + heading + description. payment-app-list.tsx L238-261: Receipt icon + heading + conditional description + conditional CTA. members/page.tsx L307-323: Users icon + heading + description + conditional Invite Member button |
| 2 | All data-fetching views show a skeleton loader or spinner during fetches rather than blank content areas | VERIFIED | members/page.tsx L228-233: `Array.from({ length: 3 }).map(() => <Skeleton className="h-14 w-full" />)` during membersLoading. L339-342: 2 skeleton rows during invitationsLoading. Separate pulse-animation loading states exist in change-order-list, commitment-list, and payment-app-list (pre-existing pulse skeletons, not modified by this phase) |
| 3 | API errors surface as toast notifications rather than silent failures | VERIFIED | providers.tsx L27-33: `new QueryCache({ onError: (error) => { toast.error("Failed to load data", { id: "query-error", description: error.message }) } })`. id:"query-error" prevents duplicate toasts on re-renders. No MutationCache present (confirmed by grep — avoids double-toasting) |
| 4 | When a user manually types a job number on edit project page and saves, the auto-generation counter advances | VERIFIED | project.ts L658-714: loads companyProfile, extracts sequence digits from input.jobNumber using template {N+} pattern, compares manualSequence >= nextSequenceNumber, sets updatedJobSettings = { nextSequenceNumber: manualSequence + 1 }. Wrapped in db.transaction with hard uniqueness check and companyProfiles update |

**Score:** 4/4 truths verified (automated)

### Required Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|---------------------|----------------|--------|
| `apps/web/app/providers.tsx` | QueryClient with QueryCache.onError global handler | Yes | Yes — QueryCache instantiated with onError calling toast.error; id:"query-error" for dedup | Yes — QueryClient passed to QueryClientProvider and trpc.Provider | VERIFIED |
| `apps/api/src/trpc/routers/project.ts` | project.update mutation with counter-advance logic | Yes | Yes — updatedJobSettings logic at L665-686, db.transaction at L688-714 | Yes — transaction updates companyProfiles AND projects atomically | VERIFIED |
| `apps/web/components/change-order/change-order-list.tsx` | Upgraded empty state with FilePlus icon + CTA | Yes | Yes — FilePlus imported (L16), icon container + heading + description + Button at L132-147 | Yes — handleNavigateToNew wired to Button onClick at L141 | VERIFIED |
| `apps/web/components/budget/commitment-list.tsx` | Upgraded empty state with FileText icon | Yes | Yes — FileText imported (L15), icon container + heading + description at L121-131 | Yes — rendered in filteredCommitments empty branch at L115-133 | VERIFIED |
| `apps/web/components/payment-app/payment-app-list.tsx` | Upgraded empty state with Receipt icon + conditional CTA | Yes | Yes — Receipt imported (L24), icon container + heading + hasSovItems-conditional CTA at L238-261 | Yes — CTA links to `/projects/${projectSlug}/payment-apps/new` only when hasSovItems | VERIFIED |
| `apps/web/app/(dashboard)/settings/members/page.tsx` | Skeleton loading + upgraded empty states | Yes | Yes — Skeleton imported (L17), Users imported (L16), 3 skeleton rows for members loading (L230-232), 2 for invitations loading (L340-342) | Yes — skeleton conditional on membersLoading/invitationsLoading booleans from tRPC queries | VERIFIED |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `providers.tsx QueryCache.onError` | `toast.error("Failed to load data")` | Direct call in onError handler | WIRED | L28-32: `onError: (error) => { toast.error("Failed to load data", { id: "query-error", description: error.message }) }` |
| `QueryCache.onError` | sonner toast | `import { toast } from "sonner"` | WIRED | L8: `import { toast } from "sonner"` — direct sonner package import |
| `project.update mutation` | `schema.companyProfiles` | `db.transaction with companyProfiles update` | WIRED | L709-713: `await tx.update(schema.companyProfiles).set({ jobNumberSettings: updatedJobSettings }).where(isNull(...))` inside transaction |
| `input.jobNumber` | `nextSequenceNumber` | Sequence digit extraction and comparison | WIRED | L670-685: template regex match, parseInt, `if (manualSequence >= jobNumberSettings.nextSequenceNumber) { updatedJobSettings = { nextSequenceNumber: manualSequence + 1 } }` |
| `change-order-list.tsx empty state` | `handleNavigateToNew` | Button onClick handler | WIRED | L141: `<Button onClick={handleNavigateToNew}>` in unfiltered empty state |
| `payment-app-list.tsx empty state` | `Link href payment-apps/new` | Button asChild + Link (only when hasSovItems) | WIRED | L251-258: `{hasSovItems && <Button asChild><Link href={.../payment-apps/new}>` |
| `members/page.tsx loading` | `Skeleton component` | membersLoading/invitationsLoading conditionals | WIRED | L228: `{membersLoading ? <div className="space-y-2">{Array.from({length:3}).map(...)}</div>` |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UX-01 | 29-03, 29-04 | List and table views display an informative empty state when no records exist | SATISFIED | 4 components upgraded: change-order-list (FilePlus + CTA), commitment-list (FileText), payment-app-list (Receipt + conditional CTA), members (Users + invite CTA). Filter-active states retain simpler text-only messages |
| UX-02 | 29-03, 29-04 | Data loading states consistent — skeleton loaders appear during fetches | SATISFIED | members/page.tsx: 3 Skeleton rows during membersLoading, 2 during invitationsLoading. Other list components have pre-existing pulse-animation skeleton placeholders |
| UX-03 | 29-01, 29-04 | API errors surface consistently via toast notifications | SATISFIED | QueryCache.onError in providers.tsx wired to toast.error with id:"query-error" deduplication. No MutationCache added (avoids double-toasting) |
| JOBEDIT-01 | 29-02, 29-04 | Job number manually changed on edit page advances auto-generation counter | SATISFIED | project.update mutation loads companyProfile, extracts sequence digits, advances nextSequenceNumber in companyProfiles inside db.transaction. Hard uniqueness check also added inside transaction |

**Orphaned requirements check:** REQUIREMENTS.md maps exactly UX-01, UX-02, UX-03, JOBEDIT-01 to Phase 29. All four are claimed by plans (29-01 through 29-04). No orphaned requirements.

### Commit Verification

All 10 commits from summaries verified present in git history:

| Commit | Description | Verified |
|--------|-------------|---------|
| `3ad1dd2` | feat(29-02): add job number counter-advance logic to project.update mutation | Yes |
| `6a049fc` | feat(29-01): add QueryCache global error handler to providers.tsx | Yes |
| `819c1e3` | feat(29-03): upgrade empty states in change-order-list, commitment-list, payment-app-list | Yes |
| `65848e8` | feat(29-03): add skeleton loading and upgraded empty states to members page | Yes |
| `f98f2fa` | fix(29-uat): deduplicate query error toasts and invalidate company cache on project edit | Yes |
| `2602a8b` | fix(settings): sync nextSequenceNumber when startingSequenceNumber changes | Yes |
| `9e59b52` | fix(job-numbers): enforce uniqueness on auto-generation and invalidate cache on create | Yes |
| `a156731` | fix(job-numbers): hard server-side uniqueness check inside transactions | Yes |
| `354ec43` | fix(settings): floor nextSequenceNumber above highest used job number | Yes |
| `38f4dc8` | fix(settings): invalidate getMaxUsedJobSequence cache on project create/edit | Yes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/providers.tsx` | 59 | `return {}` in catch block | Info | Correct behavior — returns empty headers object when auth token fetch fails; not a stub |

No blocker or warning anti-patterns found. The `return {}` in providers.tsx is intentional error handling in the auth token fetch, not a stub implementation.

### Human Verification Required

#### 1. Empty State Visual Rendering

**Test:** Navigate to a project with no change orders at `/projects/{slug}/change-orders`
**Expected:** Dashed-border card with FilePlus icon, "No change orders yet" heading, scope change description, and "New Change Order" button — NOT a blank area or bare text
**Why human:** Component rendering and CSS layout cannot be verified programmatically

#### 2. Filter-Active Empty State (Change Orders)

**Test:** On the change orders list, apply a filter (e.g., Status: Draft) with no matching results
**Expected:** Simple text message "No change orders match the selected filters" WITHOUT the icon container — icon pattern is for true-empty, not filtered-to-zero
**Why human:** Conditional branch requires runtime filter state

#### 3. Skeleton Loading Rows (Members Page)

**Test:** Navigate to `/settings/members` with network throttled to Slow 3G (Chrome DevTools Network tab)
**Expected:** Three gray horizontal skeleton bars visible momentarily during the fetch, then replaced by member rows — NOT "Loading members..." text
**Why human:** Loading state is transient and requires live observation with throttled network

#### 4. Query Error Toast (Single Instance)

**Test:** Block the API host in DevTools Network tab, navigate to `/projects`
**Expected:** A single toast appears with "Failed to load data" title and an error description — does NOT multiply even if React Query retries
**Why human:** Toast fire behavior and deduplication correctness requires live network conditions and React Query retry observation

#### 5. No Double-Toast on Mutation Errors

**Test:** With API blocked, attempt to create a new project via the project form
**Expected:** Only one error toast (the mutation's own onError toast) — NOT two toasts ("Failed to load data" + mutation error)
**Why human:** Interaction between QueryCache error handler and mutation onError path requires runtime observation to confirm MutationCache exclusion works correctly

#### 6. Job Number Counter Advance (End-to-End)

**Test:**
1. Go to Settings > Company > Job Number Settings. Note current "Next Sequence Number" (e.g., 5)
2. Navigate to an existing project's edit page
3. Change job number to one whose trailing sequence digits are higher (e.g., 0010 = 10 if counter is 5)
4. Save the project
5. Return to Settings > Company > Job Number Settings

**Expected:** "Next Sequence Number" now shows 11 (manualSequence + 1). Create a new project to confirm it gets sequence 11, not a conflicting number.
**Why human:** Full DB write + cache invalidation + settings page re-read cycle cannot be automated here

### Summary

All 9 automated must-have verifications passed:

- **providers.tsx:** QueryCache with onError correctly imports QueryCache, instantiates with onError handler, calls `toast.error` with `id:"query-error"` for deduplication, and wires the toast import from sonner directly. No MutationCache present.
- **project.ts (update mutation):** Company profile loaded, sequence digits extracted via template regex, updatedJobSettings advances nextSequenceNumber when manual >= current counter, all wrapped in db.transaction with hard uniqueness check. Pattern mirrors project.create exactly.
- **change-order-list.tsx:** FilePlus imported, full icon + heading + description + Button empty state in unfiltered branch, simpler text-only in filter-active branch.
- **commitment-list.tsx:** FileText imported, icon + heading + description empty state (no CTA, consistent with existing UI having no create flow).
- **payment-app-list.tsx:** Receipt imported, icon + heading + hasSovItems-conditional description + hasSovItems-conditional CTA button in empty branch.
- **members/page.tsx:** Skeleton imported, Users icon imported; 3 skeleton rows during membersLoading, 2 during invitationsLoading; Users icon empty state with conditional invite CTA (admin-only); UserPlus icon empty state for invitations.
- **All 10 git commits** from the plan summaries verified present in repository history.
- **No blocker anti-patterns** found across any of the 6 modified files.

6 human verification items remain for visual, behavioral, and end-to-end runtime confirmation. The code is substantive and correctly wired — human tests are for confidence rather than resolving known gaps.

---

_Verified: 2026-02-17_
_Verifier: Claude (gsd-verifier)_
