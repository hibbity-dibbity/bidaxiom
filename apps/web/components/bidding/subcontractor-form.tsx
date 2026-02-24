"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { UpdateSubcontractor, TradeValue } from "@construction/shared";
import { TradeCombobox } from "@/components/bidding/trade-combobox";
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
  onSuccess?: (updated?: { slug: string; id: string }) => void;
}

export function SubcontractorForm({ mode, defaultValues, onSuccess }: SubcontractorFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
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
      trades: (defaultValues as any)?.trades || [],  // legacy field kept for form compat
      trade: (defaultValues as any)?.trade || [],
      tradeOther: (defaultValues as any)?.tradeOther || "",
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
    onSuccess: (updated) => {
      utils.subcontractor.list.invalidate();
      utils.subcontractor.getById.invalidate();
      toast.success("Subcontractor updated successfully");
      if (onSuccess) {
        onSuccess(updated as { slug: string; id: string });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update subcontractor");
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    // Map form data to API schema (flatten address from nested form shape)
    const payload = {
      companyName: data.companyName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      street1: data.address?.street1,
      street2: data.address?.street2,
      city: data.address?.city,
      state: data.address?.state,
      zip: data.address?.zipCode,
      trades: [],  // legacy — cleared, kept for schema compat
      trade: data.trade ?? [],
      tradeOther: data.tradeOther || undefined,
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
                  <FormLabel>Contact Email *</FormLabel>
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
            <h4 className="text-sm font-medium">Address</h4>
            <AddressInput form={form} prefix="address" />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Trades</h4>
            <TradeCombobox
              value={form.watch("trade") ?? []}
              onChange={(trades: string[]) => {
                form.setValue("trade", trades as TradeValue[]);
                // Clear tradeOther when Other is deselected
                if (!trades.includes("Other")) {
                  form.setValue("tradeOther", "");
                }
              }}
            />
            {(form.watch("trade") ?? []).includes("Other") && (
              <FormField
                control={form.control}
                name="tradeOther"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specify trade (Other)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Demolition, Excavation..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
