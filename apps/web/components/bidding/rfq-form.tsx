"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@/lib/trpc";
import { createRfqSchema, CSI_DIVISIONS } from "@construction/shared";
import { z } from "zod";

// datetime-local input gives "YYYY-MM-DDTHH:MM" (no Z, no seconds).
// Override dueDate to accept that format; onSubmit converts to ISO before API call.
const rfqFormSchema = createRfqSchema.extend({
  dueDate: z.string().min(1, "Due date is required"),
});
type RfqFormData = z.infer<typeof rfqFormSchema>;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RfqFormProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const CSI_DIVISION_OPTIONS = [
  {
    value: 0,
    label: "00 - Procurement and Contracting",
    description: "Bidding requirements, contract forms, conditions of the contract"
  },
  {
    value: 1,
    label: "01 - General Requirements",
    description: "Project management, temporary facilities, quality control"
  },
  {
    value: 2,
    label: "02 - Existing Conditions",
    description: "Demolition, site remediation, asbestos abatement"
  },
  {
    value: 3,
    label: "03 - Concrete",
    description: "Cast-in-place concrete, precast concrete, concrete finishing"
  },
  {
    value: 4,
    label: "04 - Masonry",
    description: "Brick masonry, stone masonry, concrete block (CMU)"
  },
  {
    value: 5,
    label: "05 - Metals",
    description: "Structural steel, metal joists, metal decking"
  },
  {
    value: 6,
    label: "06 - Wood, Plastics, and Composites",
    description: "Rough carpentry, finish carpentry, architectural woodwork"
  },
  {
    value: 7,
    label: "07 - Thermal and Moisture Protection",
    description: "Waterproofing, insulation, roofing, siding"
  },
  {
    value: 8,
    label: "08 - Openings",
    description: "Doors, windows, skylights, glazing, curtain walls"
  },
  {
    value: 9,
    label: "09 - Finishes",
    description: "Drywall, tile, flooring, carpet, painting"
  },
  {
    value: 10,
    label: "10 - Specialties",
    description: "Toilet partitions, fire extinguishers, signage, lockers"
  },
  {
    value: 21,
    label: "21 - Fire Suppression",
    description: "Fire sprinkler systems, standpipes, fire pumps"
  },
  {
    value: 22,
    label: "22 - Plumbing",
    description: "Plumbing fixtures, domestic water piping, sanitary waste"
  },
  {
    value: 23,
    label: "23 - HVAC",
    description: "Heating systems, ventilation, air conditioning"
  },
  {
    value: 26,
    label: "26 - Electrical",
    description: "Power distribution, lighting systems, fire alarm"
  },
  {
    value: 27,
    label: "27 - Communications",
    description: "Data cabling, structured cabling, phone systems"
  },
  {
    value: 28,
    label: "28 - Electronic Safety and Security",
    description: "Access control systems, CCTV surveillance, intrusion detection"
  },
  {
    value: 31,
    label: "31 - Earthwork",
    description: "Excavation, grading, soil stabilization, trenching"
  },
  {
    value: 32,
    label: "32 - Exterior Improvements",
    description: "Paving, landscaping, fencing, retaining walls"
  },
  {
    value: 33,
    label: "33 - Utilities",
    description: "Water distribution, sanitary sewers, storm drainage"
  },
];

export function RfqForm({ projectId, projectSlug }: RfqFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [selectedTrades, setSelectedTrades] = useState<number[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RfqFormData>({
    resolver: zodResolver(rfqFormSchema),
    defaultValues: {
      projectId,
      trades: [],
    },
  });

  const createMutation = trpc.rfq.create.useMutation({
    onSuccess: (data) => {
      utils.rfq.list.invalidate({ projectId });
      toast.success("RFQ created successfully");
      router.push(`/projects/${projectSlug}/rfqs/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create RFQ");
    },
  });

  const onSubmit = (data: RfqFormData) => {
    createMutation.mutate({
      ...data,
      trades: selectedTrades,
      dueDate: new Date(data.dueDate).toISOString(),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="e.g., HVAC Package - Main Building"
          maxLength={200}
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Optional description or summary"
          rows={3}
          maxLength={5000}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="scopeOfWork">Scope of Work *</Label>
        <Textarea
          id="scopeOfWork"
          {...register("scopeOfWork")}
          placeholder="Detailed scope of work for this RFQ..."
          rows={8}
          maxLength={10000}
        />
        {errors.scopeOfWork && (
          <p className="text-sm text-red-500">{errors.scopeOfWork.message}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Trades / CSI Divisions *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedTrades.length === CSI_DIVISION_OPTIONS.length) {
                setSelectedTrades([]);
              } else {
                setSelectedTrades(CSI_DIVISION_OPTIONS.map((d) => d.value));
              }
            }}
          >
            {selectedTrades.length === CSI_DIVISION_OPTIONS.length
              ? "Deselect All"
              : "Select All"}
          </Button>
        </div>
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto border rounded-md p-3">
            {CSI_DIVISION_OPTIONS.map((division) => (
              <div key={division.value} className="flex items-start space-x-3">
                <Checkbox
                  checked={selectedTrades.includes(division.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTrades([...selectedTrades, division.value]);
                    } else {
                      setSelectedTrades(
                        selectedTrades.filter((v) => v !== division.value)
                      );
                    }
                  }}
                />
                <div className="flex items-center gap-1.5 flex-1">
                  <Label className="text-sm font-normal cursor-pointer">
                    {division.label}
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{division.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </TooltipProvider>
        {selectedTrades.length === 0 && (
          <p className="text-sm text-red-500">At least one trade is required</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date *</Label>
        <div className="flex gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground mt-2" />
          <Input
            id="dueDate"
            type="datetime-local"
            {...register("dueDate")}
            className="flex-1"
          />
        </div>
        {errors.dueDate && (
          <p className="text-sm text-red-500">{errors.dueDate.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || selectedTrades.length === 0}
        >
          {createMutation.isPending ? "Creating..." : "Create RFQ"}
        </Button>
      </div>
    </form>
  );
}
