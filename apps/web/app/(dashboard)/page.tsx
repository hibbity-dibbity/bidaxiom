"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MyActiveProjects, MyOpenBids, MyTodo } from "@/components/dashboard/user-widgets";
import { TotalActiveProjects, CompanyOpenBids, BidOpportunities, RevenueInProgress, Backlog, EstimatingPipeline } from "@/components/dashboard/company-widgets";

/**
 * Company dashboard landing page.
 * Uses custom auth context instead of Clerk hooks.
 */
export default function DashboardPage() {
  const { orgId, orgName } = useAuth();
  const companyName = orgName || "Your Company";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to {companyName}</p>
      </div>

      {/* User-Level Widgets - "My" section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">My Overview</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <MyActiveProjects />
          <MyOpenBids />
          <MyTodo />
        </div>
      </div>

      {/* Company-Level Widgets - KPI section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Company Overview</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <TotalActiveProjects />
          <CompanyOpenBids />
          <BidOpportunities />
        </div>
      </div>

      {/* Financial Widgets */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Financial Summary</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <RevenueInProgress />
          <Backlog />
          <EstimatingPipeline />
        </div>
      </div>
    </div>
  );
}
