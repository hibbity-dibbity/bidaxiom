"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  FolderKanban,
  DollarSign,
  FileText,
  Users,
  HardHat,
  Settings,
  BarChart,
  Briefcase,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const mainNav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/subcontractors", label: "Subcontractors", icon: HardHat },
  { href: "/bids", label: "Bidding", icon: Briefcase },
  { href: "/financials", label: "Financials", icon: DollarSign },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Contextual nav items shown when viewing a project
const projectNav = [
  { href: "/overview", label: "Overview", icon: Home },
  { href: "/budget", label: "Budget", icon: DollarSign },
  { href: "/change-orders", label: "Change Orders", icon: FileText },
  { href: "/documents", label: "Documents", icon: FileText },
];

export function SidebarNav() {
  const pathname = usePathname();

  // Detect if we're viewing a project detail page
  const isProjectPage = pathname?.startsWith("/projects/") && pathname !== "/projects";

  // Extract project ID from URL if on project page
  const projectId = isProjectPage ? pathname?.split("/")[2] : null;

  // Use contextual nav when viewing project, main nav otherwise
  const navItems = isProjectPage
    ? projectNav.map((item) => ({
        ...item,
        href: `/projects/${projectId}${item.href}`,
      }))
    : mainNav;

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={isActive}>
              <Link href={item.href}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
