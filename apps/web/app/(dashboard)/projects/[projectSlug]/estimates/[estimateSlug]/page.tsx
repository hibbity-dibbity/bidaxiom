"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { SendToCustomerDialog } from "@/components/shared/send-to-customer-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EstimateStatus } from "@construction/shared";
import { formatCurrency } from "@construction/shared";
import { format } from "date-fns";
import { ArrowLeft, Edit, FileText, Loader2, MoreVertical, Send } from "lucide-react";
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
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Load estimate data
  const { data: estimate, isLoading } = trpc.estimates.getBySlug.useQuery({
    slug: estimateSlug,
  });

  // Load project data for navigation and customer email pre-population
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

  // Send to Customer mutation
  const sendToCustomerMutation = trpc.estimates.sendToCustomer.useMutation({
    onSuccess: () => {
      void utils.estimates.getBySlug.invalidate({ slug: estimateSlug });
      toast.success("Proposal sent to customer");
      setSendDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to send proposal");
    },
  });

  const handleGeneratePdf = () => {
    if (!estimate) return;
    generateProposalMutation.mutate({
      projectSlug,
      estimateId: estimate.id,
    });
  };

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
          <h2 className="text-2xl font-bold mb-2">Proposal Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The proposal you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectSlug}/estimates`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Proposals
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header — Phase 46 two-row layout */}
      <div className="space-y-4">
        {/* Row 1: Back navigation */}
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/estimates`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Proposals
          </Link>
        </Button>

        {/* Row 2: Name, status badge, actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{estimate.name}</h1>
            <StatusBadge variant={estimateVariantMap[estimate.status as EstimateStatus]}>
              {estimateLabelMap[estimate.status as EstimateStatus]}
            </StatusBadge>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleGeneratePdf}
                  disabled={generateProposalMutation.isPending}
                >
                  {generateProposalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSendDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Send to Customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild>
              <Link href={`/projects/${projectSlug}/estimates/${estimateSlug}/workflow`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Proposal
              </Link>
            </Button>
          </div>
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

      <SendToCustomerDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        documentName={estimate.name}
        prePopulatedEmail={project?.customer?.email}
        prePopulatedSubject={`Proposal: ${estimate.name}`}
        isPending={sendToCustomerMutation.isPending}
        onSend={({ recipients, subject, note }) => {
          void recipients;
          void subject;
          void note;
          sendToCustomerMutation.mutate({ estimateId: estimate.id });
        }}
      />
    </div>
  );
}
