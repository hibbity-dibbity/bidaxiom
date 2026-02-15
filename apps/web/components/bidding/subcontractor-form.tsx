"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { toast } from "sonner";
import { createSubcontractorSchema } from "@construction/shared";
import type { CreateSubcontractor, UpdateSubcontractor } from "@construction/shared";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";
import { useRouter } from "next/navigation";

interface SubcontractorFormProps {
  mode: "create" | "edit";
  defaultValues?: Partial<UpdateSubcontractor> & {
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  onSuccess?: () => void;
}

export function SubcontractorForm({ mode, defaultValues, onSuccess }: SubcontractorFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const form = useForm<CreateSubcontractor>({
    resolver: zodResolver(createSubcontractorSchema),
    defaultValues: {
      companyName: defaultValues?.companyName || "",
      contactName: defaultValues?.contactName || "",
      contactEmail: defaultValues?.contactEmail || "",
      contactPhone: defaultValues?.contactPhone || "",
      address: {
        street1: defaultValues?.street1 || "",
        street2: defaultValues?.street2 || "",
        city: defaultValues?.city || "",
        state: defaultValues?.state || "",
        zipCode: defaultValues?.zip || "",
      },
      trades: defaultValues?.trades || [],
      notes: defaultValues?.notes || "",
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
    // Map form data to API schema (flatten address)
    const payload = {
      companyName: data.companyName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      address: data.address,
      street1: data.address?.street1,
      street2: data.address?.street2,
      city: data.address?.city,
      state: data.address?.state,
      zip: data.address?.zipCode,
      trades: data.trades,
      notes: data.notes,
    };

    if (mode === "create") {
      createMutation.mutate(payload);
    } else if (defaultValues?.id) {
      updateMutation.mutate({
        id: defaultValues.id,
        ...payload,
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name *</FormLabel>
                <FormControl>
                  <Input placeholder="ABC Plumbing Inc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@abcplumbing.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <PhoneInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormLabel>Address</FormLabel>
            <AddressInput form={form} prefix="address" />
          </div>

          <div className="space-y-2">
            <FormLabel>Trades (CSI Divisions) *</FormLabel>
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

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes about this subcontractor..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
    </Form>
  );
}
