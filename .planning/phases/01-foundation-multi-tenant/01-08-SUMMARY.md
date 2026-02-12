# Plan 08 Summary: E2E Smoke Test Pages

**Status:** Complete

## What was built
- Enhanced Dashboard page (`apps/web/app/(dashboard)/page.tsx`):
  - Real audit activity feed wired to `trpc.audit.summary.useQuery()`
  - Stats cards (Active Projects, Open Bids, Pending Pay Apps) with placeholder values
  - Quick actions: "Invite Team Members" (active link), "Create Project" (disabled/coming soon)
  - ActivityItem component with action icons (create, invite, role_change, login)
  - Relative time display (just now, Xm ago, Xh ago, Xd ago)
  - Loading skeleton states
- Settings landing page (`apps/web/app/(dashboard)/settings/page.tsx`):
  - Grid with Team Members (active link) and Company Profile (disabled/coming soon) cards
- Team Members page (`apps/web/app/(dashboard)/settings/members/page.tsx`):
  - Clerk OrganizationProfile component for member management
  - Styled to match app design (hidden navbar, no shadow, rounded border)
  - Admins see invite form + member management; members see read-only list
- Settings nav item activated in sidebar-nav.tsx

## Pages now navigable
- `/` — Dashboard with live audit feed
- `/settings` — Settings hub
- `/settings/members` — Team member management via Clerk
