# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.3 Polish & Gap Closure — Phase 29 (in progress)

## Current Position

Phase: 29 of 29 in v1.3 (UX Polish & Tech Debt) — Complete
Plan: 4 of 4 in Phase 29 — Plan 29-04 complete
Status: Phase 29 complete; All plans 29-01 through 29-04 complete (2026-02-17); v1.3 milestone complete
Last activity: 2026-02-17 — Completed Plan 29-04: human UAT sign-off with 6 hotfixes (toast dedup, cache invalidation, job number uniqueness in transactions, startingSequenceNumber floor logic)

Progress: v1.0: [██████████] 100% (12 phases) | v1.1: [██████████] 100% (7 phases) | v1.2: [██████████] 100% (5 phases) | v1.3: [██████████] 100% (5/5 phases + 4/4 plans in Phase 29)

## Performance Metrics

**Velocity:**
- Total plans completed: 107
- Average duration: 4.3 min
- Total execution time: ~8.99 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 20 | 3 | 9.9 min | 3.3 min |
| 21 | 2 | 4 min | 2 min |
| 22 | 4 | ~15 min | ~3.8 min |
| 23 | 1 | 5 min | 5 min |
| 24 | 2 | ~6 min | ~3 min |
| 25 | 3 | ~11 min | ~3.7 min |
| 26 | 3 | ~40 min | ~13 min |
| 27 | 3 | ~13 min | ~4.3 min |
| 28 | 3 | ~12 min | ~4 min |
| 29 | 4 | ~10 min + UAT | ~3.3 min (excl. UAT) |

**Recent Trend:**
- Last 5 plans: 29-03 (~4 min), 29-02 (~3 min), 29-01 (~3 min), 28-02 (~2 min), 28-01 (~8 min)
- Trend: Phase 29 plans are surgical UX polish/tech debt — no deviations, fast execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Slug-based routing (Phases 16-27)**: Complete — projects, customers, and subcontractors all use human-readable slug URLs
- **generateNameSlug vs generateSlug (Phase 27)**: Customers and subcontractors use name-only slugs (no UUID prefix); projects continue using job-number prefix via generateProjectSlug. The UUID prefix pattern was a uniqueness mechanism that produced ugly URLs — removed in favor of clean name slugs.
- **Custom auth over Clerk (Phase 12)**: JWT + MFA working well; session expiry handling gap closed by Phase 25 (SESS-01 + SESS-02 complete)
- **Iron-session for encrypted stateless cookies**: 7-day maxAge matching refresh token TTL — expiry detection needed client-side
- **startingSequenceNumber (Phase 24)**: Year rollover resets to configurable start; counter increment on manual edit-page change was tech debt JOBEDIT-01, now closed by Plan 29-02
- **project.update counter-advance (Phase 29)**: update mutation now mirrors create mutation — loads companyProfile, extracts sequence digits via template {N+} pattern, advances nextSequenceNumber in a transaction if manual value >= current counter
- **Component library extraction at 3+ uses (Phase 19)**: Empty state and loading state components will likely qualify for extraction in Phase 29
- **window.location.href for session redirects (Phase 25)**: Full page reload ensures middleware re-evaluates iron-session cookie; router.push would leave broken session in place
- **SessionWatcher client component pattern (Phase 25)**: Dashboard layout stays a Server Component; tiny client wrapper mounts the hook without polluting layout
- **globalThis.fetch in tRPC interceptor (Phase 25)**: Prevents infinite recursion when custom fetch property overrides global fetch
- **changePassword revokes refresh tokens, disableMfa does not (Phase 26)**: Password change is a credential rotation event requiring forced re-login on other devices; MFA disable is a settings change that should not disrupt sessions
- **ctx.userId pattern for changePassword/disableMfa (Phase 26)**: createContext already verifies JWT and sets ctx.userId; manual Bearer token extraction pattern from Plan 26-01 was replaced with ctx.userId in Plan 26-03 after discovering ctx has no req property
- **tRPC fetch body: no { json: {} } wrapper (Phase 26)**: Without superjson transformer, tRPC REST handler expects raw input directly, not wrapped in { json: {...} }; affects all manual fetch calls to tRPC endpoints
- **collapsible="icon" not "none" (Phase 26)**: "icon" enables icon-only collapse mode (sidebar collapses to icon strip); "none" disables collapse entirely. Phase goal was always-visible with collapse toggle intact, so "icon" is correct
- **sidebar-nav.tsx fix (Phase 26)**: NAV-01 root cause was projectNav context-switching in sidebar-nav.tsx, not the collapsible prop. Fixed by removing the project-context detection branch; sidebar-nav now always renders mainNav
- **router.replace for post-rename slug navigation (Phase 27)**: After companyName change regenerates slug, router.replace navigates to new URL so old slug is not left in back-stack history
- **onSuccess type widened with optional arg (Phase 27)**: SubcontractorForm onSuccess prop accepts optional { slug, id } so update caller can receive new slug without requiring it; create caller omits arg, remaining compatible
- **Estimate search: .some() guard on CommandGroup (Phase 28)**: Estimates CommandGroup uses .some() guard to avoid rendering empty heading when no estimates match; Projects/Customers groups always render (consistent with prior behavior for those types)
- **isNotNull slug guard in estimate search query (Phase 28)**: Estimates without slugs are excluded at DB query level — prevents URL construction failures and avoids fetching data that would be filtered in JS
- **Customer search URL: c.slug not c.id (Phase 28)**: Customer results in global search now navigate to /customers/{slug} matching the slug-based routing from Phase 27; was previously using UUID producing 404s
- **EstimatingPipeline no onClick (Phase 28)**: Placeholder data (always 0), no top-level estimates list page exists yet — widget intentionally left non-clickable
- **MyTodo no onClick (Phase 28)**: Spans 3 sub-resource types (change orders, pay apps, workflows) with no unified inbox page — no clean single navigation target
- **QueryCache.onError not defaultOptions.queries.onError (Phase 29)**: v5 react-query API; defaultOptions.queries.onError silently no-ops in v5. QueryCache.onError is the correct global catch for query failures.
- **No MutationCache.onError in global handler (Phase 29)**: Mutations already handle errors via per-mutation onError callbacks; adding global mutation handler would double-toast every failure
- **Empty state CTA omitted from commitment-list (Phase 29)**: No create-commitment flow exists in UI; adding CTA would be out of scope
- **payment-app-list empty state CTA gated on hasSovItems (Phase 29)**: When SOV not set up, description explains prerequisite; matches existing disabled-button pattern at top of page
- **Members invite CTA focuses email input (Phase 29)**: document.getElementById("email")?.focus() scrolls user to invite form rather than duplicating form inline in empty state
- **Filter-active empty states stay text-only (Phase 29)**: Icon pattern reserved for true empty states; filtered-to-zero uses simpler text message
- **Toast deduplication via stable id (Phase 29 UAT)**: QueryCache.onError fires per re-render; passing a stable id to toast() deduplicates so only one toast appears per error type regardless of retry count
- **Invalidate companyProfile on project save (Phase 29 UAT)**: project.create and project.update both advance nextSequenceNumber server-side; Settings page must invalidate companyProfile cache after saves to display accurate counter
- **startingSequenceNumber floors nextSequenceNumber at maxUsed+1 (Phase 29 UAT)**: Lowering startingSequenceNumber cannot reduce nextSequenceNumber below highest-ever-issued sequence; floor computed via getMaxUsedJobSequence to prevent duplicate job numbers
- **Uniqueness check inside DB transaction (Phase 29 UAT)**: Load-compare-write uniqueness has a race window; moved collision check inside transaction for both auto-generate and manual-edit paths

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed Plan 29-04 — human UAT sign-off; Phase 29 complete; v1.3 milestone complete
Resume file: None
