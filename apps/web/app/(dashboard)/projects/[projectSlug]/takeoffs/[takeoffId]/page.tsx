"use client";

import { TakeoffEditor } from "@/components/takeoff/takeoff-editor";

export default function TakeoffPage({ params }: { params: { projectSlug: string; takeoffId: string } }) {
  return <TakeoffEditor projectSlug={params.projectSlug} takeoffId={params.takeoffId} />;
}
