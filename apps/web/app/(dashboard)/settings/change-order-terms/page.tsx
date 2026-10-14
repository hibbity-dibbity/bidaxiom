"use client";

import { TermsEditor } from "@/components/settings/terms-editor";

export default function ChangeOrderTermsPage() {
  return (
    <TermsEditor
      kind="change_order"
      title="Change order authorization"
      description="The wording printed on every change order, in place of the proposal terms and conditions, above the signature lines."
      footnote="Changes apply to change orders sent after you save. A change order keeps the wording it was sent with, so accepted change orders never change."
    />
  );
}
