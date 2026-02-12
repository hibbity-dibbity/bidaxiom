"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { companyConfigSchema } from "@construction/shared";
import type { CompanyConfig } from "@construction/shared";
import { trpc } from "@/lib/trpc";
import { useAbilities } from "@/lib/abilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { TradesCombobox } from "@/components/company/trades-combobox";
import { CustomTradesList } from "@/components/company/custom-trades-list";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

/**
 * Company configuration page.
 * Allows admin users to configure company type and trade specialties.
 */
export default function CompanySettingsPage() {
  const abilities = useAbilities();
  const canManage = abilities.can("manage", "CompanySettings");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.company.getCurrent.useQuery();
  const updateMutation = trpc.company.update.useMutation({
    onSuccess: () => {
      utils.company.getCurrent.invalidate();
      toast.success("Company configuration saved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save configuration");
    },
  });

  const form = useForm<CompanyConfig>({
    resolver: zodResolver(companyConfigSchema),
    defaultValues: {
      companyType: "gc_only",
      tradesConfig: {
        csiDivisions: [],
        customTrades: [],
      },
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      form.reset({
        companyType: data.companyType as "gc_only" | "sub_only" | "both",
        tradesConfig: data.tradesConfig,
      });
    }
  }, [data, form]);

  const onSubmit = (values: CompanyConfig) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground">
            Configure company type and trade specialties
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Profile</h1>
        <p className="text-muted-foreground">
          Configure company type and trade specialties
        </p>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              Read-only access
            </p>
            <p className="text-sm text-amber-700">
              Only company administrators can modify these settings
            </p>
          </div>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Type Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Company Type</h2>
              <p className="text-sm text-muted-foreground">
                Select how your company operates
              </p>
            </div>

            <RadioGroup
              value={form.watch("companyType")}
              onValueChange={(value) =>
                form.setValue("companyType", value as any)
              }
              disabled={!canManage}
            >
              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="gc_only" id="gc_only" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="gc_only" className="font-medium cursor-pointer">
                    General Contractor
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Your company acts as the general contractor on projects
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="sub_only" id="sub_only" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="sub_only" className="font-medium cursor-pointer">
                    Subcontractor
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Your company provides specialty trade services
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                <RadioGroupItem value="both" id="both" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="both" className="font-medium cursor-pointer">
                    Both (Hybrid)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Your company acts as both GC and subcontractor
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </Card>

        {/* Trade Configuration Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Trade Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Select CSI divisions your company specializes in
              </p>
            </div>

            <div>
              <Label>CSI MasterFormat Divisions</Label>
              <div className="mt-2">
                <TradesCombobox
                  value={form.watch("tradesConfig.csiDivisions")}
                  onChange={(value) =>
                    form.setValue("tradesConfig.csiDivisions", value)
                  }
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Custom Trades Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Custom Specialty Trades</h2>
              <p className="text-sm text-muted-foreground">
                Add trades not covered by standard CSI divisions
              </p>
            </div>

            <CustomTradesList
              value={form.watch("tradesConfig.customTrades")}
              onChange={(value) =>
                form.setValue("tradesConfig.customTrades", value)
              }
            />
          </div>
        </Card>

        {/* Submit Button */}
        {canManage && (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
