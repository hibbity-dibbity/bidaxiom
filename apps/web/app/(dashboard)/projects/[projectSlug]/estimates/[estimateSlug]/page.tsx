"use client";

import { ProposalBuilder } from "@/components/proposal/proposal-builder";

export default function EstimatePage({
  params,
}: {
  params: { projectSlug: string; estimateSlug: string };
}) {
  return (
    <ProposalBuilder
      projectSlug={params.projectSlug}
      estimateSlug={params.estimateSlug}
    />
  );
}
