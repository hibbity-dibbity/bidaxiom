"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BasicInfoStep } from "./steps/01-BasicInfo";
import { TemplateSelectionStep } from "./steps/02-TemplateSelection";
import { MarkupConfigStep } from "./steps/05-MarkupConfig";

interface WorkflowStepContainerProps {
  estimateId: string;
  currentStep: number;
}

const STEP_TITLES: Record<number, string> = {
  1: "Basic Information",
  2: "Template Selection",
  3: "Line Items",
  4: "Labor Rates",
  5: "Markup Configuration",
  6: "SOV Builder",
};

export function WorkflowStepContainer({
  estimateId,
  currentStep,
}: WorkflowStepContainerProps) {
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep estimateId={estimateId} />;
      case 2:
        return <TemplateSelectionStep estimateId={estimateId} />;
      case 3:
        return (
          <div className="text-muted-foreground">
            Line Items step - Coming in next plan
          </div>
        );
      case 4:
        return (
          <div className="text-muted-foreground">
            Labor Rates step - Coming in next plan
          </div>
        );
      case 5:
        return <MarkupConfigStep estimateId={estimateId} />;
      case 6:
        return (
          <div className="text-muted-foreground">
            SOV Builder step - Coming in next plan
          </div>
        );
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{STEP_TITLES[currentStep] || "Unknown Step"}</CardTitle>
      </CardHeader>
      <CardContent>{renderStep()}</CardContent>
    </Card>
  );
}
