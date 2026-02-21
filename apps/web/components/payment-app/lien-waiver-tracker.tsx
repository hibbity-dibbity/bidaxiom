"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import { trpc } from "@/lib/trpc";

interface LienWaiverTrackerProps {
  paymentAppId: string;
  projectId: string;
}

const waiverTypeColors: Record<string, string> = {
  partial_conditional: "bg-blue-500/10 text-blue-700 border-blue-200",
  partial_unconditional: "bg-muted text-foreground border-border",
  final_conditional: "bg-purple-500/10 text-purple-700 border-purple-200",
  final_unconditional: "bg-orange-500/10 text-orange-700 border-orange-200",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function LienWaiverTracker({ paymentAppId, projectId }: LienWaiverTrackerProps) {
  const { data: collectionStatus, isLoading } = trpc.lienWaiver.getCollectionStatus.useQuery({ paymentAppId });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lien Waiver Collection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!collectionStatus) {
    return null;
  }

  const { totalRequired, totalReceived, allComplete, waivers } = collectionStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lien Waiver Collection</CardTitle>
        <CardDescription>
          <Badge variant="outline" className="mt-1">
            {totalReceived}/{totalRequired} Received
          </Badge>
          {allComplete && (
            <span className="ml-2 text-financial-positive text-sm">All waivers collected</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {waivers.map((waiver) => {
          const isCollected = waiver.status === "received" || waiver.status === "verified" || waiver.status === "stored";

          return (
            <div key={waiver.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox checked={isCollected} disabled className="mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{waiver.partyName}</p>
                  <Badge variant="outline" className="text-xs">
                    {waiver.partyType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={waiverTypeColors[waiver.type] || ""}>
                    {waiver.type.replace("_", " ")}
                  </Badge>
                  <span className="text-muted-foreground">
                    Through {new Date(waiver.throughDate).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {currencyFormatter.format(Number(waiver.amountWaived))}
                  </span>
                </div>
                {(waiver.requiresNotarization || waiver.usesStatutoryForm) && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {waiver.requiresNotarization && (
                      <Badge variant="outline" className="text-xs">Requires Notarization</Badge>
                    )}
                    {waiver.usesStatutoryForm && (
                      <Badge variant="outline" className="text-xs">Statutory Form Required</Badge>
                    )}
                  </div>
                )}
                <p className="text-sm">
                  Status:{" "}
                  <StatusBadge variant={isCollected ? "approved" : "warning"}>
                    {waiver.status.replace("_", " ")}
                  </StatusBadge>
                </p>
              </div>
            </div>
          );
        })}

        {waivers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No lien waivers required for this payment application
          </p>
        )}
      </CardContent>
    </Card>
  );
}
