"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
  projectType: z.enum(["residential", "commercial", "industrial", "institutional"]),
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

  const form = useForm<CreateEstimateFormValues>({
    resolver: zodResolver(createEstimateSchema),
    defaultValues: {
      name: "",
      projectType: "commercial",
    },
  });

  const createMutation = trpc.estimates.create.useMutation({
    onSuccess: (data) => {
      toast.success("Estimate created successfully");
      router.push(`/projects/${projectSlug}/estimates/${data.id}/workflow`);
    },
    onError: (error) => {
      toast.error("Failed to create estimate", {
        description: error.message,
      });
    },
  });

  const onSubmit = (values: CreateEstimateFormValues) => {
    if (!projectId) {
      toast.error("Project not found");
      return;
    }

    createMutation.mutate({
      projectId,
      ...values,
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/projects/${projectSlug}`} className="hover:text-foreground">
          Project
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/projects/${projectSlug}/estimates`} className="hover:text-foreground">
          Estimates
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">New Estimate</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Estimate</h1>
        <p className="text-muted-foreground mt-1">
          Start a new pre-bid cost estimate with guided workflow
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
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimate Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Base Bid Option A" {...field} />
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
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="institutional">Institutional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Start Estimating"}
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
