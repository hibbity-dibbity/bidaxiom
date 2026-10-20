"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";

export default function TasksPage() {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Action items across all your projects"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New task
          </Button>
        }
      />
      <TaskBoard newOpen={creating} onNewOpenChange={setCreating} />
    </div>
  );
}
