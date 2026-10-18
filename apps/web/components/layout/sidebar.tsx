"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarTrigger,
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
    <ShadcnSidebar collapsible="icon" style={{ "--sidebar-width": "12.875rem" } as React.CSSProperties}>
      <SidebarHeader className="h-14 shrink-0 border-b">
        <div className="flex h-full items-center justify-center px-4">
          {/* Full logo when expanded — light mode */}
          <Image
            src="/BIDAXIOM-Logo-Dark-TransparentBG.png"
            alt="BIDAXIOM"
            width={172}
            height={40}
            className="group-data-[collapsible=icon]:hidden block dark:hidden h-10 w-auto"
            priority
          />
          {/* Full logo when expanded — dark mode */}
          <Image
            src="/BIDAXIOM-Logo-Light-TransparentBG.png"
            alt="BIDAXIOM"
            width={172}
            height={40}
            className="group-data-[collapsible=icon]:hidden hidden dark:block h-10 w-auto"
            priority
          />
          {/* Collapse/expand trigger when collapsed */}
          <div className="hidden group-data-[collapsible=icon]:block">
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarNav />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-2">
        <p className="select-text text-[10px] leading-none text-muted-foreground/60" title="Build running now">
          Build {process.env.NEXT_PUBLIC_BUILD_ID || "dev"}
        </p>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
