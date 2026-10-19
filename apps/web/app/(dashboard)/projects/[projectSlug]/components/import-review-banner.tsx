"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export interface ImportReview {
  items?: Array<{ code: string; text: string }>;
  reviewedAt?: string | null;
}

/** Shown on a project that was imported from SharePoint and has details someone should check. */
export function ImportReviewBanner({ projectId, review, canClear }: { projectId: string; review: ImportReview | undefined; canClear: boolean }) {
  const utils = trpc.useUtils();
  const dismiss = trpc.project.dismissImportReview.useMutation({
    onSuccess: () => {
      toast.success("Marked as reviewed");
      utils.project.getBySlug.invalidate();
      utils.project.list.invalidate();
    },
    onError: (e) => toast.error("Could not update the project", { description: e.message }),
  });
  if (!review?.items?.length || review.reviewedAt) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Imported from SharePoint: needs review</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {review.items.map((i) => <li key={i.code + i.text}>{i.text}</li>)}
        </ul>
      </div>
      {canClear && (
        <Button size="sm" variant="outline" disabled={dismiss.isPending} onClick={() => dismiss.mutate({ projectId })}>
          Mark reviewed
        </Button>
      )}
    </div>
  );
}
