# Plan 06 Summary: App Shell & Navigation

**Commit:** ef7ee20
**Status:** Complete

## What was built
- Full responsive app shell with collapsible sidebar using shadcn/ui Sidebar component
- 11 shadcn/ui components installed (sidebar, dropdown-menu, avatar, breadcrumb, skeleton, sheet, separator, tooltip, button, input + use-mobile hook)
- `AppShell` component: SidebarProvider + AppSidebar + SidebarInset + TopBar + content area
- `AppSidebar`: collapsible="icon" mode, logo, SidebarNav with active/disabled states
- `TopBar`: SidebarTrigger, path-based Breadcrumbs, notification placeholder, CompanySwitcher, UserMenu
- `CompanySwitcher`: Clerk OrganizationSwitcher with hidePersonal
- `UserMenu`: Clerk UserButton with afterSignOutUrl
- `Breadcrumbs`: auto-generated from pathname with company name from Clerk
- Dashboard layout wrapping all `(dashboard)` routes in AppShell
- Loading skeleton state for dashboard

## Design system
- shadcn/ui New York style with Zinc theme
- CSS variables for all color tokens including sidebar-specific colors
- Tailwind config with full theme extension
