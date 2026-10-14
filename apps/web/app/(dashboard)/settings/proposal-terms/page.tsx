"use client";

import { TermsEditor } from "@/components/settings/terms-editor";

export default function ProposalTermsPage() {
  return (
    <TermsEditor
      kind="proposal"
      title="Proposal terms"
      description="Master terms and conditions appended to every proposal, after the invoicing schedule."
      footnote="Changes apply to proposals sent after you save. A proposal keeps the terms version it was sent with, so accepted proposals never change."
    />
  );
}
