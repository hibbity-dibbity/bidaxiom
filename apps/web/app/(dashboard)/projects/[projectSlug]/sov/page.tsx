"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { toast } from "sonner";

export default function SovPage() {
  const params = useParams<{ projectSlug: string }>();

  useEffect(() => {
    toast("That page isn't available");
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3 max-w-sm">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">This section isn't available</h3>
        <p className="text-muted-foreground text-sm">
          Schedule of Values isn't part of your current plan.
        </p>
        <Button variant="outline" asChild>
          <Link href={"/projects/" + params.projectSlug}>Back to Overview</Link>
        </Button>
      </div>
    </div>
  );
}
