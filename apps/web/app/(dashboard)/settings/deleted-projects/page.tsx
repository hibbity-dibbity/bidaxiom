"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DeletedProjectsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.project.listDeleted.useQuery();

  const restoreMutation = trpc.project.restore.useMutation({
    onSuccess: () => {
      utils.project.listDeleted.invalidate();
      toast.success("Project restored. It will show a restoration banner.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Deleted Projects</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Deleted projects are permanently removed after 30 days. Restore a project to recover all data.
        </p>
      </div>

      {(!data || data.length === 0) ? (
        <div className="rounded border p-8 text-center text-muted-foreground text-sm">
          No deleted projects
        </div>
      ) : (
        <div className="rounded border divide-y">
          {data.map((project) => {
            const deletedAtDate = project.deletedAt ? new Date(project.deletedAt) : null;
            const formattedDate = deletedAtDate
              ? deletedAtDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";
            return (
              <div key={project.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">
                    {project.jobNumber ? `${project.jobNumber} — ${project.name}` : project.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deleted {formattedDate}
                    {project.deletedByName ? ` by ${project.deletedByName}` : ""}
                    {" · "}
                    {project.daysRemaining} day{project.daysRemaining !== 1 ? "s" : ""} remaining
                  </p>
                  {project.deletionReason && (
                    <p className="text-xs text-muted-foreground italic">Reason: {project.deletionReason}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => restoreMutation.mutate({ projectId: project.id })}
                  disabled={restoreMutation.isPending}
                >
                  Restore
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
