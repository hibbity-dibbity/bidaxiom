"use client";

import { useEffect, useState } from "react";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";

const STORAGE_KEY = "sidebar-collapsed";

/**
 * Collapsible left sidebar with persistent collapse state.
 * Per locked decision: "Collapses to icon-only mode for more workspace"
 *
 * Uses shadcn Sidebar with collapsible="icon" variant:
 * - Expanded: shows icon + text labels
 * - Collapsed: icon-only mode
 * - Mobile: hidden, accessible via hamburger (SidebarTrigger)
 * - Persists collapse state via localStorage
 */
export function AppSidebar() {
  const { setOpen, open } = useSidebar();
  const [mounted, setMounted] = useState(false);

  // Restore collapse state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setOpen(stored === "true");
    }
  }, [setOpen]);

  // Persist collapse state changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(open));
    }
  }, [open, mounted]);

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
