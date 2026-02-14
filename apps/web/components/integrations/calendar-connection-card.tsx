"use client";

import { useState } from "react";
import { Loader2, Calendar, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type CalendarConnection = {
  id: string;
  status: string;
  providerEmail: string | null;
  calendarId: string;
  lastSyncAt: string | null;
  webhookExpiresAt: string | null;
  errorMessage: string | null;
  syncState: {
    syncStatus: string;
    syncedEventCount: number;
    errorCount: number;
    lastFullSyncAt: string | null;
    lastIncrementalSyncAt: string | null;
    lastError: string | null;
  } | null;
};

interface CalendarConnectionCardProps {
  provider: "google" | "microsoft";
  connection?: CalendarConnection;
}

export function CalendarConnectionCard({
  provider,
  connection,
}: CalendarConnectionCardProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const utils = trpc.useUtils();

  const providerName = provider === "google" ? "Google Calendar" : "Microsoft Outlook";
  const providerColor = provider === "google" ? "text-blue-700" : "text-orange-700";
  const providerBg = provider === "google" ? "bg-blue-100" : "bg-orange-100";

  const getAuthUrlMutation = trpc.calendar.getAuthUrl.useMutation({
    onSuccess: (data) => {
      // Redirect to OAuth page
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error("Failed to get authorization URL", {
        description: error.message,
      });
    },
  });

  const disconnectMutation = trpc.calendar.disconnect.useMutation({
    onSuccess: () => {
      toast.success(`${providerName} disconnected successfully`);
      utils.calendar.getConnections.invalidate();
      setShowDisconnectDialog(false);
    },
    onError: (error) => {
      toast.error(`Failed to disconnect ${providerName}`, {
        description: error.message,
      });
    },
  });

  const manualSyncMutation = trpc.calendar.manualSync.useMutation({
    onSuccess: () => {
      toast.success("Manual sync initiated", {
        description: "Your calendar will sync shortly",
      });
      utils.calendar.getConnections.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to start sync", {
        description: error.message,
      });
    },
  });

  const syncAllProjectsMutation = trpc.calendar.syncAllProjects.useMutation({
    onSuccess: (data) => {
      toast.success("Project sync initiated", {
        description: `${data.jobsQueued} projects queued for sync`,
      });
    },
    onError: (error) => {
      toast.error("Failed to sync projects", {
        description: error.message,
      });
    },
  });

  const handleConnect = () => {
    getAuthUrlMutation.mutate({ provider });
  };

  const handleDisconnect = () => {
    if (!connection) return;
    disconnectMutation.mutate({ connectionId: connection.id });
  };

  const handleSyncNow = () => {
    if (!connection) return;
    manualSyncMutation.mutate({ connectionId: connection.id });
  };

  const handleSyncAllProjects = () => {
    if (!connection) return;
    syncAllProjectsMutation.mutate({ connectionId: connection.id });
  };

  const getStatusBadge = () => {
    if (!connection) {
      return (
        <Badge variant="outline" className="bg-gray-100">
          Not Connected
        </Badge>
      );
    }

    if (connection.status === "error") {
      return <Badge variant="destructive">Error</Badge>;
    }

    if (connection.status === "expired") {
      return (
        <Badge
          variant="outline"
          className="bg-yellow-100 text-yellow-800 border-yellow-300"
        >
          Expired
        </Badge>
      );
    }

    return (
      <Badge className="bg-green-100 text-green-800 border-green-300">
        Connected
      </Badge>
    );
  };

  const getSyncStatusBadge = () => {
    if (!connection?.syncState) return null;

    const status = connection.syncState.syncStatus;
    switch (status) {
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${providerBg}`}
              >
                <Calendar className={`h-5 w-5 ${providerColor}`} />
              </div>
              <div>
                <CardTitle>{providerName}</CardTitle>
                <CardDescription>
                  Sync project milestones to your calendar
                </CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {connection && (
            <div className="space-y-2 text-sm">
              {connection.providerEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{connection.providerEmail}</span>
                </div>
              )}
              {connection.calendarId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Calendar:</span>
                  <span className="font-medium">{connection.calendarId}</span>
                </div>
              )}
              {connection.lastSyncAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Sync:</span>
                  <span>
                    {formatDistanceToNow(new Date(connection.lastSyncAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
              {connection.syncState && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sync Status:</span>
                  {getSyncStatusBadge()}
                </div>
              )}
              {connection.syncState && connection.syncState.syncedEventCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Events Synced:</span>
                  <span>{connection.syncState.syncedEventCount}</span>
                </div>
              )}
              {connection.webhookExpiresAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Webhook Expires:</span>
                  <span>
                    {formatDistanceToNow(new Date(connection.webhookExpiresAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {connection?.status === "error" && connection.errorMessage && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Connection Error</p>
                <p className="text-xs">{connection.errorMessage}</p>
              </div>
            </div>
          )}

          {connection?.syncState?.lastError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Sync Error</p>
                <p className="text-xs">{connection.syncState.lastError}</p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          {!connection || connection.status === "expired" ? (
            <Button
              onClick={handleConnect}
              disabled={getAuthUrlMutation.isPending}
              className="w-full"
            >
              {getAuthUrlMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {connection?.status === "expired" ? "Reconnect" : "Connect"}{" "}
              {providerName}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleSyncNow}
                disabled={manualSyncMutation.isPending}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {manualSyncMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sync Now
              </Button>
              <Button
                onClick={handleSyncAllProjects}
                disabled={syncAllProjectsMutation.isPending}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {syncAllProjectsMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sync All Projects
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnectMutation.isPending}
                size="sm"
              >
                {disconnectMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Disconnect
              </Button>
            </>
          )}
        </CardFooter>
      </Card>

      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {providerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing project milestones to your calendar. You can
              reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
