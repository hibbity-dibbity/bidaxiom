"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SOVLineItemCard, type SOVLineItem } from "./SOVLineItemCard";
import { formatCurrency } from "../line-items/MarginCalculator";

interface SOVBuilderProps {
  estimateId: string;
  defaultGroupingMethod?: "csi" | "phase" | "payment_schedule";
}

/**
 * SOV Builder Component
 * Generates SOV preview from estimate, allows manual adjustments, and finalizes SOV.
 */
export function SOVBuilder({ estimateId, defaultGroupingMethod = "csi" }: SOVBuilderProps) {
  const [groupingMethod, setGroupingMethod] = useState<"csi" | "phase" | "payment_schedule">(
    defaultGroupingMethod
  );
  const [sovLineItems, setSovLineItems] = useState<SOVLineItem[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const utils = trpc.useUtils();

  // Load estimate
  const { data: estimate } = trpc.estimates.getById.useQuery({ id: estimateId });

  // Generate SOV mutation
  const generateSov = trpc.sov.generate.useMutation({
    onSuccess: (data) => {
      setSovLineItems(data as SOVLineItem[]);
      setIsGenerated(true);
      toast.success("SOV generated successfully");
    },
    onError: (error) => {
      toast.error("Failed to generate SOV", {
        description: error.message,
      });
    },
  });

  // Finalize SOV mutation
  const finalizeSov = trpc.sov.finalize.useMutation({
    onSuccess: (data) => {
      toast.success("SOV finalized", {
        description: `Version ${data.version} created`,
      });
      utils.estimates.getById.invalidate({ id: estimateId });
    },
    onError: (error) => {
      toast.error("Failed to finalize SOV", {
        description: error.message,
      });
    },
  });

  // Calculate totals
  const sovTotal = sovLineItems.reduce((sum, item) => sum + item.amount, 0);
  const estimateTotal = estimate?.totalCost ? Number(estimate.totalCost) : 0;
  const variance = sovTotal - estimateTotal;
  const varianceAbs = Math.abs(variance);

  // Determine if variance is within tolerance ($1.00)
  const isVarianceAcceptable = varianceAbs <= 1.0;

  // Get variance color
  const getVarianceColor = () => {
    if (isVarianceAcceptable) {
      return "text-green-600";
    } else {
      return "text-red-600";
    }
  };

  const handleGenerate = () => {
    generateSov.mutate({ estimateId, groupingMethod });
  };

  const handleUpdateLineItem = (id: string, updates: Partial<SOVLineItem>) => {
    setSovLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleDeleteLineItem = (id: string) => {
    if (confirm("Delete this SOV line item?")) {
      setSovLineItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleFinalize = () => {
    if (!isVarianceAcceptable) {
      toast.error("Cannot finalize", {
        description: "SOV total must match estimate total within $1.00",
      });
      return;
    }

    finalizeSov.mutate({
      estimateId,
      lineItems: sovLineItems.map((item, idx) => ({
        ...item,
        sortOrder: idx,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Generate Controls */}
      {!isGenerated && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Generate Schedule of Values</h3>
              <p className="text-sm text-muted-foreground">
                Select a grouping method and generate an initial SOV from your estimate line items.
              </p>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Grouping Method</label>
                <Select
                  value={groupingMethod}
                  onValueChange={(value: any) => setGroupingMethod(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csi">By CSI Division</SelectItem>
                    <SelectItem value="phase">By Construction Phase</SelectItem>
                    <SelectItem value="payment_schedule">By Payment Schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateSov.isPending}
                className="min-w-[140px]"
              >
                <FileText className="mr-2 h-4 w-4" />
                {generateSov.isPending ? "Generating..." : "Generate SOV"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOV Line Items */}
      {isGenerated && sovLineItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">SOV Line Items ({sovLineItems.length})</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsGenerated(false);
                setSovLineItems([]);
              }}
            >
              Regenerate
            </Button>
          </div>

          <div className="space-y-2">
            {sovLineItems.map((item) => (
              <SOVLineItemCard
                key={item.id}
                sovLineItem={item}
                onUpdate={handleUpdateLineItem}
                onDelete={handleDeleteLineItem}
                isEditable={true}
              />
            ))}
          </div>

          {/* Totals and Variance */}
          <Card>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimate Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(estimateTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">SOV Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(sovTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Variance</p>
                  <p className={`text-2xl font-bold ${getVarianceColor()}`}>
                    {variance >= 0 ? "+" : ""}
                    {formatCurrency(variance)}
                  </p>
                </div>
              </div>

              {!isVarianceAcceptable && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    SOV total must match estimate total within $1.00 to finalize. Adjust line item
                    amounts to correct the variance.
                  </AlertDescription>
                </Alert>
              )}

              {isVarianceAcceptable && (
                <Alert className="mt-4 border-green-600 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-600">
                    SOV total matches estimate total. Ready to finalize.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Finalize Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleFinalize}
              disabled={!isVarianceAcceptable || finalizeSov.isPending}
              size="lg"
            >
              {finalizeSov.isPending ? "Finalizing..." : "Finalize SOV"}
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {isGenerated && sovLineItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No SOV line items generated. Ensure your estimate has line items and try again.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
