"use client";

import { trpc } from "@/lib/trpc";
import { LIFECYCLE_PHASE_LABELS, type LifecyclePhase } from "@construction/shared";
import { formatDistanceToNow } from "date-fns";

interface TransitionHistoryProps {
  projectId: string;
}

export function TransitionHistory({ projectId }: TransitionHistoryProps) {
  const { data: transitions, isLoading } = trpc.project.getTransitionHistory.useQuery({ projectId });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading history...</div>;
  }

  if (!transitions?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No phase transitions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transitions.map((t) => {
        const actorName =
          t.triggeredBy === "system"
            ? "System"
            : [t.actorFirstName, t.actorLastName].filter(Boolean).join(" ") || "Unknown";

        return (
          <div key={t.id} className="flex items-start gap-3 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
            <div className="flex-1">
              <span className="font-medium">
                {LIFECYCLE_PHASE_LABELS[t.fromPhase as LifecyclePhase]}{" "}
                &rarr;{" "}
                {LIFECYCLE_PHASE_LABELS[t.toPhase as LifecyclePhase]}
              </span>
              <span className="text-muted-foreground ml-1">by {actorName}</span>
              {t.triggeredBy === "system" && t.eventSource && (
                <span className="text-muted-foreground ml-1">
                  (auto: {t.eventSource})
                </span>
              )}
              {t.reason && (
                <p className="text-muted-foreground mt-0.5">Reason: {t.reason}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
