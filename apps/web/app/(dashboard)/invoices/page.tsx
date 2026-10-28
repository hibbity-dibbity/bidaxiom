"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar, ListActions, SearchField, FilterSelect } from "@/components/shared/list-toolbar";
import { downloadCsv } from "@/lib/csv";
import { EmptyState } from "@/components/shared/empty-state";
import { InvoiceStatusBadge, dollars, shortDate } from "@/components/invoices/invoice-ui";

type Filter = "all" | "draft" | "open" | "overdue" | "paid";

/** Every invoice in the company in one place: type a number, project, job number or customer to jump to it. */
export default function InvoicesPage() {
  const { orgRole } = useAuth();
  const allowed = !orgRole || ["org:admin", "org:project_manager", "org:accountant", "org:estimator"].includes(orgRole);
  const { data, isLoading, error } = trpc.invoice.listAll.useQuery(undefined, { refetchOnWindowFocus: true, enabled: allowed, retry: false });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filter === "draft" && r.status !== "draft") return false;
      if (filter === "open" && !(r.status === "sent" || r.status === "partially_paid")) return false;
      if (filter === "overdue" && !r.overdue) return false;
      if (filter === "paid" && r.status !== "paid") return false;
      if (!q) return true;
      return [r.number, r.projectName, r.jobNumber, r.customerName, r.milestoneName].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const showQbo = (data ?? []).some((r) => r.qbo !== null);
  const open = rows.reduce((a, r) => a + (r.outstanding ?? 0), 0);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Invoices" description="Your role cannot view this page." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="All invoices across your projects." />
      <ListToolbar activeCount={(search.trim() ? 1 : 0) + (filter !== "all" ? 1 : 0)} summary={data ? `${rows.length} shown · ${dollars(open)} outstanding` : undefined}
        actions={<ListActions exportDisabled={rows.length === 0} onExport={() => downloadCsv("invoices", ["Invoice", "Milestone", "Project", "Customer", "Status", "Sent", "Due", "Amount", "Outstanding"], rows.map((r) => [r.number, r.milestoneName, [r.jobNumber, r.projectName].filter(Boolean).join(" - "), r.customerName, r.overdue ? "overdue" : r.status, r.status === "draft" ? "" : shortDate(r.sentOn), r.status === "draft" ? "" : shortDate(r.dueOn), r.amount, r.outstanding]))} />}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search number, project or customer" />
        <FilterSelect
          label="Status"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "draft", label: "Draft" },
            { value: "open", label: "Open" },
            { value: "overdue", label: "Overdue" },
            { value: "paid", label: "Paid" },
          ]}
        />
      </ListToolbar>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} heading="No invoices found" description={search || filter !== "all" ? "Try a different search or filter." : "Invoices appear here once a proposal is accepted."} />
      ) : (
        <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              {showQbo && <TableHead>QuickBooks</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${r.projectSlug}/invoices/${r.id}`} className="hover:underline">{r.number}</Link>
                  <div className="text-xs font-normal text-muted-foreground">{r.milestoneName}</div>
                </TableCell>
                <TableCell>
                  <Link href={`/projects/${r.projectSlug}/invoices`} className="hover:underline">{[r.jobNumber, r.projectName].filter(Boolean).join(" - ")}</Link>
                </TableCell>
                <TableCell>{r.customerName}</TableCell>
                <TableCell><InvoiceStatusBadge status={r.status} overdue={r.overdue} amount={r.amount} /></TableCell>
                <TableCell>{r.status === "draft" ? "—" : shortDate(r.sentOn)}</TableCell>
                <TableCell>{r.status === "draft" ? "—" : shortDate(r.dueOn)}</TableCell>
                <TableCell className="text-right">{dollars(r.amount)}</TableCell>
                <TableCell className="text-right">{r.outstanding == null ? "—" : dollars(r.outstanding)}</TableCell>
                {showQbo && (
                  <TableCell>
                    {r.qbo === "synced" ? "In QuickBooks" : r.qbo === "not_sent" ? <span className="text-muted-foreground">Not sent</span> : r.qbo === "problem" ? <Link href={`/projects/${r.projectSlug}/invoices/${r.id}`} className="text-destructive hover:underline">Problem</Link> : "—"}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Card>
      )}
    </div>
  );
}
