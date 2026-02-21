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
        active: "bg-primary/10 text-primary",
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
 * Design System Pattern:
 * - Single variant dimension with 9 semantic options
 * - Consistent color mapping across application
 * - Light/dark mode support built-in
 *
 * Usage:
 * ```tsx
 * <StatusBadge variant="approved">Approved</StatusBadge>
 * <StatusBadge variant="warning">Pending Review</StatusBadge>
 * <StatusBadge variant="error">Rejected</StatusBadge>
 * ```
 *
 * Variant Semantics:
 * - draft: Gray - Initial state, not yet submitted
 * - pending: Blue - Awaiting action or review
 * - active: Green - Currently in progress or operational
 * - approved: Green - Officially approved or accepted
 * - completed: Green - Finished successfully
 * - rejected: Red - Denied or declined
 * - cancelled: Gray - Cancelled or voided
 * - warning: Yellow - Requires attention
 * - error: Red - Error state or critical issue
 */
export function StatusBadge({ className, variant, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

export { statusBadgeVariants };
