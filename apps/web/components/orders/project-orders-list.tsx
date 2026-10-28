"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ListToolbar, ListActions } from "@/components/shared/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { OrderCard } from "./order-card";
import { dollars, signed } from "./order-ui";
import { Plus } from "lucide-react";

/**
 * Purchase Orders or Work Orders tab of a project: review the drafts created at acceptance, pick
 * vendors, split, move and merge lines, issue, revise, and open an order for details and payments.
 */
export function ProjectOrdersList({ projectSlug, kind }: { projectSlug: string; kind: "purchase" | "work" }) {
  const router = useRouter();
  const isWork = kind === "work";
  const noun = isWork ? "WO" : "PO";
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id ?? "";
  const utils = trpc.useUtils();
  const { data: orders, isLoading } = trpc.order.listCards.useQuery({ projectId, kind }, { enabled: !!projectId });
  const { data: vendors } = trpc.order.vendorOptions.useQuery();
  const [picked, setPicked] = React.useState<Record<string, string[]>>({});

  const refresh = () => {
    utils.order.listCards.invalidate();
    utils.order.projectSummary.invalidate();
  };
  const fail = (title: string) => (e: { message: string }) => toast.error(title, { description: e.message });
  const create = trpc.order.createManual.useMutation({
    onSuccess: (r) => {
      refresh();
      router.push(`/projects/${projectSlug}/orders/${r.id}`);
    },
    onError: fail("Could not create the order"),
  });
  const update = trpc.order.update.useMutation({ onSuccess: refresh, onError: fail("Could not update the order") });
  const updateLine = trpc.order.updateLine.useMutation({ onSuccess: refresh, onError: fail("Could not update the line") });
  const move = trpc.order.moveLines.useMutation({
    onSuccess: (r) => {
      toast.success(`Moved to ${r.number}`);
      setPicked({});
      refresh();
    },
    onError: fail("Could not move the lines"),
  });
  const merge = trpc.order.merge.useMutation({
    onSuccess: () => {
      toast.success("Orders merged");
      setPicked({});
      refresh();
    },
    onError: fail("Could not merge"),
  });
  const markPaid = trpc.order.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Marked paid");
      refresh();
      utils.order.listForProject.invalidate();
    },
    onError: fail("Could not record the payment"),
  });
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const issue = trpc.order.issue.useMutation({
    onSuccess: () => {
      toast.success("Order issued");
      refresh();
    },
    onError: fail("Could not issue"),
  });
  const revise = trpc.order.revise.useMutation({
    onSuccess: (r) => {
      toast.success(`Reopened as Rev ${r.revision} draft`);
      refresh();
    },
    onError: fail("Could not revise"),
  });

  const list = orders ?? [];
  const budget = list.reduce((a, o) => a + o.budgetTotal, 0);
  const projected = list.reduce((a, o) => a + o.projectedTotal, 0);
  const paid = list.reduce((a, o) => a + o.paid, 0);
  const outstanding = list.reduce((a, o) => a + (o.outstanding ?? 0), 0);
  const drafts = list.filter((o) => o.status === "draft");
  const needVendor = drafts.filter((o) => !o.vendorId).length;
  const busy = update.isPending || move.isPending || merge.isPending || issue.isPending || revise.isPending;
  // Drafts first so the work to do is at the top, then issued orders by number.
  const sorted = [...list].sort((a, b) => Number(a.status !== "draft") - Number(b.status !== "draft") || a.number.localeCompare(b.number));

  return (
    <div className="space-y-6">
      <PageHeader
        title={isWork ? "Work Orders" : "Purchase Orders"}
        description={
          isWork
            ? "Labor and subcontract scope, one order per subcontractor. Drafts are created from the accepted proposal. Pick the subcontractor, split lines if needed, then issue. Each lists the scope you send to confirm it matches yours."
            : "Materials and equipment, one order per vendor. Drafts are created from the accepted proposal. Pick the vendor, split lines if needed, then issue."
        }
      />
      <ListToolbar actions={<ListActions addDisabled={!projectId || create.isPending} onAdd={() => create.mutate({ projectId, kind })} />} />

      {isLoading || !projectId ? (
        <Skeleton className="h-40 w-full" />
      ) : list.length === 0 ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No {isWork ? "work" : "purchase"} orders yet. They are created when a proposal is accepted, or add one by hand.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              ["Cost budget", dollars(budget)],
              ["Projected cost", dollars(projected)],
              ["Projected vs budget", signed(projected - budget)],
              ["Paid", dollars(paid)],
              ["Outstanding", dollars(outstanding)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border bg-background px-3 py-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="font-mono text-lg font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          {drafts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {drafts.length} draft{drafts.length > 1 ? "s" : ""} to review{needVendor > 0 ? `, ${needVendor} need a vendor before issuing` : ""}. Drafts are not counted as outstanding until issued.
            </p>
          )}

          <div className="space-y-3">
            {sorted.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                noun={noun}
                projectSlug={projectSlug}
                siblings={sorted.filter((r) => r.id !== o.id && r.status === "draft")}
                vendors={vendors ?? []}
                selected={picked[o.id] ?? []}
                setSelected={(ids) => setPicked((p) => ({ ...p, [o.id]: ids }))}
                busy={busy}
                onVendor={(vendorId) => update.mutate({ orderId: o.id, vendorId })}
                onProjected={(lineId, v) => updateLine.mutate({ lineId, projectedCost: v })}
                onExclusions={(lineId, v) => updateLine.mutate({ lineId, exclusions: v })}
                onSplit={(ids) => move.mutate({ lineIds: ids })}
                onMoveTo={(ids, toOrderId) => move.mutate({ lineIds: ids, toOrderId })}
                onMerge={(intoOrderId) => merge.mutate({ fromOrderId: o.id, intoOrderId })}
                onIssue={() => issue.mutate({ orderId: o.id })}
                onRevise={() => revise.mutate({ orderId: o.id })}
                onMarkPaid={() => {
                  if (window.confirm(`Mark ${o.number} paid in full (${dollars(o.outstanding ?? 0)}) as of today?`))
                    markPaid.mutate({ orderId: o.id, amount: o.outstanding ?? 0, paidAt: todayStr, reference: null });
                }}
              />
            ))}
          </div>
        </>
      )}
      <p className="max-w-3xl text-sm text-muted-foreground">
        An insurance warning on a work order does not stop you from issuing it. Issued orders are locked. To change one, revise it: it reopens as a draft with the next revision, the earlier revision is kept, and a line moved to another vendor appears on a new order. Projected cost is what you expect to pay, for example from a vendor&apos;s quote. Budget is the cost on the proposal and never changes. {isWork ? "A work order" : "A PO"} added by hand has no link to the proposal and no customer charge.
      </p>
    </div>
  );
}
