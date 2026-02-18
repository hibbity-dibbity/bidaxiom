"use client";

import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { Check, LogOut, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * Custom user menu replacing Clerk UserButton.
 *
 * Displays user avatar with initials, profile info, and sign-out option.
 * Includes integrated company selector below Account Settings.
 * Uses custom auth context for user data and logout functionality.
 */
export function UserMenu() {
  const { user, orgId, switchOrg } = useAuth();
  const router = useRouter();
  const { data: organizations } = trpc.organization.list.useQuery();

  // Generate initials from user name or email
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleSignOut = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (response.ok) {
        router.push("/sign-in");
      }
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleSwitch = async (newOrgId: string) => {
    if (newOrgId !== orgId) {
      await switchOrg(newOrgId);
    }
  };

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-brand-slate text-brand-slate-foreground text-xs">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/account" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Account Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Company selector group */}
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1.5">
          Company
        </DropdownMenuLabel>
        {organizations?.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="cursor-pointer"
          >
            <Check className={`mr-2 h-4 w-4 text-primary ${org.id === orgId ? "opacity-100" : "opacity-0"}`} />
            <span className="truncate">{org.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create new company</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
