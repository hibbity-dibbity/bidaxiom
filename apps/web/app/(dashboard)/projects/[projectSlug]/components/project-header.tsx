"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import type { ProjectStatus } from "@construction/shared";

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

interface ProjectHeaderProps {
  project: {
    id: string;
    jobNumber: string | null;
    name: string;
    slug: string;
    status: ProjectStatus;
    customerId: string;
    customerSlug?: string | null;
    customerName?: string | null;
    street1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    budget?: string | null;
  };
  budgetSummary?: {
    totalBudgeted: number | string;
    totalCommitted: number | string;
    totalActual: number | string;
  } | null;
  teamMemberCount?: number;
}

export function ProjectHeader({ project, budgetSummary, teamMemberCount }: ProjectHeaderProps) {
  // Format currency with fallback for null/undefined
  const formatCurrencyValue = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return "--";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "--";
    return formatCurrency(numValue);
  };

  // Format date range
  const formatDateRange = () => {
    if (!project.startDate && !project.endDate) return null;
    const start = project.startDate ? new Date(project.startDate).toLocaleDateString() : "TBD";
    const end = project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD";
    return `${start} - ${end}`;
  };

  // Format address
  const formatAddress = () => {
    const parts = [
      project.street1,
      project.city,
      project.state,
      project.zip,
    ].filter(Boolean);

    if (parts.length === 0) return null;

    // Format as: street, city, state zip
    if (project.street1 && (project.city || project.state || project.zip)) {
      const cityStateZip = [project.city, project.state, project.zip].filter(Boolean).join(" ");
      return `${project.street1}, ${cityStateZip}`;
    }

    return parts.join(", ");
  };

  const address = formatAddress();
  const dateRange = formatDateRange();

  return (
    <div className="border-b pb-4">
      {/* Top row: Job # + Name + Status + Edit button */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name}
          </h1>
          <Badge className={statusColors[project.status]} variant="outline">
            {project.status.replace("_", " ")}
          </Badge>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${project.slug}/edit`}>
            Edit Project
          </Link>
        </Button>
      </div>

      {/* Info row: Customer (linked) + Address + Date range */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
        {project.customerName && (
          <Link
            href={`/customers/${project.customerSlug || project.customerId}`}
            className="hover:text-foreground hover:underline flex items-center gap-1.5"
          >
            <Building2 className="h-4 w-4" />
            {project.customerName}
          </Link>
        )}
        {address && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {address}
          </div>
        )}
        {dateRange && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {dateRange}
          </div>
        )}
      </div>

      {/* Key Metrics row: Budget Total, Committed, Actual Cost, Team Members */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Budget Total</p>
          <p className="text-sm font-semibold">
            {budgetSummary ? formatCurrencyValue(budgetSummary.totalBudgeted) : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Committed</p>
          <p className="text-sm font-semibold">
            {budgetSummary ? formatCurrencyValue(budgetSummary.totalCommitted) : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual Cost</p>
          <p className="text-sm font-semibold">
            {budgetSummary ? formatCurrencyValue(budgetSummary.totalActual) : "--"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Team Members</p>
          <p className="text-sm font-semibold">{teamMemberCount ?? "--"}</p>
        </div>
      </div>
    </div>
  );
}
