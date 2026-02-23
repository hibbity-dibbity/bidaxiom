"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWorkflowState } from "../useWorkflowState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "../../line-items/MarginCalculator";

interface LaborRatesStepProps {
  estimateId: string;
}

/**
 * Step 4: Labor Rates Application
 * Displays labor rate templates and applies them to labor line items.
 * Unlocks Step 5 after applying rates or clicking Skip.
 */
export function LaborRatesStep({ estimateId }: LaborRatesStepProps) {
  const { unlockStep, goToStep } = useWorkflowState();
  const utils = trpc.useUtils();
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  // Load labor rate templates
  const { data: templates, isLoading: templatesLoading } =
    trpc.estimateTemplates.listLaborRateTemplates.useQuery();

  // Load estimate with line items
  const { data: estimate } = trpc.estimates.getById.useQuery({ id: estimateId });

  // Apply labor rate template mutation
  const applyRates = trpc.estimateTemplates.applyLaborRateTemplate.useMutation({
    onSuccess: (data) => {
      utils.estimates.getById.invalidate({ id: estimateId });
      toast.success("Labor rates applied", {
        description: `Updated ${data.updatedCount} labor line items`,
      });
      setAppliedTemplateId(data.templateId);
      unlockStep(5);
    },
    onError: (error) => {
      toast.error("Failed to apply labor rates", {
        description: error.message,
      });
    },
  });

  // Get labor line items
  const laborLineItems =
    estimate?.lineItems?.filter((item) => item.costType === "labor") || [];

  const handleApplyTemplate = (templateId: string) => {
    applyRates.mutate({ templateId, estimateId });
  };

  const handleSkip = () => {
    unlockStep(5);
    goToStep(5);
    toast.info("Labor rates step skipped");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Apply Labor Rates</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select a labor rate template to apply standardized hourly rates to labor line items.
        </p>
      </div>

      {/* Template Selection */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templatesLoading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            Loading templates...
          </div>
        ) : templates && templates.length > 0 ? (
          templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-colors hover:border-primary ${
                appliedTemplateId === template.id ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => !applyRates.isPending && handleApplyTemplate(template.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  {appliedTemplateId === template.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Badge variant="outline" className="text-xs">
                    {template.scope === "company" ? "Company Template" : "Personal Template"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No labor rate templates available. You can skip this step.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Current Labor Line Items */}
      {laborLineItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">
            Current Labor Line Items ({laborLineItems.length})
          </h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity (hrs)</TableHead>
                  <TableHead className="text-right">Rate ($/hr)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborLineItems.map((item) => {
                  const quantity = Number(item.quantity);
                  const rate = Number(item.unitCost);
                  const total = quantity * rate;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(rate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {laborLineItems.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No labor line items found. Add labor line items in Step 3 if needed, or skip this
              step.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="ghost" onClick={handleSkip}>
          Skip Labor Rates
        </Button>
        <Button onClick={() => goToStep(5)}>Next</Button>
      </div>
    </div>
  );
}
