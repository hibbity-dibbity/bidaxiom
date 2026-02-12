"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  Gavel,
  DollarSign,
  FileText,
  Settings,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    active: true,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    active: false,
  },
  {
    label: "Bidding",
    href: "/bids",
    icon: Gavel,
    active: false,
  },
  {
    label: "Financials",
    href: "/financials",
    icon: DollarSign,
    active: false,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileText,
    active: false,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    active: false,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
            >
              <Link
                href={item.active ? item.href : "#"}
                className={!item.active ? "opacity-50 cursor-not-allowed" : ""}
                onClick={
                  !item.active ? (e) => e.preventDefault() : undefined
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                {!item.active && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Soon
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
