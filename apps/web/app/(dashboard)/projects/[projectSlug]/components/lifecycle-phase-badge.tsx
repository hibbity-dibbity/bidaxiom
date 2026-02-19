"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LIFECYCLE_ORDER, LIFECYCLE_PHASE_LABELS, type LifecyclePhase } from "@construction/shared";

const phaseColors: Record<LifecyclePhase, string> = {
  opportunity: "bg-purple-500/10 text-purple-700 border-purple-200",
  estimating: "bg-blue-500/10 text-blue-700 border-blue-200",
  submitted: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  awarded: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  active: "bg-green-500/10 text-green-700 border-green-200",
  substantial_completion: "bg-teal-500/10 text-teal-700 border-teal-200",
  closed: "bg-gray-500/10 text-gray-700 border-gray-200",
  warranty: "bg-orange-500/10 text-orange-700 border-orange-200",
  archived: "bg-slate-500/10 text-slate-400 border-slate-200",
};

interface LifecyclePhaseBadgeProps {
  projectId: string;
  projectSlug: string;
  currentPhase: LifecyclePhase;
  canTransition: boolean;
}

export function LifecyclePhaseBadge({
  projectId,
  projectSlug,
  currentPhase,
  canTransition,
}: LifecyclePhaseBadgeProps) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<LifecyclePhase | null>(null);
  const [isBackward, setIsBackward] = useState(false);
  const [reason, setReason] = useState("");

  const transitionMutation = trpc.project.transitionLifecyclePhase.useMutation({
    onSuccess: () => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      utils.project.list.invalidate();
      utils.project.getTransitionHistory.invalidate({ projectId });
      toast.success(
        `Project moved to ${pendingPhase ? LIFECYCLE_PHASE_LABELS[pendingPhase] : ""}`
      );
      setPendingPhase(null);
      setReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePhaseClick = (phase: LifecyclePhase) => {
    const currentIdx = LIFECYCLE_ORDER.indexOf(currentPhase);
    const targetIdx = LIFECYCLE_ORDER.indexOf(phase);
    const backward = targetIdx < currentIdx;
    setOpen(false);
    if (backward) {
      // Backward: show reason dialog
      setIsBackward(true);
      setPendingPhase(phase);
    } else {
      // Forward: fire immediately, no confirmation
      transitionMutation.mutate({ projectId, toPhase: phase, reason: undefined });
    }
  };

  const handleConfirm = () => {
    if (!pendingPhase) return;
    transitionMutation.mutate({
      projectId,
      toPhase: pendingPhase,
      reason: isBackward ? reason : undefined,
    });
  };

  const badge = (
    <Badge
      className={phaseColors[currentPhase]}
      variant="outline"
      style={{ cursor: canTransition ? "pointer" : "default" }}
    >
      {LIFECYCLE_PHASE_LABELS[currentPhase]}
    </Badge>
  );

  return (
    <>
      {canTransition ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{badge}</PopoverTrigger>
          <PopoverContent className="w-52 p-1">
            {LIFECYCLE_ORDER.map((phase) => (
              <button
                key={phase}
                disabled={phase === currentPhase}
                onClick={() => handlePhaseClick(phase)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {LIFECYCLE_PHASE_LABELS[phase]}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        badge
      )}

      <AlertDialog
        open={!!pendingPhase}
        onOpenChange={(o) => {
          if (!o) {
            setPendingPhase(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBackward
                ? `Revert to ${pendingPhase ? LIFECYCLE_PHASE_LABELS[pendingPhase] : ""}?`
                : `Advance to ${pendingPhase ? LIFECYCLE_PHASE_LABELS[pendingPhase] : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBackward
                ? "This is a backward transition. Please provide a reason before confirming."
                : "This will move the project forward to the next phase."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isBackward && (
            <Textarea
              placeholder="Reason for reverting..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={
                (isBackward && reason.trim() === "") ||
                transitionMutation.isPending
              }
            >
              {transitionMutation.isPending ? "Saving..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
