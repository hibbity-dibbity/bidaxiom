"use client";

import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SyncState = {
  syncStatus: string;
  syncedEventCount: number;
  errorCount: number;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  lastError: string | null;
};

interface CalendarSyncStatusProps {
  syncState: SyncState | null;
}

export function CalendarSyncStatus({ syncState }: CalendarSyncStatusProps) {
  if (!syncState) {
    return (
      <div className="text-sm text-muted-foreground">
        No sync data available
      </div>
    );
  }

  const getSyncStatusBadge = () => {
    switch (syncState.syncStatus) {
      case "idle":
        return <Badge variant="outline">Idle</Badge>;
      case "syncing":
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 border-blue-300"
          >
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Syncing...
          </Badge>
        );
      case "synced":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Synced
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{syncState.syncStatus}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-3">Sync Details</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Status:</dt>
            <dd>{getSyncStatusBadge()}</dd>
          </div>

          {syncState.lastFullSyncAt && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Full Sync:</dt>
              <dd>
                {formatDistanceToNow(new Date(syncState.lastFullSyncAt), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          )}

          {syncState.lastIncrementalSyncAt && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last Incremental Sync:</dt>
              <dd>
                {formatDistanceToNow(new Date(syncState.lastIncrementalSyncAt), {
                  addSuffix: true,
                })}
              </dd>
            </div>
          )}

          <div className="flex justify-between">
            <dt className="text-muted-foreground">Events Synced:</dt>
            <dd className="font-medium">{syncState.syncedEventCount}</dd>
          </div>

          <div className="flex justify-between">
            <dt className="text-muted-foreground">Errors:</dt>
            <dd
              className={
                syncState.errorCount > 0
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              }
            >
              {syncState.errorCount}
            </dd>
          </div>
        </dl>
      </div>

      {syncState.lastError && (
        <Alert variant="destructive">
          <AlertTitle>Last Sync Error</AlertTitle>
          <AlertDescription className="text-xs">
            {syncState.lastError}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
