"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";
import type { BidStatus } from "@construction/shared";

interface BidHistoryItem {
  bidId: string;
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  latestAmount: number | null;
  status: string;
  submittedAt: string;
}

interface BidHistoryTableProps {
  bidHistory: BidHistoryItem[];
}

const bidStatusToVariant = (status: string) => {
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

const getStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    shortlisted: "Shortlisted",
    awarded: "Awarded",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  };
  return statusLabels[status] || status;
};

export function BidHistoryTable({ bidHistory }: BidHistoryTableProps) {
  if (bidHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No bid history for this subcontractor
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>RFQ #</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bidHistory.map((bid) => (
          <TableRow key={bid.bidId}>
            <TableCell>
              <div className="font-medium">{bid.rfqNumber}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {bid.rfqTitle}
              </div>
            </TableCell>
            <TableCell className="text-right font-medium">
              {bid.latestAmount !== null
                ? `$${bid.latestAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                : "-"}
            </TableCell>
            <TableCell>
              <StatusBadge variant={bidStatusToVariant(bid.status)}>
                {getStatusLabel(bid.status)}
              </StatusBadge>
            </TableCell>
            <TableCell>
              {new Date(bid.submittedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
