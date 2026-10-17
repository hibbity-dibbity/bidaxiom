"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QboConnectionCard } from "@/components/integrations/qbo-connection-card";
import { QboSetupInfo } from "@/components/integrations/qbo-setup-info";
import { QboAutoSyncCard } from "@/components/integrations/qbo-auto-sync-card";
import { QboInvoiceSyncCard } from "@/components/integrations/qbo-invoice-sync-card";
import { QboConnectionCheck } from "@/components/integrations/qbo-connection-check";
import { QboSyncStatus } from "@/components/integrations/qbo-sync-status";
import { QboSyncNotifications } from "@/components/integrations/qbo-sync-notifications";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Integrations settings page.
 * Shows QuickBooks connection management.
 */
export default function IntegrationsPage() {
  const { data: qboStatus, isLoading: qboLoading, error: qboError } = trpc.quickbooks.getStatus.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Poll every 5 seconds for near-real-time updates
    }
  );

  // Type guard to check if QBO status is connected
  const isQboConnected = (
    s: typeof qboStatus
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

  if (qboLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect QuickBooks to your account
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Show individual errors for each integration
  const hasError = qboError;

  if (hasError && !qboStatus) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect QuickBooks to your account
          </p>
        </div>
        {qboError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading QuickBooks integration</AlertTitle>
            <AlertDescription>{qboError.message}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground">
          Connect QuickBooks to your account
        </p>
      </div>

      <div className="space-y-8">
        {/* QuickBooks Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">QuickBooks Online</h2>
          <div className="space-y-6">
            {qboError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error loading QuickBooks</AlertTitle>
                <AlertDescription>{qboError.message}</AlertDescription>
              </Alert>
            ) : (
              <>
                <QboConnectionCard
                  connection={
                    isQboConnected(qboStatus)
                      ? {
                          connected: true as const,
                          realmId: qboStatus.connection.realmId,
                          companyName: qboStatus.connection.companyName,
                          environment: qboStatus.connection.environment,
                          status: qboStatus.connection.status,
                          connectedAt: undefined, // Not returned from API
                          refreshTokenExpiresAt: qboStatus.connection
                            .refreshTokenExpiresAt
                            ? new Date(qboStatus.connection.refreshTokenExpiresAt)
                            : undefined,
                          lastSyncAt: qboStatus.connection.lastSyncAt
                            ? new Date(qboStatus.connection.lastSyncAt)
                            : undefined,
                          errorMessage: undefined, // Not returned from API
                        }
                      : { connected: false as const }
                  }
                />

                {!isQboConnected(qboStatus) && <QboSetupInfo />}

                {/* Sync Notifications (only shown if connected) */}
                {isQboConnected(qboStatus) && (
                  <>
                    <QboAutoSyncCard />
                    <QboInvoiceSyncCard />
                    <QboConnectionCheck />
                    <QboSyncNotifications />

                    {/* Sync Status Table */}
                    {qboStatus.syncStates.length > 0 && (
                      <QboSyncStatus
                        syncStates={qboStatus.syncStates.map((state) => ({
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
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
