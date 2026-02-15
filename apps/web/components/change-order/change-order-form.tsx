"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
import { createChangeOrderSchema, CSI_DIVISIONS } from "@construction/shared";
import type { z } from "zod";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ChangeOrderFormProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

type ChangeOrderFormData = z.infer<typeof createChangeOrderSchema>;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function ChangeOrderForm({ projectId, projectSlug }: ChangeOrderFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const { data: budgetLineItems } = trpc.budget.listLineItems.useQuery({
    projectId,
  });

  const { data: commitments } = trpc.commitment.list.useQuery({
    projectId,
  });

  const executedCommitments = commitments?.filter((c) => c.status === "executed");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(createChangeOrderSchema) as any,
    defaultValues: {
      projectId,
      type: "owner",
      title: "",
      description: "",
      relatedDocuments: [],
      lineItems: [
        {
          budgetLineItemId: undefined,
          costCodeId: 0,
          description: "",
          amountChange: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const selectedType = watch("type");

  const createMutation = trpc.changeOrder.create.useMutation({
    onSuccess: (data) => {
      utils.changeOrder.list.invalidate({ projectId });
      toast.success("Change order created successfully");
      router.push(`/projects/${projectSlug}/change-orders/${data.changeOrder.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create change order");
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  const lineItems = watch("lineItems");
  const totalAmount = lineItems.reduce(
    (sum: number, item: any) => sum + (Number(item.amountChange) || 0),
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

  const handleBack = () => {
    router.push(`/projects/${projectSlug}/change-orders`);
  };

  const canProceedStep1 = selectedType !== undefined;
  const canProceedStep2 = watch("title")?.length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Step 1: Type Selection */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Change Order Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={selectedType}
              onValueChange={(value) =>
                setValue("type", value as "owner" | "internal" | "subcontractor")
              }
            >
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="owner" id="owner" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="owner" className="font-semibold cursor-pointer">
                        Owner Change Order
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Change requested by the project owner
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="internal" id="internal" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="internal" className="font-semibold cursor-pointer">
                        Internal Change Order
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Change identified internally (errors, efficiency, value engineering)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem
                      value="subcontractor"
                      id="subcontractor"
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="subcontractor" className="font-semibold cursor-pointer">
                        Subcontractor Change Order
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Change to a subcontract or purchase order
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={handleBack}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                Next: Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Change Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="Enter change order title"
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
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

            {/* Type-specific fields */}
            {selectedType === "owner" && (
              <div className="space-y-2">
                <Label htmlFor="requestedBy">Requested By *</Label>
                <Input
                  id="requestedBy"
                  {...register("requestedBy")}
                  placeholder="Enter name of person requesting change"
                />
                {(errors as any).requestedBy && (
                  <p className="text-sm text-red-600">{(errors as any).requestedBy.message}</p>
                )}
              </div>
            )}

            {selectedType === "internal" && (
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select
                  value={watch("reason")}
                  onValueChange={(value) => setValue("reason", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason for change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="efficiency">Efficiency</SelectItem>
                    <SelectItem value="value_engineering">Value Engineering</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {(errors as any).reason && (
                  <p className="text-sm text-red-600">{(errors as any).reason.message}</p>
                )}
              </div>
            )}

            {selectedType === "subcontractor" && (
              <div className="space-y-2">
                <Label htmlFor="commitmentId">Related Commitment *</Label>
                <Select
                  value={watch("commitmentId")}
                  onValueChange={(value) => setValue("commitmentId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select commitment" />
                  </SelectTrigger>
                  <SelectContent>
                    {executedCommitments?.map((commitment) => (
                      <SelectItem key={commitment.id} value={commitment.id}>
                        {commitment.vendorName} -{" "}
                        {currencyFormatter.format(Number(commitment.totalAmount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(errors as any).commitmentId && (
                  <p className="text-sm text-red-600">{(errors as any).commitmentId.message}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                Next: Line Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Line Items */}
      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Step 3: Line Items</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      budgetLineItemId: undefined,
                      costCodeId: 0,
                      description: "",
                      amountChange: 0,
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
                            {getDivisionName(item.costCodeId)} - {item.description}
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
                    {(errors.lineItems as any)?.[index]?.costCodeId && (
                      <p className="text-sm text-red-600">
                        {(errors.lineItems as any)[index]?.costCodeId?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input
                      {...register(`lineItems.${index}.description`)}
                      placeholder="Enter description"
                    />
                    {(errors.lineItems as any)?.[index]?.description && (
                      <p className="text-sm text-red-600">
                        {(errors.lineItems as any)[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Amount Change *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`lineItems.${index}.amountChange`, {
                        valueAsNumber: true,
                      })}
                      placeholder="0.00 (can be negative)"
                    />
                    {(errors.lineItems as any)?.[index]?.amountChange && (
                      <p className="text-sm text-red-600">
                        {(errors.lineItems as any)[index]?.amountChange?.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {errors.lineItems && typeof errors.lineItems === "object" && !Array.isArray(errors.lineItems) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{(errors.lineItems as any).message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Amount Change:</span>
                <span className={totalAmount < 0 ? "text-red-600" : "text-green-600"}>
                  {currencyFormatter.format(totalAmount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Change Order"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
