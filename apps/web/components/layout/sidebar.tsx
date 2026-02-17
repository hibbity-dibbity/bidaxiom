import Image from "next/image";
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
 * Static left sidebar — always visible, always expanded.
 * collapsible="none" disables icon-only mode and toggle.
 */
export function AppSidebar() {
  return (
    <ShadcnSidebar collapsible="none" style={{ "--sidebar-width": "12.875rem" } as React.CSSProperties}>
      <SidebarHeader className="h-14 shrink-0 border-b">
        <div className="flex h-full items-center justify-center px-4">
          <Image
            src="/bidaxiom-logo.png"
            alt="BidAxiom"
            width={192}
            height={32}
            className="dark:invert h-8 w-auto"
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
        <div className="text-xs text-muted-foreground px-2">
          v0.0.1
        </div>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
