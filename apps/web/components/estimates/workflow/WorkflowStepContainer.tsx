"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BasicInfoStep } from "./steps/01-BasicInfo";
import { TemplateSelectionStep } from "./steps/02-TemplateSelection";
import { LineItemsStep } from "./steps/03-LineItems";
import { LaborRatesStep } from "./steps/04-LaborRates";
import { MarkupConfigStep } from "./steps/05-MarkupConfig";
import { SOVBuilderStep } from "./steps/06-SOVBuilder";

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
        return <LineItemsStep estimateId={estimateId} />;
      case 4:
        return <LaborRatesStep estimateId={estimateId} />;
      case 5:
        return <MarkupConfigStep estimateId={estimateId} />;
      case 6:
        return <SOVBuilderStep estimateId={estimateId} />;
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
