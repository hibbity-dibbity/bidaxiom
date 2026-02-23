"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { NumericFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Award } from "lucide-react";
import type { LevelingCategory } from "@construction/shared";

interface BidComparisonTableProps {
  rfqId: string;
  projectId: string;        // For tRPC queries
  projectSlug: string;      // For navigation
}

const levelingCategories: Record<LevelingCategory, { label: string; variant: "rejected" | "approved" | "pending" | "warning" }> = {
  scope_gap: { label: "Scope Gap", variant: "rejected" },
  scope_extra: { label: "Scope Extra", variant: "approved" },
  clarification: { label: "Clarification", variant: "pending" },
  risk: { label: "Risk", variant: "warning" },
};

export function BidComparisonTable({ rfqId, projectId, projectSlug }: BidComparisonTableProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [expandedBids, setExpandedBids] = useState<Set<string>>(new Set());
  const [levelingDialogOpen, setLevelingDialogOpen] = useState(false);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [selectedBidId, setSelectedBidId] = useState<string | null>(null);
  const [levelingCategory, setLevelingCategory] = useState<LevelingCategory>("scope_gap");
  const [levelingNote, setLevelingNote] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [convertToCommitment, setConvertToCommitment] = useState(true);
  const [commitmentDescription, setCommitmentDescription] = useState("");

  const { data: comparison, isLoading } = trpc.bid.compare.useQuery({ rfqId });

  const addLevelingNoteMutation = trpc.bid.addLevelingNote.useMutation({
    onSuccess: () => {
      utils.bid.compare.invalidate({ rfqId });
      toast.success("Leveling note added");
      setLevelingDialogOpen(false);
      setLevelingNote("");
      setAdjustmentAmount(0);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add leveling note");
    },
  });

  const awardBidMutation = trpc.bid.award.useMutation({
    onSuccess: () => {
      utils.bid.compare.invalidate({ rfqId });
      utils.rfq.getById.invalidate({ id: rfqId });
      toast.success("Bid awarded successfully");
      setAwardDialogOpen(false);
      router.push(`/projects/${projectSlug}/rfqs/${rfqId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to award bid");
    },
  });

  const toggleExpanded = (bidId: string) => {
    const newExpanded = new Set(expandedBids);
    if (newExpanded.has(bidId)) {
      newExpanded.delete(bidId);
    } else {
      newExpanded.add(bidId);
    }
    setExpandedBids(newExpanded);
  };

  const handleAddLevelingNote = (bidId: string) => {
    setSelectedBidId(bidId);
    setLevelingDialogOpen(true);
  };

  const handleAward = (bidId: string, companyName: string) => {
    setSelectedBidId(bidId);
    setCommitmentDescription(`Award from RFQ to ${companyName}`);
    setAwardDialogOpen(true);
  };

  const submitLevelingNote = () => {
    if (!selectedBidId || !levelingNote.trim()) {
      toast.error("Note is required");
      return;
    }
    addLevelingNoteMutation.mutate({
      rfqId,
      bidId: selectedBidId,
      category: levelingCategory,
      note: levelingNote.trim(),
      adjustmentAmount: adjustmentAmount === 0 ? undefined : adjustmentAmount,
    });
  };

  const submitAward = () => {
    if (!selectedBidId) return;
    awardBidMutation.mutate({
      bidId: selectedBidId,
      convertToCommitment,
      commitmentDescription: commitmentDescription.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!comparison || comparison.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No bids to compare</p>
      </Card>
    );
  }

  // Find lowest leveled amount
  const lowestLeveledAmount = Math.min(...comparison.map((b) => b.leveledAmount));

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Comparison</TableHead>
              {comparison.map((bid) => (
                <TableHead key={bid.bidId} className="text-center min-w-[250px]">
                  <div className="space-y-1">
                    <div className="font-semibold">{bid.bidderCompanyName}</div>
                    <StatusBadge
                      variant={bid.status === "awarded" ? "approved" : "draft"}
                    >
                      {bid.status.replace("_", " ")}
                    </StatusBadge>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Original Amount */}
            <TableRow>
              <TableCell className="font-medium">Original Amount</TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-center">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(bid.totalAmount)}
                </TableCell>
              ))}
            </TableRow>

            {/* Leveling Adjustments */}
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  Leveling Adjustments
                  <span className="text-xs text-muted-foreground">
                    ({comparison.reduce((sum, b) => sum + b.levelingNotes.length, 0)} notes)
                  </span>
                </div>
              </TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-center">
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        signDisplay: "always",
                      }).format(
                        bid.levelingNotes.reduce(
                          (sum, note) => sum + (note.adjustmentAmount || 0),
                          0
                        )
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(bid.bidId)}
                    >
                      {expandedBids.has(bid.bidId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {bid.levelingNotes.length} notes
                    </Button>
                  </div>
                </TableCell>
              ))}
            </TableRow>

            {/* Expanded Leveling Notes */}
            {comparison.some((bid) => expandedBids.has(bid.bidId)) && (
              <TableRow>
                <TableCell colSpan={comparison.length + 1} className="bg-muted/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {comparison
                      .filter((bid) => expandedBids.has(bid.bidId))
                      .map((bid) => (
                        <div key={bid.bidId} className="space-y-2">
                          <h4 className="font-semibold">{bid.bidderCompanyName}</h4>
                          {bid.levelingNotes.length > 0 ? (
                            bid.levelingNotes.map((note, idx) => (
                              <Card key={idx} className="p-3 text-sm">
                                <StatusBadge variant={levelingCategories[note.category].variant}>
                                  {levelingCategories[note.category].label}
                                </StatusBadge>
                                <p className="mt-2">{note.note}</p>
                                {note.adjustmentAmount && (
                                  <p className="font-semibold mt-1">
                                    {new Intl.NumberFormat("en-US", {
                                      style: "currency",
                                      currency: "USD",
                                      signDisplay: "always",
                                    }).format(note.adjustmentAmount)}
                                  </p>
                                )}
                              </Card>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No notes</p>
                          )}
                        </div>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Leveled Amount */}
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Leveled Amount</TableCell>
              {comparison.map((bid) => (
                <TableCell
                  key={bid.bidId}
                  className={`text-center text-lg ${
                    bid.leveledAmount === lowestLeveledAmount
                      ? "bg-muted/50 text-financial-positive font-bold"
                      : ""
                  }`}
                >
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(bid.leveledAmount)}
                </TableCell>
              ))}
            </TableRow>

            {/* Scope Notes */}
            <TableRow>
              <TableCell className="font-medium">Scope Notes</TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-sm">
                  {bid.scopeNotes || "—"}
                </TableCell>
              ))}
            </TableRow>

            {/* Exclusions */}
            <TableRow>
              <TableCell className="font-medium">Exclusions</TableCell>
              {comparison.map((bid) => (
                <TableCell
                  key={bid.bidId}
                  className={`text-sm ${bid.exclusions ? "text-financial-negative" : ""}`}
                >
                  {bid.exclusions || "—"}
                </TableCell>
              ))}
            </TableRow>

            {/* Inclusions */}
            <TableRow>
              <TableCell className="font-medium">Inclusions</TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-sm">
                  {bid.inclusions || "—"}
                </TableCell>
              ))}
            </TableRow>

            {/* Line Items */}
            <TableRow>
              <TableCell className="font-medium">Line Items</TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-sm">
                  <details className="cursor-pointer">
                    <summary className="text-primary hover:underline">
                      {bid.lineItems.length} items
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {bid.lineItems.map((item, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{item.description}</span>
                          <span className="font-mono">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </TableCell>
              ))}
            </TableRow>

            {/* Actions */}
            <TableRow>
              <TableCell className="font-medium">Actions</TableCell>
              {comparison.map((bid) => (
                <TableCell key={bid.bidId} className="text-center space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddLevelingNote(bid.bidId)}
                    disabled={bid.status === "awarded"}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                  {bid.status !== "awarded" && bid.status !== "rejected" && (
                    <Button
                      size="sm"
                      onClick={() => handleAward(bid.bidId, bid.bidderCompanyName)}
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Award
                    </Button>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Leveling Note Dialog */}
      <Dialog open={levelingDialogOpen} onOpenChange={setLevelingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Leveling Note</DialogTitle>
            <DialogDescription>
              Add a note to adjust the bid for comparison purposes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={levelingCategory}
                onValueChange={(value) => setLevelingCategory(value as LevelingCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(levelingCategories).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leveling-note">Note *</Label>
              <Textarea
                id="leveling-note"
                value={levelingNote}
                onChange={(e) => setLevelingNote(e.target.value)}
                placeholder="Explain the adjustment..."
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment">Adjustment Amount (optional)</Label>
              <NumericFormat
                id="adjustment"
                value={adjustmentAmount === 0 ? "" : adjustmentAmount}
                prefix="$"
                thousandSeparator
                decimalScale={2}
                allowNegative
                customInput={Input}
                onValueChange={(values) => setAdjustmentAmount(values.floatValue ?? 0)}
              />
              <p className="text-xs text-muted-foreground">
                Positive = increase cost, Negative = decrease cost
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelingDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitLevelingNote}
              disabled={addLevelingNoteMutation.isPending}
            >
              {addLevelingNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award Dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Bid</DialogTitle>
            <DialogDescription>
              Award this bid and optionally convert to a budget commitment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="convert"
                checked={convertToCommitment}
                onCheckedChange={(checked) => setConvertToCommitment(!!checked)}
              />
              <Label htmlFor="convert" className="cursor-pointer">
                Convert to budget commitment
              </Label>
            </div>

            {convertToCommitment && (
              <div className="space-y-2">
                <Label htmlFor="commitment-description">
                  Commitment Description (optional)
                </Label>
                <Input
                  id="commitment-description"
                  value={commitmentDescription}
                  onChange={(e) => setCommitmentDescription(e.target.value)}
                  placeholder="Description for the commitment..."
                />
              </div>
            )}

            <div className="bg-muted border border-border rounded p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Awarding this bid will set its status to
                "awarded" and reject all other bids for this RFQ.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitAward}
              disabled={awardBidMutation.isPending}
            >
              {awardBidMutation.isPending ? "Awarding..." : "Confirm Award"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
