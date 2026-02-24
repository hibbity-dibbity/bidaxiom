"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, MapPin, Calendar } from "lucide-react";
import type { LifecyclePhase } from "@construction/shared";
import { LifecyclePhaseBadge } from "./lifecycle-phase-badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteProjectButton } from "../../components/delete-project-button";
import { CurrencyDisplay } from "@/components/shared/currency-display";

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
    startDate?: string | null;
    endDate?: string | null;
    restoredAt?: string | null;
  };
  headerStats: {
    contractValue: number;
    billedToDate: number;
    paidToDate: number;
    balanceToComplete: number;
    retainageHeld: number;
  } | null;
  canTransition: boolean;
  canDelete?: boolean;
}

function formatAddress(
  street1: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string | null {
  const parts = [street1, [city, state].filter(Boolean).join(", "), zip].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string | null {
  if (!startDate) return null;
  const start = new Date(startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (!endDate) return start;
  const end = new Date(endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

export function ProjectHeader({ project, headerStats, canTransition, canDelete }: ProjectHeaderProps) {
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

  return (
    <div className="pb-0">
      {/* Restored banner — renders above rows; accepted transient height when visible */}
      {project.restoredAt && (
        <div className="flex items-center justify-between rounded border border-border bg-muted px-4 py-2 text-sm text-muted-foreground mb-2">
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

      {/* Row 1 (~40px): Job # + Name + Lifecycle phase badge + Mode badge + Actions */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold truncate">
            {project.jobNumber ? `${project.jobNumber} — ${project.name}` : project.name}
          </h1>
          <LifecyclePhaseBadge
            projectId={project.id}
            projectSlug={project.slug}
            currentPhase={project.lifecyclePhase as LifecyclePhase}
            canTransition={canTransition}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDelete && (
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.name}
                  variant="menu-item"
                  onDeleted={() => {
                    window.location.href = "/projects";
                  }}
                />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/projects/${project.slug}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      {/* Row 2 (~30px): Customer + address + dates */}
      {(project.customerName || formatAddress(project.street1, project.city, project.state, project.zip) || formatDateRange(project.startDate, project.endDate)) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 flex-wrap">
          {project.customerName && (
            <>
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {project.customerSlug ? (
                <Link href={`/customers/${project.customerSlug}`} className="hover:underline truncate max-w-[200px]">
                  {project.customerName}
                </Link>
              ) : (
                <span className="truncate max-w-[200px]">{project.customerName}</span>
              )}
            </>
          )}
          {project.customerName && (formatAddress(project.street1, project.city, project.state, project.zip) || formatDateRange(project.startDate, project.endDate)) && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {formatAddress(project.street1, project.city, project.state, project.zip) && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[240px]">{formatAddress(project.street1, project.city, project.state, project.zip)}</span>
            </>
          )}
          {formatAddress(project.street1, project.city, project.state, project.zip) && formatDateRange(project.startDate, project.endDate) && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {formatDateRange(project.startDate, project.endDate) && (
            <>
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDateRange(project.startDate, project.endDate)}</span>
            </>
          )}
        </div>
      )}

      {/* Row 3 (~40px): Financial stat bar — 5 fields always visible */}
      <div className="flex items-center gap-6 pb-3 overflow-x-auto">
        {[
          { label: "Contract Value", value: headerStats?.contractValue ?? 0 },
          { label: "Billed to Date", value: headerStats?.billedToDate ?? 0 },
          { label: "Paid to Date", value: headerStats?.paidToDate ?? 0 },
          { label: "Balance to Complete", value: headerStats?.balanceToComplete ?? 0 },
          { label: "Retainage Held", value: headerStats?.retainageHeld ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col min-w-0 shrink-0">
            <span className="text-xs text-muted-foreground leading-tight whitespace-nowrap">{label}</span>
            <CurrencyDisplay amount={value} className="text-sm font-semibold" />
          </div>
        ))}
      </div>
    </div>
  );
}
