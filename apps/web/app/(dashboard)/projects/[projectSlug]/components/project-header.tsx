"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, MapPin, Calendar } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    customerBudget?: string | null;
  };
  stats: {
    contractValue: number;
    billed: number;
    collected: number;
    costBudget: number;
    paid: number;
    outstanding: number;
    cashPosition: number;
    profit: number;
    marginPercent: number | null;
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

function DatePickerField({
  label,
  value,
  projectId,
  field,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  projectId: string;
  field: "startDate" | "endDate";
  onSave: (isoDate: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const formatted = value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const selected = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {formatted ? (
          <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            {formatted}
          </button>
        ) : (
          <button
            title={label}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label={label}
          >
            <Calendar className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={selected}
          onSelect={(date) => {
            setOpen(false);
            onSave(date ? date.toISOString() : null);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function ProjectHeader({ project, stats, canTransition, canDelete }: ProjectHeaderProps) {
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

  const updateProjectMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: project.slug });
      toast.success("Project updated");
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Failed to update project");
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

      {/* Row 2 (~30px): Customer + address + date pickers */}
      {(project.customerName || formatAddress(project.street1, project.city, project.state, project.zip) || true) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 flex-wrap">
          {/* Customer */}
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
          {project.customerName && formatAddress(project.street1, project.city, project.state, project.zip) && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {formatAddress(project.street1, project.city, project.state, project.zip) && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-w-[240px]">{formatAddress(project.street1, project.city, project.state, project.zip)}</span>
            </>
          )}
          {formatAddress(project.street1, project.city, project.state, project.zip) && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {/* Start date picker */}
          <DatePickerField
            label="Set start date"
            value={project.startDate}
            projectId={project.id}
            field="startDate"
            onSave={(iso) =>
              updateProjectMutation.mutate({ id: project.id, startDate: iso })
            }
          />
          {/* "–" only when at least one date is set */}
          {(project.startDate || project.endDate) && (
            <span className="text-muted-foreground/40">–</span>
          )}
          {/* End date picker */}
          <DatePickerField
            label="Set end date"
            value={project.endDate}
            projectId={project.id}
            field="endDate"
            onSave={(iso) =>
              updateProjectMutation.mutate({ id: project.id, endDate: iso })
            }
          />
        </div>
      )}

      {/* Row 3: Financial stat bar (contract, cash in, cost, cash out) */}
      <div className="flex items-center gap-6 pb-3 overflow-x-auto">
        {[
          ["Contract Value", stats?.contractValue ?? 0, false],
          ["Billed", stats?.billed ?? 0, false],
          ["Collected", stats?.collected ?? 0, false],
          ["Cost Budget", stats?.costBudget ?? 0, false],
          ["Projected Profit", stats?.profit ?? 0, true],
          ["Paid", stats?.paid ?? 0, false],
          ["Outstanding to Pay", stats?.outstanding ?? 0, false],
          ["Cash Position", stats?.cashPosition ?? 0, true],
        ].flatMap((row, i) =>
          // The margin sits right after projected profit, as a percent of contract value.
          row[0] === "Projected Profit"
            ? [row, ["Margin", stats?.marginPercent ?? null, "percent"]]
            : [row]
        ).map(([label, amount, signed]) => signed === "percent" ? (
          <div key={label as string} className="flex flex-col min-w-0 shrink-0">
            <span className="text-xs text-muted-foreground leading-tight whitespace-nowrap">{label as string}</span>
            <span className="text-sm font-semibold tabular-nums">{amount === null ? "—" : `${(amount as number).toFixed(1)}%`}</span>
          </div>
        ) : (
          <div key={label as string} className="flex flex-col min-w-0 shrink-0">
            <span className="text-xs text-muted-foreground leading-tight whitespace-nowrap">{label as string}</span>
            <CurrencyDisplay
              amount={amount as number}
              className={`text-sm font-semibold ${signed && (amount as number) < 0 ? "text-destructive" : ""}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
