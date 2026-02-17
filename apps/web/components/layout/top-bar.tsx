"use client";

import { Bell, Search } from "lucide-react";
import Image from "next/image";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CompanySwitcher } from "./company-switcher";
import { UserMenu } from "./user-menu";

/**
 * Top bar with sidebar trigger, search, company switcher, and user menu.
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
          <Image
            src="/bidaxiom-logo.png"
            alt="BidAxiom"
            width={192}
            height={32}
            className="dark:invert h-8 w-auto"
            priority
          />
        )}
      </div>

      {/* Right: Search, Notifications, Company Switcher, User Menu */}
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

        {/* Notification bell (placeholder) */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <CompanySwitcher />

        <Separator orientation="vertical" className="h-4" />

        <UserMenu />
      </div>
    </header>
  );
}
