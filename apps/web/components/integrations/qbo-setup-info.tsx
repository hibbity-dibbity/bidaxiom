"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

/** What this BidAxiom is set up to send to Intuit, to compare with the app's Keys & credentials page. */
export function QboSetupInfo() {
  const { data } = trpc.quickbooks.setupInfo.useQuery();
  if (!data) return null;
  const row = (label: string, value: string, ok = true) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`break-all font-mono text-xs ${ok ? "" : "text-destructive"}`}>{value}</span>
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup details</CardTitle>
        <CardDescription>Compare these with your app on developer.intuit.com. The Redirect URI must be listed on the same Keys tab (Development or Production) as the Client ID you are using, letter for letter.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {row("Redirect URI", data.redirectUri)}
        {row("Environment", data.environment)}
        {row("Client ID", data.clientIdHint ?? "Not set", Boolean(data.clientIdHint))}
        {row("Client secret", data.hasSecret ? "Set" : "Not set", data.hasSecret)}
        {row("Encryption key", data.hasEncryptionKey ? "Set" : "Missing or not 64 characters", data.hasEncryptionKey)}
      </CardContent>
    </Card>
  );
}
