"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstimateStatus } from "@construction/shared";
import { GenerateBidButton } from "../actions/GenerateBidButton";
import { SubmitEstimateButton } from "../actions/SubmitEstimateButton";
import { ConvertToProjectButton } from "../actions/ConvertToProjectButton";

interface NextStepsPanelProps {
  estimateId: string;
  status: EstimateStatus;
  projectId: string;
  onActionComplete?: () => void;
}

export function NextStepsPanel({ estimateId, status, projectId, onActionComplete }: NextStepsPanelProps) {
  const renderActions = () => {
    switch (status) {
      case "draft":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your estimate is ready. Submit for approval or generate a bid to send to clients.
            </p>
            <div className="flex gap-2">
              <SubmitEstimateButton
                estimateId={estimateId}
                onSuccess={onActionComplete}
                variant="default"
              />
              <GenerateBidButton
                estimateId={estimateId}
                onSuccess={onActionComplete}
                variant="outline"
              />
            </div>
          </div>
        );

      case "submitted":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Estimate has been submitted. Mark as accepted if bid is won.
            </p>
            <div className="flex gap-2">
              <GenerateBidButton
                estimateId={estimateId}
                onSuccess={onActionComplete}
                variant="outline"
              />
            </div>
          </div>
        );

      case "accepted":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Congratulations! Convert this estimate to an active project with one click.
            </p>
            <div className="flex gap-2">
              <ConvertToProjectButton
                estimateId={estimateId}
                onSuccess={onActionComplete}
                variant="default"
              />
            </div>
          </div>
        );

      case "under_contract":
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This estimate has been converted to an active project. Budget line items have been created.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Steps</CardTitle>
      </CardHeader>
      <CardContent>
        {renderActions()}
      </CardContent>
    </Card>
  );
}
