"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}

/**
 * Number input that keeps what the user is typing ("1.", "", "0.5") while
 * only committing valid numbers to the parent.
 */
export function NumField({ value, onChange, min, max, step, disabled, className, ...rest }: NumFieldProps) {
  const [text, setText] = React.useState(String(value));
  const lastCommitted = React.useRef(value);

  // Re-sync when the parent changes the value from elsewhere (e.g. "Apply to all")
  React.useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setText(String(value));
    }
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      className={cn(className)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) {
          lastCommitted.current = n;
          onChange(n);
        } else if (e.target.value === "") {
          lastCommitted.current = 0;
          onChange(0);
        }
      }}
      onBlur={() => setText(String(lastCommitted.current))}
    />
  );
}
