"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Home,
  FolderKanban,
  Users,
  HardHat,
  Receipt,
  Settings,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const mainNav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/customers", label: "Customers", icon: Users, roles: ["org:admin", "org:project_manager", "org:accountant", "org:estimator"] },
  { href: "/outstanding", label: "Outstanding", icon: Receipt, roles: ["org:admin", "org:project_manager", "org:accountant"] },
  { href: "/subcontractors", label: "Subs & Vendors", icon: HardHat },
  { href: "/settings", label: "Settings", icon: Settings },
] as Array<{ href: string; label: string; icon: any; roles?: string[] }>;

export function SidebarNav() {
  const pathname = usePathname();
  const { orgRole } = useAuth();

  return (
    <SidebarMenu>
      {mainNav.filter((item) => !item.roles || !orgRole || item.roles.includes(orgRole)).map((item) => {
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
