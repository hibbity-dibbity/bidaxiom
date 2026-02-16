"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { ButtonProps } from "@/components/ui/button";

interface GenerateBidButtonProps {
  estimateId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function GenerateBidButton({ estimateId, onSuccess, variant = "outline" }: GenerateBidButtonProps) {
  const [open, setOpen] = useState(false);
  const [bidName, setBidName] = useState("");

  const generateBid = trpc.estimates.generateBid.useMutation({
    onSuccess: () => {
      toast.success("Bid generated successfully");
      setOpen(false);
      setBidName("");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate bid");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateBid.mutate({ estimateId, bidName });
  };

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        Generate Bid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Generate Bid</DialogTitle>
              <DialogDescription>
                Create a bid from this estimate. You can submit the bid to clients after generation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bidName">Bid Name</Label>
                <Input
                  id="bidName"
                  value={bidName}
                  onChange={(e) => setBidName(e.target.value)}
                  placeholder="e.g., ABC Construction Proposal"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateBid.isPending || !bidName}>
                {generateBid.isPending ? "Generating..." : "Generate Bid"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
