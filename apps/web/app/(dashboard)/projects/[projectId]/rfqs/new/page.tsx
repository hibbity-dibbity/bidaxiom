"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RfqForm } from "@/components/bidding/rfq-form";
import { ChevronLeft } from "lucide-react";

export default function NewRfqPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/rfqs`}>
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
          <RfqForm projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
