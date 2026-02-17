"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, DEFAULT_PROJECT_PHASES, previewJobNumber, createCustomerSchema, validateJobNumberFormat } from "@construction/shared";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
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
  FormDescription,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, X, GripVertical, Info, Loader2, ExternalLink } from "lucide-react";
import { getCustomerDisplayName } from "@construction/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ProjectFormValues = z.infer<typeof createProjectSchema>;

const CSI_DIVISIONS = [
  {
    value: 0,
    label: "00 - Procurement and Contracting",
    description: "Bidding requirements, contract forms, conditions of the contract, and project procurement procedures"
  },
  {
    value: 1,
    label: "01 - General Requirements",
    description: "Project management, temporary facilities, quality control, project meetings, and submittal procedures"
  },
  {
    value: 2,
    label: "02 - Existing Conditions",
    description: "Demolition, site remediation, asbestos abatement, existing structure assessments, and hazardous material removal"
  },
  {
    value: 3,
    label: "03 - Concrete",
    description: "Cast-in-place concrete, precast concrete, concrete finishing, formwork, and concrete accessories"
  },
  {
    value: 4,
    label: "04 - Masonry",
    description: "Brick masonry, stone masonry, concrete block (CMU), glass block, and mortar"
  },
  {
    value: 5,
    label: "05 - Metals",
    description: "Structural steel, metal joists, metal decking, cold-formed metal framing, and ornamental metals"
  },
  {
    value: 6,
    label: "06 - Wood, Plastics, and Composites",
    description: "Rough carpentry, finish carpentry, architectural woodwork, plastic fabrications, and composite materials"
  },
  {
    value: 7,
    label: "07 - Thermal and Moisture Protection",
    description: "Waterproofing, insulation, roofing, siding, membrane roofing, and joint sealants"
  },
  {
    value: 8,
    label: "08 - Openings",
    description: "Doors, windows, skylights, glazing, curtain walls, and specialty openings"
  },
  {
    value: 9,
    label: "09 - Finishes",
    description: "Drywall, tile, flooring, carpet, painting, wallcovering, and acoustical ceilings"
  },
  {
    value: 10,
    label: "10 - Specialties",
    description: "Toilet partitions, fire extinguishers, signage, lockers, flagpoles, and building specialties"
  },
  {
    value: 21,
    label: "21 - Fire Suppression",
    description: "Fire sprinkler systems, standpipes, fire pumps, and fire suppression equipment"
  },
  {
    value: 22,
    label: "22 - Plumbing",
    description: "Plumbing fixtures, domestic water piping, sanitary waste, water heaters, and sewage systems"
  },
  {
    value: 23,
    label: "23 - HVAC",
    description: "Heating systems, ventilation, air conditioning, ductwork, fans, and climate control equipment"
  },
  {
    value: 26,
    label: "26 - Electrical",
    description: "Power distribution, lighting systems, fire alarm, emergency power, and electrical equipment"
  },
  {
    value: 27,
    label: "27 - Communications",
    description: "Data cabling, structured cabling, phone systems, audio/visual, and telecommunications infrastructure"
  },
  {
    value: 28,
    label: "28 - Electronic Safety and Security",
    description: "Access control systems, CCTV surveillance, intrusion detection, and building security systems"
  },
  {
    value: 31,
    label: "31 - Earthwork",
    description: "Excavation, grading, soil stabilization, trenching, and earthwork operations"
  },
  {
    value: 32,
    label: "32 - Exterior Improvements",
    description: "Paving, landscaping, fencing, retaining walls, site improvements, and irrigation"
  },
  {
    value: 33,
    label: "33 - Utilities",
    description: "Water distribution, sanitary sewers, storm drainage, and underground utility systems"
  },
];

const PROJECT_ROLES = [
  { value: "project_manager", label: "Project Manager" },
  { value: "superintendent", label: "Superintendent" },
  { value: "foreman", label: "Foreman" },
  { value: "estimator", label: "Estimator" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
];

export function ProjectForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [manualJobNumber, setManualJobNumber] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateProject, setDuplicateProject] = useState<{ name: string; slug: string } | null>(null);

  // Fetch company profile for job number settings
  const { data: companyProfile } = trpc.company.getCurrent.useQuery();
  const jobNumberSettings = companyProfile?.jobNumberSettings;
  const jobNumbersEnabled = jobNumberSettings?.enabled ?? false;

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
      projectType: "commercial",
      startDate: undefined,
      endDate: undefined,
      costCodes: [],
      teamMembers: [],
      phases: DEFAULT_PROJECT_PHASES.map((phase) => ({
        name: phase.name,
        orderIndex: phase.orderIndex,
      })),
    },
  });

  const { fields: teamFields, append: appendTeam, remove: removeTeam } = useFieldArray({
    control: form.control,
    name: "teamMembers",
  });

  const { fields: phaseFields, append: appendPhase, remove: removePhase } = useFieldArray({
    control: form.control,
    name: "phases",
  });

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (data) => {
      utils.project.list.invalidate();
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
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Essential project details and timeline
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddCustomerOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Location</h4>
              <AddressInput form={form} prefix="location" />
            </div>

            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        {...field}
                        value={field.value ? field.value.split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          field.onChange(date ? new Date(date).toISOString() : undefined);
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
                        {...field}
                        value={field.value ? field.value.split('T')[0] : ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          field.onChange(date ? new Date(date).toISOString() : undefined);
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

        {/* Job Number - Show if settings exist, regardless of enabled state */}
        {jobNumberSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Job Number</CardTitle>
              <CardDescription>
                {jobNumberSettings.enabled
                  ? "A unique job number will be auto-generated or you can enter one manually"
                  : "Job number auto-generation is disabled. You can enter one manually (optional)."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!manualJobNumber && jobNumberSettings.enabled ? (
                <div className="space-y-3">
                  <div className="p-4 bg-muted rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm font-medium">Auto-generated</div>
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            Next available
                          </span>
                        </div>
                        <div className="font-mono text-lg text-primary">
                          {previewJobNumber(jobNumberSettings.template, jobNumberSettings.nextSequenceNumber)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setManualJobNumber(true)}
                      >
                        Enter Manually
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Job number will be assigned automatically when you create the project
                  </p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="jobNumber"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-2">
                        <FormLabel>Job Number{jobNumberSettings.enabled ? "" : " (Optional)"}</FormLabel>
                        {manualJobNumber && jobNumberSettings.enabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setManualJobNumber(false);
                              field.onChange(undefined);
                              form.clearErrors("jobNumber");
                              setDuplicateProject(null);
                            }}
                          >
                            Use Auto-generated
                          </Button>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder={`e.g., ${previewJobNumber(jobNumberSettings.template, 1)}`}
                          className="font-mono"
                          maxLength={50}
                          onBlur={(e) => {
                            field.onBlur(); // preserve RHF blur behavior
                            handleJobNumberBlur(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormDescription className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span>
                          Expected format: <code className="text-xs bg-muted px-1 py-0.5 rounded">{jobNumberSettings.template}</code>
                          {" "}(e.g., {previewJobNumber(jobNumberSettings.template, 1)})
                        </span>
                      </FormDescription>
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
            </CardContent>
          </Card>
        )}

        {/* Cost Codes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CSI Cost Codes</CardTitle>
                <CardDescription>
                  Select relevant divisions for this project
                </CardDescription>
              </div>
              <FormField
                control={form.control}
                name="costCodes"
                render={({ field }) => {
                  const allSelected = field.value?.length === CSI_DIVISIONS.length;
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (allSelected) {
                          field.onChange([]);
                        } else {
                          field.onChange(CSI_DIVISIONS.map((d) => d.value));
                        }
                      }}
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </Button>
                  );
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="costCodes"
              render={() => (
                <FormItem>
                  <TooltipProvider>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {CSI_DIVISIONS.map((division) => (
                        <FormField
                          key={division.value}
                          control={form.control}
                          name="costCodes"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(division.value)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, division.value])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== division.value
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <div className="flex items-center gap-1.5 flex-1">
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {division.label}
                                </FormLabel>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>{division.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </TooltipProvider>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Assign team members and their roles (you'll be added as Project Manager automatically)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamFields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`teamMembers.${index}.userId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>User ID</FormLabel>
                        <FormControl>
                          <Input placeholder="user_xxx or clerk_id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`teamMembers.${index}.role`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROJECT_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTeam(index)}
                  className="mt-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendTeam({ userId: "", role: "viewer" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Team Member
            </Button>
          </CardContent>
        </Card>

        {/* Project Phases */}
        <Card>
          <CardHeader>
            <CardTitle>Project Phases</CardTitle>
            <CardDescription>
              Define construction phases (defaults loaded, customize as needed)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {phaseFields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-center">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <FormField
                  control={form.control}
                  name={`phases.${index}.name`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Phase name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePhase(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendPhase({
                  name: "",
                  orderIndex: phaseFields.length,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Phase
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
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
