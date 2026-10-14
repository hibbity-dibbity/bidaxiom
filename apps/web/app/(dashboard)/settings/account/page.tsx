"use client";

import { browserApiUrl } from "@/lib/api-url";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/settings/theme-toggle";

const API_URL = browserApiUrl();

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function AccountSettingsPage() {
  const { user, hasMfa } = useAuth();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [disableMfaPassword, setDisableMfaPassword] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email || "—";

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    try {
      const tokenResponse = await fetch("/api/auth/token");
      if (!tokenResponse.ok) {
        toast.error("Authentication required. Please sign in.");
        return;
      }
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${API_URL}/trpc/auth.changePassword`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(
          result.error?.message || "Failed to update password"
        );
        return;
      }

      toast.success("Password updated successfully");
      reset();
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const onDisableMfa = async () => {
    if (!disableMfaPassword) {
      toast.error("Please enter your password");
      return;
    }

    setIsDisablingMfa(true);
    try {
      const tokenResponse = await fetch("/api/auth/token");
      if (!tokenResponse.ok) {
        toast.error("Authentication required. Please sign in.");
        return;
      }
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${API_URL}/trpc/auth.disableMfa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: disableMfaPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error?.message || "Failed to disable MFA");
        return;
      }

      toast.success("MFA has been disabled");
      setDisableMfaPassword("");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
      console.error(error);
    } finally {
      setIsDisablingMfa(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, password, two-factor authentication, and appearance
        </p>
      </div>

      {/* Section 1: Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Name
              </Label>
              <p className="mt-1 text-sm">{displayName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Email
              </Label>
              <p className="mt-1 text-sm">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password. You&apos;ll remain signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                disabled={isChangingPassword}
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                disabled={isChangingPassword}
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                disabled={isChangingPassword}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Section 3: Appearance */}
      <ThemeToggle />

      {/* Section 4: Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMfa ? (
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 text-sm text-financial-positive">
                <Shield className="h-4 w-4" /> Enabled
              </span>
              <p className="text-sm text-muted-foreground">
                To disable MFA, confirm your password.
              </p>
              <div className="flex gap-2 items-center">
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={disableMfaPassword}
                  onChange={(e) => setDisableMfaPassword(e.target.value)}
                  disabled={isDisablingMfa}
                  className="max-w-xs"
                />
                <Button
                  variant="destructive"
                  onClick={onDisableMfa}
                  disabled={isDisablingMfa}
                >
                  {isDisablingMfa && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Disable MFA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" /> Not enabled
              </span>
              <p className="text-sm text-muted-foreground">
                Protect your account with a time-based one-time password (TOTP)
                authenticator app.
              </p>
              <Button variant="outline" asChild>
                <Link href="/mfa-setup?redirect_url=/settings/account">
                  Set Up MFA
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
