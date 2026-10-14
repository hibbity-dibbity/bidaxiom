"use client";

import { ProposalBuilder } from "@/components/proposal/proposal-builder";

/** A change order is built in the proposal builder. */
export default function ChangeOrderPage({ params }: { params: { projectSlug: string; estimateSlug: string } }) {
  return <ProposalBuilder projectSlug={params.projectSlug} estimateSlug={params.estimateSlug} />;
}
