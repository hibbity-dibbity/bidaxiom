"use client";

import ProposalPreviewPage from "../../../estimates/[estimateSlug]/preview/page";

/** The customer view of a change order is the proposal customer view. */
export default function ChangeOrderPreviewPage({ params }: { params: { projectSlug: string; estimateSlug: string } }) {
  return <ProposalPreviewPage params={params} />;
}
