"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowState } from "./useWorkflowState";

const STEPS = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Template Selection" },
  { number: 3, label: "Line Items" },
  { number: 4, label: "Labor Rates" },
  { number: 5, label: "Markup Config" },
  { number: 6, label: "SOV Builder" },
] as const;

export function EstimateStepperBar() {
  const { currentStep, goToStep } = useWorkflowState();

  return (
    <div className="flex items-start w-full">
      {STEPS.map((step, index) => {
        const isDone = step.number < currentStep;
        const isActive = step.number === currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.number} className="flex-1 flex items-start">
            {/* Step column: circle + label */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => goToStep(step.number)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  (isDone || isActive)
                    ? "bg-primary border-primary"
                    : "bg-transparent border-muted-foreground/40"
                )}
              >
                {isDone ? (
                  <Check className="h-5 w-5 text-brand-slate" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isActive ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.number}
                  </span>
                )}
              </button>

              {/* Label: only active step renders text; others get invisible placeholder */}
              {isActive ? (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap mt-1">
                  {step.label}
                </span>
              ) : (
                <span className="h-4" />
              )}
            </div>

            {/* Connecting line (not after the last step) */}
            {!isLast && (
              <div
                className={cn(
                  "mx-2 mt-4 h-0.5 flex-1 rounded-full",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
