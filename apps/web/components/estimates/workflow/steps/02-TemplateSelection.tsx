"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkflowState } from "../useWorkflowState";
import { toast } from "sonner";
import { FileText, CheckCircle2 } from "lucide-react";

interface TemplateSelectionStepProps {
  estimateId: string;
}

export function TemplateSelectionStep({ estimateId }: TemplateSelectionStepProps) {
  const { unlockStep, goToStep } = useWorkflowState();
  const utils = trpc.useUtils();

  // Load estimate to check applied template
  const { data: estimate } = trpc.estimates.getById.useQuery({ id: estimateId });

  // Load available templates
  const { data: costCodeTemplates, isLoading: templatesLoading } =
    trpc.estimateTemplates.listCostCodeTemplates.useQuery({
      scope: "all",
    });

  const { data: laborRateTemplates, isLoading: laborLoading } =
    trpc.estimateTemplates.listLaborRateTemplates.useQuery({
      scope: "all",
    });

  // Apply cost code template mutation
  const applyTemplateMutation = trpc.estimateTemplates.applyCostCodeTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template applied successfully");
      utils.estimates.getById.invalidate({ id: estimateId });
      unlockStep(3); // Unlock Step 3 when template is applied
    },
    onError: (error) => {
      toast.error("Failed to apply template", {
        description: error.message,
      });
    },
  });

  const handleApplyTemplate = (templateId: string) => {
    applyTemplateMutation.mutate({
      templateId,
      estimateId,
    });
  };

  const handleSkipTemplates = () => {
    unlockStep(3); // Unlock Step 3 when user skips template selection
    goToStep(3);   // Automatically navigate to Step 3
    toast.success("Skipped template selection", {
      description: "You can manually add line items in the next step",
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Apply a template to quickly populate your estimate with cost codes and labor rates.
        You can customize them later.
      </p>

      {/* Cost Code Templates Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Cost Code Templates</h3>
        {templatesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !costCodeTemplates || costCodeTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No cost code templates available</p>
              <p className="text-sm text-muted-foreground">
                You can skip this step and manually add line items in the next step.
              </p>
              <Button
                onClick={handleSkipTemplates}
                variant="outline"
              >
                Skip Template Selection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {costCodeTemplates.map((template) => {
              const isApplied = estimate?.appliedTemplateId === template.id;

              return (
                <Card key={template.id} className={isApplied ? "border-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {isApplied && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {template.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant={template.scope === "company" ? "default" : "secondary"}>
                        {template.scope === "company" ? "Company" : "Personal"}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleApplyTemplate(template.id)}
                        disabled={applyTemplateMutation.isPending || isApplied}
                        variant={isApplied ? "outline" : "default"}
                      >
                        {isApplied ? "Applied" : "Apply Template"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {costCodeTemplates && costCodeTemplates.length > 0 && (
          <div className="mt-4 text-center">
            <Button
              onClick={handleSkipTemplates}
              variant="ghost"
              size="sm"
            >
              Skip and add line items manually
            </Button>
          </div>
        )}
      </div>

      {/* Labor Rate Templates Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Labor Rate Templates</h3>
        {laborLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !laborRateTemplates || laborRateTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No labor rate templates available
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {laborRateTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {template.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={template.scope === "company" ? "default" : "secondary"}>
                      {template.scope === "company" ? "Company" : "Personal"}
                    </Badge>
                    <Button size="sm" variant="outline" disabled>
                      Apply (Coming Soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {estimate?.appliedTemplateId ? (
            <span className="text-financial-positive font-medium">
              ✓ Template applied - Step 3 unlocked
            </span>
          ) : (
            <span>
              Apply a cost code template to unlock the next step, or skip to manually add line items
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
