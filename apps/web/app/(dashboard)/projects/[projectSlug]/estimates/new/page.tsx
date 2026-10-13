"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

const createEstimateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  projectType: z.enum(["residential", "commercial", "industrial", "infrastructure"]),
});

type CreateEstimateFormValues = z.infer<typeof createEstimateSchema>;

export default function NewEstimatePage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;
  const router = useRouter();

  // Resolve project by slug
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  const { data: existing } = trpc.estimates.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  // "blank" or the id of a proposal in this project to copy
  const [source, setSource] = React.useState<string>("blank");
  const copying = source !== "blank";

  const form = useForm<CreateEstimateFormValues>({
    resolver: zodResolver(createEstimateSchema),
    defaultValues: {
      name: "",
      projectType: "commercial",
    },
  });

  const createMutation = trpc.estimates.create.useMutation({
    onSuccess: (data) => {
      toast.success("Proposal created successfully");
      router.push(`/projects/${projectSlug}/estimates/${data.slug}`);
    },
    onError: (error) => {
      toast.error("Failed to create proposal", {
        description: error.message,
      });
    },
  });

  const duplicateMutation = trpc.proposal.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("Proposal copied");
      router.push(`/projects/${projectSlug}/estimates/${data.slug}`);
    },
    onError: (error) => {
      toast.error("Failed to copy proposal", { description: error.message });
    },
  });

  const onSourceChange = (value: string) => {
    setSource(value);
    const src = existing?.find((e) => e.id === value);
    if (src && !form.getValues("name").trim()) {
      form.setValue("name", `Copy of ${src.name}`, { shouldValidate: true });
    }
  };

  const onSubmit = (values: CreateEstimateFormValues) => {
    if (!projectId) {
      toast.error("Project not found");
      return;
    }
    if (copying) {
      duplicateMutation.mutate({ estimateId: source, name: values.name });
      return;
    }

    createMutation.mutate({
      projectId,
      ...values,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Proposal</h1>
        <p className="text-muted-foreground mt-1">
          Start a new pre-bid cost proposal with guided workflow
        </p>
      </div>

      {/* Form */}
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Provide basic details to get started. You'll be able to add more details in the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {existing && existing.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Start from</label>
                    <Select value={source} onValueChange={onSourceChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blank">Blank proposal</SelectItem>
                        {existing.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            Copy of: {e.name}{e.revision > 1 ? ` (Rev ${e.revision})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[13px] text-muted-foreground">
                      {copying
                        ? "Copies the lines, margins, global costs, tax, payment terms and invoicing schedule. Notes are copied too. Nothing is shared with the original."
                        : "Or pick an earlier proposal in this project to copy as a starting point."}
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proposal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Base Bid Option A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!copying && <FormField
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
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="infrastructure">Institutional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || duplicateMutation.isPending}
                  >
                    {createMutation.isPending || duplicateMutation.isPending
                      ? "Creating..."
                      : copying
                      ? "Create copy"
                      : "Start Estimating"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/projects/${projectSlug}/estimates`)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
