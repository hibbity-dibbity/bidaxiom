"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createSubcontractorSchema, updateSubcontractorSchema } from "@construction/shared";
import type { CreateSubcontractor, UpdateSubcontractor } from "@construction/shared";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";
import { useRouter } from "next/navigation";

interface SubcontractorFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<UpdateSubcontractor>;
  onSuccess?: () => void;
}

export function SubcontractorForm({ mode, defaultValues, onSuccess }: SubcontractorFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<CreateSubcontractor>({
    resolver: zodResolver(createSubcontractorSchema),
    defaultValues: {
      companyName: defaultValues?.companyName || "",
      contactName: defaultValues?.contactName || undefined,
      contactEmail: defaultValues?.contactEmail || undefined,
      contactPhone: defaultValues?.contactPhone || undefined,
      address: defaultValues?.address || undefined,
      trades: defaultValues?.trades || [],
      notes: defaultValues?.notes || undefined,
    },
  });

  const createMutation = trpc.subcontractor.create.useMutation({
    onSuccess: () => {
      utils.subcontractor.list.invalidate();
      toast.success("Subcontractor created successfully");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/subcontractors");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create subcontractor");
    },
  });

  const updateMutation = trpc.subcontractor.update.useMutation({
    onSuccess: () => {
      utils.subcontractor.list.invalidate();
      utils.subcontractor.getById.invalidate();
      toast.success("Subcontractor updated successfully");
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update subcontractor");
    },
  });

  const onSubmit = (data: CreateSubcontractor) => {
    if (mode === "create") {
      createMutation.mutate(data);
    } else if (defaultValues?.id) {
      updateMutation.mutate({
        id: defaultValues.id,
        ...data,
      });
    }
  };

  const selectedTrades = form.watch("trades");

  const handleTradeToggle = (divisionNumber: number) => {
    const current = selectedTrades || [];
    const updated = current.includes(divisionNumber)
      ? current.filter((t) => t !== divisionNumber)
      : [...current, divisionNumber];
    form.setValue("trades", updated);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            {...form.register("companyName")}
            placeholder="ABC Plumbing Inc."
          />
          {form.formState.errors.companyName && (
            <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            {...form.register("contactName")}
            placeholder="John Doe"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              {...form.register("contactEmail")}
              placeholder="john@abcplumbing.com"
            />
            {form.formState.errors.contactEmail && (
              <p className="text-sm text-destructive">{form.formState.errors.contactEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              {...form.register("contactPhone")}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            {...form.register("address")}
            placeholder="123 Main St, City, State, ZIP"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Trades (CSI Divisions) *</Label>
          <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
            {CSI_DIVISIONS.map((division) => (
              <div key={division.number} className="flex items-center space-x-2">
                <Checkbox
                  id={`trade-${division.number}`}
                  checked={selectedTrades?.includes(division.number) || false}
                  onCheckedChange={() => handleTradeToggle(division.number)}
                />
                <label
                  htmlFor={`trade-${division.number}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {division.number} - {division.name}
                </label>
              </div>
            ))}
          </div>
          {form.formState.errors.trades && (
            <p className="text-sm text-destructive">{form.formState.errors.trades.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            {...form.register("notes")}
            placeholder="Internal notes about this subcontractor..."
            rows={4}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Saving..."
            : mode === "create"
            ? "Create Subcontractor"
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
