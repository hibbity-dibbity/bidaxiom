"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CalendarProjectSyncProps {
  connectionId: string;
}

export function CalendarProjectSync({
  connectionId,
}: CalendarProjectSyncProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [syncingProject, setSyncingProject] = useState<string | null>(null);

  const { data: projectsData, isLoading } = trpc.project.list.useQuery({});

  const syncProjectMutation = trpc.calendar.syncProject.useMutation({
    onMutate: (variables) => {
      setSyncingProject(variables.projectId);
    },
    onSuccess: () => {
      toast.success("Project milestones queued for sync", {
        description: "Your calendar will update shortly",
      });
    },
    onError: (error) => {
      toast.error("Failed to sync project", {
        description: error.message,
      });
    },
    onSettled: () => {
      setSyncingProject(null);
    },
  });

  const handleSyncProject = (projectId: string) => {
    syncProjectMutation.mutate({ connectionId, projectId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading projects...
      </div>
    );
  }

  const projects = projectsData?.items || [];

  if (projects.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No projects found. Create a project to sync milestones to your calendar.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Button
        variant="ghost"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-semibold">
          Sync Individual Projects ({projects.length})
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {isOpen && (
        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{project.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {project.status}
                  </Badge>
                  {project.jobNumber && (
                    <span className="text-xs text-muted-foreground">
                      {project.jobNumber}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSyncProject(project.id)}
                disabled={syncingProject === project.id}
              >
                {syncingProject === project.id && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                Sync to Calendar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
