"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, ArrowRight, CheckCircle, XCircle, List } from "lucide-react";
import type { ChangeHistoryType } from "@construction/shared";

interface ChangeOrderHistoryProps {
  changeOrderId: string;
}

const historyTypeIcons: Record<ChangeHistoryType, React.ReactNode> = {
  field_update: <Pencil className="h-4 w-4" />,
  status_change: <ArrowRight className="h-4 w-4" />,
  approval: <CheckCircle className="h-4 w-4" />,
  line_item_change: <List className="h-4 w-4" />,
};

export function ChangeOrderHistory({ changeOrderId }: ChangeOrderHistoryProps) {
  const { data: history, isLoading } = trpc.changeOrder.getHistory.useQuery({
    changeOrderId,
  });

  if (isLoading) {
    return null;
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No history yet</p>
        </CardContent>
      </Card>
    );
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  };

  const getHistoryDescription = (entry: any) => {
    switch (entry.changeType) {
      case "field_update":
        return (
          <>
            Changed <span className="font-medium">{entry.fieldName}</span> from{" "}
            <span className="text-muted-foreground">{entry.oldValue || "(empty)"}</span>{" "}
            to <span className="text-muted-foreground">{entry.newValue}</span>
          </>
        );
      case "status_change":
        return (
          <>
            Status changed from{" "}
            <span className="font-medium">
              {entry.oldValue?.replace(/_/g, " ") || "none"}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {entry.newValue?.replace(/_/g, " ")}
            </span>
          </>
        );
      case "approval":
        const isApproved = entry.newValue === "approved";
        return (
          <>
            {isApproved ? "Approved" : "Rejected"} at step {entry.fieldName}
            {entry.comments && (
              <p className="text-sm mt-1 text-muted-foreground">{entry.comments}</p>
            )}
          </>
        );
      case "line_item_change":
        return (
          <>
            Updated line items
            {entry.revisionNumber && (
              <Badge variant="outline" className="ml-2">
                Rev. {entry.revisionNumber}
              </Badge>
            )}
          </>
        );
      default:
        return "Unknown change";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry) => (
            <div key={entry.id} className="flex gap-4">
              <div className="mt-1 flex-shrink-0">
                {historyTypeIcons[entry.changeType as ChangeHistoryType]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{entry.changedBy}</span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={new Date(entry.changedAt).toLocaleString()}
                  >
                    {getTimeAgo(entry.changedAt)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {getHistoryDescription(entry)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
