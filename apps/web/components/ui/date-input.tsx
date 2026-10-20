import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A date box that is never blank on a phone. iPhones show an empty date field as nothing at all (no "mm/dd/yyyy"),
 * so it looked like the field was missing. On touch screens an empty box shows "Select date" instead; tapping it
 * still opens the phone's own date picker. Desktop keeps the browser's normal date box.
 */
export const DateInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, value, ...props }, ref) => {
    // Only controlled boxes can tell whether they are empty.
    const empty = value !== undefined && (value == null || value === "");
    return (
      <span className={cn("relative max-sm:block", /\bw-full\b/.test(className ?? "") ? "block" : "inline-block")}>
        <input
          ref={ref}
          type="date"
          value={value}
          data-empty={empty}
          className={cn(
            "min-w-[9.5rem] max-sm:w-full max-sm:min-h-9 [-webkit-appearance:none] [appearance:none]",
            "[@media(hover:none)]:data-[empty=true]:text-transparent",
            className,
          )}
          {...props}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-y-0 left-2 hidden items-center gap-2 text-sm text-muted-foreground [@media(hover:none)]:flex">
            {props.placeholder || props["aria-label"] || "Select date"}
          </span>
        )}
      </span>
    );
  },
);
DateInput.displayName = "DateInput";
