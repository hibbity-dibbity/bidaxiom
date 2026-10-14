"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceStatusBadge, dollars, shortDate } from "@/components/invoices/invoice-ui";

export default function InvoicesPage({ params }: { params: { projectSlug: string } }) {
  const { projectSlug } = params;
  const utils = trpc.useUtils();
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id ?? "";
  const { data, isLoading } = trpc.invoice.list.useQuery({ projectId }, { enabled: !!projectId });
  const { data: active } = trpc.proposal.activeForProject.useQuery({ projectId }, { enabled: !!projectId });
  const create = trpc.proposal.createInvoices.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.created} draft invoices created`);
      utils.invoice.list.invalidate();
    },
    onError: (e) => toast.error("Could not create the invoices", { description: e.message }),
  });

  const [picked, setPicked] = React.useState<string[]>([]);
  const merge = trpc.invoice.merge.useMutation({
    onSuccess: (r) => {
      toast.success(`Merged into ${r.number}`, { description: r.removed.length ? `${r.removed.join(", ")} folded into it.` : undefined });
      setPicked([]);
      utils.invoice.list.invalidate();
    },
    onError: (e) => toast.error("Could not merge", { description: e.message }),
  });
  const record = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Marked paid");
      utils.invoice.list.invalidate();
    },
    onError: (e) => toast.error("Could not record the payment", { description: e.message }),
  });
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  if (!project) return null;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="One draft invoice is created for each milestone in the invoicing schedule when a proposal is accepted. Send each one yourself when it is due. Sending sets the date sent and the due date."
      />

      {isLoading || !projectId ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="space-y-3 rounded-md border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {active?.accepted ? (
            <>
              <p>This accepted proposal has no invoices yet.</p>
              <Button type="button" disabled={create.isPending} onClick={() => create.mutate({ estimateId: active.estimateId })}>
                Create draft invoices from the schedule
              </Button>
            </>
          ) : (
            <p>Invoices are created when a proposal is accepted.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Contract value", dollars(data!.total)],
              ["Billed", dollars(data!.billed)],
              ["Collected", dollars(data!.collected)],
              ["Outstanding", dollars(data!.outstanding)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border bg-background px-3 py-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="text-lg font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          {rows.some((r) => r.status === "draft") && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button type="button" size="sm" variant="outline" disabled={picked.length < 2 || merge.isPending} onClick={() => merge.mutate({ invoiceIds: picked })}>
                Merge selected{picked.length > 0 ? ` (${picked.length})` : ""}
              </Button>
              <span className="text-muted-foreground">
                Tick two or more unsent invoices to combine them into one. The lowest invoice number is kept and each milestone is listed on it.
              </span>
            </div>
          )}
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Milestone</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2 text-right">Received</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {r.status === "draft" && (
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`Select ${r.number} to merge`}
                          checked={picked.includes(r.id)}
                          onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      <Link href={`/projects/${projectSlug}/invoices/${r.id}`} className="hover:underline">
                        {r.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {r.itemCount > 0 ? r.milestoneName : <>{r.milestoneName} <span className="text-muted-foreground">({r.percent}%)</span></>}
                      {r.itemCount === 0 && r.isChangeOrder && <div className="text-xs text-muted-foreground">{r.source}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{dollars(r.amount)}</td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={r.status} overdue={r.overdue} />
                    </td>
                    <td className="px-3 py-2">{shortDate(r.sentOn)}</td>
                    <td className="px-3 py-2">{shortDate(r.dueOn)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.status === "draft" ? "—" : dollars(r.received)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.outstanding === null ? "—" : dollars(r.outstanding)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {r.status === "draft" ? (
                        <Link href={`/projects/${projectSlug}/invoices/${r.id}`} className="text-xs text-muted-foreground hover:underline">
                          Open to send
                        </Link>
                      ) : r.status === "paid" ? null : (
                        <span className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/projects/${projectSlug}/invoices/${r.id}#payments`}>Partial payment</Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={record.isPending}
                            onClick={() => {
                              if (window.confirm(`Mark ${r.number} paid in full (${dollars(r.outstanding ?? 0)}) as of today?`))
                                record.mutate({ invoiceId: r.id, amount: r.outstanding ?? 0, receivedAt: todayStr, reference: null });
                            }}
                          >
                            Mark paid
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Drafts are not counted as billed until you send them. Sent invoices are locked. If the contract value changes later, only invoices not yet sent are re-amounted.
          </p>
        </>
      )}
    </div>
  );
}
