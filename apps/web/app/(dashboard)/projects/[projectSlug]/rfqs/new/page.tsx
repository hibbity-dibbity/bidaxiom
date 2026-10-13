"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RfqForm } from "@/components/bidding/rfq-form";
import { ChevronLeft } from "lucide-react";

export default function NewRfqPage({
  params,
}: {
  params: { projectSlug: string };
}) {
  const { projectSlug } = params;

  // Resolve project by slug (cached from layout)
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id;

  if (!project) {
    return null; // Layout handles loading/error states
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectSlug}/rfqs`}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to RFQs
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Create RFQ</h1>
        <p className="text-muted-foreground mt-1">
          Create a new request for quotation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFQ Details</CardTitle>
        </CardHeader>
        <CardContent>
          <RfqForm projectId={project.id} projectSlug={projectSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
