"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
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

const bidStatusToVariant = (status: BidStatus) => {
  switch (status) {
    case "submitted": return "pending" as const;
    case "under_review": return "warning" as const;
    case "shortlisted": return "pending" as const;
    case "awarded": return "approved" as const;
    case "rejected": return "rejected" as const;
    case "withdrawn": return "cancelled" as const;
    default: return "draft" as const;
  }
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
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Unack. amendments</span>
              </div>
            )}
            <StatusBadge variant={bidStatusToVariant(bid.status)}>
              {bid.status.replace("_", " ")}
            </StatusBadge>
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
