"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SyncState = {
  entityType: string;
  syncStatus: "synced" | "syncing" | "pending" | "error" | "conflict";
  lastSuccessfulSync: Date | null;
  syncedCount: number;
  errorCount: number;
  errorMessage: string | null;
};

interface QboSyncStatusProps {
  syncStates: SyncState[];
}

export function QboSyncStatus({ syncStates }: QboSyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const utils = trpc.useUtils();

  const manualSyncMutation = trpc.quickbooks.manualSync.useMutation({
    onMutate: () => {
      setSyncing(true);
    },
    onSuccess: (data) => {
      toast.success("Sync initiated", {
        description: `${data.jobsQueued} sync jobs queued`,
      });
      // Invalidate status to show updated sync states
      utils.quickbooks.getStatus.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to start sync", {
        description: error.message,
      });
    },
    onSettled: () => {
      setSyncing(false);
    },
  });

  const cancelMutation = trpc.quickbooks.cancelSync.useMutation({
    onSuccess: (d) => {
      toast.success("Sync stopped", { description: `${d.removed} waiting job${d.removed === 1 ? "" : "s"} removed. Status reset.` });
      utils.quickbooks.getStatus.invalidate();
    },
    onError: (error) => toast.error("Could not stop the sync", { description: error.message }),
  });

  const handleSync = (entityType: "project" | "invoice" | "bill" | "all") => {
    manualSyncMutation.mutate({ entityType });
  };

  const getStatusBadge = (status: SyncState["syncStatus"]) => {
    switch (status) {
      case "synced":
        return <StatusBadge variant="active">Synced</StatusBadge>;
      case "syncing":
        return (
          <StatusBadge variant="pending">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Syncing...
          </StatusBadge>
        );
      case "pending":
        return <StatusBadge variant="pending">Pending</StatusBadge>;
      case "error":
        return <StatusBadge variant="error">Error</StatusBadge>;
      case "conflict":
        return <StatusBadge variant="warning">Conflict</StatusBadge>;
      default:
        return <StatusBadge variant="draft">{status}</StatusBadge>;
    }
  };

  const formatEntityType = (entityType: string) => {
    const mapping: Record<string, string> = {
      project: "Projects",
      invoice: "Invoices",
      bill: "Bills",
      payment: "Payments",
      vendor: "Vendors",
      customer: "Customers",
    };
    return mapping[entityType] || entityType;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sync Status</h3>
          <p className="text-sm text-muted-foreground">
            Monitor sync health for each entity type
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={syncing} size="sm">
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync Now
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSync("all")}>
              Sync All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("project")}>
              Sync Projects
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("invoice")}>
              Sync Invoices
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSync("bill")}>
              Sync Bills
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              Stop and reset status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead className="text-right">Synced Count</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {syncStates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No sync data available
                </TableCell>
              </TableRow>
            ) : (
              syncStates.map((state) => (
                <TableRow key={state.entityType}>
                  <TableCell className="font-medium">
                    {formatEntityType(state.entityType)}
                  </TableCell>
                  <TableCell>{getStatusBadge(state.syncStatus)}</TableCell>
                  <TableCell>
                    {state.lastSuccessfulSync ? (
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(state.lastSuccessfulSync), {
                          addSuffix: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {state.syncedCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {state.errorCount > 0 ? (
                      <span
                        className="text-destructive font-medium cursor-help"
                        title={state.errorMessage || "Sync errors occurred"}
                      >
                        {state.errorCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
