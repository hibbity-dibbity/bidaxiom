import * as React from "react"

import { cn } from "@/lib/utils"
import { DateInput } from "@/components/ui/date-input"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const base =
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
    if (type === "date") return <DateInput ref={ref} className={cn(base, className)} {...props} />;
    return (
      <input
        type={type}
        className={cn(
          base,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
