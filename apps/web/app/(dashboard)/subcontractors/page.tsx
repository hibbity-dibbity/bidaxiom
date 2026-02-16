"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2 } from "lucide-react";
import { CSI_DIVISIONS } from "@/lib/csi-divisions";
import type { SubcontractorStatus } from "@construction/shared";

export default function SubcontractorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubcontractorStatus | "all">("all");

  const { data, isLoading } = trpc.subcontractor.list.useQuery({
    search: search || undefined,
    trade: tradeFilter ?? undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const subcontractors = data || [];

  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      active: "bg-green-500/10 text-green-500",
      inactive: "bg-gray-500/10 text-gray-500",
      blacklisted: "bg-red-500/10 text-red-500",
    };
    return statusColors[status] || "bg-gray-500/10 text-gray-500";
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      active: "Active",
      inactive: "Inactive",
      blacklisted: "Blacklisted",
    };
    return statusLabels[status] || status;
  };

  const getTradeBadges = (trades: number[]) => {
    const firstThree = trades.slice(0, 3);
    const remaining = trades.length - 3;

    return (
      <div className="flex flex-wrap gap-1">
        {firstThree.map((tradeNum) => {
          const division = CSI_DIVISIONS.find((d) => d.number === tradeNum);
          return (
            <Badge key={tradeNum} variant="outline" className="text-xs">
              {division ? `${division.number} - ${division.name}` : tradeNum}
            </Badge>
          );
        })}
        {remaining > 0 && (
          <Badge variant="outline" className="text-xs">
            +{remaining} more
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subcontractor Directory</h1>
          <p className="text-muted-foreground">
            Manage your subcontractor relationships and bid history
          </p>
        </div>
        <Button onClick={() => router.push("/subcontractors/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subcontractor
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by company name, contact, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-md"
            />

            <Select
              value={tradeFilter?.toString() || "all"}
              onValueChange={(value) => setTradeFilter(value === "all" ? null : Number(value))}
            >
              <SelectTrigger className="md:w-[300px]">
                <SelectValue placeholder="Filter by trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {CSI_DIVISIONS.map((division) => (
                  <SelectItem key={division.number} value={division.number.toString()}>
                    {division.number} - {division.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as SubcontractorStatus | "all")}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
              <TabsTrigger value="blacklisted">Blacklisted</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Subcontractors Table */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : subcontractors.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Trades</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcontractors.map((sub) => (
                <TableRow
                  key={sub.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/subcontractors/${sub.slug}`)}
                >
                  <TableCell className="font-medium">{sub.companyName}</TableCell>
                  <TableCell>{sub.contactName || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.contactEmail || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.contactPhone || "-"}
                  </TableCell>
                  <TableCell>{getTradeBadges(sub.trades)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getStatusColor(sub.status)}>
                      {getStatusLabel(sub.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="rounded-full bg-muted p-3">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No subcontractors found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first subcontractor to start building your directory
              </p>
            </div>
            <Button onClick={() => router.push("/subcontractors/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Subcontractor
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
