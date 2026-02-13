"use client";

import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type SyncNotification = {
  id: string;
  severity: "error" | "warning" | "info";
  entityType: string;
  entityId: string | null;
  message: string;
  createdAt: Date;
};

export function QboSyncNotifications() {
  const utils = trpc.useUtils();

  const { data: notifications } = trpc.quickbooks.getNotifications.useQuery(
    { includeDismissed: false },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const dismissNotificationMutation = trpc.quickbooks.dismissNotification.useMutation({
    onSuccess: () => {
      utils.quickbooks.getNotifications.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to dismiss notification", {
        description: error.message,
      });
    },
  });

  const dismissAllMutation = trpc.quickbooks.dismissAllNotifications.useMutation({
    onSuccess: (data) => {
      toast.success(`Dismissed ${data.dismissed} notifications`);
      utils.quickbooks.getNotifications.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to dismiss all notifications", {
        description: error.message,
      });
    },
  });

  const handleDismiss = (notificationId: string) => {
    dismissNotificationMutation.mutate({ notificationId });
  };

  const handleDismissAll = () => {
    dismissAllMutation.mutate();
  };

  const getIcon = (severity: SyncNotification["severity"]) => {
    switch (severity) {
      case "error":
        return <AlertTriangle className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
    }
  };

  const formatEntityType = (entityType: string) => {
    const mapping: Record<string, string> = {
      project: "Project",
      invoice: "Invoice",
      bill: "Bill",
      payment: "Payment",
      vendor: "Vendor",
      customer: "Customer",
    };
    return mapping[entityType] || entityType;
  };

  if (!notifications || notifications.notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Sync Notifications</h3>
        {notifications.notifications.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissAll}
            disabled={dismissAllMutation.isPending}
          >
            Dismiss All
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.notifications.map((notification) => {
          const isError = notification.severity === "error";
          const isWarning = notification.severity === "warning";

          return (
            <Alert
              key={notification.id}
              variant={isError ? "destructive" : "default"}
              className={
                isWarning
                  ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                  : ""
              }
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getIcon(notification.severity as "error" | "warning" | "info")}
                </div>
                <div className="flex-1 space-y-1">
                  <AlertTitle className="text-sm font-medium">
                    {formatEntityType(notification.entityType)} Sync{" "}
                    {notification.severity === "error" ? "Failed" : "Issue"}
                    {notification.entityId && (
                      <span className="ml-2 font-mono text-xs opacity-70">
                        #{notification.entityId.slice(0, 8)}
                      </span>
                    )}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {notification.message}
                  </AlertDescription>
                  <div className="text-xs opacity-60 mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => handleDismiss(notification.id)}
                  disabled={dismissNotificationMutation.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}
