"use client";

import { StatusBadge as SharedStatusBadge } from "@/components/shared/status-badge";
import type { EstimateStatus } from "@construction/shared";

interface StatusBadgeProps {
  status: EstimateStatus;
}

/**
 * StatusBadge - Domain-specific wrapper for Estimate status display.
 * Maps Estimate statuses to shared StatusBadge variants.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  // Map estimate statuses to StatusBadge variants
  const variantMap: Record<EstimateStatus, "draft" | "pending" | "approved" | "active"> = {
    draft: "draft",
    submitted: "pending",
    accepted: "approved",
    under_contract: "active",
  };

  const labelMap: Record<EstimateStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    accepted: "Accepted",
    under_contract: "Under Contract",
  };

  return (
    <SharedStatusBadge variant={variantMap[status]}>
      {labelMap[status]}
    </SharedStatusBadge>
  );
}
