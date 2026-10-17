"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
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
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Purchase & Work Orders</h1>
        <p className="text-sm text-muted-foreground">Your role cannot view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Purchase & Work Orders" description="All purchase orders and work orders across your projects." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus className="pl-8" placeholder="Search number, vendor, project or job" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="owed">Unpaid</TabsTrigger>
          </TabsList>
        </Tabs>
        {data && <span className="text-sm text-muted-foreground">{rows.length} shown · {dollars(owed)} outstanding</span>}
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShoppingCart} heading="No orders found" description={search || filter !== "all" ? "Try a different search or filter." : "Orders appear here once a proposal is accepted."} />
      ) : (
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
      )}
    </div>
  );
}
