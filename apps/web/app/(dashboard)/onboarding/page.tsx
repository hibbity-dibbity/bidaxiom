"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Companies are set up by BidAxiom and people join by invitation, so there is nothing to fill in here.
 * Anyone who already belongs to a company is sent straight to the dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded } = useAuth();
  const { data: organizations, isLoading } = trpc.organization.list.useQuery(undefined, { enabled: isLoaded });

  useEffect(() => {
    if (isLoaded && !isLoading && organizations && organizations.length > 0) router.push("/");
  }, [isLoaded, isLoading, organizations, router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No company on this account</CardTitle>
          <CardDescription>
            Your account isn&apos;t linked to a company. BidAxiom sets up each company, and your administrator invites everyone else. Contact BidAxiom or your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
