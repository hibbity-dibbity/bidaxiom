"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const field = "w-full rounded-md border bg-background px-2 py-1.5 text-sm";
const split = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

/**
 * Email a document as a PDF attachment. A draft is marked sent when the email goes out; for
 * anything already sent this is just another copy.
 */
export function EmailDocumentDialog({
  kind,
  id,
  open,
  onOpenChange,
  onSent,
}: {
  kind: "proposal" | "invoice" | "order";
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const { data, isLoading } = trpc.email.compose.useQuery({ kind, id }, { enabled: open && !!id, refetchOnMount: "always" });
  const [to, setTo] = React.useState("");
  const [cc, setCc] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [copyMe, setCopyMe] = React.useState(true);
  const loaded = React.useRef<string>("");

  React.useEffect(() => {
    if (!open) {
      loaded.current = "";
      return;
    }
    if (data && loaded.current !== id) {
      loaded.current = id;
      setTo(data.to.join(", "));
      setCc("");
      setSubject(data.subject);
      setMessage(data.message);
      setReplyTo(data.replyTo ?? "");
    }
  }, [open, data, id]);

  const send = trpc.email.send.useMutation({
    onSuccess: (r) => {
      toast.success(`Emailed to ${r.to.join(", ")}`, { description: r.markedSent ? "It is now marked as sent." : undefined });
      onOpenChange(false);
      onSent?.();
    },
    onError: (e) => toast.error("The email was not sent", { description: e.message }),
  });

  const toList = split(to);
  const ccList = [...split(cc), ...(copyMe && data?.ccMe ? [data.ccMe] : [])];
  const bad = [...toList, ...ccList].find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
  const canSend = toList.length > 0 && !bad && subject.trim() !== "" && message.trim() !== "" && !data?.blocker && !send.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email as PDF</DialogTitle>
          <DialogDescription>
            The document goes out as a PDF attachment{data?.willMarkSent ? " and is marked as sent" : ""}.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <p className="py-6 text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3 text-sm">
            {data.blocker && <p className="rounded-md border bg-muted px-3 py-2">{data.blocker}</p>}
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</span>
              <input className={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" />
              {toList.length === 0 && <span className="text-xs text-muted-foreground">No email address is on file{data.recipientName ? ` for ${data.recipientName}` : ""}. Type one, and add it to their record to have it filled in next time.</span>}
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cc</span>
              <input className={field} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional, separate with commas" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} />
              <span>Send me a copy{data.ccMe ? ` (${data.ccMe})` : ""}</span>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</span>
              <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</span>
              <textarea className={field} rows={9} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Replies go to</span>
              <input className={field} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
            </label>
            {bad && <p className="text-xs text-financial-negative">"{bad}" is not a valid email address.</p>}
            {data.history.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Last emailed {data.history[0].status === "failed" ? "(failed) " : ""}to {data.history[0].to} on {new Date(data.history[0].sentAt).toLocaleString()}.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            disabled={!canSend}
            onClick={() => send.mutate({ kind, id, to: toList, cc: ccList, subject: subject.trim(), message, replyTo: replyTo.trim() || null })}
          >
            {send.isPending ? "Sending..." : "Send email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
