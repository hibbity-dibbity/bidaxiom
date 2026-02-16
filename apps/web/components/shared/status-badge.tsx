"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
