"use client";

import { useRouter, useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SOVBuilder } from "../../sov/SOVBuilder";

interface SOVBuilderStepProps {
  estimateId: string;
}

/**
 * Step 6: SOV Builder
 * Final step: Generate and adjust Schedule of Values from estimate.
 */
export function SOVBuilderStep({ estimateId }: SOVBuilderStepProps) {
  const router = useRouter();
  const params = useParams<{ projectSlug: string; estimateSlug: string }>();
  const projectSlug = params.projectSlug;
  const estimateSlug = params.estimateSlug;

  // Load company profile to get default SOV grouping method
  const { data: companyProfile } = trpc.company.getActiveProfile.useQuery();

  const defaultGroupingMethod =
    (companyProfile?.sovGroupingMethod as "csi" | "phase" | "payment_schedule" | undefined) ||
    "csi";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Schedule of Values (SOV)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate a Schedule of Values from your estimate. Review and adjust line items before
          finalizing. The SOV total must match the estimate total within $1.00.
        </p>
      </div>

      <SOVBuilder estimateId={estimateId} defaultGroupingMethod={defaultGroupingMethod} />

      <div className="pt-4 border-t flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Once finalized, the SOV will be locked and versioned. Use change orders to modify the
          contract value after finalization.
        </p>
        <Button
          onClick={() => router.push(`/projects/${projectSlug}/estimates/${estimateSlug}`)}
        >
          Finalize Estimate
        </Button>
      </div>
    </div>
  );
}
