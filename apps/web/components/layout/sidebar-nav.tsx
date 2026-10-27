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
  FileText,
  ShoppingCart,
  Settings,
  CheckSquare,
} from "lucide-react";
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

type NavItem = { href: string; label: string; icon: any; roles?: string[] };

const FIN_ROLES = ["org:admin", "org:project_manager", "org:accountant", "org:estimator"];

const navGroups: Array<{ label?: string; items: NavItem[] }> = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: Home },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/customers", label: "Customers", icon: Users, roles: FIN_ROLES },
      { href: "/subcontractors", label: "Subs & Vendors", icon: HardHat },
    ],
  },
  {
    label: "Financial",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText, roles: FIN_ROLES },
      { href: "/orders", label: "PO & WO", icon: ShoppingCart, roles: FIN_ROLES },
      { href: "/outstanding", label: "Outstanding", icon: Receipt, roles: ["org:admin", "org:project_manager", "org:accountant"] },
    ],
  },
  { items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { orgRole } = useAuth();

  return (
    <>
      {navGroups.map((group, gi) => {
        const items = group.items.filter((item) => !item.roles || !orgRole || item.roles.includes(orgRole));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.label && (
              <SidebarGroupLabel className="h-auto px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em]">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
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
          </div>
        );
      })}
    </>
  );
}
