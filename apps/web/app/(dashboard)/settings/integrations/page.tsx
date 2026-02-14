"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { QboConnectionCard } from "@/components/integrations/qbo-connection-card";
import { QboSyncStatus } from "@/components/integrations/qbo-sync-status";
import { QboSyncNotifications } from "@/components/integrations/qbo-sync-notifications";
import { CalendarConnectionCard } from "@/components/integrations/calendar-connection-card";
import { CalendarProjectSync } from "@/components/integrations/calendar-project-sync";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

/**
 * Integrations settings page.
 * Shows QuickBooks and Calendar connection management.
 */
export default function IntegrationsPage() {
  const { data: qboStatus, isLoading: qboLoading, error: qboError } = trpc.quickbooks.getStatus.useQuery(
    undefined,
    {
      refetchInterval: 5000, // Poll every 5 seconds for near-real-time updates
    }
  );

  const { data: calendarConnections, isLoading: calendarLoading, error: calendarError } = trpc.calendar.getConnections.useQuery(
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

  // Find active calendar connection for project sync section
  const activeCalendarConnection = calendarConnections?.find(
    (conn) => conn.status === "active"
  );

  if (qboLoading || calendarLoading) {
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

  // Show individual errors for each integration
  const hasError = qboError || calendarError;

  if (hasError && !qboStatus && !calendarConnections) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect external services to your account
          </p>
        </div>
        {qboError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading QuickBooks integration</AlertTitle>
            <AlertDescription>{qboError.message}</AlertDescription>
          </Alert>
        )}
        {calendarError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading Calendar integration</AlertTitle>
            <AlertDescription>{calendarError.message}</AlertDescription>
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
          Connect external services to your account
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

                {/* Sync Notifications (only shown if connected) */}
                {isQboConnected(qboStatus) && (
                  <>
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

        <Separator />

        {/* Calendar Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Calendar Integration</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your Google Calendar or Microsoft Outlook to sync project
            milestones and deadlines.
          </p>

          {calendarError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error loading Calendar connections</AlertTitle>
              <AlertDescription>{calendarError.message}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Google Calendar card */}
                <CalendarConnectionCard
                  provider="google"
                  connection={calendarConnections?.find(
                    (c) => c.provider === "google"
                  )}
                />
                {/* Microsoft Outlook card */}
                <CalendarConnectionCard
                  provider="microsoft"
                  connection={calendarConnections?.find(
                    (c) => c.provider === "microsoft"
                  )}
                />
              </div>

              {/* If any connection is active, show project sync controls */}
              {activeCalendarConnection && (
                <CalendarProjectSync connectionId={activeCalendarConnection.id} />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
