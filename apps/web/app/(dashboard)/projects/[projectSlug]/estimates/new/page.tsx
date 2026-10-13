import { redirect } from "next/navigation";

/**
 * Proposals are created straight from the Proposals tab (Rev 0, Rev 1, ...), so the old
 * "name your proposal" form is gone. Old links land on the list.
 */
export default function NewEstimatePage({ params }: { params: { projectSlug: string } }) {
  redirect(`/projects/${params.projectSlug}/estimates`);
}
