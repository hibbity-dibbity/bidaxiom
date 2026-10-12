import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action group. Primary action first, destructive next, utility last. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader - canonical header for list and detail pages.
 * Title is always text-2xl; description is text-sm muted.
 * See COMPONENT-ORGANIZATION.md > Page Header Action Area.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
