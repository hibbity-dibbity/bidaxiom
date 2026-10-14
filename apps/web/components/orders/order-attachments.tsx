"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

function size(n: number | null) {
  if (!n) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Files on a purchase or work order (quotes, plans, signed copies). Each file is also saved in the
 * project's Documents. Removing an attachment here does not delete the file from Documents.
 */
export function OrderAttachments({ orderId, projectId }: { orderId: string; projectId: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.order.attachments.useQuery({ orderId });
  const getUploadUrl = trpc.document.getUploadUrl.useMutation();
  const createDocument = trpc.document.create.useMutation();
  const attach = trpc.order.attachDocument.useMutation();
  const detach = trpc.order.detachDocument.useMutation({
    onSuccess: () => utils.order.attachments.invalidate({ orderId }),
    onError: (e) => toast.error("Could not remove the file", { description: e.message }),
  });
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const contentType = file.type || "application/octet-stream";
        const { uploadUrl, storageKey } = await getUploadUrl.mutateAsync({ projectId, fileName: file.name, contentType, fileSize: file.size });
        const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!res.ok) throw new Error(`Upload of ${file.name} failed (${res.status})`);
        const doc = await createDocument.mutateAsync({ projectId, name: file.name, storageKey, fileSize: file.size, contentType });
        await attach.mutateAsync({ orderId, documentId: doc.id });
      }
      toast.success(files.length === 1 ? "File attached" : `${files.length} files attached`);
      utils.order.attachments.invalidate({ orderId });
    } catch (e) {
      toast.error("Could not attach the file", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function open(documentId: string) {
    try {
      const r = await utils.document.getDownloadUrl.fetch({ documentId });
      window.open(r.downloadUrl, "_blank");
    } catch {
      toast.error("Could not open the file");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Attachments</h2>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading..." : "Attach files"}
        </Button>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>
      <ul className="divide-y rounded-md border bg-background text-sm">
        {(data ?? []).length === 0 && <li className="px-3 py-2 text-muted-foreground">No files attached.</li>}
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <button type="button" className="truncate text-left hover:underline" onClick={() => open(a.documentId)}>
              {a.name}
            </button>
            <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
              <span className="text-xs">{size(a.fileSize)} · {format(new Date(a.addedAt), "MMM d, yyyy")}</span>
              <button
                type="button"
                className="text-xs hover:underline"
                disabled={detach.isPending}
                onClick={() => window.confirm(`Remove ${a.name} from this order? It stays in the project's documents.`) && detach.mutate({ attachmentId: a.id })}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
