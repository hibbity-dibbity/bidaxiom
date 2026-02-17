"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
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
  const initializedRef = useRef(false);

  // Restore collapse state from localStorage on mount (runs once)
  useEffect(() => {
    setMounted(true);
    if (!initializedRef.current) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const shouldBeOpen = stored === "true";
        setOpen(shouldBeOpen);
      }
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen]);

  // Persist collapse state changes (only after initialization)
  useEffect(() => {
    if (mounted && initializedRef.current) {
      localStorage.setItem(STORAGE_KEY, String(open));
    }
  }, [open, mounted]);

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader className="h-14 shrink-0 border-b px-4">
        <div className="flex h-full items-center justify-center">
          {/* Full logo when expanded */}
          <Image
            src="/bidaxiom-logo.png"
            alt="BidAxiom"
            width={192}
            height={32}
            className="group-data-[collapsible=icon]:hidden dark:invert h-8 w-auto"
            priority
          />
          {/* Icon when collapsed */}
          <Image
            src="/bidaxiom-icon.png"
            alt="BidAxiom"
            width={32}
            height={32}
            className="hidden group-data-[collapsible=icon]:block dark:invert h-8 w-8"
            priority
          />
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
