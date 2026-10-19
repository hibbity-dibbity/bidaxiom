import * as React from "react";
import { createPortal } from "react-dom";

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
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {/* Page tools that live inside the table (Export CSV, columns) are placed here with <InPageHeader>, left of the page's own buttons. */}
        <div id="page-header-tools" className="flex flex-wrap items-center gap-2" />
        {actions}
      </div>
    </div>
  );
}

/** Puts its children in the page header's action area, so Export CSV and column pickers sit in the same place on every list page. */
export function InPageHeader({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => { setTarget(document.getElementById("page-header-tools")); }, []);
  return target ? createPortal(children, target) : null;
}
