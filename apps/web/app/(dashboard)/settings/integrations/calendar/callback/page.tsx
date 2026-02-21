"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";

/**
 * OAuth callback handler page for calendar integrations.
 * Receives provider, code, and state from calendar OAuth redirect.
 * Exchanges code for tokens via tRPC mutation, then redirects to integrations page.
 */
export default function CalendarCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleCallbackMutation = trpc.calendar.handleCallback.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Redirect to integrations page after 2 seconds
      setTimeout(() => {
        router.push("/settings/integrations");
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    // Extract OAuth params from URL
    const provider = searchParams.get("provider");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Check if we have the required params
    if (!provider || !code || !state) {
      setStatus("error");
      setErrorMessage(
        "Missing required parameters. Please try connecting again from the integrations page."
      );
      return;
    }

    // Validate provider
    if (provider !== "google" && provider !== "microsoft") {
      setStatus("error");
      setErrorMessage(
        `Invalid provider: ${provider}. Please try connecting again.`
      );
      return;
    }

    // Exchange code for tokens
    handleCallbackMutation.mutate({ provider, code, state });
  }, [searchParams]);

  const getProviderName = () => {
    const provider = searchParams.get("provider");
    if (provider === "google") return "Google Calendar";
    if (provider === "microsoft") return "Microsoft Outlook";
    return "Calendar";
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Calendar Connection</CardTitle>
          <CardDescription>
            Processing your {getProviderName()} authorization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">
                  Connecting {getProviderName()}...
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait while we complete the connection
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-muted p-3">
                <CheckCircle2 className="h-8 w-8 text-financial-positive" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">
                  Successfully connected {getProviderName()}!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Redirecting to integrations page...
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connection Failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button
                onClick={() => router.push("/settings/integrations")}
                className="w-full"
              >
                Return to Integrations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
