"use client";

import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/shared/status-badge";
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
        return <StatusBadge variant="draft">Idle</StatusBadge>;
      case "syncing":
        return (
          <StatusBadge variant="pending">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Syncing...
          </StatusBadge>
        );
      case "synced":
        return <StatusBadge variant="active">Synced</StatusBadge>;
      case "error":
        return <StatusBadge variant="error">Error</StatusBadge>;
      default:
        return <StatusBadge variant="draft">{syncState.syncStatus}</StatusBadge>;
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
