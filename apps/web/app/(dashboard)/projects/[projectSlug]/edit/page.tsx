"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProjectSchema, validateJobNumberFormat } from "@construction/shared";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressInput } from "@/components/ui/address-input";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { getCustomerDisplayName } from "@construction/shared";

// Edit form schema: omit 'id' so form values don't include it
// We pass id separately in the mutation
const editFormSchema = updateProjectSchema.omit({ id: true, costCodes: true });
type EditFormValues = z.infer<typeof editFormSchema>;

interface EditProjectPageProps {
  params: { projectSlug: string };
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const { projectSlug } = params;
  const router = useRouter();
  const utils = trpc.useUtils();

  const hasReset = useRef(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateProject, setDuplicateProject] = useState<{
    name: string;
    slug: string;
  } | null>(null);

  // Data loading
  const { data: projectData, isLoading: projectLoading } = trpc.project.getBySlug.useQuery({
    slug: projectSlug,
  });
  const project = projectData;

  const { data: companyProfile } = trpc.company.getCurrent.useQuery();
  const jobNumberSettings = companyProfile?.jobNumberSettings;

  const { data: customersData } = trpc.customer.list.useQuery({ limit: 100, offset: 0 });
  const customers = customersData?.items || [];

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema) as any,
    defaultValues: {
      name: "",
      jobNumber: undefined,
      customerId: "",
      description: "",
      status: "active",
      projectType: "commercial",
      startDate: undefined,
      endDate: undefined,
      location: { street1: "", street2: "", city: "", state: "", zipCode: "" },
    },
  });

  // Pre-fill form once BOTH project data AND customers are loaded.
  // Waiting for customersData ensures the Customer Select has its options in the DOM
  // before form.reset() sets the value — otherwise Radix shows a blank trigger.
  useEffect(() => {
    if (project && customersData && !hasReset.current) {
      hasReset.current = true;
      form.reset({
        name: project.name,
        jobNumber: project.jobNumber ?? undefined,
        customerId: project.customerId,
        description: project.description ?? "",
        poNumber: project.poNumber ?? "",
        status: project.status as "active" | "on_hold" | "completed" | "archived",
        projectType: project.projectType as "commercial" | "residential" | "infrastructure" | "industrial",
        startDate: project.startDate
          ? new Date(project.startDate).toISOString()
          : undefined,
        endDate: project.endDate
          ? new Date(project.endDate).toISOString()
          : undefined,
        location: {
          street1: project.street1 ?? "",
          street2: project.street2 ?? "",
          city: project.city ?? "",
          state: project.state ?? "",
          zipCode: project.zip ?? "",
        },
      });
    }
  }, [project, customersData]);

  // Save mutation
  const updateMutation = trpc.project.update.useMutation({
    onSuccess: (updated) => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      // If slug changed (name/jobNumber updated), use new slug from response
      const newSlug = updated?.slug ?? projectSlug;
      utils.project.getBySlug.invalidate({ slug: newSlug });
      utils.project.list.invalidate();
      // Invalidate company profile and max-used sequence so settings page is fresh
      utils.company.getCurrent.invalidate();
      utils.company.getMaxUsedJobSequence.invalidate();
      toast.success("Project updated");
      router.push(`/projects/${newSlug}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update project");
    },
  });

  // Blur validation with excludeProjectId — same pattern as create form
  const handleJobNumberBlur = async (value: string) => {
    setDuplicateProject(null);
    if (!value) {
      form.clearErrors("jobNumber");
      return;
    }

    // Format check (only when auto-gen is enabled)
    if (jobNumberSettings?.enabled) {
      if (!validateJobNumberFormat(value, jobNumberSettings.template)) {
        form.setError("jobNumber", {
          type: "manual",
          message: "Job number doesn't match the required format",
        });
        return;
      }
    }

    // Duplicate check — exclude THIS project's own ID to prevent self-match
    form.clearErrors("jobNumber");
    setIsCheckingDuplicate(true);
    try {
      const result = await utils.company.checkJobNumberAvailability.fetch({
        jobNumber: value,
        excludeProjectId: project?.id,
      });
      if (
        !result.available &&
        result.existingProjectName &&
        result.existingProjectSlug
      ) {
        setDuplicateProject({
          name: result.existingProjectName,
          slug: result.existingProjectSlug,
        });
        form.setError("jobNumber", { type: "manual", message: " " });
      }
    } catch {
      // Don't block save on network error
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const onSubmit = async (values: EditFormValues) => {
    if (!project) return;

    // Async safety net — re-run blur validation on submit
    if (values.jobNumber) {
      await handleJobNumberBlur(values.jobNumber);
      if (form.formState.errors.jobNumber || duplicateProject) return;
    }

    updateMutation.mutate({ id: project.id, ...values });
  };

  // Loading state
  if (projectLoading || !project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>Loading...</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  const isSubmitDisabled =
    updateMutation.isPending || isCheckingDuplicate || !!duplicateProject;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectSlug}`} className="hover:text-foreground">
          {project.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Edit</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Project</h1>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Update project details and timeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Downtown Office Tower" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief project description..."
                          className="min-h-[80px]"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer PO number</FormLabel>
                      <FormControl>
                        <Input placeholder="Leave blank if the customer has no PO" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Printed on every proposal, change order and invoice for this project.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Location</h4>
                  <AddressInput form={form} prefix="location" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="commercial">Commercial</SelectItem>
                            <SelectItem value="residential">Residential</SelectItem>
                            <SelectItem value="infrastructure">Infrastructure</SelectItem>
                            <SelectItem value="industrial">Industrial</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? field.value.split("T")[0] : ""}
                            onChange={(e) => {
                              const date = e.target.value;
                              field.onChange(
                                date ? new Date(date).toISOString() : undefined
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? field.value.split("T")[0] : ""}
                            onChange={(e) => {
                              const date = e.target.value;
                              field.onChange(
                                date ? new Date(date).toISOString() : undefined
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Job Number */}
            <Card>
              <CardHeader>
                <CardTitle>Job Number</CardTitle>
                <CardDescription>
                  {jobNumberSettings?.enabled
                    ? "Update the job number. Leaving blank will keep the existing number."
                    : "Job number (optional)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="jobNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Number (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            placeholder="e.g., ABC-001"
                            className="font-mono pr-8"
                            maxLength={50}
                            onChange={(e) => {
                              field.onChange(e);
                              // Clear duplicate error immediately when user starts typing
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
                          {isCheckingDuplicate && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      {duplicateProject && (
                        <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                          Already used by{" "}
                          <Link
                            href={`/projects/${duplicateProject.slug}`}
                            target="_blank"
                            className="underline font-medium inline-flex items-center gap-0.5"
                          >
                            {duplicateProject.name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/projects/${projectSlug}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
