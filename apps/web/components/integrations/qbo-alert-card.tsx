"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

/** Per-company choice of who is emailed when the QuickBooks connection stops and has to be reconnected. */
export function QboAlertCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.quickbooks.getAlertSettings.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState("");

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setEmails(data.emails);
    }
  }, [data]);

  const save = trpc.quickbooks.setAlertSettings.useMutation({
    onSuccess: (r) => {
      toast.success("Alert settings saved");
      setEmails(r.emails);
      utils.quickbooks.getAlertSettings.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const dirty = data ? enabled !== data.enabled || emails.trim() !== data.emails : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection alert</CardTitle>
        <CardDescription>
          If QuickBooks rejects the connection, syncing stops until someone reconnects. Turn this on to be emailed the moment that happens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} id="qbo-alert-enabled" />
          <div className="flex-1 space-y-2">
            <Label htmlFor="qbo-alert-enabled">Email me when QuickBooks needs to be reconnected</Label>
            <Textarea
              aria-label="Email addresses to alert"
              rows={2}
              placeholder="owner@yourcompany.com, bookkeeper@yourcompany.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">Separate several addresses with commas. You are emailed once per disconnect, not repeatedly.</p>
          </div>
        </div>
        <Button onClick={() => save.mutate({ enabled, emails })} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
