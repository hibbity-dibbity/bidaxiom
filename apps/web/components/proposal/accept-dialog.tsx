"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyAcceptance,
  computeSchedule,
  generateDraftOrders,
  linesMissingCostCode,
  type ProposalResult,
} from "@construction/shared";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

interface AcceptLine {
  id: string;
  parentId: string | null;
  name: string;
  type: "labor" | "material" | "subcontractor" | "equipment" | "other";
  costCodeId: number | null;
  vendorId: string | null;
  isOptional: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  lines: AcceptLine[];
  computed: ProposalResult;
  milestones: Array<{ id: string; name: string; percent: number }>;
  onAccepted: () => void;
}

/** Ask which optional items the customer took, show what that does to the contract, then accept. */
export function AcceptDialog({ open, onOpenChange, estimateId, lines, computed, milestones, onAccepted }: Props) {
  const [chosen, setChosen] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (open) setChosen([]);
  }, [open]);

  const accept = trpc.proposal.accept.useMutation({
    onSuccess: (r) => {
      toast.success(`Accepted. Contract value ${money(r.contractValue)}, ${r.orders.length} draft orders created.`);
      onOpenChange(false);
      onAccepted();
    },
    onError: (e) => toast.error("Could not mark accepted", { description: e.message }),
  });

  const nameOf = new Map(lines.map((l) => [l.id, l.name]));
  const acceptance = applyAcceptance(computed, chosen);
  const schedule = computeSchedule(acceptance.contractValue, milestones);
  const missing = linesMissingCostCode(lines, computed, chosen);
  const draftCount = generateDraftOrders(lines, computed, chosen).length;

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mark proposal accepted</DialogTitle>
          <DialogDescription>
            Choose the optional items the customer accepted. Accepting locks this proposal, sets the contract value and invoicing amounts,
            and creates draft purchase orders and work orders.
          </DialogDescription>
        </DialogHeader>

        {computed.options.length > 0 ? (
          <div className="flex flex-col divide-y rounded-md border">
            {computed.options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={chosen.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                <span className="flex-1 font-medium">{nameOf.get(o.id)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {money(o.price)}
                  {o.tax > 0 ? ` + ${money(o.tax)} tax` : ""}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This proposal has no optional items.</p>
        )}

        <div className="flex flex-col gap-1.5 rounded-md bg-muted p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Proposal total</span>
            <span className="tabular-nums">{money(computed.totals.total)}</span>
          </div>
          <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
            <span>Contract value</span>
            <span className="tabular-nums">{money(acceptance.contractValue)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cost budget</span>
            <span className="tabular-nums">{money(acceptance.costBudget)}</span>
          </div>
          <div className="mt-1 text-muted-foreground">
            Invoicing:{" "}
            {schedule.map((m, i) => `${milestones[i].name} ${money(m.amount)}`).join(" · ")}
          </div>
          <div className="text-muted-foreground">{draftCount} draft orders will be created.</div>
        </div>

        {missing.length > 0 && (
          <div className="rounded-md border border-financial-pending/40 px-3 py-2 text-sm">
            <strong>Cost codes needed.</strong> Pick a cost code in the builder for: {missing.slice(0, 6).join(", ")}
            {missing.length > 6 ? ` and ${missing.length - 6} more` : ""}. Lines of type Other do not need one.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={missing.length > 0 || accept.isPending}
            onClick={() => accept.mutate({ estimateId, acceptedOptionIds: chosen })}
          >
            {accept.isPending ? "Accepting…" : "Mark accepted"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
