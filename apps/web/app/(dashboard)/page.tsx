"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { DashboardView } from "@/components/dashboard/dashboard-view";

/**
 * Company dashboard landing page.
 * Uses custom auth context instead of Clerk hooks.
 */
export default function DashboardPage() {
  const { orgId } = useAuth();
  const [isActivating, setIsActivating] = useState(false);

  // Fetch organizations for safety net
  const { data: organizations } = trpc.organization.list.useQuery(undefined, {
    retry: false,
  });

  // Safety net: If session has no org but user has orgs, auto-activate the first one
  useEffect(() => {
    if (!isActivating && !orgId && organizations && organizations.length > 0) {
      setIsActivating(true);

      // Call switch-org directly and reload
      fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organizations[0].id }),
      })
        .then(async (response) => {
          if (response.ok) {
            window.location.reload();
          } else {
            const errorData = await response.json().catch(() => null);
            toast.error(errorData?.error || "Failed to activate organization. Please refresh the page.");
            setIsActivating(false);
          }
        })
        .catch((error) => {
          console.error("Failed to activate organization:", error);
          toast.error("Failed to activate organization. Please refresh the page or log out and back in.");
          setIsActivating(false);
        });
    }
  }, [orgId, organizations, isActivating]);

  return <DashboardView />;
}
