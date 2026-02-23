"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createEstimateSchema } from "@construction/shared";
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
  FormDescription,
} from "@/components/ui/form";
import { useAutoSave } from "../useAutoSave";
import { useWorkflowState } from "../useWorkflowState";
import { toast } from "sonner";

// Use subset of createEstimateSchema for this step
// Full schema requires projectId which is already set during estimate creation
const basicInfoSchema = createEstimateSchema.pick({
  name: true,
  description: true,
  projectType: true,
});

type BasicInfoFormValues = z.infer<typeof basicInfoSchema>;

interface BasicInfoStepProps {
  estimateId: string;
}

export function BasicInfoStep({ estimateId }: BasicInfoStepProps) {
  const { unlockStep, goToStep } = useWorkflowState();
  const utils = trpc.useUtils();

  // Load current estimate data
  const { data: estimate } = trpc.estimates.getById.useQuery({ id: estimateId });

  // Update mutation
  const updateMutation = trpc.estimates.update.useMutation({
    onSuccess: () => {
      utils.estimates.getById.invalidate({ id: estimateId });
    },
    onError: (error) => {
      toast.error("Failed to save changes", {
        description: error.message,
      });
    },
  });

  const form = useForm<BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: "",
      description: "",
      projectType: "commercial",
    },
  });

  // Load data into form when estimate loads
  useEffect(() => {
    if (estimate) {
      form.reset({
        name: estimate.name || "",
        description: estimate.description || "",
        projectType: estimate.projectType || "commercial",
      });
    }
  }, [estimate, form]);

  // Auto-save form changes
  const watchedData = form.watch();
  useAutoSave({
    data: watchedData,
    onSave: async (data) => {
      await updateMutation.mutateAsync({
        id: estimateId,
        ...data,
      });

      // Unlock Step 2 when minimal data is present
      if (data.name && data.projectType) {
        unlockStep(2);
      }
    },
    enabled: !!estimateId,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Provide basic details about this estimate. Changes are saved automatically.
      </p>

      <Form {...form}>
        <form className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimate Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Base Bid Option A" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name for this estimate
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional details about this estimate..."
                    rows={4}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); goToStep(2); } }}
                    {...field}
                  />
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  The type of construction project
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => goToStep(2)}>Next</Button>
      </div>
    </div>
  );
}
