"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        draft: "bg-muted text-muted-foreground",
        pending: "bg-financial-pending/15 text-financial-pending",
        active: "bg-primary/10 text-primary",
        approved: "bg-financial-positive/15 text-financial-positive",
        completed: "bg-financial-positive/15 text-financial-positive",
        rejected: "bg-financial-negative/15 text-financial-negative",
        cancelled: "bg-muted text-muted-foreground",
        warning: "bg-financial-pending/15 text-financial-pending",
        error: "bg-financial-negative/15 text-financial-negative",
      },
    },
    defaultVariants: {
      variant: "draft",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
}

/**
 * StatusBadge - Shared status indicator component with controlled CVA variants.
 *
 * Design System Pattern — 4-tier semantic color model:
 * - GRAY tier  (draft, cancelled): bg-muted text-muted-foreground
 *   Use for: draft/inactive/archived/closed states
 * - AMBER tier (pending, warning): bg-muted text-financial-pending
 *   Use for: submitted/under review/pending action states
 * - GREEN tier (active, approved, completed): bg-muted text-financial-positive
 *   Use for: active/approved/paid/won/complete states
 * - RED tier   (rejected, error): bg-muted text-financial-negative
 *   Use for: rejected/void/lost states
 *
 * Usage:
 * ```tsx
 * <StatusBadge variant="approved">Approved</StatusBadge>
 * <StatusBadge variant="pending">Under Review</StatusBadge>
 * <StatusBadge variant="rejected">Rejected</StatusBadge>
 * ```
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(statusBadgeVariants({ variant }), className)} {...props}>
        {children}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { statusBadgeVariants };
