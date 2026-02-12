"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProjectForm } from "@/components/project/project-form";

/**
 * Project creation page.
 * Wraps the ProjectForm component with page layout and breadcrumbs.
 */
export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">New Project</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
        <p className="text-muted-foreground mt-1">
          Set up a new construction project with team, phases, and cost codes
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <ProjectForm />
      </div>
    </div>
  );
}
