"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        draft: "bg-muted text-muted-foreground",
        pending: "bg-muted text-financial-pending",
        active: "bg-muted text-financial-positive",
        approved: "bg-muted text-financial-positive",
        completed: "bg-muted text-financial-positive",
        rejected: "bg-muted text-financial-negative",
        cancelled: "bg-muted text-muted-foreground",
        warning: "bg-muted text-financial-pending",
        error: "bg-muted text-financial-negative",
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
export function StatusBadge({ className, variant, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

export { statusBadgeVariants };
