"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * Onboarding Page
 *
 * Custom organization creation flow replacing Clerk CreateOrganization.
 *
 * Handles two signup paths:
 * 1. Direct signup -> user has no org -> show create organization form
 * 2. Invited signup -> user already has org -> redirect to dashboard
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded } = useAuth();
  const [companyName, setCompanyName] = useState("");

  const { data: organizations, isLoading: orgsLoading } = trpc.organization.list.useQuery(
    undefined,
    { enabled: isLoaded }
  );

  const createOrgMutation = trpc.organization.create.useMutation({
    onSuccess: () => {
      toast.success("Company created successfully!");
      // Reload to trigger auth context update and redirect
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create company");
    },
  });

  useEffect(() => {
    if (isLoaded && !orgsLoading && organizations && organizations.length > 0) {
      // User already has an organization, redirect to dashboard
      router.push("/");
    }
  }, [isLoaded, orgsLoading, organizations, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }

    if (companyName.length < 3 || companyName.length > 100) {
      toast.error("Company name must be between 3 and 100 characters");
      return;
    }

    createOrgMutation.mutate({ name: companyName.trim() });
  };

  // Loading state while checking organizations
  if (!isLoaded || orgsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // User has an org already (invited) -- will redirect via useEffect
  if (organizations && organizations.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting to dashboard...</div>
      </div>
    );
  }

  // Direct signup path: user needs to create their first organization
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="mb-8 max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Create Your Company
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up your company to start managing projects, bids, and financials.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Enter your company details to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Construction"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                minLength={3}
                maxLength={100}
                disabled={createOrgMutation.isPending}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createOrgMutation.isPending}
            >
              {createOrgMutation.isPending ? "Creating..." : "Create Company"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
