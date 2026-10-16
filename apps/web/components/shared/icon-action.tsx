"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The one way a list row shows an action: a small icon button with hover text that says what it does.
 * Every list of proposals, change orders and invoices uses this, so they always look and behave the same.
 * Pass `href` for a link, `onClick` for a button. A disabled one still explains itself (use `label` for the reason).
 */
export function IconAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  tone = "default",
  busy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  busy?: boolean;
}) {
  const cls = cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors",
    "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    tone === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
    tone === "danger" && "hover:text-destructive",
    (disabled || busy) && "pointer-events-none opacity-50",
    busy && "animate-pulse"
  );
  const control =
    href && !disabled ? (
      <Link href={href} aria-label={label} className={cls} onClick={(e) => e.stopPropagation()}>
        <Icon className="h-4 w-4" />
      </Link>
    ) : (
      <button type="button" aria-label={label} disabled={disabled || busy} className={cls} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <Icon className="h-4 w-4" />
      </button>
    );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        {/* The span lets a disabled button still show its hover text. */}
        <TooltipTrigger asChild><span className="inline-flex">{control}</span></TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
