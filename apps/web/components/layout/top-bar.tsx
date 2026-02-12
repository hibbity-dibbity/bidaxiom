"use client";

import { Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CompanySwitcher } from "./company-switcher";
import { UserMenu } from "./user-menu";

/**
 * Top bar with sidebar trigger, company switcher, and user menu.
 * Fixed at top of main content area.
 */
export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      {/* Left: Sidebar trigger */}
      <div className="flex items-center gap-2 flex-1">
        <SidebarTrigger className="-ml-1" />
      </div>

      {/* Right: Notifications, Company Switcher, User Menu */}
      <div className="flex items-center gap-3">
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
