"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const when = (d: string | Date) => new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Where online signing stands for a sent proposal: waiting, viewed, signed (with the signed PDF), or declined. */
export function SigningStatus({ estimateId, enabled }: { estimateId: string; enabled: boolean }) {
  const utils = trpc.useUtils();
  const { data } = trpc.signing.status.useQuery({ estimateId }, { enabled: enabled && !!estimateId, refetchOnMount: "always" });
  const revoke = trpc.signing.revoke.useMutation({
    onSuccess: () => { utils.signing.status.invalidate({ estimateId }); toast.success("The signing link no longer works."); },
    onError: (e) => toast.error("Could not turn the link off", { description: e.message }),
  });
  if (!data || (!data.link && !data.signature)) return null;

  const sig = data.signature;
  if (sig?.outcome === "accepted") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-financial-positive/40 bg-muted px-4 py-3 text-sm">
        <div>
          <strong>Signed online by {sig.signerName}</strong> on {when(sig.signedAt)}. The signed copy is also in the project's Documents, in the Signed Proposals folder.
        </div>
        {data.pdfUrl ? (
          <Button asChild variant="outline"><a href={data.pdfUrl}>Download signed PDF</a></Button>
        ) : (
          <span className="text-xs text-muted-foreground">{sig.hasPdf ? "" : "The signed PDF could not be made automatically; use Download PDF on the preview."}</span>
        )}
      </div>
    );
  }
  if (sig?.outcome === "declined") {
    return (
      <div className="rounded-md border bg-muted px-4 py-3 text-sm">
        <strong>Declined by {sig.signerName}</strong> on {when(sig.signedAt)}.{sig.declineReason ? ` Reason: "${sig.declineReason}"` : ""} Create a revision to change it and send it again.
      </div>
    );
  }
  const l = data.link;
  if (!l) return null;
  if (l.status === "pending") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted px-4 py-3 text-sm">
        <div>
          <strong>{l.expired ? "Signing link expired." : "Waiting for the customer to sign."}</strong> Link sent {when(l.sentAt)}{l.recipient ? ` to ${l.recipient}` : ""}.{" "}
          {l.viewedAt ? `Opened ${when(l.viewedAt)}.` : "Not opened yet."} {l.expired ? "" : `Works until ${new Date(l.expiresAt).toLocaleDateString()}.`}
        </div>
        {!l.expired && <Button type="button" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate({ estimateId })}>Turn link off</Button>}
      </div>
    );
  }
  return null;
}
