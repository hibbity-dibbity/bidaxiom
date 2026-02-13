"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Calendar } from "lucide-react";

interface AmendmentTimelineProps {
  rfqId: string;
  rfqStatus: string;
  amendments: Array<{
    id: string;
    amendmentNumber: number;
    description: string;
    scopeChanges?: string | null;
    dueDateChange?: string | null;
    createdAt: string;
    createdBy: string;
  }>;
}

export function AmendmentTimeline({
  rfqId,
  rfqStatus,
  amendments,
}: AmendmentTimelineProps) {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [scopeChanges, setScopeChanges] = useState("");
  const [dueDateChange, setDueDateChange] = useState("");

  const createAmendmentMutation = trpc.rfq.createAmendment.useMutation({
    onSuccess: () => {
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("Amendment created");
      setShowForm(false);
      setDescription("");
      setScopeChanges("");
      setDueDateChange("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create amendment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    createAmendmentMutation.mutate({
      rfqId,
      description: description.trim(),
      scopeChanges: scopeChanges.trim() || undefined,
      dueDateChange: dueDateChange ? new Date(dueDateChange).toISOString() : undefined,
    });
  };

  if (rfqStatus !== "issued") {
    return null;
  }

  return (
    <div className="space-y-4">
      {!showForm ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Amendment
        </Button>
      ) : (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the amendment..."
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scopeChanges">Scope Changes</Label>
              <Textarea
                id="scopeChanges"
                value={scopeChanges}
                onChange={(e) => setScopeChanges(e.target.value)}
                placeholder="Optional scope modifications..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDateChange">New Due Date</Label>
              <div className="flex gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground mt-2" />
                <Input
                  id="dueDateChange"
                  type="datetime-local"
                  value={dueDateChange}
                  onChange={(e) => setDueDateChange(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setDescription("");
                  setScopeChanges("");
                  setDueDateChange("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createAmendmentMutation.isPending}
              >
                {createAmendmentMutation.isPending ? "Creating..." : "Create Amendment"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {amendments.length > 0 ? (
        <div className="space-y-3">
          {amendments
            .sort((a, b) => b.amendmentNumber - a.amendmentNumber)
            .map((amendment) => (
              <Card key={amendment.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">
                      Amendment #{amendment.amendmentNumber}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {new Date(amendment.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm mb-2">{amendment.description}</p>
                {amendment.scopeChanges && (
                  <div className="text-sm mb-2">
                    <span className="font-medium">Scope Changes:</span>{" "}
                    {amendment.scopeChanges}
                  </div>
                )}
                {amendment.dueDateChange && (
                  <div className="text-sm">
                    <span className="font-medium">New Due Date:</span>{" "}
                    {new Date(amendment.dueDateChange).toLocaleString()}
                  </div>
                )}
              </Card>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No amendments yet
        </p>
      )}
    </div>
  );
}
