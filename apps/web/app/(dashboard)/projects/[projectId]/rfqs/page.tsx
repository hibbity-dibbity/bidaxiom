"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { RfqStatusBadge } from "@/components/bidding/rfq-status-badge";
import { Plus, ChevronLeft, FileText } from "lucide-react";
import type { RfqStatus } from "@construction/shared";

const CSI_DIVISION_MAP: Record<number, string> = {
  0: "00 - Procurement",
  1: "01 - General Requirements",
  2: "02 - Existing Conditions",
  3: "03 - Concrete",
  4: "04 - Masonry",
  5: "05 - Metals",
  6: "06 - Wood, Plastics",
  7: "07 - Thermal & Moisture",
  8: "08 - Openings",
  9: "09 - Finishes",
  10: "10 - Specialties",
  21: "21 - Fire Suppression",
  22: "22 - Plumbing",
  23: "23 - HVAC",
  26: "26 - Electrical",
  27: "27 - Communications",
  28: "28 - Security",
  31: "31 - Earthwork",
  32: "32 - Exterior Improvements",
  33: "33 - Utilities",
};

export default function RfqsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [statusFilter, setStatusFilter] = useState<RfqStatus | "all">("all");

  const { data: rfqs, isLoading } = trpc.rfq.list.useQuery({ projectId });
  const { data: project } = trpc.project.getById.useQuery({ id: projectId });

  const filteredRfqs =
    statusFilter === "all"
      ? rfqs
      : rfqs?.filter((rfq) => rfq.status === statusFilter);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Requests for Quotation</h1>
          {project && (
            <p className="text-muted-foreground mt-1">{project.name}</p>
          )}
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/rfqs/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New RFQ
          </Link>
        </Button>
      </div>

      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as RfqStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="awarded">Awarded</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredRfqs && filteredRfqs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RFQ #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Bids</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRfqs.map((rfq) => (
                  <TableRow
                    key={rfq.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      (window.location.href = `/projects/${projectId}/rfqs/${rfq.id}`)
                    }
                  >
                    <TableCell className="font-mono font-medium">
                      {rfq.rfqNumber}
                    </TableCell>
                    <TableCell className="font-medium">{rfq.title}</TableCell>
                    <TableCell>
                      <RfqStatusBadge status={rfq.status as RfqStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rfq.trades as number[]).slice(0, 3).map((trade) => (
                          <span
                            key={trade}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {CSI_DIVISION_MAP[trade] || `CSI ${trade}`}
                          </span>
                        ))}
                        {(rfq.trades as number[]).length > 3 && (
                          <span className="text-xs text-muted-foreground px-2 py-1">
                            +{(rfq.trades as number[]).length - 3} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(rfq.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{rfq.bidCount || 0}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(rfq.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No RFQs Found</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              {statusFilter === "all"
                ? "Get started by creating your first RFQ"
                : `No RFQs with status "${statusFilter}"`}
            </p>
            {statusFilter === "all" && (
              <Button asChild>
                <Link href={`/projects/${projectId}/rfqs/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create RFQ
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
