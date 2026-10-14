"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/** Download a document as a PDF made on the server (the same layout as the customer view). */
export function usePdfDownload() {
  const m = trpc.pdf.document.useMutation({
    onSuccess: ({ filename, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    onError: (e) => toast.error("Could not make the PDF", { description: e.message }),
  });
  return {
    pending: m.isPending,
    download: (kind: "proposal" | "invoice" | "order", id: string) => m.mutate({ kind, id }),
  };
}
