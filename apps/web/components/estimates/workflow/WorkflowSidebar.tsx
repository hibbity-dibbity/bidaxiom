"use client";

import { Lock } from "lucide-react";
import { useWorkflowState } from "./useWorkflowState";
import { cn } from "@/lib/utils";

const WORKFLOW_STEPS = [
  {
    group: "Setup",
    steps: [
      { number: 1, title: "Basic Info" },
      { number: 2, title: "Template Selection" },
    ],
  },
  {
    group: "Cost Entry",
    steps: [
      { number: 3, title: "Line Items" },
      { number: 4, title: "Labor Rates" },
    ],
  },
  {
    group: "Finalization",
    steps: [
      { number: 5, title: "Markup Config" },
      { number: 6, title: "SOV Builder" },
    ],
  },
];

export function WorkflowSidebar() {
  const { currentStep, maxUnlockedStep, goToStep } = useWorkflowState();

  return (
    <div className="w-64 bg-card border-r min-h-screen p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Estimate Workflow</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Complete each step to build your estimate
        </p>
      </div>

      <nav className="space-y-6">
        {WORKFLOW_STEPS.map((group) => (
          <div key={group.group} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {group.group}
            </h3>
            <div className="space-y-1">
              {group.steps.map((step) => {
                const isActive = currentStep === step.number;
                const isUnlocked = step.number <= maxUnlockedStep;
                const isCompleted = step.number < currentStep;

                return (
                  <button
                    key={step.number}
                    onClick={() => goToStep(step.number)}
                    disabled={!isUnlocked}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                      isActive && "bg-primary text-primary-foreground font-medium",
                      !isActive && isUnlocked && "hover:bg-accent hover:text-accent-foreground",
                      !isUnlocked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full border-2 flex-shrink-0",
                        isActive && "border-primary-foreground bg-primary-foreground text-primary",
                        !isActive && isCompleted && "border-primary bg-primary text-primary-foreground",
                        !isActive && !isCompleted && isUnlocked && "border-muted-foreground",
                        !isUnlocked && "border-muted"
                      )}
                    >
                      {!isUnlocked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <span className="text-xs font-semibold">{step.number}</span>
                      )}
                    </div>
                    <span className="flex-1">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
