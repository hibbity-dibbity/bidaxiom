"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/** Read-only check of the live QuickBooks connection: what QuickBooks reports about the company and its books. */
export function QboConnectionCheck() {
  const check = trpc.quickbooks.checkConnection.useMutation({
    onError: (e) => toast.error("Check failed", { description: e.message }),
  });
  const r = check.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Connection check</CardTitle>
            <CardDescription>Reads your company, plan and record counts from QuickBooks. Nothing is changed in QuickBooks.</CardDescription>
          </div>
          <Button onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {r ? "Run again" : "Run check"}
          </Button>
        </div>
      </CardHeader>
      {r && (
        <CardContent className="space-y-3 text-sm">
          {r.fatal && <p className="rounded-md bg-destructive/10 p-3 text-destructive">{r.fatal}</p>}
          {r.items.map((i) => (
            <div key={i.key} className="flex items-start gap-3">
              {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-financial-positive" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <div className="min-w-0">
                <div className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{i.label}</span>
                  {i.value && <span>{i.value}</span>}
                </div>
                {i.note && <p className={i.ok ? "text-muted-foreground" : "text-destructive"}>{i.note}</p>}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {r.environment === "production" ? "Production" : "Sandbox"} · checked {new Date(r.checkedAt).toLocaleString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
