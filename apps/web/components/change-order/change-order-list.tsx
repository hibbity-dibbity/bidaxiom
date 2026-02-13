"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { ChangeOrderStatus, ChangeOrderType } from "@construction/shared";

interface ChangeOrderListProps {
  projectId: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});

const statusColors: Record<ChangeOrderStatus, string> = {
  draft: "bg-gray-500",
  pco_submitted: "bg-yellow-500",
  pending_approval: "bg-orange-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  void: "bg-slate-500",
};

const typeColors: Record<ChangeOrderType, string> = {
  owner: "bg-blue-500",
  internal: "bg-amber-500",
  subcontractor: "bg-purple-500",
};

const typeLabels: Record<ChangeOrderType, string> = {
  owner: "Owner",
  internal: "Internal",
  subcontractor: "Subcontractor",
};

export function ChangeOrderList({ projectId }: ChangeOrderListProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: changeOrders, isLoading } = trpc.changeOrder.list.useQuery({
    projectId,
    status: statusFilter === "all" ? undefined : (statusFilter as ChangeOrderStatus),
    type: typeFilter === "all" ? undefined : (typeFilter as ChangeOrderType),
  });

  const handleNavigateToDetail = (changeOrderId: string) => {
    router.push(`/projects/${projectId}/change-orders/${changeOrderId}`);
  };

  const handleNavigateToNew = () => {
    router.push(`/projects/${projectId}/change-orders/new`);
  };

  const getChangeOrderNumber = (co: any) => {
    if (co.coNumber) return co.coNumber;
    if (co.pcoNumber) return co.pcoNumber;
    return "Draft";
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

  return (
    <div className="space-y-4">
      <div className="flex gap-4 justify-between items-center">
        <div className="flex gap-4 flex-1">
          <div className="flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pco_submitted">PCO Submitted</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="void">Void</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="subcontractor">Subcontractor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleNavigateToNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Change Order
        </Button>
      </div>

      {!changeOrders || changeOrders.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground">
            {statusFilter !== "all" || typeFilter !== "all"
              ? "No change orders match the selected filters"
              : "No change orders yet. Create your first change order above."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {changeOrders.map((co) => (
            <Card
              key={co.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleNavigateToDetail(co.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColors[co.status as ChangeOrderStatus]}>
                        {co.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge className={typeColors[co.type as ChangeOrderType]}>
                        {typeLabels[co.type as ChangeOrderType]}
                      </Badge>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {getChangeOrderNumber(co)}
                      </span>
                    </div>
                    <CardTitle className="text-lg">
                      {co.title.length > 60 ? `${co.title.substring(0, 60)}...` : co.title}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {currencyFormatter.format(Number(co.totalAmount))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(co.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
