"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, MoreVertical } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import type { LifecyclePhase } from "@construction/shared";
import { LifecyclePhaseBadge } from "./lifecycle-phase-badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteProjectButton } from "../../components/delete-project-button";

interface ProjectHeaderProps {
  project: {
    id: string;
    jobNumber: string | null;
    name: string;
    slug: string;
    lifecyclePhase: string;
    projectMode: string;
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
    restoredAt?: string | null;
  };
  budgetSummary?: {
    totalBudgeted: number | string;
    totalCommitted: number | string;
    totalActual: number | string;
  } | null;
  teamMemberCount?: number;
  canTransition: boolean;
  canDelete?: boolean;
}

export function ProjectHeader({ project, budgetSummary, teamMemberCount, canTransition, canDelete }: ProjectHeaderProps) {
  const utils = trpc.useUtils();

  const setModeMutation = trpc.project.setMode.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: project.slug });
      toast.success("Project mode updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update project mode");
    },
  });

  const acknowledgeRestoreMutation = trpc.project.acknowledgeRestore.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: project.slug });
    },
  });

  const handleModeSwitch = () => {
    const newMode = project.projectMode === "simple" ? "gc_advanced" : "simple";
    setModeMutation.mutate({ projectId: project.id, mode: newMode as "simple" | "gc_advanced" });
  };

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
      {/* Top row: Job # + Name + Lifecycle Phase Badge + Mode Badge + Edit button */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            {project.jobNumber ? `${project.jobNumber}-${project.name}` : project.name}
          </h1>
          <LifecyclePhaseBadge
            projectId={project.id}
            projectSlug={project.slug}
            currentPhase={project.lifecyclePhase as LifecyclePhase}
            canTransition={canTransition}
          />
          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
            {project.projectMode === "simple" ? "Simple" : "GC/Advanced"}
          </Badge>
          {canTransition && (
            <button
              onClick={handleModeSwitch}
              disabled={setModeMutation.isPending}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setModeMutation.isPending
                ? "Switching..."
                : project.projectMode === "simple"
                ? "Switch to GC/Advanced"
                : "Switch to Simple"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.name}
                  variant="menu-item"
                  onDeleted={() => {
                    window.location.href = "/projects";
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.slug}/edit`}>
              Edit Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Restored banner — shown when project was recently restored */}
      {project.restoredAt && (
        <div className="flex items-center justify-between rounded border border-border bg-muted px-4 py-2 text-sm text-muted-foreground mb-3">
          <span>This project was deleted and restored.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => acknowledgeRestoreMutation.mutate({ projectId: project.id })}
            disabled={acknowledgeRestoreMutation.isPending}
          >
            Dismiss
          </Button>
        </div>
      )}

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
