"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { companyConfigSchema } from "@construction/shared";
import type { CompanyConfig, JobNumberSettings } from "@construction/shared";
import { previewJobNumber, validateJobNumberTemplate } from "@construction/shared";
import { trpc } from "@/lib/trpc";
import { useAbilities } from "@/lib/abilities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { TradesCombobox } from "@/components/company/trades-combobox";
import { CustomTradesList } from "@/components/company/custom-trades-list";
import { LogoUpload } from "@/components/branding/logo-upload";
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
      jobNumberSettings: {
        enabled: false,
        template: "{YYYY}-{NNN}",
        nextSequenceNumber: 1,
        lastGeneratedFormat: null,
      },
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      form.reset({
        companyType: data.companyType as "gc_only" | "sub_only" | "both",
        tradesConfig: data.tradesConfig,
        jobNumberSettings: data.jobNumberSettings ?? {
          enabled: false,
          template: "{YYYY}-{NNN}",
          nextSequenceNumber: 1,
          lastGeneratedFormat: null,
        },
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

        {/* Job Numbering Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Job Numbering</h2>
              <p className="text-sm text-muted-foreground">
                Configure automatic job number generation for new projects
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="job-numbering-enabled">Enable automatic job numbering</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically assign job numbers to new projects
                </p>
              </div>
              <Switch
                id="job-numbering-enabled"
                checked={form.watch("jobNumberSettings.enabled")}
                onCheckedChange={(checked) =>
                  form.setValue("jobNumberSettings.enabled", checked)
                }
                disabled={!canManage}
              />
            </div>

            {form.watch("jobNumberSettings.enabled") ? (
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="job-number-template">Job Number Template</Label>
                  <Input
                    id="job-number-template"
                    value={form.watch("jobNumberSettings.template")}
                    onChange={(e) =>
                      form.setValue("jobNumberSettings.template", e.target.value)
                    }
                    onBlur={(e) => {
                      const template = e.target.value;
                      if (!validateJobNumberTemplate(template)) {
                        toast.error("Template must contain at least one sequence pattern (e.g., {NNN})");
                      }
                    }}
                    disabled={!canManage}
                    placeholder="{YYYY}-{NNN}"
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Available tokens: <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{YYYY}"}</code> (year), <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{YY}"}</code> (2-digit year), <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{MM}"}</code> (month), <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{DD}"}</code> (day), <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{NNN...}"}</code> (sequence number)
                  </p>
                </div>

                <div>
                  <Label htmlFor="next-sequence-number">Next Sequence Number</Label>
                  <Input
                    id="next-sequence-number"
                    type="number"
                    min={1}
                    value={form.watch("jobNumberSettings.nextSequenceNumber")}
                    onChange={(e) =>
                      form.setValue("jobNumberSettings.nextSequenceNumber", parseInt(e.target.value, 10) || 1)
                    }
                    disabled={!canManage}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    The starting sequence number for new job numbers
                  </p>
                </div>

                <div>
                  <Label>Preview</Label>
                  <div className="mt-2 rounded-md bg-muted p-3">
                    <p className="text-sm text-muted-foreground mb-1">
                      Next job number will be:
                    </p>
                    <code className="text-lg font-mono font-semibold">
                      {previewJobNumber(
                        form.watch("jobNumberSettings.template"),
                        form.watch("jobNumberSettings.nextSequenceNumber")
                      )}
                    </code>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enable to automatically assign job numbers to new projects
              </p>
            )}
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

      {/* Company Branding Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Branding</h2>
          <p className="text-muted-foreground">
            Customize your company's visual identity
          </p>
        </div>
        <LogoUpload />
      </div>
    </div>
  );
}
