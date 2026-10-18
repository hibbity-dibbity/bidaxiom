import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned action group. Secondary (outline) buttons first, the one primary button last. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader - canonical header for list and detail pages. Same look as the Dashboard and Settings headings:
 * title text-2xl semibold, description text-sm muted, actions on the right.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
