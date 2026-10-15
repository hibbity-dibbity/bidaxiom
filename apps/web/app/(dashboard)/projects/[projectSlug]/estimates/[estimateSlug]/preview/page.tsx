"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { usePdfDownload } from "@/lib/pdf-download";
import { EmailDocumentDialog } from "@/components/shared/email-document-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SigningStatus } from "@/components/proposal/signing-status";
import { ProposalDocument } from "@/components/proposal/proposal-document";
import { StatusBadge } from "@/components/shared/status-badge";
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

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #proposal-doc, #proposal-doc * { visibility: visible !important; }
  #proposal-doc { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
}
`;

/**
 * Customer view: exactly what the customer receives. Hidden lines, costs, margins,
 * contingency and internal notes are never included (the API builds this from an allow-list).
 */
export default function ProposalPreviewPage({
  params,
}: {
  params: { projectSlug: string; estimateSlug: string };
}) {
  const { projectSlug, estimateSlug } = params;
  const utils = trpc.useUtils();
  const { data: estimate } = trpc.estimates.getBySlug.useQuery({ slug: estimateSlug });
  const estimateId = estimate?.id ?? "";
  const { data, isLoading, error } = trpc.proposal.customerView.useQuery(
    { estimateId },
    { enabled: !!estimateId, refetchOnMount: "always" }
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const pdf = usePdfDownload();
  const [emailOpen, setEmailOpen] = React.useState(false);

  const send = trpc.proposal.send.useMutation({
    onSuccess: (r) => {
      toast.success(`${isCO ? "Change order" : "Proposal"} marked as sent. Terms version ${r.termsVersion} saved with it.`);
      setConfirmOpen(false);
      utils.proposal.customerView.invalidate({ estimateId });
      utils.proposal.get.invalidate({ estimateId });
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error("Could not send", { description: e.message });
    },
  });

  // The same page serves change orders under their own tab.
  const pathname = usePathname();
  const isCO = pathname.includes("/change-orders/");
  const noun = isCO ? "change order" : "proposal";
  const builderHref = `/projects/${projectSlug}/${isCO ? "change-orders" : "estimates"}/${estimateSlug}`;

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-financial-negative">Could not load the customer view: {error.message}</p>
        <Button asChild variant="outline"><Link href={builderHref}>Back to builder</Link></Button>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const customer = data.customerName ?? "the customer";
  const sent = data.status !== "draft";

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>
      <EmailDocumentDialog kind="proposal" id={estimateId} open={emailOpen} onOpenChange={setEmailOpen} onSent={() => { utils.proposal.customerView.invalidate({ estimateId }); utils.proposal.get.invalidate({ estimateId }); }} />

      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Preview</h1>
            {sent && data.sentAt && <StatusBadge variant={data.status === "submitted" ? "pending" : "approved"}>{data.status === "submitted" ? "Sent" : "Accepted"} {new Date(data.sentAt).toLocaleDateString()}</StatusBadge>}
          </div>
          <p className="text-muted-foreground">
            What {customer} receives. Hidden lines and cost details are not shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href={builderHref}>Back to builder</Link></Button>
          <Button type="button" variant="outline" disabled={pdf.pending || !estimateId} onClick={() => pdf.download("proposal", estimateId)}>{pdf.pending ? "Making PDF..." : "Download PDF"}</Button>
          <Button type="button" disabled={!!data.blocker && !sent} onClick={() => setEmailOpen(true)}>
            {sent ? "Email again" : "Email to customer"}
          </Button>
          {!sent && (
            <Button type="button" variant="outline" disabled={!!data.blocker || send.isPending} onClick={() => setConfirmOpen(true)}>
              Mark as sent
            </Button>
          )}
        </div>
      </div>

      <div className="print:hidden"><SigningStatus estimateId={estimateId} enabled={sent} /></div>

      {data.blocker && !sent && (
        <div className="rounded-md border border-financial-pending/40 bg-muted px-4 py-3 text-sm print:hidden">
          <strong>Not ready to send.</strong> {data.blocker}
        </div>
      )}

      {data.companyContact.length === 0 && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm print:hidden">
          Your phone, website and address are not set, so they are not printed under your company name.{" "}
          <Link href="/settings/company" className="font-medium underline underline-offset-4">Add them in Settings, Company</Link>.
        </div>
      )}

      <div className="flex justify-center rounded-md border bg-muted p-6 print:border-0 print:bg-transparent print:p-0">
        <ProposalDocument data={data} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this {noun} as sent?</AlertDialogTitle>
            <AlertDialogDescription>
              The {noun} is recorded as sent and locked, and keeps the current {isCO ? "authorization wording" : "master terms"} (version {data.terms.version}).
              Later changes to your {isCO ? "wording" : "terms"} will not change it. To change it after sending, create a revision. Use Email or Download PDF to send it to {customer}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); send.mutate({ estimateId }); }}>
              {send.isPending ? "Sending…" : "Mark as sent"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
