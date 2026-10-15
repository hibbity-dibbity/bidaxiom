"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePdfDownload } from "@/lib/pdf-download";
import { EmailDocumentDialog } from "@/components/shared/email-document-dialog";

/**
 * Preview, Download PDF and Email buttons for a proposal, change order, invoice or order, used in
 * list rows and on builder pages so the preview page is not a required stop.
 */
export function DocumentActions({
  kind,
  id,
  previewHref,
  disabled,
  disabledReason,
  size = "sm",
  onSent,
}: {
  kind: "proposal" | "invoice" | "order";
  id: string;
  previewHref?: string;
  disabled?: boolean;
  disabledReason?: string;
  size?: "sm" | "default";
  onSent?: () => void;
}) {
  const pdf = usePdfDownload();
  const [emailOpen, setEmailOpen] = React.useState(false);
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {previewHref &&
        (disabled ? (
          <Button type="button" size={size} variant="outline" disabled title={disabledReason}>Preview</Button>
        ) : (
          <Button asChild size={size} variant="outline"><Link href={previewHref}>Preview</Link></Button>
        ))}
      <Button type="button" size={size} variant="outline" disabled={disabled || pdf.pending} title={disabled ? disabledReason : undefined} onClick={() => pdf.download(kind, id)}>
        {pdf.pending ? "Making PDF..." : "Download PDF"}
      </Button>
      <Button type="button" size={size} disabled={disabled} title={disabled ? disabledReason : undefined} onClick={() => setEmailOpen(true)}>
        Email
      </Button>
      {emailOpen && <EmailDocumentDialog kind={kind} id={id} open={emailOpen} onOpenChange={setEmailOpen} onSent={onSent} />}
    </div>
  );
}
