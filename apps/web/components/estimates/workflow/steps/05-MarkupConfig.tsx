"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { overheadTypeEnum, markupBaseEnum, formatCurrency } from "@construction/shared";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutoSave } from "../useAutoSave";
import { useWorkflowState } from "../useWorkflowState";
import { toast } from "sonner";

// Markup config schema extends updateEstimateSchema fields with per-cost-type markup percentages
// These are stored as JSONB in the markupConfig column
const markupConfigSchema = z.object({
  overheadType: overheadTypeEnum,
  overheadValue: z.number().min(0),
  markupBase: markupBaseEnum,
  laborMarkupPercent: z.number().min(0).max(100),
  materialMarkupPercent: z.number().min(0).max(100),
  equipmentMarkupPercent: z.number().min(0).max(100),
  subcontractorMarkupPercent: z.number().min(0).max(100),
});

type MarkupConfigFormValues = z.infer<typeof markupConfigSchema>;

interface MarkupConfigStepProps {
  estimateId: string;
}

export function MarkupConfigStep({ estimateId }: MarkupConfigStepProps) {
  const utils = trpc.useUtils();
  const { unlockStep, goToStep } = useWorkflowState();

  // Load company defaults
  const { data: companyProfile } = trpc.company.getCurrent.useQuery();

  // Load current estimate data
  const { data: estimate } = trpc.estimates.getById.useQuery({ id: estimateId });

  // Update mutation
  const updateMutation = trpc.estimates.update.useMutation({
    onSuccess: () => {
      utils.estimates.getById.invalidate({ id: estimateId });
    },
    onError: (error) => {
      toast.error("Failed to save markup config", {
        description: error.message,
      });
    },
  });

  const form = useForm<MarkupConfigFormValues>({
    resolver: zodResolver(markupConfigSchema),
    defaultValues: {
      overheadType: "percentage",
      overheadValue: 10,
      markupBase: "direct",
      laborMarkupPercent: 15,
      materialMarkupPercent: 10,
      equipmentMarkupPercent: 12,
      subcontractorMarkupPercent: 8,
    },
  });

  // Unlock Step 6 on mount (markup config is optional)
  useEffect(() => {
    unlockStep(6);
  }, [unlockStep]);

  // Load data from company defaults or estimate
  useEffect(() => {
    if (estimate?.markupConfig) {
      form.reset(estimate.markupConfig as MarkupConfigFormValues);
    } else if (companyProfile?.defaultMarkupConfig) {
      form.reset(companyProfile.defaultMarkupConfig as MarkupConfigFormValues);
    }
  }, [estimate, companyProfile, form]);

  // Auto-save form changes
  const watchedData = form.watch();
  useAutoSave({
    data: watchedData,
    onSave: async (data) => {
      await updateMutation.mutateAsync({
        id: estimateId,
        markupConfig: data,
      });
    },
    enabled: !!estimateId,
  });

  // Calculate summary metrics
  const calculateMargin = () => {
    if (!estimate?.totalCost) return null;

    // Parse all numeric values (totalCost from DB is a string)
    const directCost = parseFloat(estimate.totalCost.toString());
    if (isNaN(directCost) || directCost <= 0) return null;

    let totalCost = directCost;

    // Add overhead
    if (watchedData.overheadType === "percentage") {
      const overheadPercent = parseFloat(watchedData.overheadValue.toString()) || 0;
      totalCost += directCost * (overheadPercent / 100);
    } else {
      const overheadFixed = parseFloat(watchedData.overheadValue.toString()) || 0;
      totalCost += overheadFixed;
    }

    // Calculate weighted markup (simplified - assumes even distribution)
    const avgMarkup =
      (parseFloat(watchedData.laborMarkupPercent.toString()) +
        parseFloat(watchedData.materialMarkupPercent.toString()) +
        parseFloat(watchedData.equipmentMarkupPercent.toString()) +
        parseFloat(watchedData.subcontractorMarkupPercent.toString())) /
      4;

    const markupBase =
      watchedData.markupBase === "direct_plus_overhead" ? totalCost : directCost;
    const markupAmount = markupBase * (avgMarkup / 100);
    const sellingPrice = totalCost + markupAmount;
    const margin = sellingPrice > 0 ? ((sellingPrice - directCost) / sellingPrice) * 100 : 0;

    return {
      directCost,
      overhead: totalCost - directCost,
      markup: markupAmount,
      sellingPrice,
      margin,
    };
  };

  const summary = calculateMargin();

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure overhead and markup percentages for this estimate. Changes are saved automatically.
      </p>

      <Form {...form}>
        <form className="space-y-6">
          {/* Overhead Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Overhead</CardTitle>
              <CardDescription>
                General & administrative costs applied to the project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="overheadType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overhead Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="percentage" id="percentage" />
                          <Label htmlFor="percentage">Percentage</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fixed" id="fixed" />
                          <Label htmlFor="fixed">Fixed Amount</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="overheadValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchedData.overheadType === "percentage"
                        ? "Overhead Percentage"
                        : "Overhead Amount"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      {watchedData.overheadType === "percentage"
                        ? "Applied as a percentage of direct costs"
                        : "Applied as a fixed dollar amount"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Markup Base */}
          <Card>
            <CardHeader>
              <CardTitle>Markup Base</CardTitle>
              <CardDescription>
                What costs should markup be calculated on?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="markupBase"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="direct" id="direct" />
                          <Label htmlFor="direct">Direct costs only</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="direct_plus_overhead" id="direct_plus_overhead" />
                          <Label htmlFor="direct_plus_overhead">
                            Direct costs + overhead
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Tiered Markup */}
          <Card>
            <CardHeader>
              <CardTitle>Markup by Cost Type</CardTitle>
              <CardDescription>
                Different markup percentages for each cost category
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="laborMarkupPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labor Markup %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="materialMarkupPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material Markup %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentMarkupPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Markup %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcontractorMarkupPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcontractor Markup %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goToStep(6); } }}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Margin Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Margin Summary</CardTitle>
            <CardDescription>
              Calculated based on current estimate totals and markup configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Direct Cost</dt>
                <dd className="font-semibold">{formatCurrency(summary.directCost)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Overhead</dt>
                <dd className="font-semibold">{formatCurrency(summary.overhead)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Markup</dt>
                <dd className="font-semibold">{formatCurrency(summary.markup)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Selling Price</dt>
                <dd className="font-semibold">{formatCurrency(summary.sellingPrice)}</dd>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <dt className="text-muted-foreground">Margin</dt>
                <dd className="text-lg font-bold text-financial-positive">
                  {summary.margin.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={() => goToStep(6)}>Next</Button>
      </div>
    </div>
  );
}
