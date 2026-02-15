"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { SearchProvider, useSearch } from "@/components/search/command-palette";

/**
 * Main application shell composing sidebar + topbar + content.
 *
 * Layout:
 * - Desktop (lg+): sidebar visible, collapsible
 * - Mobile/tablet (< lg): sidebar hidden, accessible via hamburger
 * - Full height: h-screen with flex row
 * - Content area scrolls independently
 * - Global search accessible via Cmd+K or search button
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopBarWithSearch />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SearchProvider>
  );
}

/**
 * TopBar wrapper that connects to search context.
 */
function TopBarWithSearch() {
  const { setOpen } = useSearch();
  return <TopBar onSearchOpen={() => setOpen(true)} />;
}
