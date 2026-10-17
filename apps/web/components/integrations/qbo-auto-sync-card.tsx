"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type Mode = "off" | "on_change" | "scheduled";

const INTERVALS: Array<[number, string]> = [
  [15, "Every 15 minutes"],
  [60, "Every hour"],
  [360, "Every 6 hours"],
  [1440, "Once a day"],
];

/** Per-company choice of when projects are sent to QuickBooks without anyone pressing Sync Now. */
export function QboAutoSyncCard() {
  const utils = trpc.useUtils();
  const { data } = trpc.quickbooks.getAutoSync.useQuery();
  const [mode, setMode] = useState<Mode>("off");
  const [interval, setIntervalMinutes] = useState(60);
  const [readPayments, setReadPayments] = useState(false);

  useEffect(() => {
    if (data) {
      setMode(data.mode);
      setIntervalMinutes(data.intervalMinutes);
      setReadPayments(data.readPayments);
    }
  }, [data]);

  const save = trpc.quickbooks.setAutoSync.useMutation({
    onSuccess: () => {
      toast.success("Automatic sync saved");
      utils.quickbooks.getAutoSync.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  const dirty = data ? mode !== data.mode || interval !== data.intervalMinutes || readPayments !== data.readPayments : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic sync</CardTitle>
        <CardDescription>
          Choose when projects are sent to QuickBooks without pressing Sync Now. Each project becomes a job under its customer, and the job is made inactive when the project is closed, archived or lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>When to sync</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off (Sync Now only)</SelectItem>
                <SelectItem value="on_change">When a project is created or changed</SelectItem>
                <SelectItem value="scheduled">On a schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "scheduled" && (
            <div className="space-y-2">
              <Label>How often</Label>
              <Select value={String(interval)} onValueChange={(v) => setIntervalMinutes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map(([m, label]) => (
                    <SelectItem key={m} value={String(m)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {mode === "off" && "Nothing is sent until someone presses Sync Now."}
          {mode === "on_change" && "A project is sent shortly after it is created, renamed, re-numbered or moved to a new phase."}
          {mode === "scheduled" && "New and changed projects are sent on the schedule above."}
          {data?.lastRunAt && mode === "scheduled" ? ` Last scheduled run: ${new Date(data.lastRunAt).toLocaleString()}.` : ""}
        </p>
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch checked={readPayments} onCheckedChange={setReadPayments} id="qbo-read-payments" />
          <div>
            <Label htmlFor="qbo-read-payments">Read deposits and payments from QuickBooks</Label>
            <p className="text-sm text-muted-foreground">
              Every 15 minutes BidAxiom looks for money your bookkeeper recorded. An exact match to one invoice is marked paid (you can undo it); anything else waits on the Outstanding page and in the bell for an owner, administrator or project manager. Nothing is changed in QuickBooks.
            </p>
          </div>
        </div>
        <Button onClick={() => save.mutate({ mode, intervalMinutes: interval, readPayments })} disabled={!dirty || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
