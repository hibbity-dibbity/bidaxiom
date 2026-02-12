"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, Calendar, DollarSign, Users, FileText, Edit, UserPlus, X, CheckCircle2, Circle, Clock } from "lucide-react";
import type { ProjectStatus, ProjectRole } from "@construction/shared";
import { useState } from "react";
import { toast } from "sonner";

const statusColors: Record<ProjectStatus, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  on_hold: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-blue-500/10 text-blue-700 border-blue-200",
  archived: "bg-gray-500/10 text-gray-700 border-gray-200",
};

const phaseStatusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
};

const phaseStatusColors = {
  pending: "text-gray-400",
  in_progress: "text-blue-500",
  completed: "text-green-500",
};

export default function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>("viewer");

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.project.getById.useQuery({ id: projectId });

  const addTeamMemberMutation = trpc.project.addTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Team member added");
      setAddMemberOpen(false);
      setNewMemberUserId("");
      setNewMemberRole("viewer");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add team member");
    },
  });

  const removeTeamMemberMutation = trpc.project.removeTeamMember.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Team member removed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove team member");
    },
  });

  const { data: auditData } = trpc.audit.entityHistory.useQuery(
    {
      entityType: "Project",
      entityId: projectId,
    },
    {
      enabled: !!project,
    }
  );

  // Show only last 10 entries
  const recentAudit = auditData?.slice(0, 10) || [];

  const handleAddMember = () => {
    if (!newMemberUserId.trim()) {
      toast.error("User ID is required");
      return;
    }
    addTeamMemberMutation.mutate({
      projectId,
      userId: newMemberUserId,
      role: newMemberRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      removeTeamMemberMutation.mutate({
        projectId,
        userId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <h3 className="text-lg font-semibold">Project not found</h3>
          <p className="text-sm text-muted-foreground">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button asChild>
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
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
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge className={statusColors[project.status as ProjectStatus]} variant="outline">
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.location && (
            <p className="text-muted-foreground mt-1">{project.location}</p>
          )}
        </div>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Edit Project
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">Phase 4 feature</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {project.startDate && project.endDate
                ? `${new Date(project.startDate).toLocaleDateString()} - ${new Date(project.endDate).toLocaleDateString()}`
                : "Not set"}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.startDate && project.endDate
                ? `${Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`
                : "Set start and end dates"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{project.teamMembers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link href={`/projects/${projectId}/documents`}>View documents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Team Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>People assigned to this project</CardDescription>
            </div>
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Assign a team member to this project
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      placeholder="user_xxx or clerk_id"
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as ProjectRole)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project_manager">Project Manager</SelectItem>
                        <SelectItem value="superintendent">Superintendent</SelectItem>
                        <SelectItem value="foreman">Foreman</SelectItem>
                        <SelectItem value="estimator">Estimator</SelectItem>
                        <SelectItem value="accountant">Accountant</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember} disabled={addTeamMemberMutation.isPending}>
                    {addTeamMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {project.teamMembers && project.teamMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.teamMembers.map((member: any) => (
                  <TableRow key={member.userId}>
                    <TableCell className="font-medium">
                      {member.userProfile?.fullName || member.userId}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.assignedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members assigned yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Phases Section */}
      <Card>
        <CardHeader>
          <CardTitle>Project Phases</CardTitle>
          <CardDescription>Construction phases and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {project.phases && project.phases.length > 0 ? (
            <div className="space-y-3">
              {project.phases.map((phase: any) => {
                const StatusIcon = phaseStatusIcons[phase.status as keyof typeof phaseStatusIcons] || Circle;
                const statusColor = phaseStatusColors[phase.status as keyof typeof phaseStatusColors] || "text-gray-400";

                return (
                  <div key={phase.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                      <div>
                        <p className="font-medium">{phase.name}</p>
                        {(phase.startDate || phase.endDate) && (
                          <p className="text-xs text-muted-foreground">
                            {phase.startDate ? new Date(phase.startDate).toLocaleDateString() : "TBD"}
                            {" - "}
                            {phase.endDate ? new Date(phase.endDate).toLocaleDateString() : "TBD"}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {phase.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No phases defined
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes to this project</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAudit.length > 0 ? (
            <div className="space-y-3">
              {recentAudit.map((entry: any) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="flex-1">
                    <p className="font-medium">
                      {entry.action.replace("_", " ")} {entry.entityType.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
