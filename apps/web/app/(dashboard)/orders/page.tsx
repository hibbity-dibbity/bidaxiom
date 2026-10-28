"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar, ListActions, SearchField, FilterSelect } from "@/components/shared/list-toolbar";
import { downloadCsv } from "@/lib/csv";
import { EmptyState } from "@/components/shared/empty-state";
import { OrderStatusBadge, dollars } from "@/components/orders/order-ui";

type Filter = "all" | "purchase" | "work" | "draft" | "owed";

/** Every purchase and work order in the company: type a number, vendor, project or job to jump to it. */
export default function OrdersPage() {
  const { orgRole } = useAuth();
  const allowed = !orgRole || ["org:admin", "org:project_manager", "org:accountant", "org:estimator"].includes(orgRole);
  const { data, isLoading, error } = trpc.order.listAll.useQuery(undefined, { refetchOnWindowFocus: true, enabled: allowed, retry: false });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (filter === "purchase" && r.kind !== "purchase") return false;
      if (filter === "work" && r.kind !== "work") return false;
      if (filter === "draft" && r.status !== "draft") return false;
      if (filter === "owed" && !((r.outstanding ?? 0) > 0)) return false;
      if (!q) return true;
      return [r.number, r.vendorName, r.projectName, r.jobNumber].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const owed = rows.reduce((a, r) => a + (r.outstanding ?? 0), 0);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Purchase & Work Orders" description="Your role cannot view this page." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase & Work Orders" description="All purchase orders and work orders across your projects." />
      <ListToolbar activeCount={(search.trim() ? 1 : 0) + (filter !== "all" ? 1 : 0)} summary={data ? `${rows.length} shown · ${dollars(owed)} outstanding` : undefined}
        actions={<ListActions exportDisabled={rows.length === 0} onExport={() => downloadCsv("orders", ["Order", "Type", "Project", "Vendor", "Status", "Cost", "Paid", "Outstanding"], rows.map((r) => [r.number, r.kind === "work" ? "Work order" : "Purchase order", [r.jobNumber, r.projectName].filter(Boolean).join(" - "), r.vendorName, r.status, r.cost, r.paid, r.outstanding]))} />}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search number, vendor or project" />
        <FilterSelect
          label="Show"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All orders" },
            { value: "purchase", label: "Purchase orders" },
            { value: "work", label: "Work orders" },
            { value: "draft", label: "Draft" },
            { value: "owed", label: "Unpaid" },
          ]}
        />
      </ListToolbar>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShoppingCart} heading="No orders found" description={search || filter !== "all" ? "Try a different search or filter." : "Orders appear here once a proposal is accepted."} />
      ) : (
        <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${r.projectSlug}/orders/${r.id}`} className="hover:underline">{r.number}</Link>
                  <div className="text-xs font-normal text-muted-foreground">{r.kind === "work" ? "Work order" : "Purchase order"}</div>
                </TableCell>
                <TableCell>
                  <Link href={`/projects/${r.projectSlug}/${r.kind === "work" ? "work-orders" : "purchase-orders"}`} className="hover:underline">{[r.jobNumber, r.projectName].filter(Boolean).join(" - ")}</Link>
                </TableCell>
                <TableCell>{r.vendorName ?? "—"}</TableCell>
                <TableCell><OrderStatusBadge status={r.status} revision={r.revision} /></TableCell>
                <TableCell className="text-right">{dollars(r.cost)}</TableCell>
                <TableCell className="text-right">{dollars(r.paid)}</TableCell>
                <TableCell className="text-right">{r.outstanding == null ? "—" : dollars(r.outstanding)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </Card>
      )}
    </div>
  );
}
