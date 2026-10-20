"use client";

import { trpc } from "@/lib/trpc";
import { TaskBoard } from "@/components/tasks/task-board";

/** A project's action items. The Tasks page in the sidebar shows the same list across every project. */
export default function ProjectTasksPage({ params }: { params: { projectSlug: string } }) {
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: params.projectSlug });
  if (!project) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Tasks</h2>
      <TaskBoard project={{ id: project.id, label: `${project.jobNumber ? `${project.jobNumber} - ` : ""}${project.name}` }} />
    </div>
  );
}
