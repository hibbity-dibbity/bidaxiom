"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { RfqStatus } from "@construction/shared";

interface RfqStatusBadgeProps {
  status: RfqStatus;
}

/**
 * RfqStatusBadge - Domain-specific wrapper for RFQ status display.
 * Maps RFQ statuses to shared StatusBadge variants.
 */
export function RfqStatusBadge({ status }: RfqStatusBadgeProps) {
  // Map RFQ statuses to StatusBadge variants
  const variantMap: Record<RfqStatus, "draft" | "active" | "completed" | "cancelled" | "warning"> = {
    draft: "draft",
    issued: "active",
    closed: "completed",
    awarded: "completed",
    cancelled: "cancelled",
  };

  const variant = variantMap[status];
  const label = status.replace("_", " ");

  return <StatusBadge variant={variant}>{label}</StatusBadge>;
}
