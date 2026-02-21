"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type VerificationState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<VerificationState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const hasAttemptedVerification = useRef(false);

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setState("success");
    },
    onError: (error) => {
      setState("error");
      setErrorMessage(error.message || "Verification failed");
    },
  });

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("No verification token provided");
      return;
    }

    // Prevent double-calling in React Strict Mode
    if (hasAttemptedVerification.current) {
      return;
    }
    hasAttemptedVerification.current = true;

    verifyMutation.mutate({ token });
  }, [token]);

  if (state === "loading") {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <CardTitle className="text-center">Verifying Email</CardTitle>
          <CardDescription className="text-center">
            Please wait while we verify your email address...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-center">Verification Failed</CardTitle>
          <CardDescription className="text-center">
            We couldn&apos;t verify your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground text-center">
            The verification link may have expired or is invalid. Please request a new verification email.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            Go to Sign In
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Need help? Contact support.
          </p>
        </CardFooter>
      </Card>
    );
  }

  // Success state
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="h-12 w-12 text-financial-positive" />
        </div>
        <CardTitle className="text-center">Email Verified!</CardTitle>
        <CardDescription className="text-center">
          Your email has been successfully verified
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            You can now sign in to your account and start using the platform.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => router.push("/sign-in")}>
          Continue to Sign In
        </Button>
      </CardFooter>
    </Card>
  );
}
