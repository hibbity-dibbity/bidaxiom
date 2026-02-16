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
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/hooks/use-toast";
import type { ButtonProps } from "@/components/ui/button";

interface GenerateBidButtonProps {
  estimateId: string;
  onSuccess?: () => void;
  variant?: ButtonProps["variant"];
}

export function GenerateBidButton({ estimateId, onSuccess, variant = "outline" }: GenerateBidButtonProps) {
  const [open, setOpen] = useState(false);
  const [bidName, setBidName] = useState("");
  const { toast } = useToast();

  const generateBid = trpc.estimates.generateBid.useMutation({
    onSuccess: () => {
      toast({
        title: "Bid generated",
        description: "Your bid has been created successfully.",
      });
      setOpen(false);
      setBidName("");
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
