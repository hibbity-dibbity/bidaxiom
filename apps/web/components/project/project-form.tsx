"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, previewJobNumber, createCustomerSchema, validateJobNumberFormat } from "@construction/shared";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { AddressInput } from "@/components/ui/address-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, X, Loader2, ExternalLink } from "lucide-react";
import { getCustomerDisplayName } from "@construction/shared";

type ProjectFormValues = z.infer<typeof createProjectSchema>;

export function ProjectForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [manualJobNumber, setManualJobNumber] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateProject, setDuplicateProject] = useState<{ name: string; slug: string } | null>(null);
  const [buildingWidth, setBuildingWidth] = useState<number | "">("");
  const [buildingLength, setBuildingLength] = useState<number | "">("");

  // Fetch company profile for job number settings
  const { data: companyProfile } = trpc.company.getCurrent.useQuery();
  const jobNumberSettings = companyProfile?.jobNumberSettings;

  // Fetch customers for dropdown
  const { data: customersData } = trpc.customer.list.useQuery({ limit: 100, offset: 0 });
  const customers = customersData?.items || [];

  // Separate form instance for customer dialog
  const customerForm = useForm({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: { street1: "", street2: "", city: "", state: "", zipCode: "" },
    },
  });

  const createCustomerMutation = trpc.customer.create.useMutation({
    onSuccess: (data) => {
      utils.customer.list.invalidate();
      form.setValue("customerId", data.id);
      toast.success("Customer created");
      setAddCustomerOpen(false);
      customerForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create customer");
    },
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as any,
    defaultValues: {
      name: "",
      jobNumber: undefined,
      customerId: "",
      description: "",
      location: { street1: "", street2: "", city: "", state: "", zipCode: "" },
      projectMode: "simple",
      costCodes: [],
      customerBudget: undefined,
      buildingWidth: undefined,
      buildingLength: undefined,
      buildingHeight: undefined,
    },
  });

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (data) => {
      utils.project.list.invalidate();
      // Invalidate company profile and max-used sequence so settings page is fresh
      utils.company.getCurrent.invalidate();
      utils.company.getMaxUsedJobSequence.invalidate();
      toast.success("Project created successfully");
      router.push(`/projects/${data.slug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    },
  });

  const handleJobNumberBlur = async (value: string) => {
    setDuplicateProject(null);
    if (!value) {
      form.clearErrors("jobNumber");
      return;
    }

    // Step 1: Format validation (only when auto-gen is enabled)
    if (jobNumberSettings?.enabled) {
      if (!validateJobNumberFormat(value, jobNumberSettings.template)) {
        form.setError("jobNumber", {
          type: "manual",
          message: "Job number doesn't match the required format",
        });
        return;
      }
    }

    // Step 2: Duplicate check (async)
    form.clearErrors("jobNumber");
    setIsCheckingDuplicate(true);
    try {
      const result = await utils.company.checkJobNumberAvailability.fetch({
        jobNumber: value,
        // No excludeProjectId — this is a new project
      });
      if (!result.available && result.existingProjectName && result.existingProjectSlug) {
        setDuplicateProject({ name: result.existingProjectName, slug: result.existingProjectSlug });
        form.setError("jobNumber", { type: "manual", message: " " }); // space keeps FormMessage visible for layout
      }
    } catch {
      // Don't block submission on network error — backend will catch duplicates
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const onSubmit = async (values: ProjectFormValues) => {
    // Safety net: re-check if a manual job number is entered
    if (values.jobNumber) {
      await handleJobNumberBlur(values.jobNumber);
      // If errors were set, abort
      if (form.formState.errors.jobNumber || duplicateProject) return;
    }
    createMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* PROJECT NUMBER — inline widget, only shown when jobNumberSettings exists */}
        {jobNumberSettings && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium leading-none">Project Number</label>
            {!manualJobNumber && jobNumberSettings.enabled ? (
              /* READ-ONLY MODE */
              <div className="flex items-center gap-3">
                <span className="font-mono text-base">
                  {previewJobNumber(jobNumberSettings.template, jobNumberSettings.nextSequenceNumber)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setManualJobNumber(true)}
                >
                  Manual Entry
                </Button>
              </div>
            ) : (
              /* MANUAL ENTRY MODE */
              <FormField
                control={form.control}
                name="jobNumber"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          className="font-mono w-48"
                          maxLength={50}
                          onChange={(e) => {
                            field.onChange(e);
                            if (duplicateProject || form.formState.errors.jobNumber) {
                              form.clearErrors("jobNumber");
                              setDuplicateProject(null);
                            }
                          }}
                          onBlur={(e) => {
                            field.onBlur();
                            handleJobNumberBlur(e.target.value);
                          }}
                        />
                      </FormControl>
                      {jobNumberSettings.enabled && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setManualJobNumber(false);
                            field.onChange(undefined);
                            form.clearErrors("jobNumber");
                            setDuplicateProject(null);
                          }}
                        >
                          Use Auto-Generated
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                    {isCheckingDuplicate && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking availability...
                      </div>
                    )}
                    {duplicateProject && !isCheckingDuplicate && (
                      <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                        <span className="font-mono font-medium">{form.getValues("jobNumber")}</span>
                        <span>is already assigned to</span>
                        <a
                          href={`/projects/${duplicateProject.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline hover:no-underline inline-flex items-center gap-0.5"
                        >
                          {duplicateProject.name}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        {/* PROJECT NAME */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Name</FormLabel>
              <FormControl>
                <Input placeholder="Downtown Office Tower" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* CUSTOMER */}
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer *</FormLabel>
              <div className="flex gap-2">
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {getCustomerDisplayName(customer)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setAddCustomerOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* DESCRIPTION */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Brief project description..." className="min-h-[80px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* LOCATION — AddressInput, no heading above it */}
        <AddressInput form={form} prefix="location" />

        {/* BUILDING DIMENSIONS */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Building Dimensions</p>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="buildingWidth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Width</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          field.onChange(val);
                          setBuildingWidth(val ?? "");
                        }}
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">ft</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buildingLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Length</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          field.onChange(val);
                          setBuildingLength(val ?? "");
                        }}
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">ft</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buildingHeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? undefined : Number(e.target.value);
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">ft</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* Live sq ft preview */}
          {buildingWidth !== "" && buildingLength !== "" && (
            <p className="text-sm text-muted-foreground">
              Sq ft:{" "}
              <span className="font-medium text-foreground">
                {(Number(buildingWidth) * Number(buildingLength)).toLocaleString()}
              </span>
            </p>
          )}
        </div>

        {/* CUSTOMER BUDGET */}
        <FormField
          control={form.control}
          name="customerBudget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Budget</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value ?? 0}
                  onChange={(val) => field.onChange(val === 0 ? undefined : val)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* SUBMIT */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || isCheckingDuplicate || !!duplicateProject}
          >
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>

      </form>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerOpen} onOpenChange={(open) => {
        setAddCustomerOpen(open);
        if (!open) customerForm.reset();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create a new customer record
            </DialogDescription>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit((data) => createCustomerMutation.mutate(data))} className="space-y-4 py-4">
              <FormField
                control={customerForm.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Construction Inc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={customerForm.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={customerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneInput placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={customerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Address</h4>
                <AddressInput form={customerForm} prefix="address" />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddCustomerOpen(false);
                    customerForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending ? "Creating..." : "Create Customer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
