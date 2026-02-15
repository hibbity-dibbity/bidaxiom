"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import slug from "slug";
import type { ProjectStatus } from "@construction/shared";

// Type for project data from API
interface Project {
  id: string;
  jobNumber: string | null;
  name: string;
  customerName: string | null;
  status: ProjectStatus;
  startDate: string | null;
}

// Status color mapping (consistent with existing page)
const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

// Helper to generate slug for project detail links
function getProjectSlug(project: Project): string {
  const jobPart = project.jobNumber || "project";
  const namePart = project.name;
  return slug(`${jobPart}-${namePart}`);
}

export const columns: ColumnDef<Project>[] = [
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
      const projectSlug = getProjectSlug(project);
      return (
        <Link
          href={`/projects/${projectSlug}`}
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
    accessorKey: "status",
    header: "Status",
    size: 120,
    cell: ({ row }) => {
      const status = row.getValue("status") as ProjectStatus;
      const displayStatus = status.replace("_", " ");
      const capitalizedStatus = displayStatus
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return (
        <Badge className={statusColors[status]} variant="outline">
          {capitalizedStatus}
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
