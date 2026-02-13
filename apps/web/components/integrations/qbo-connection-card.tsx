"use client";

import { useState } from "react";
import { Loader2, Plug, AlertCircle } from "lucide-react";
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

type QboConnection = {
  connected: boolean;
  realmId?: string | null;
  companyName?: string | null;
  environment?: string | null;
  status?: string | null;
  connectedAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  lastSyncAt?: Date | null;
  errorMessage?: string | null;
};

interface QboConnectionCardProps {
  connection: QboConnection;
}

export function QboConnectionCard({ connection }: QboConnectionCardProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const utils = trpc.useUtils();

  const getAuthUrlMutation = trpc.quickbooks.getAuthUrl.useMutation({
    onSuccess: (data) => {
      // Redirect to QuickBooks OAuth page
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      toast.error("Failed to get authorization URL", {
        description: error.message,
      });
    },
  });

  const disconnectMutation = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => {
      toast.success("QuickBooks disconnected successfully");
      utils.quickbooks.getStatus.invalidate();
      setShowDisconnectDialog(false);
    },
    onError: (error) => {
      toast.error("Failed to disconnect QuickBooks", {
        description: error.message,
      });
    },
  });

  const handleConnect = () => {
    getAuthUrlMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  const getStatusBadge = () => {
    if (!connection.connected) {
      return <Badge variant="outline" className="bg-gray-100">Not Connected</Badge>;
    }

    if (connection.status === "error") {
      return <Badge variant="destructive">Error</Badge>;
    }

    if (connection.status === "expired") {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          Expired
        </Badge>
      );
    }

    return <Badge className="bg-green-100 text-green-800 border-green-300">Connected</Badge>;
  };

  const getEnvironmentBadge = () => {
    if (!connection.environment) return null;

    const isSandbox = connection.environment === "sandbox";
    return (
      <Badge variant="outline" className={isSandbox ? "bg-amber-50 text-amber-700" : ""}>
        {isSandbox ? "Sandbox" : "Production"}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Plug className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <CardTitle>QuickBooks Online</CardTitle>
                <CardDescription>
                  Sync projects, invoices, and bills with QuickBooks
                </CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {connection.connected && (
            <div className="space-y-2 text-sm">
              {connection.companyName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-medium">{connection.companyName}</span>
                </div>
              )}
              {connection.realmId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Realm ID:</span>
                  <span className="font-mono text-xs">{connection.realmId}</span>
                </div>
              )}
              {connection.environment && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment:</span>
                  {getEnvironmentBadge()}
                </div>
              )}
              {connection.connectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected:</span>
                  <span>
                    {formatDistanceToNow(new Date(connection.connectedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
              {connection.refreshTokenExpiresAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token Expires:</span>
                  <span>
                    {formatDistanceToNow(new Date(connection.refreshTokenExpiresAt), {
                      addSuffix: true,
                    })}
                  </span>
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
            </div>
          )}

          {connection.status === "error" && connection.errorMessage && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-medium">Connection Error</p>
                <p className="text-xs">{connection.errorMessage}</p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {!connection.connected || connection.status === "expired" ? (
            <Button
              onClick={handleConnect}
              disabled={getAuthUrlMutation.isPending}
              className="w-full"
            >
              {getAuthUrlMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {connection.status === "expired" ? "Reconnect" : "Connect"} QuickBooks
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDisconnectDialog(true)}
              disabled={disconnectMutation.isPending}
              className="w-full"
            >
              {disconnectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Disconnect
            </Button>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing data between your account and QuickBooks Online.
              You can reconnect at any time.
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
