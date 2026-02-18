"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BidStatus } from "@construction/shared";
import { AlertCircle } from "lucide-react";

interface BidCardProps {
  bid: {
    id: string;
    bidderCompanyName: string;
    totalAmount: number;
    versionCount: number;
    status: BidStatus;
    submittedAt: string;
    hasUnacknowledgedAmendments: boolean;
  };
  onClick?: () => void;
}

const bidStatusColors: Record<BidStatus, string> = {
  submitted: "bg-blue-500/10 text-blue-700 border-blue-200",
  under_review: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  shortlisted: "bg-purple-500/10 text-purple-700 border-purple-200",
  awarded: "bg-green-500/10 text-green-700 border-green-200",
  rejected: "bg-red-500/10 text-red-700 border-red-200",
  withdrawn: "bg-gray-500/10 text-gray-700 border-gray-200",
};

export function BidCard({ bid, onClick }: BidCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
        onClick ? "hover:border-primary" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-semibold">{bid.bidderCompanyName}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(bid.submittedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bid.hasUnacknowledgedAmendments && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Unack. amendments</span>
              </div>
            )}
            <Badge
              variant="outline"
              className={bidStatusColors[bid.status]}
            >
              {bid.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            }).format(bid.totalAmount)}
          </span>
          <span className="text-sm text-muted-foreground">
            v{bid.versionCount}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
