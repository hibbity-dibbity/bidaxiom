# Phase 1: Foundation & Multi-Tenant Infrastructure - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Authentication, multi-tenant schema isolation, policy-based authorization, immutable audit logging, and the responsive web application shell. This phase delivers the security and infrastructure foundation that every subsequent phase depends on. No business logic (projects, budgets, bids) — just the container they'll live in.

Requirements: IDMT-01 through IDMT-10, RWEB-01, RWEB-02 (12 requirements)

</domain>

<decisions>
## Implementation Decisions

### Auth & Onboarding Flow
- Signup creates an account AND a company (user becomes company admin)
- Users do NOT self-join companies — they are invited by the company admin
- Invited users accept email invite → account created → auto-joined to company (skip company creation)
- Admin-initiated invitations only; no self-service "join company" flow
- MFA is required for ALL users, no exceptions (not role-based, not configurable)
- Password reset via standard email link flow
- No social login (OAuth Google/GitHub) in v1 — email/password + MFA only

### Multi-Company Switching
- Slack-style company switcher: dropdown in header bar
- User can switch between companies they belong to without logging out
- Each company switch changes the data context (schema) but preserves session

### App Shell & Navigation
- Collapsible left sidebar for main navigation (projects, bidding, financials, etc.)
- Sidebar collapses to icon-only mode for more workspace
- Top bar contains: company switcher dropdown, user menu, notifications area
- Landing page after login: Company dashboard (overview of projects, activity, key metrics)
- Responsive: sidebar becomes hamburger menu on tablet/mobile, content goes full-width

### Project Navigation (within a project)
- Entering a project reveals project-specific sub-navigation tabs (Dashboard, Budget, Change Orders, Documents, etc.)
- Sub-nav sits below the top bar, within the project context
- Breadcrumbs show: Company → Project → [Current Section]

### Claude's Discretion
- Org/company hierarchy implementation details (how parent org maps to companies in auth provider)
- Schema provisioning timing and mechanism (eager vs lazy, migration tooling)
- Connection pooling strategy (PgBouncer config, pool sizes)
- Tenant routing middleware implementation
- Specific sidebar navigation items and icons
- Dashboard widget layout and content (will evolve as features ship)
- Exact responsive breakpoints (standard Tailwind breakpoints likely fine)
- Loading states and skeleton designs
- Error page designs (404, 403, 500)
- Toast/notification patterns

</decisions>

<specifics>
## Specific Ideas

- Company switcher should feel like Slack's workspace switcher — dropdown in header, shows company name + logo, quick switch without disrupting workflow
- Sidebar should be collapsible like Linear or Notion — clean when collapsed, descriptive when expanded
- "Last visited page" behavior NOT desired — always land on company dashboard after login

</specifics>

<deferred>
## Deferred Ideas

- **Passkeys / WebAuthn** — Consider for future version as modern auth alternative to passwords. User explicitly interested but agrees v1 uses email/password + MFA.
- **Social login (Google/GitHub OAuth)** — Not in v1, could reduce signup friction in future.

</deferred>

---

*Phase: 01-foundation-multi-tenant*
*Context gathered: 2026-02-10*
