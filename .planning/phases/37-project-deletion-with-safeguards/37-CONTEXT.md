# Phase 37: Project Deletion with Safeguards - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-only project deletion with lifecycle phase and financial record guards, a reason-required confirmation dialog, soft-delete with 30-day recovery window in Company Settings, and auto-purge after 30 days. Restore capability is included in this phase. Build time purging is Claude's implementation decision.

</domain>

<decisions>
## Implementation Decisions

### Delete entry points
- Project table: delete action lives as a **separate danger zone** on the row (standalone red button visible on hover/row actions, separate from other actions like Edit/View)
- Project detail page: delete action lives in the **project header actions menu** (kebab/actions dropdown next to the lifecycle badge)
- Non-admin users: **completely hidden** — no delete options appear on any surface for non-admins
- Action label: **"Delete Project"** (clear, direct, standard CRUD language)

### Blocking feedback
- Check runs **before** the confirmation dialog — clicking "Delete Project" triggers a pre-flight check immediately
- If blocked: a **modal/dialog** appears explaining why (not a toast)
- Error specificity: **all blocking reasons listed at once** — e.g., "Cannot delete: project is in Active phase and has 3 change orders and 1 payment application"
- Both blocking triggers checked simultaneously: lifecycle phase AND financial records (change orders, payment apps, committed costs)

### Confirmation dialog
- **Replaces roadmap DEL-03 spec** (roadmap said "type exact project name" — user decision overrides this)
- Dialog shows:
  - Warning text explaining deletion
  - Reassuring note: "You can recover this project within 30 days via Company Settings → Deleted Projects"
  - Required **Reason for deletion** text field (free text, required — Delete button disabled until filled)
  - No "type project name" field — logged-in user identity is captured automatically from auth
- Delete button: **red/destructive variant**
- Reason is stored in the audit trail alongside actor identity and timestamp

### Recovery path
- Location: **Company Settings → Deleted Projects** section (tab or section within settings)
- Deleted projects list shows: project name, deleted date, deleted by, reason, days remaining until auto-purge
- Admin restores a project → project is **restored to exact prior state** but shows a **"This project was deleted and restored"** banner on the project header
- After 30 days: **auto-purge** (hard delete) — record is permanently removed from the database

### Claude's Discretion
- Auto-purge implementation (cron job, on-read lazy check, or scheduled task)
- Exact row danger zone UI pattern (how the red button appears/animates on hover)
- Exact wording of blocking error messages and confirmation dialog body text
- Recovery banner dismissal behavior (persistent vs. dismissible)
- Database column names for soft-delete fields (deleted_at, deleted_by, deletion_reason, etc.)

</decisions>

<specifics>
## Specific Ideas

- The blocking modal should enumerate ALL blocking factors simultaneously — not just the first one found. User wants to see the full picture in one message.
- The 30-day window should be surfaced reassuringly in the confirmation dialog — not hidden as an internal implementation detail.
- Recovery lives in Company Settings (not a toggle on the projects list) — keeps the main projects view clean.
- The "restored and flagged with banner" pattern signals to the project team that something happened — avoids silent resurrection.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-project-deletion-with-safeguards*
*Context gathered: 2026-02-19*
