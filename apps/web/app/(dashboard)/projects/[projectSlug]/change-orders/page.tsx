"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { dollars, shortDate } from "@/components/invoices/invoice-ui";

const STATUS: Record<string, string> = { draft: "Draft", submitted: "Sent", accepted: "Accepted", under_contract: "Accepted" };

/** Change orders: changes to an accepted proposal, built and sent like a proposal. */
export default function ChangeOrdersPage({ params }: { params: { projectSlug: string } }) {
  const { projectSlug } = params;
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id ?? "";
  const { data, isLoading } = trpc.proposal.listChangeOrders.useQuery({ projectId }, { enabled: !!projectId });
  const [name, setName] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const create = trpc.proposal.createChangeOrder.useMutation({
    onSuccess: (r) => {
      utils.proposal.listChangeOrders.invalidate();
      router.push(`/projects/${projectSlug}/change-orders/${r.slug}`);
    },
    onError: (e) => toast.error("Could not create the change order", { description: e.message }),
  });
  const remove = trpc.proposal.deleteChangeOrder.useMutation({
    onSuccess: () => {
      toast.success("Change order deleted");
      utils.proposal.listChangeOrders.invalidate();
    },
    onError: (e) => toast.error("Could not delete", { description: e.message }),
  });

  if (!project) return null;
  const rows = data?.rows ?? [];
  const accepted = rows.filter((r) => r.status === "accepted" || r.status === "under_contract");
  const acceptedTotal = accepted.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change orders"
        description="Changes to the accepted proposal. Build one like a proposal, send it, and mark it accepted. Accepting adds its amount to the contract value, drafts its purchase orders and work orders, and drafts its invoices."
        actions={
          data?.canCreate ? (
            adding ? null : <Button onClick={() => setAdding(true)}>New change order</Button>
          ) : undefined
        }
      />

      {adding && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate({ projectId, name: name.trim() });
          }}
        >
          <input
            autoFocus
            aria-label="Change order name"
            placeholder="What is changing? e.g. Add second restroom"
            className="h-9 min-w-[280px] flex-1 rounded-md border bg-background px-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>Create</Button>
          <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      )}

      {isLoading || !projectId ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          {data?.canCreate ? "No change orders yet." : "Change orders become available once a proposal is accepted."}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Change orders", String(new Set(rows.map((r) => r.number)).size)],
              ["Accepted", String(accepted.length)],
              ["Added to contract", dollars(acceptedTotal / 100)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border bg-background px-3 py-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="text-lg font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Change order</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Accepted</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={"border-b last:border-0" + (r.superseded ? " text-muted-foreground" : "")}>
                    <td className="px-3 py-2 font-semibold">
                      <Link href={`/projects/${projectSlug}/change-orders/${r.slug}`} className="hover:underline">
                        {r.number}
                        {r.revision > 0 ? ` Rev ${r.revision}` : ""}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.superseded ? "Superseded" : STATUS[r.status] ?? r.status}</td>
                    <td className="px-3 py-2">{r.sentAt ? shortDate(new Date(r.sentAt).toISOString().slice(0, 10)) : "—"}</td>
                    <td className="px-3 py-2">{r.acceptedAt ? shortDate(new Date(r.acceptedAt).toISOString().slice(0, 10)) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{dollars(r.total / 100)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "draft" && (
                        <button
                          type="button"
                          aria-label={`Delete ${r.number}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => window.confirm(`Delete draft ${r.number}${r.revision > 0 ? ` Rev ${r.revision}` : ""}?`) && remove.mutate({ estimateId: r.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
