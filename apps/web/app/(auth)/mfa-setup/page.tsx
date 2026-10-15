"use client";

import { browserApiUrl } from "@/lib/api-url";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect";
import { PasskeysCard } from "@/components/settings/passkeys-card";

const API_URL = browserApiUrl();

const verifySchema = z.object({
  token: z.string().length(6, "Code must be 6 digits"),
});

type VerifyFormData = z.infer<typeof verifySchema>;

type SetupData = {
  qrCodeDataUrl: string;
  secret: string;
  backupCodes: string[];       // plaintext — display to user
  hashedBackupCodes: string[]; // hashed — send to API
};

function MfaSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  useEffect(() => {
    const initializeMfa = async () => {
      try {
        // Get access token from session
        const tokenResponse = await fetch("/api/auth/token");
        if (!tokenResponse.ok) {
          toast.error("Authentication required. Please sign in.");
          router.push("/sign-in");
          return;
        }

        const { accessToken } = await tokenResponse.json();

        // Call setupMfa to get QR code and backup codes
        const response = await fetch(`${API_URL}/trpc/auth.setupMfa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({}),
        });

        const data = await response.json();
        const result = data.result?.data;

        if (!response.ok || !result) {
          const error = data.error?.message || "Failed to initialize MFA setup";
          toast.error(error);
          return;
        }

        setSetupData(result);
      } catch (error) {
        toast.error("An error occurred. Please try again.");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeMfa();
  }, [router]);

  const onVerifySubmit = async (data: VerifyFormData) => {
    if (!setupData) return;

    setIsVerifying(true);
    try {
      // Get access token from session
      const tokenResponse = await fetch("/api/auth/token");
      if (!tokenResponse.ok) {
        toast.error("Authentication required. Please sign in.");
        router.push("/sign-in");
        return;
      }

      const { accessToken } = await tokenResponse.json();

      // Verify MFA setup
      const response = await fetch(`${API_URL}/trpc/auth.verifyMfaSetup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          token: data.token,
          secret: setupData.secret,
          hashedBackupCodes: setupData.hashedBackupCodes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.result?.data) {
        const error = result.error?.message || "Verification failed";
        toast.error(error);
        return;
      }

      // Pick up a fresh session that knows the second factor is now set up.
      await fetch("/api/auth/refresh-session", { method: "POST" });

      // Show backup codes
      setShowBackupCodes(true);
      toast.success("MFA successfully configured!");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyBackupCodes = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.backupCodes.join("\n"));
    toast.success("Backup codes copied to clipboard");
  };

  const handleComplete = () => {
    if (!backupCodesSaved) {
      toast.error("Please confirm you've saved your backup codes");
      return;
    }
    router.push(getSafeRedirectUrl(redirectUrl));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <CardTitle className="text-center">Setting up MFA</CardTitle>
          <CardDescription className="text-center">
            Please wait...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (showBackupCodes && setupData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-financial-positive" />
          </div>
          <CardTitle className="text-center">Save Your Backup Codes</CardTitle>
          <CardDescription className="text-center">
            Store these codes in a safe place
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these backup codes now. Each code can only be used once. You&apos;ll need them if you lose access to your authenticator app.
            </AlertDescription>
          </Alert>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
            {setupData.backupCodes.map((code, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{code}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={copyBackupCodes}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy All Codes
          </Button>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="saved"
              checked={backupCodesSaved}
              onChange={(e) => setBackupCodesSaved(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="saved" className="text-sm cursor-pointer">
              I&apos;ve saved my backup codes in a secure location
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleComplete}
            disabled={!backupCodesSaved}
          >
            Complete Setup
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!setupData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Setup Failed</CardTitle>
          <CardDescription className="text-center">
            Unable to initialize MFA setup
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            Back to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Multi-Factor Authentication Required</CardTitle>
        <CardDescription>
          Set up an authenticator app to secure your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onVerifySubmit)}>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              To protect your account and your company&apos;s data, multi-factor authentication is required.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Scan QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use an authenticator app like Google Authenticator, Authy, or 1Password to scan this QR code.
              </p>
              <div className="flex justify-center bg-card p-4 rounded-lg">
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="MFA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Step 2: Enter Verification Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter the 6-digit code from your authenticator app to verify the setup.
              </p>
              <div className="space-y-2">
                <Label htmlFor="token">Authentication Code</Label>
                <Input
                  id="token"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  {...register("token")}
                  disabled={isVerifying}
                />
                {errors.token && (
                  <p className="text-sm text-destructive">{errors.token.message}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify and Continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
    <p className="text-center text-sm text-muted-foreground">Or use a passkey instead of an authenticator app:</p>
    <PasskeysCard afterChange={() => router.push(getSafeRedirectUrl(redirectUrl))} />
    </div>
  );
}

export default function MfaSetupPageWrapper() {
  return (
    <Suspense fallback={null}>
      <MfaSetupPage />
    </Suspense>
  );
}
