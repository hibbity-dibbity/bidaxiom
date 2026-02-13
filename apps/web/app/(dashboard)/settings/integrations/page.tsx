"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QboConnectionCard } from "@/components/integrations/qbo-connection-card";
import { QboSyncStatus } from "@/components/integrations/qbo-sync-status";
import { QboSyncNotifications } from "@/components/integrations/qbo-sync-notifications";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Integrations settings page.
 * Shows QuickBooks connection management and sync status.
 */
export default function IntegrationsPage() {
  const { data: status, isLoading, error } = trpc.quickbooks.getStatus.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Poll every 5 seconds for near-real-time updates
    }
  );

  // Type guard to check if status is connected
  const isConnected = (
    s: typeof status
  ): s is {
    connected: true;
    connection: {
      realmId: string;
      companyName: string | null;
      status: string;
      lastSyncAt: string | null;
      environment: string;
      connectedBy: string;
      refreshTokenExpiresAt: string;
    };
    syncStates: Array<{
      entityType: string;
      lastSuccessfulSync: string | null;
      syncStatus: string;
      syncedCount: number;
      errorCount: number;
      errorMessage: string | null;
    }>;
  } => {
    return s?.connected === true && "connection" in s;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to your account
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to your account
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading integrations</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to your account
        </p>
      </div>

      <div className="space-y-6">
        {/* QuickBooks Connection Card */}
        <QboConnectionCard
          connection={
            isConnected(status)
              ? {
                  connected: true as const,
                  realmId: status.connection.realmId,
                  companyName: status.connection.companyName,
                  environment: status.connection.environment,
                  status: status.connection.status,
                  connectedAt: undefined, // Not returned from API
                  refreshTokenExpiresAt: status.connection.refreshTokenExpiresAt
                    ? new Date(status.connection.refreshTokenExpiresAt)
                    : undefined,
                  lastSyncAt: status.connection.lastSyncAt
                    ? new Date(status.connection.lastSyncAt)
                    : undefined,
                  errorMessage: undefined, // Not returned from API
                }
              : { connected: false as const }
          }
        />

        {/* Sync Notifications (only shown if connected) */}
        {isConnected(status) && (
          <>
            <QboSyncNotifications />

            {/* Sync Status Table */}
            {status.syncStates.length > 0 && (
              <QboSyncStatus
                syncStates={status.syncStates.map((state) => ({
                  ...state,
                  syncStatus: state.syncStatus as
                    | "synced"
                    | "syncing"
                    | "pending"
                    | "error"
                    | "conflict",
                  lastSuccessfulSync: state.lastSuccessfulSync
                    ? new Date(state.lastSuccessfulSync)
                    : null,
                }))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
