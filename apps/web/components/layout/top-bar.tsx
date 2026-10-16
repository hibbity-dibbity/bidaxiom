"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { UserMenu } from "./user-menu";
import { AttentionBell } from "./attention-bell";

/**
 * Top bar with sidebar trigger, search, and user menu.
 * Fixed at top of main content area.
 */
export function TopBar({ onSearchOpen }: { onSearchOpen?: () => void }) {
  const { open } = useSidebar();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Left: Sidebar trigger and logo */}
      <div className="flex items-center gap-2 flex-1">
        {/* Sidebar trigger when expanded */}
        {open && <SidebarTrigger className="-ml-1" />}
        {/* Logo appears here when sidebar is collapsed */}
        {!open && (
          <>
            <Image
              src="/BIDAXIOM-Logo-Dark-TransparentBG.png"
              alt="BIDAXIOM"
              width={172}
              height={40}
              className="block dark:hidden h-10 w-auto"
              priority
            />
            <Image
              src="/BIDAXIOM-Logo-Light-TransparentBG.png"
              alt="BIDAXIOM"
              width={172}
              height={40}
              className="hidden dark:block h-10 w-auto"
              priority
            />
          </>
        )}
      </div>

      {/* Right: Search, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Global search trigger (Cmd+K hint) */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          onClick={onSearchOpen}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <AttentionBell />

        <Separator orientation="vertical" className="h-4" />

        <UserMenu />
      </div>
    </header>
  );
}
