# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.3 Polish & Gap Closure — Phase 28 (next phase)

## Current Position

Phase: 28 of 29 in v1.3 (Search & Dashboard Enhancements) — Ready for planning
Plan: 0 of TBD in Phase 28 — Not started
Status: Phase 27 complete (verified 2026-02-17); Phase 28 ready for planning
Last activity: 2026-02-17 — Completed Phase 27: slug routing for customers and subcontractors; fixed UUID prefix bug in slug generation

Progress: v1.0: [██████████] 100% (12 phases) | v1.1: [██████████] 100% (7 phases) | v1.2: [██████████] 100% (5 phases) | v1.3: [██████░░░░] ~60% (3/5 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 105
- Average duration: 4.4 min
- Total execution time: ~8.97 hours

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

**Recent Trend:**
- Last 5 plans: 27-03 (~5 min UAT + slug fix), 27-02 (3 min), 27-01 (5 min), 26-03 (~30 min), 26-02 (8 min)
- Trend: Phase 27 was lean — 2 plans executed in parallel, UAT surfaced one slug format bug fixed inline

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Slug-based routing (Phases 16-27)**: Complete — projects, customers, and subcontractors all use human-readable slug URLs
- **generateNameSlug vs generateSlug (Phase 27)**: Customers and subcontractors use name-only slugs (no UUID prefix); projects continue using job-number prefix via generateProjectSlug. The UUID prefix pattern was a uniqueness mechanism that produced ugly URLs — removed in favor of clean name slugs.
- **Custom auth over Clerk (Phase 12)**: JWT + MFA working well; session expiry handling gap closed by Phase 25 (SESS-01 + SESS-02 complete)
- **Iron-session for encrypted stateless cookies**: 7-day maxAge matching refresh token TTL — expiry detection needed client-side
- **startingSequenceNumber (Phase 24)**: Year rollover resets to configurable start; counter increment on manual edit-page change is tech debt (JOBEDIT-01, Phase 29)
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

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed Phase 27 — all 3 plans done, UAT passed (10/10), slug UUID prefix bug fixed
Resume file: None
