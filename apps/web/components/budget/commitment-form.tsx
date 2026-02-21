"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createCommitmentSchema, CSI_DIVISIONS } from "@construction/shared";
import type { z } from "zod";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CommitmentFormProps {
  projectId: string;
  onSuccess?: () => void;
}

type CommitmentFormData = z.infer<typeof createCommitmentSchema>;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function CommitmentForm({ projectId, onSuccess }: CommitmentFormProps) {
  const utils = trpc.useUtils();
  const { data: budgetLineItems } = trpc.budget.listLineItems.useQuery({
    projectId,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CommitmentFormData>({
    resolver: zodResolver(createCommitmentSchema),
    defaultValues: {
      projectId,
      type: "subcontract",
      vendorName: "",
      contractNumber: "",
      description: "",
      lineItems: [
        {
          budgetLineItemId: undefined,
          costCodeId: 0,
          description: "",
          amount: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const createMutation = trpc.commitment.create.useMutation({
    onSuccess: (data) => {
      utils.commitment.list.invalidate({ projectId });
      utils.budget.getProjectSummary.invalidate({ projectId });
      toast.success("Commitment created successfully");

      // Show warnings if any
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((warning) => {
          const message = typeof warning === "string"
            ? warning
            : `Budget line item ${warning.budgetLineItemId} exceeds budget by ${currencyFormatter.format(warning.exceedsBy)}`;
          toast.warning(message, { duration: 5000 });
        });
      }

      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create commitment");
    },
  });

  const onSubmit = (data: CommitmentFormData) => {
    createMutation.mutate(data);
  };

  const lineItems = watch("lineItems");
  const totalAmount = lineItems.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  const getDivisionName = (costCodeId: number) => {
    const division = CSI_DIVISIONS.find((d) => d.division === costCodeId);
    return division
      ? `Div ${costCodeId}: ${division.name}`
      : `Cost Code ${costCodeId}`;
  };

  const handleBudgetLineItemChange = (index: number, budgetLineItemId: string) => {
    const budgetItem = budgetLineItems?.find((b) => b.id === budgetLineItemId);
    if (budgetItem) {
      setValue(`lineItems.${index}.budgetLineItemId`, budgetLineItemId);
      setValue(`lineItems.${index}.costCodeId`, budgetItem.costCodeId);
      setValue(`lineItems.${index}.description`, budgetItem.description);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Commitment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              defaultValue="subcontract"
              onValueChange={(value) =>
                setValue("type", value as "subcontract" | "purchase_order")
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="subcontract" id="subcontract" />
                <Label htmlFor="subcontract" className="font-normal">
                  Subcontract
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="purchase_order" id="purchase_order" />
                <Label htmlFor="purchase_order" className="font-normal">
                  Purchase Order
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendorName">Vendor Name *</Label>
            <Input
              id="vendorName"
              {...register("vendorName")}
              placeholder="Enter vendor name"
            />
            {errors.vendorName && (
              <p className="text-sm text-destructive">{errors.vendorName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contractNumber">Contract Number</Label>
            <Input
              id="contractNumber"
              {...register("contractNumber")}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Optional description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Line Items</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  budgetLineItemId: undefined,
                  costCodeId: 0,
                  description: "",
                  amount: 0,
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex justify-between items-start">
                <h4 className="font-medium">Line Item {index + 1}</h4>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Budget Line Item (Optional)</Label>
                <Select
                  onValueChange={(value) =>
                    handleBudgetLineItemChange(index, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget line item" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetLineItems?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getDivisionName(item.costCodeId)} -{" "}
                        {item.description} - {currencyFormatter.format(Number(item.budgetedAmount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cost Code *</Label>
                <Select
                  value={watch(`lineItems.${index}.costCodeId`)?.toString() || ""}
                  onValueChange={(value) =>
                    setValue(`lineItems.${index}.costCodeId`, parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    {CSI_DIVISIONS.map((division) => (
                      <SelectItem
                        key={division.division}
                        value={division.division.toString()}
                      >
                        Div {division.division}: {division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.lineItems?.[index]?.costCodeId && (
                  <p className="text-sm text-destructive">
                    {errors.lineItems[index]?.costCodeId?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  {...register(`lineItems.${index}.description`)}
                  placeholder="Enter description"
                />
                {errors.lineItems?.[index]?.description && (
                  <p className="text-sm text-destructive">
                    {errors.lineItems[index]?.description?.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Amount *</Label>
                <Controller
                  name={`lineItems.${index}.amount`}
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      value={Number(field.value) || 0}
                      onChange={(n) => field.onChange(n)}
                      onBlur={field.onBlur}
                      placeholder="0.00"
                    />
                  )}
                />
                {errors.lineItems?.[index]?.amount && (
                  <p className="text-sm text-destructive">
                    {errors.lineItems[index]?.amount?.message}
                  </p>
                )}
              </div>
            </div>
          ))}

          {errors.lineItems && typeof errors.lineItems === "object" && !Array.isArray(errors.lineItems) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.lineItems.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total Amount:</span>
            <span>{currencyFormatter.format(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => onSuccess?.()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Commitment"}
        </Button>
      </div>
    </form>
  );
}
