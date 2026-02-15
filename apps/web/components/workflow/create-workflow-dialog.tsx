"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar as CalendarIcon, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

interface CreateWorkflowDialogProps {
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApprovalStep {
  stepNumber: number;
  approverUserId?: string;
  approverRole?: string;
  requirementType: "specific_user" | "any_with_role" | "all_with_role";
}

export function CreateWorkflowDialog({
  projectId,
  projectSlug,
  open,
  onOpenChange,
}: CreateWorkflowDialogProps) {
  const [step, setStep] = useState(1);
  const router = useRouter();

  // Step 1: Basic Info
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [workflowType, setWorkflowType] = useState<"rfi" | "submittal" | "transmittal">("rfi");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Priority and Due Date
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();

  // Step 3: Approval Steps
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([
    { stepNumber: 1, requirementType: "specific_user" },
  ]);

  const utils = trpc.useUtils();

  // Fetch documents for selection
  const { data: documents } = trpc.document.list.useQuery({ projectId });

  // Fetch users for approval step assignment
  const { data: users } = trpc.user.list.useQuery();

  const createWorkflowMutation = trpc.workflow.create.useMutation({
    onSuccess: (workflow) => {
      toast.success("Workflow created successfully");
      utils.workflow.list.invalidate({ projectId });
      resetForm();
      onOpenChange(false);
      // Navigate to workflow detail page
      router.push(`/projects/${projectSlug}/workflows/${workflow.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create workflow");
    },
  });

  const resetForm = () => {
    setStep(1);
    setSelectedDocumentId("");
    setWorkflowType("rfi");
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate(undefined);
    setApprovalSteps([{ stepNumber: 1, requirementType: "specific_user" }]);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedDocumentId || !title.trim()) {
        toast.error("Please select a document and enter a title");
        return;
      }
    }
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleAddApprovalStep = () => {
    const nextStepNumber = Math.max(...approvalSteps.map((s) => s.stepNumber)) + 1;
    setApprovalSteps([
      ...approvalSteps,
      { stepNumber: nextStepNumber, requirementType: "specific_user" },
    ]);
  };

  const handleRemoveApprovalStep = (stepNumber: number) => {
    if (approvalSteps.length > 1) {
      setApprovalSteps(approvalSteps.filter((s) => s.stepNumber !== stepNumber));
    }
  };

  const handleApprovalStepChange = (
    stepNumber: number,
    field: keyof ApprovalStep,
    value: any
  ) => {
    setApprovalSteps(
      approvalSteps.map((s) =>
        s.stepNumber === stepNumber ? { ...s, [field]: value } : s
      )
    );
  };

  const handleCreate = () => {
    // Validate approval steps
    const invalidStep = approvalSteps.find((step) => {
      if (step.requirementType === "specific_user" && !step.approverUserId) {
        return true;
      }
      if (
        (step.requirementType === "any_with_role" ||
          step.requirementType === "all_with_role") &&
        !step.approverRole
      ) {
        return true;
      }
      return false;
    });

    if (invalidStep) {
      toast.error("All approval steps must have valid approvers");
      return;
    }

    createWorkflowMutation.mutate({
      documentId: selectedDocumentId,
      workflowType,
      title,
      description: description || undefined,
      priority,
      dueDate: dueDate?.toISOString(),
      approvalSteps: approvalSteps.map((s) => ({
        stepNumber: s.stepNumber,
        approverUserId: s.approverUserId,
        approverRole: s.approverRole,
        requirementType: s.requirementType,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Workflow - Step {step} of 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "Select document and workflow details"}
            {step === 2 && "Set priority and due date"}
            {step === 3 && "Configure approval steps"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="document">Document *</Label>
                <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                  <SelectTrigger id="document">
                    <SelectValue placeholder="Select a document" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents?.map((doc: any) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workflowType">Workflow Type *</Label>
                <Select value={workflowType} onValueChange={(value: any) => setWorkflowType(value)}>
                  <SelectTrigger id="workflowType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rfi">RFI (Request for Information)</SelectItem>
                    <SelectItem value="submittal">Submittal</SelectItem>
                    <SelectItem value="transmittal">Transmittal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter workflow title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 2: Priority and Due Date */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <RadioGroup value={priority} onValueChange={(value: any) => setPriority(value)}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="low" id="low" />
                      <Label htmlFor="low" className="font-normal cursor-pointer">
                        Low
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="font-normal cursor-pointer">
                        Medium
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="high" id="high" />
                      <Label htmlFor="high" className="font-normal cursor-pointer">
                        High
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="urgent" id="urgent" />
                      <Label htmlFor="urgent" className="font-normal cursor-pointer">
                        Urgent
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "No due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Step 3: Approval Steps */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Approval Steps *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddApprovalStep}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-4">
                {approvalSteps.map((approvalStep, index) => (
                  <div key={approvalStep.stepNumber} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Step {index + 1}</Badge>
                      {approvalSteps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveApprovalStep(approvalStep.stepNumber)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Requirement Type</Label>
                      <Select
                        value={approvalStep.requirementType}
                        onValueChange={(value: any) =>
                          handleApprovalStepChange(approvalStep.stepNumber, "requirementType", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="specific_user">Specific User</SelectItem>
                          <SelectItem value="any_with_role">Any with Role</SelectItem>
                          <SelectItem value="all_with_role">All with Role</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {approvalStep.requirementType === "specific_user" && (
                      <div className="space-y-2">
                        <Label>Select User</Label>
                        <Select
                          value={approvalStep.approverUserId}
                          onValueChange={(value) =>
                            handleApprovalStepChange(approvalStep.stepNumber, "approverUserId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users?.map((user: any) => (
                              <SelectItem key={user.clerkUserId} value={user.clerkUserId}>
                                {user.firstName} {user.lastName} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {(approvalStep.requirementType === "any_with_role" ||
                      approvalStep.requirementType === "all_with_role") && (
                      <div className="space-y-2">
                        <Label>Select Role</Label>
                        <Select
                          value={approvalStep.approverRole}
                          onValueChange={(value) =>
                            handleApprovalStepChange(approvalStep.stepNumber, "approverRole", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="project_manager">Project Manager</SelectItem>
                            <SelectItem value="superintendent">Superintendent</SelectItem>
                            <SelectItem value="foreman">Foreman</SelectItem>
                            <SelectItem value="project_engineer">Project Engineer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {step < 3 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={createWorkflowMutation.isLoading}
              >
                {createWorkflowMutation.isLoading ? "Creating..." : "Create Workflow"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
