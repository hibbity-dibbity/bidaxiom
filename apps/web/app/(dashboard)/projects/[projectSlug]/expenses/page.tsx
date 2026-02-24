"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";

export default function ExpensesPage() {
  const params = useParams<{ projectSlug: string }>();

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3 max-w-sm">
        <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">Expense Tracking</h3>
        <p className="text-muted-foreground text-sm">
          Expense tracking is coming soon. Check back in a future update.
        </p>
        <Button variant="outline" asChild>
          <Link href={"/projects/" + params.projectSlug}>Back to Overview</Link>
        </Button>
      </div>
    </div>
  );
}
