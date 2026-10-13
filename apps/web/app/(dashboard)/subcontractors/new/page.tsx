"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubcontractorForm } from "@/components/bidding/subcontractor-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewSubcontractorPage() {
  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/subcontractors"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to directory
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add Sub or Vendor</h1>
        <p className="text-muted-foreground">
          Add a subcontractor (work orders) or supplier (purchase orders) to your directory
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Enter contact details, terms and compliance information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubcontractorForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
