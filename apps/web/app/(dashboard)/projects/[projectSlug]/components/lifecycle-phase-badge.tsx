"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { LIFECYCLE_MENU_ORDER, LIFECYCLE_SIDE_PHASES, LIFECYCLE_PHASE_LABELS, type LifecyclePhase } from "@construction/shared";

const phaseToVariant = (phase: LifecyclePhase) => {
  switch (phase) {
    case "opportunity": return "pending" as const;
    case "estimating": return "pending" as const;
    case "submitted": return "pending" as const;
    case "awarded": return "approved" as const;
    case "active": return "active" as const;
    case "substantial_completion": return "active" as const;
    case "closed": return "completed" as const;
    case "warranty": return "warning" as const;
    case "archived": return "cancelled" as const;
    case "on_hold": return "warning" as const;
    case "lost": return "cancelled" as const;
    default: return "draft" as const;
  }
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

  const transitionMutation = trpc.project.transitionLifecyclePhase.useMutation({
    onMutate: async ({ toPhase }) => {
      await utils.project.getBySlug.cancel({ slug: projectSlug });
      const previous = utils.project.getBySlug.getData({ slug: projectSlug });
      utils.project.getBySlug.setData({ slug: projectSlug }, (old) =>
        old ? { ...old, lifecyclePhase: toPhase } : old
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        utils.project.getBySlug.setData({ slug: projectSlug }, ctx.previous);
      }
      toast.error(_err.message);
    },
    onSettled: () => {
      utils.project.getBySlug.invalidate({ slug: projectSlug });
      utils.project.list.invalidate();
      utils.project.getTransitionHistory.invalidate({ projectId });
    },
  });

  const handlePhaseClick = (phase: LifecyclePhase) => {
    setOpen(false);
    transitionMutation.mutate({ projectId, toPhase: phase, reason: undefined });
  };

  const badge = (
    <StatusBadge
      variant={phaseToVariant(currentPhase)}
      style={{ cursor: canTransition && !transitionMutation.isPending ? "pointer" : "default" }}
      className={transitionMutation.isPending ? "opacity-60" : undefined}
    >
      {transitionMutation.isPending && (
        <Loader2 className="h-3 w-3 animate-spin mr-1 inline" />
      )}
      {LIFECYCLE_PHASE_LABELS[currentPhase]}
    </StatusBadge>
  );

  return (
    <>
      {canTransition ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{badge}</PopoverTrigger>
          <PopoverContent className="w-52 p-1">
            {LIFECYCLE_MENU_ORDER.map((phase) => (
              <div key={phase}>
                {phase === LIFECYCLE_SIDE_PHASES[0] && <div className="my-1 border-t" />}
                <button
                  disabled={phase === currentPhase}
                  onClick={() => handlePhaseClick(phase)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {LIFECYCLE_PHASE_LABELS[phase]}
                </button>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        badge
      )}
    </>
  );
}
