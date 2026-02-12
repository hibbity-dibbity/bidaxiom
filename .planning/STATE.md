# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** A GC can issue an RFQ, subs can respond with bids, and both can manage the full project financial lifecycle (budget → change orders → pay applications) in one platform — with AI drafting assistance embedded throughout.
**Current focus:** Phase 3 - Project Management Core

## Current Position

Phase: 3 of 9 (Project Management Core)
Plan: 4 of 5 in current phase
Status: In Progress
Last activity: 2026-02-12 — Completed 03-04-PLAN.md (Document and Folder Management API)

Progress: [███░░░░░░░] 27% (2 of 9 phases, 4 of 5 plans in phase 3)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 3 min
- Total execution time: 0.30 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 2 | 10 min | 5 min |
| 03 | 3 | 9 min | 3 min |

**Recent Trend:**
- Last 5 plans: 02-01 (5 min), 02-02 (5 min), 03-02 (2 min), 03-03 (3 min), 03-04 (4 min)
- Trend: Steady

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Schema-per-company DB isolation**: Strong data isolation without per-company DB instance ops overhead
- **Zero Trust security**: MFA, short-lived tokens, server-side PBAC enforced on every request
- **Cloud-agnostic deployment**: Avoids vendor lock-in; keeps deployment flexible as business needs evolve
- **Responsive web (no native mobile) for v1**: Faster to ship; field use works via mobile browser
- **Effective dating for company profile versioning**: Using validFrom/validTo pattern ensures all company configuration changes are preserved for historical context (02-01)
- **TEXT column + Zod validation for companyType**: Avoids PostgreSQL ENUM migration complexity while maintaining type safety via shared Zod schema (02-01)
- **Atomic transaction for version updates**: Close old version and insert new version in a single transaction to prevent race conditions (02-01)
- **Clerk v5 compact JWT claims**: Org data is under `o` key (o.id, o.rol) not top-level org_id/org_role. Role needs `org:` prefix normalization for CASL.
- **Lazy DB pool initialization**: Required due to ESM import hoisting — pool must be created after dotenv loads env vars.
- **Per-app .env.local in monorepo**: Next.js only reads .env.local from its own directory, not monorepo root.
- **Self-referential folder hierarchy without FK constraint**: Application-level validation enforces folder hierarchy integrity to avoid circular reference complexity (03-01)
- **Project team membership scoping in CASL**: Abilities accept optional projectTeamMemberships array, extract project IDs, use $in operator for conditions. Empty array when undefined prevents unintended access (03-01)
- **Denormalized document metadata for performance**: fileSize and contentType stored on documents table (in addition to document_versions) for fast list queries (03-01)
- **MinIO for local S3-compatible storage**: Cloud-agnostic; same API works with AWS S3 or other S3-compatible providers in production (03-02)
- **Tenant-prefixed storage keys**: Prevents cross-tenant document access via storage key format tenants/{tenantId}/projects/{projectId}/{uuid}/{fileName} (03-02)
- **Pre-signed URLs with different expiry times**: Uploads expire in 15 minutes (short-lived), downloads expire in 1 hour (user convenience) (03-02)
- **Creating user auto-added as project_manager**: Ensures the person creating a project has immediate management permissions without separate assignment (03-03)
- **Manual ability loading pattern for project-level permissions**: protectedProcedure with loadProjectAbilities() used instead of authorizedProcedure because abilities need project team membership context (03-03)
- **Pre-signed URL expiry strategy**: Uploads 15 minutes (short-lived security), downloads 1 hour (user convenience for viewing/downloading) (03-04)
- **Incremental document version numbers**: Simple integer sequence (1, 2, 3...) for chronological ordering, easier than semantic versioning or timestamps (03-04)
- **Soft delete for documents**: DB record deleted but S3 objects remain; orphaned storage cleanup via S3 lifecycle policies (future work) (03-04)
- **Storage key validation**: All uploaded storageKeys must start with tenants/{tenantId}/ to prevent cross-tenant injection attacks (03-04)
- **Server-managed folder orderIndex**: Calculated by querying max value then incrementing; prevents race conditions from concurrent client requests (03-04)

### Pending Todos

None yet.

### Blockers/Concerns

- Clerk webhook secret is still placeholder (`whsec_xxx`). Tenant auto-provisioning via webhooks won't work until configured with real secret from Clerk dashboard.

## Session Continuity

Last session: 2026-02-12 (Phase 3 in progress)
Stopped at: Completed 03-04-PLAN.md (Document and Folder Management API). Ready for 03-05-PLAN.md or next plan.
Resume file: None

---
*Created: 2026-02-10*
*Last updated: 2026-02-12*
