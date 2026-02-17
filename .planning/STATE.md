# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** v1.3 Polish & Gap Closure — Phase 26 (next phase)

## Current Position

Phase: 26 of 29 in v1.3 (Account Settings & Shell Cleanup) — In Progress
Plan: 1 of 3 in Phase 26 — COMPLETE
Status: Phase 26 in progress; Plan 26-01 done, plans 26-02 and 26-03 remaining
Last activity: 2026-02-17 — Completed 26-01: auth.changePassword and auth.disableMfa mutations

Progress: v1.0: [██████████] 100% (12 phases) | v1.1: [██████████] 100% (7 phases) | v1.2: [██████████] 100% (5 phases) | v1.3: [██░░░░░░░░] ~20% (1/5 phases complete, Phase 26 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 99
- Average duration: 4.5 min
- Total execution time: ~8.75 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 20 | 3 | 9.9 min | 3.3 min |
| 21 | 2 | 4 min | 2 min |
| 22 | 4 | ~15 min | ~3.8 min |
| 23 | 1 | 5 min | 5 min |
| 24 | 2 | ~6 min | ~3 min |
| 25 | 3 | ~11 min | ~3.7 min |
| 26 | 1 so far | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 25-03 (~5 min UAT), 25-02 (3 min), 25-01 (3 min), 24-02 (2 min), 24-01 (4 min)
- Trend: Stable — averaging 3 min per plan in v1.3

*Updated after each plan completion*
| Phase 26-account-settings-and-shell-cleanup P02 | 8min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Slug-based routing (Phases 16-19)**: Partial — projects done, customers/subs still on UUID routes (Phase 27 completes this)
- **Custom auth over Clerk (Phase 12)**: JWT + MFA working well; session expiry handling gap closed by Phase 25 (SESS-01 + SESS-02 complete)
- **Iron-session for encrypted stateless cookies**: 7-day maxAge matching refresh token TTL — expiry detection needed client-side
- **startingSequenceNumber (Phase 24)**: Year rollover resets to configurable start; counter increment on manual edit-page change is tech debt (JOBEDIT-01, Phase 29)
- **Component library extraction at 3+ uses (Phase 19)**: Empty state and loading state components will likely qualify for extraction in Phase 29
- **window.location.href for session redirects (Phase 25)**: Full page reload ensures middleware re-evaluates iron-session cookie; router.push would leave broken session in place
- **SessionWatcher client component pattern (Phase 25)**: Dashboard layout stays a Server Component; tiny client wrapper mounts the hook without polluting layout
- **globalThis.fetch in tRPC interceptor (Phase 25)**: Prevents infinite recursion when custom fetch property overrides global fetch
- **changePassword revokes refresh tokens, disableMfa does not (Phase 26)**: Password change is a credential rotation event requiring forced re-login on other devices; MFA disable is a settings change that should not disrupt sessions
- **Manual Bearer token pattern for changePassword/disableMfa (Phase 26)**: Consistent with setupMfa/verifyMfaSetup in same file; both use authHeader?.replace("Bearer ", "") + verifyAccessToken
- [Phase 26-02]: collapsible=none on ShadcnSidebar: sidebar always fully expanded, no toggle
- [Phase 26-02]: User dropdown: single Account Settings link at /settings/account replaces Settings + MFA Settings
- [Phase 26-02]: MFA bug fix: SetupData type now includes hashedBackupCodes; verifyMfaSetup receives hashedBackupCodes not backupCodes

### Pending Todos

None.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 26-01-PLAN.md — auth.changePassword and auth.disableMfa mutations live in authRouter
Resume file: None
