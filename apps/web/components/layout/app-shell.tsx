"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Main application shell composing sidebar + topbar + content.
 *
 * Layout:
 * - Desktop (lg+): sidebar visible, collapsible
 * - Mobile/tablet (< lg): sidebar hidden, accessible via hamburger
 * - Full height: h-screen with flex row
 * - Content area scrolls independently
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
