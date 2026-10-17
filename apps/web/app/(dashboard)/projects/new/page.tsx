"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProjectForm } from "@/components/project/project-form";
import { useAuth } from "@/lib/auth-context";

/**
 * Project creation page.
 * Wraps the ProjectForm component with page layout and breadcrumbs.
 */
export default function NewProjectPage() {
  const { orgRole } = useAuth();
  if (orgRole && orgRole !== "org:admin" && orgRole !== "org:project_manager") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">New Project</h1>
        <p className="text-sm text-muted-foreground">Only administrators and project managers can create projects.</p>
        <Link href="/projects" className="text-sm underline">Back to Projects</Link>
      </div>
    );
  }
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
        <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <ProjectForm />
      </div>
    </div>
  );
}
