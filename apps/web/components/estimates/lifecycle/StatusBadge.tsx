"use client";

import { Badge } from "@/components/ui/badge";
import type { EstimateStatus } from "@construction/shared";

interface StatusBadgeProps {
  status: EstimateStatus;
}

const STATUS_CONFIG: Record<EstimateStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "default" },
  accepted: { label: "Accepted", variant: "success" },
  under_contract: { label: "Under Contract", variant: "success" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
