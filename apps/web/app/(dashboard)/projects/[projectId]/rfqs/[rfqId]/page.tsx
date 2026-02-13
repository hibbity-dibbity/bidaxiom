"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RfqStatusBadge } from "@/components/bidding/rfq-status-badge";
import { InvitationManager } from "@/components/bidding/invitation-manager";
import { AmendmentTimeline } from "@/components/bidding/amendment-timeline";
import { BidCard } from "@/components/bidding/bid-card";
import { toast } from "sonner";
import { ChevronLeft, Send, Ban, CheckCircle, X, BarChart3 } from "lucide-react";
import type { RfqStatus } from "@construction/shared";

const CSI_DIVISION_MAP: Record<number, string> = {
  0: "00 - Procurement",
  1: "01 - General Requirements",
  2: "02 - Existing Conditions",
  3: "03 - Concrete",
  4: "04 - Masonry",
  5: "05 - Metals",
  6: "06 - Wood, Plastics",
  7: "07 - Thermal & Moisture",
  8: "08 - Openings",
  9: "09 - Finishes",
  10: "10 - Specialties",
  21: "21 - Fire Suppression",
  22: "22 - Plumbing",
  23: "23 - HVAC",
  26: "26 - Electrical",
  27: "27 - Communications",
  28: "28 - Security",
  31: "31 - Earthwork",
  32: "32 - Exterior Improvements",
  33: "33 - Utilities",
};

export default function RfqDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const rfqId = params.rfqId as string;
  const utils = trpc.useUtils();

  const { data: rfq, isLoading } = trpc.rfq.getById.useQuery({ id: rfqId });
  const { data: bids } = trpc.bid.listByRfq.useQuery({ rfqId });

  const issueMutation = trpc.rfq.issue.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("RFQ issued");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to issue RFQ");
    },
  });

  const closeMutation = trpc.rfq.close.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("RFQ closed");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to close RFQ");
    },
  });

  const cancelMutation = trpc.rfq.cancel.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("RFQ cancelled");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel RFQ");
    },
  });

  const deleteMutation = trpc.rfq.delete.useMutation({
    onSuccess: () => {
      toast.success("RFQ deleted");
      router.push(`/projects/${projectId}/rfqs`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete RFQ");
    },
  });

  const handleIssue = () => {
    if (confirm("Issue this RFQ? This will send it to all invited subcontractors.")) {
      issueMutation.mutate({ id: rfqId });
    }
  };

  const handleClose = () => {
    if (confirm("Close this RFQ? No more bids will be accepted.")) {
      closeMutation.mutate({ id: rfqId });
    }
  };

  const handleCancel = () => {
    if (confirm("Cancel this RFQ? This action cannot be undone.")) {
      cancelMutation.mutate({ id: rfqId });
    }
  };

  const handleDelete = () => {
    if (
      confirm(
        "Delete this RFQ? This action cannot be undone and will remove all invitations."
      )
    ) {
      deleteMutation.mutate({ id: rfqId });
    }
  };

  if (isLoading || !rfq) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const canIssue = rfq.status === "draft";
  const canClose = rfq.status === "issued";
  const canCancel = rfq.status === "draft" || rfq.status === "issued";
  const canDelete = rfq.status === "draft";
  const canCompare = (rfq.status === "issued" || rfq.status === "closed") && bids && bids.length > 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/rfqs`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to RFQs
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">
              {rfq.rfqNumber} - {rfq.title}
            </h1>
            <RfqStatusBadge status={rfq.status as RfqStatus} />
          </div>
          {rfq.description && (
            <p className="text-muted-foreground">{rfq.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canIssue && (
            <Button onClick={handleIssue} disabled={issueMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Issue RFQ
            </Button>
          )}
          {canClose && (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Close
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          {canCompare && (
            <Button asChild>
              <Link href={`/projects/${projectId}/rfqs/${rfqId}/compare`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Compare Bids
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations {rfq.invitations && `(${rfq.invitations.length})`}
          </TabsTrigger>
          <TabsTrigger value="bids">
            Bids {bids && `(${bids.length})`}
          </TabsTrigger>
          <TabsTrigger value="amendments">
            Amendments {rfq.amendments && `(${rfq.amendments.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>RFQ Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Scope of Work</h4>
                <p className="text-sm whitespace-pre-wrap">{rfq.scopeOfWork}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Trades / CSI Divisions</h4>
                <div className="flex flex-wrap gap-2">
                  {(rfq.trades as number[]).map((trade) => (
                    <Badge key={trade} variant="outline">
                      {CSI_DIVISION_MAP[trade] || `CSI ${trade}`}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Due Date</h4>
                  <p className="text-sm">
                    {new Date(rfq.dueDate).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Created</h4>
                  <p className="text-sm">
                    {new Date(rfq.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <InvitationManager
                rfqId={rfqId}
                projectId={projectId}
                rfqTrades={rfq.trades as number[]}
                invitations={rfq.invitations || []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids">
          <Card>
            <CardHeader>
              <CardTitle>Submitted Bids</CardTitle>
            </CardHeader>
            <CardContent>
              {bids && bids.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bids.map((bid) => (
                    <BidCard
                      key={bid.id}
                      bid={{
                        id: bid.id,
                        bidderCompanyName: bid.bidderCompanyName,
                        totalAmount: bid.totalAmount,
                        versionCount: bid.versionCount,
                        status: bid.status,
                        submittedAt: bid.submittedAt,
                        hasUnacknowledgedAmendments: bid.hasUnacknowledgedAmendments || false,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bids submitted yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amendments">
          <Card>
            <CardHeader>
              <CardTitle>Amendments</CardTitle>
            </CardHeader>
            <CardContent>
              <AmendmentTimeline
                rfqId={rfqId}
                rfqStatus={rfq.status}
                amendments={rfq.amendments || []}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
