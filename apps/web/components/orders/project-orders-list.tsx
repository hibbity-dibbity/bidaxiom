"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { OrderStatusBadge, dollars } from "./order-ui";
import { Plus } from "lucide-react";

/** Purchase Orders or Work Orders tab of a project. */
export function ProjectOrdersList({ projectSlug, kind }: { projectSlug: string; kind: "purchase" | "work" }) {
  const router = useRouter();
  const isWork = kind === "work";
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id ?? "";
  const { data, isLoading } = trpc.order.listForProject.useQuery({ projectId, kind }, { enabled: !!projectId });
  const { data: active } = trpc.proposal.activeForProject.useQuery({ projectId }, { enabled: !!projectId });
  const utils = trpc.useUtils();
  const create = trpc.order.createManual.useMutation({
    onSuccess: (r) => {
      utils.order.listForProject.invalidate();
      utils.order.projectSummary.invalidate();
      router.push(`/projects/${projectSlug}/orders/${r.id}`);
    },
    onError: (e) => toast.error("Could not create the order", { description: e.message }),
  });

  const rows = data?.rows ?? [];
  const total = rows.reduce((a, r) => a + r.cost, 0);
  const paid = rows.reduce((a, r) => a + r.paid, 0);
  const outstanding = rows.reduce((a, r) => a + (r.outstanding ?? 0), 0);
  const hasDrafts = rows.some((r) => r.status === "draft" && r.fromProposal);
  const reviewHref = active?.accepted ? `/projects/${projectSlug}/estimates/${active.slug}/orders` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isWork ? "Work Orders" : "Purchase Orders"}
        description={
          isWork
            ? "Labor and subcontract scope, one order per subcontractor. Each lists the scope you send to confirm it matches yours."
            : "Materials and equipment, one order per vendor. Created from the proposal on acceptance."
        }
        actions={
          <>
            {reviewHref && hasDrafts && (
              <Button asChild variant="outline">
                <Link href={reviewHref}>Review drafts</Link>
              </Button>
            )}
            <Button type="button" disabled={!projectId || create.isPending} onClick={() => create.mutate({ projectId, kind })}>
              <Plus className="mr-2 h-4 w-4" />
              {isWork ? "New work order" : "New PO"}
            </Button>
          </>
        }
      />

      {isLoading || !projectId ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No {isWork ? "work" : "purchase"} orders yet. They are created when a proposal is accepted, or add one by hand.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{isWork ? "WO" : "PO"}</th>
                <th className="px-3 py-2">{isWork ? "Subcontractor" : "Vendor"}</th>
                <th className="px-3 py-2">{isWork ? "Scope lines" : "From cost lines"}</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Paid</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/projects/${projectSlug}/orders/${r.id}`} className="hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className={r.vendorName ? "px-3 py-2" : "px-3 py-2 text-financial-pending"}>{r.vendorName ?? "Assign vendor"}</td>
                  <td className="max-w-md truncate px-3 py-2 text-muted-foreground" title={r.lineSummary}>
                    {r.lineSummary || "No lines"}
                    {!r.fromProposal && <span className="ml-2 text-xs">(added by hand)</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.cost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(r.paid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.outstanding === null ? "—" : dollars(r.outstanding)}</td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={r.status} revision={r.revision} />
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td className="px-3 py-2" colSpan={3}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{dollars(total)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dollars(paid)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dollars(outstanding)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="max-w-3xl text-sm text-muted-foreground">
        Cost is the projected cost. Outstanding counts issued orders only. {isWork ? "A work order" : "A PO"} added by hand appears here with no link to the proposal and no customer charge.
      </p>
    </div>
  );
}
