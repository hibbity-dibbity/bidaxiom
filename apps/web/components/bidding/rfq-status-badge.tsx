"use client";

import { Badge } from "@/components/ui/badge";
import type { RfqStatus } from "@construction/shared";

interface RfqStatusBadgeProps {
  status: RfqStatus;
}

const statusColors: Record<RfqStatus, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200",
  issued: "bg-blue-500/10 text-blue-700 border-blue-200",
  closed: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  awarded: "bg-green-500/10 text-green-700 border-green-200",
  cancelled: "bg-red-500/10 text-red-700 border-red-200",
};

export function RfqStatusBadge({ status }: RfqStatusBadgeProps) {
  return (
    <Badge className={statusColors[status]} variant="outline">
      {status.replace("_", " ")}
    </Badge>
  );
}
