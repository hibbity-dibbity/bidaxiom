"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const requestResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RequestResetFormData = z.infer<typeof requestResetSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: requestErrors },
  } = useForm<RequestResetFormData>({
    resolver: zodResolver(requestResetSchema),
  });

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: resetErrors },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch("password");

  // Password requirement checks
  const requirements = [
    { met: password?.length >= 8, text: "At least 8 characters" },
    { met: /[A-Z]/.test(password || ""), text: "One uppercase letter" },
    { met: /[a-z]/.test(password || ""), text: "One lowercase letter" },
    { met: /[0-9]/.test(password || ""), text: "One number" },
  ];

  const onRequestSubmit = async (data: RequestResetFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/trpc/auth.requestPasswordReset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { email: data.email } }),
      });

      // Always show success message to prevent email enumeration
      setRequestSent(true);
      toast.success("If an account exists, a reset link has been sent.");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onResetSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/trpc/auth.resetPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            token,
            newPassword: data.password,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.result?.data?.json) {
        const error = result.error?.json?.message || "Password reset failed";
        toast.error(error);
        return;
      }

      setResetSuccess(true);
      toast.success("Password reset successful!");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Request reset flow - success state
  if (requestSent && !token) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-center">Check Your Email</CardTitle>
          <CardDescription className="text-center">
            If an account exists with that email, we&apos;ve sent a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Please check your inbox and click the reset link to set a new password.
              The link will expire in 1 hour.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/sign-in")}
          >
            Back to Sign In
          </Button>
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => setRequestSent(false)}
          >
            Try a different email
          </button>
        </CardFooter>
      </Card>
    );
  }

  // Reset password flow - success state
  if (resetSuccess) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-center">Password Reset!</CardTitle>
          <CardDescription className="text-center">
            Your password has been successfully reset
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              You can now sign in with your new password.
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

  // Reset password flow - form state
  if (token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmitReset(onResetSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...registerReset("password")}
                disabled={isLoading}
              />
              {resetErrors.password && (
                <p className="text-sm text-destructive">{resetErrors.password.message}</p>
              )}
              {password && (
                <div className="space-y-1 text-xs">
                  {requirements.map((req, i) => (
                    <div
                      key={i}
                      className={req.met ? "text-green-600" : "text-muted-foreground"}
                    >
                      {req.met ? "✓" : "○"} {req.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...registerReset("confirmPassword")}
                disabled={isLoading}
              />
              {resetErrors.confirmPassword && (
                <p className="text-sm text-destructive">{resetErrors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Resetting password..." : "Reset Password"}
            </Button>
            <Link
              href="/sign-in"
              className="text-center text-sm text-muted-foreground hover:text-primary"
            >
              Back to Sign In
            </Link>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Request reset flow - form state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a reset link
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmitRequest(onRequestSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...registerRequest("email")}
              disabled={isLoading}
            />
            {requestErrors.email && (
              <p className="text-sm text-destructive">{requestErrors.email.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending reset link..." : "Send Reset Link"}
          </Button>
          <Link
            href="/sign-in"
            className="text-center text-sm text-muted-foreground hover:text-primary"
          >
            Back to Sign In
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
