"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Users, Calendar } from "lucide-react";
import type { ProjectStatus } from "@construction/shared";

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

const typeColors: Record<string, string> = {
  commercial: "bg-purple-500/10 text-purple-700 border-purple-200",
  residential: "bg-orange-500/10 text-orange-700 border-orange-200",
  infrastructure: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  industrial: "bg-indigo-500/10 text-indigo-700 border-indigo-200",
};

export default function ProjectsPage() {
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | "all">("all");

  const { data, isLoading } = trpc.project.list.useQuery({
    status: selectedStatus === "all" ? undefined : selectedStatus,
    limit: 50,
    offset: 0,
  });

  const projects = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your construction projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <Tabs
        value={selectedStatus}
        onValueChange={(value) => setSelectedStatus(value as ProjectStatus | "all")}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="on_hold">On Hold</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-2">
                      {project.name}
                    </CardTitle>
                    <Badge className={statusColors[project.status as ProjectStatus]} variant="outline">
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {project.location && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {project.location}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={typeColors[project.projectType]} variant="outline">
                      {project.projectType}
                    </Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{project.teamMemberCount || 0}</span>
                    </div>
                  </div>
                  {(project.startDate || project.endDate) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {project.startDate
                          ? new Date(project.startDate).toLocaleDateString()
                          : "Not set"}
                        {" - "}
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString()
                          : "Not set"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="rounded-full bg-muted p-3">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No projects yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first project to get started
              </p>
            </div>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
