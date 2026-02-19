"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { LifecyclePhase } from "@construction/shared";
import { LIFECYCLE_PHASE_LABELS } from "@construction/shared";
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

// Phase color mapping (read-only badge, no interactivity needed)
const phaseColors: Record<LifecyclePhase, string> = {
  opportunity:            "bg-purple-500/10 text-purple-700 border-purple-200",
  estimating:             "bg-blue-500/10 text-blue-700 border-blue-200",
  submitted:              "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  awarded:                "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  active:                 "bg-green-500/10 text-green-700 border-green-200",
  substantial_completion: "bg-teal-500/10 text-teal-700 border-teal-200",
  closed:                 "bg-gray-500/10 text-gray-700 border-gray-200",
  warranty:               "bg-orange-500/10 text-orange-700 border-orange-200",
  archived:               "bg-slate-500/10 text-slate-400 border-slate-200",
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
          <Badge className={phaseColors[phase]} variant="outline">
            {LIFECYCLE_PHASE_LABELS[phase]}
          </Badge>
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
