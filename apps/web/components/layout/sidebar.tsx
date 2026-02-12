"use client";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";

/**
 * Collapsible left sidebar.
 * Per locked decision: "Collapses to icon-only mode for more workspace"
 *
 * Uses shadcn Sidebar with collapsible="icon" variant:
 * - Expanded: shows icon + text labels
 * - Collapsed: icon-only mode
 * - Mobile: hidden, accessible via hamburger (SidebarTrigger)
 */
export function AppSidebar() {
  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="border-b px-2 py-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            CS
          </div>
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            ConstructionSaaS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarNav />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="text-xs text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
          v0.0.1
        </div>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
