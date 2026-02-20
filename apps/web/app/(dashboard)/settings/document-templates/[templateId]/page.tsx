import { FieldMappingClient } from "./field-mapping-client";

interface Props {
  params: { templateId: string };
}

/**
 * Server component wrapper for the field mapping page.
 * Passes templateId from URL params to the client component.
 */
export default function TemplateFieldMappingPage({ params }: Props) {
  return <FieldMappingClient templateId={params.templateId} />;
}
