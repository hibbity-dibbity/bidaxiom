"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import type { LifecyclePhase } from "@construction/shared";
import { LIFECYCLE_PHASE_LABELS } from "@construction/shared";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeleteProjectButton } from "./delete-project-button";

// Type for project data from API
interface Project {
  id: string;
  jobNumber: string | null;
  name: string;
  slug: string;
  customerName: string | null;
  lifecyclePhase: LifecyclePhase | null;
  startDate: string | null;
}

// Phase variant mapping (read-only badge, no interactivity needed)
const phaseToVariant = (phase: LifecyclePhase) => {
  switch (phase) {
    case "opportunity": return "pending" as const;
    case "estimating": return "pending" as const;
    case "submitted": return "pending" as const;
    case "awarded": return "approved" as const;
    case "active": return "active" as const;
    case "substantial_completion": return "active" as const;
    case "closed": return "completed" as const;
    case "warranty": return "warning" as const;
    case "archived": return "cancelled" as const;
    default: return "draft" as const;
  }
};

export function createColumns(
  isAdmin: boolean,
  onDelete: (projectId: string) => void
): ColumnDef<Project>[] {
  const cols: ColumnDef<Project>[] = [
    {
      accessorKey: "jobNumber",
      header: "Job #",
      size: 100,
      cell: ({ row }) => {
        const jobNumber = row.getValue("jobNumber") as string | null;
        return (
          <div className="font-mono text-sm">
            {jobNumber || "--"}
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: "Project Name",
      size: 300,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <Link
            href={`/projects/${project.slug}`}
            className="font-semibold text-sm hover:underline"
          >
            {project.name}
          </Link>
        );
      },
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      size: 200,
      cell: ({ row }) => {
        const customerName = row.getValue("customerName") as string | null;
        return (
          <div className="text-sm">
            {customerName || "--"}
          </div>
        );
      },
    },
    {
      accessorKey: "lifecyclePhase",
      header: "Phase",
      size: 160,
      cell: ({ row }) => {
        const phase = row.original.lifecyclePhase as LifecyclePhase | null;
        if (!phase) return null;
        return (
          <StatusBadge variant={phaseToVariant(phase)}>
            {LIFECYCLE_PHASE_LABELS[phase]}
          </StatusBadge>
        );
      },
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      size: 120,
      cell: ({ row }) => {
        const startDate = row.getValue("startDate") as string | null;
        if (!startDate) {
          return <div className="text-sm">--</div>;
        }
        return (
          <div className="text-sm">
            {new Date(startDate).toLocaleDateString()}
          </div>
        );
      },
    },
  ];

  if (isAdmin) {
    cols.push({
      id: "delete",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <DeleteProjectButton
          projectId={row.original.id}
          projectName={row.original.name}
          onDeleted={() => onDelete(row.original.id)}
          variant="table-row"
        />
      ),
    });
  }

  return cols;
}
