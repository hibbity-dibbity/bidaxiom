"use client";

import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Custom organization switcher replacing Clerk OrganizationSwitcher.
 *
 * Displays current organization and allows switching between user's orgs.
 * Uses custom auth context and organization tRPC router.
 */
export function CompanySwitcher() {
  const { orgId, orgName, switchOrg } = useAuth();
  const { data: organizations, isLoading } = trpc.organization.list.useQuery();

  const handleSwitch = async (newOrgId: string) => {
    if (newOrgId !== orgId) {
      await switchOrg(newOrgId);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-32" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="px-2 py-1 rounded-md border border-input bg-background hover:bg-accent text-sm"
        >
          <span className="truncate max-w-[150px]">{orgName || "Select organization"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {organizations && organizations.length > 0 ? (
          <>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="cursor-pointer"
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    org.id === orgId ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Company</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
