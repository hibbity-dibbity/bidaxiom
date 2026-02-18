"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { CSI_DIVISIONS } from "@construction/shared";
import type { CommitmentType, CommitmentStatus } from "@construction/shared";

interface CommitmentListProps {
  projectId: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const statusColors: Record<CommitmentStatus, string> = {
  draft: "bg-gray-500",
  pending: "bg-yellow-500",
  approved: "bg-blue-500",
  executed: "bg-green-500",
  closed: "bg-slate-500",
};

const typeLabels: Record<CommitmentType, string> = {
  subcontract: "Subcontract",
  purchase_order: "Purchase Order",
};

export function CommitmentList({ projectId }: CommitmentListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedCommitmentId, setExpandedCommitmentId] = useState<string | null>(null);

  const { data: commitments, isLoading } = trpc.commitment.list.useQuery({
    projectId,
  });

  const { data: lineItems } = trpc.commitment.getLineItems.useQuery(
    { commitmentId: expandedCommitmentId! },
    { enabled: !!expandedCommitmentId }
  );

  const toggleExpand = (commitmentId: string) => {
    setExpandedCommitmentId(
      expandedCommitmentId === commitmentId ? null : commitmentId
    );
  };

  const getDivisionName = (costCodeId: number) => {
    const division = CSI_DIVISIONS.find((d) => d.division === costCodeId);
    return division ? `Div ${costCodeId}: ${division.name}` : `Cost Code ${costCodeId}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const filteredCommitments = commitments?.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex-1">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="subcontract">Subcontract</SelectItem>
              <SelectItem value="purchase_order">Purchase Order</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!filteredCommitments || filteredCommitments.length === 0 ? (
        typeFilter !== "all" || statusFilter !== "all" ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <p className="text-muted-foreground">No commitments match the selected filters</p>
          </div>
        ) : (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No commitments yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Subcontracts and purchase orders will appear here</p>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filteredCommitments.map((commitment) => {
            const isExpanded = expandedCommitmentId === commitment.id;
            return (
              <Card key={commitment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={statusColors[commitment.status as CommitmentStatus]}>
                          {commitment.status}
                        </Badge>
                        <Badge variant="outline">
                          {typeLabels[commitment.type as CommitmentType]}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">
                        {commitment.vendorName}
                      </CardTitle>
                      {commitment.contractNumber && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Contract #{commitment.contractNumber}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {currencyFormatter.format(Number(commitment.totalAmount))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(commitment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {commitment.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {commitment.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(commitment.id)}
                    className="w-full"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Hide Line Items
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show Line Items
                      </>
                    )}
                  </Button>

                  {isExpanded && lineItems && (
                    <div className="mt-4 space-y-2">
                      {lineItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-start p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">
                              {getDivisionName(item.costCodeId)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {currencyFormatter.format(Number(item.amount))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
