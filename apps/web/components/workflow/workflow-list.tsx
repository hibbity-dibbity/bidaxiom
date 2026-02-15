"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText } from "lucide-react";
import { CreateWorkflowDialog } from "./create-workflow-dialog";
import { useRouter } from "next/navigation";

interface WorkflowListProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const workflowTypeLabels = {
  rfi: "RFI",
  submittal: "Submittal",
  transmittal: "Transmittal",
};

const statusColors = {
  draft: "secondary",
  submitted: "default",
  under_review: "warning",
  approved: "success",
  rejected: "destructive",
  closed: "secondary",
  cancelled: "secondary",
} as const;

const statusLabels = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
  cancelled: "Cancelled",
};

const priorityColors = {
  low: "secondary",
  medium: "default",
  high: "warning",
  urgent: "destructive",
} as const;

export function WorkflowList({ projectId, projectSlug }: WorkflowListProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const router = useRouter();

  const { data: workflows, isLoading } = trpc.workflow.list.useQuery({
    projectId,
    workflowType: typeFilter as any,
    status: statusFilter as any,
  });

  const handleRowClick = (workflowId: string) => {
    router.push(`/projects/${projectSlug}/workflows/${workflowId}`);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Workflows</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage RFIs, Submittals, and Transmittals
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="w-48">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear__" onClick={() => setTypeFilter(undefined)}>
                  All types
                </SelectItem>
                <SelectItem value="rfi">RFI</SelectItem>
                <SelectItem value="submittal">Submittal</SelectItem>
                <SelectItem value="transmittal">Transmittal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear__" onClick={() => setStatusFilter(undefined)}>
                  All statuses
                </SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Workflow Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : workflows && workflows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow: any) => (
                <TableRow
                  key={workflow.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(workflow.id)}
                >
                  <TableCell className="font-medium">
                    {workflow.workflowNumber}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {workflowTypeLabels[workflow.workflowType as keyof typeof workflowTypeLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {workflow.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[workflow.status as keyof typeof statusColors] as any}>
                      {statusLabels[workflow.status as keyof typeof statusLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityColors[workflow.priority as keyof typeof priorityColors] as any}>
                      {workflow.priority.charAt(0).toUpperCase() + workflow.priority.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {workflow.dueDate
                      ? new Date(workflow.dueDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No workflows found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {typeFilter || statusFilter
                ? "Try adjusting your filters"
                : "Create your first workflow to get started"}
            </p>
            {!typeFilter && !statusFilter && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            )}
          </div>
        )}
      </Card>

      <CreateWorkflowDialog
        projectId={projectId}
        projectSlug={projectSlug}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
