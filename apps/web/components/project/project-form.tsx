"use client";

import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProjectSchema, DEFAULT_PROJECT_PHASES } from "@construction/shared";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, X, GripVertical } from "lucide-react";

type ProjectFormValues = z.infer<typeof createProjectSchema>;

const CSI_DIVISIONS = [
  { value: 0, label: "00 - Procurement and Contracting" },
  { value: 1, label: "01 - General Requirements" },
  { value: 2, label: "02 - Existing Conditions" },
  { value: 3, label: "03 - Concrete" },
  { value: 4, label: "04 - Masonry" },
  { value: 5, label: "05 - Metals" },
  { value: 6, label: "06 - Wood, Plastics, and Composites" },
  { value: 7, label: "07 - Thermal and Moisture Protection" },
  { value: 8, label: "08 - Openings" },
  { value: 9, label: "09 - Finishes" },
  { value: 10, label: "10 - Specialties" },
  { value: 21, label: "21 - Fire Suppression" },
  { value: 22, label: "22 - Plumbing" },
  { value: 23, label: "23 - HVAC" },
  { value: 26, label: "26 - Electrical" },
  { value: 27, label: "27 - Communications" },
  { value: 28, label: "28 - Electronic Safety and Security" },
  { value: 31, label: "31 - Earthwork" },
  { value: 32, label: "32 - Exterior Improvements" },
  { value: 33, label: "33 - Utilities" },
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

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as any,
    defaultValues: {
      name: "",
      description: "",
      location: "",
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
      router.push(`/projects/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    },
  });

  const onSubmit = (values: ProjectFormValues) => {
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

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City, State" {...field} />
                  </FormControl>
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

        {/* Cost Codes */}
        <Card>
          <CardHeader>
            <CardTitle>CSI Cost Codes</CardTitle>
            <CardDescription>
              Select relevant divisions for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="costCodes"
              render={() => (
                <FormItem>
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
                            <FormLabel className="text-sm font-normal cursor-pointer">
                              {division.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
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
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
