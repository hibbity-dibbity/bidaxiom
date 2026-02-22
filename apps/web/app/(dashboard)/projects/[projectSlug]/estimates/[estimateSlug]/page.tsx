"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import type { EstimateStatus } from "@construction/shared";
import { NextStepsPanel } from "@/components/estimates/lifecycle/NextStepsPanel";
import { formatCurrency } from "@construction/shared";
import { format } from "date-fns";
import { ArrowLeft, Edit, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const estimateVariantMap: Record<EstimateStatus, "draft" | "pending" | "approved" | "active"> = {
  draft: "draft",
  submitted: "pending",
  accepted: "approved",
  under_contract: "active",
};

const estimateLabelMap: Record<EstimateStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  under_contract: "Under Contract",
};

export default function EstimateDetailPage({
  params,
}: {
  params: { projectSlug: string; estimateSlug: string };
}) {
  const { projectSlug, estimateSlug } = params;
  const utils = trpc.useUtils();

  // Load estimate data
  const { data: estimate, isLoading } = trpc.estimates.getBySlug.useQuery({
    slug: estimateSlug,
  });

  // Load project data for navigation
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });

  // Generate Proposal PDF mutation
  const generateProposalMutation = trpc.pdf.generateProposal.useMutation({
    onSuccess: () => {
      toast.success("Proposal PDF generated and saved to document library");
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to generate Proposal PDF");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-2xl font-bold mb-2">Estimate Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The estimate you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectSlug}/estimates`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Estimates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${projectSlug}/estimates`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Estimate Details</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={generateProposalMutation.isPending}
            onClick={() => {
              generateProposalMutation.mutate({
                projectSlug,
                estimateId: estimate.id,
              });
            }}
          >
            {generateProposalMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Generate Proposal PDF
          </Button>
          <Button asChild>
            <Link href={`/projects/${projectSlug}/estimates/${estimateSlug}/workflow`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Estimate
            </Link>
          </Button>
        </div>
      </div>

      {/* Estimate Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-2xl">{estimate.name}</CardTitle>
              <StatusBadge variant={estimateVariantMap[estimate.status as EstimateStatus]}>
                {estimateLabelMap[estimate.status as EstimateStatus]}
              </StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {estimate.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Description</p>
              <p className="text-sm mt-1">{estimate.description}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(parseFloat(estimate.totalCost || "0"))}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created Date</p>
              <p className="text-lg mt-1">
                {format(new Date(estimate.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <p className="text-lg mt-1">
                {format(new Date(estimate.updatedAt), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps Panel */}
      <NextStepsPanel
        estimateId={estimate.id}
        status={estimate.status}
        projectId={estimate.projectId}
        onActionComplete={() => {
          // Refresh estimate data
          void utils.estimates.getBySlug.invalidate({ slug: estimateSlug });
        }}
      />
    </div>
  );
}
