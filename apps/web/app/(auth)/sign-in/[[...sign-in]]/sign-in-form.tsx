"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { getPasskey, passkeysSupported, passkeyErrorMessage } from "@/lib/passkey";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const mfaSchema = z.object({
  mfaToken: z.string().length(6, "MFA code must be 6 digits"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type MfaFormData = z.infer<typeof mfaSchema>;

export default function SignInForm({ redirectUrl }: { redirectUrl: string }) {
  const router = useRouter();
  const ssoError = useSearchParams().get("sso_error");
  // Email-first: step 1 asks only for the email, then the server says how that address signs in.
  const [step, setStep] = useState<"email" | "choose" | "password">("email");
  const [emailInput, setEmailInput] = useState("");
  const routeMutation = trpc.sso.route.useMutation();
  const [canPasskey, setCanPasskey] = useState(false);
  const [mfaMethods, setMfaMethods] = useState<{ totp: boolean; passkey: boolean }>({ totp: true, passkey: false });
  useEffect(() => setCanPasskey(passkeysSupported()), []);
  const passkeyStart = trpc.passkey.loginStart.useMutation();
  const passkeyFinish = trpc.passkey.loginFinish.useMutation();
  const signInWithPasskey = async () => {
    setIsLoading(true);
    try {
      const { token, options } = await passkeyStart.mutateAsync();
      const response = await getPasskey(options);
      const result = await passkeyFinish.mutateAsync({ token, response });
      await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) });
      toast.success("Login successful!");
      router.push(result.org ? getSafeRedirectUrl(redirectUrl) : "/onboarding");
    } catch (e) {
      toast.error(e instanceof Error && !(e instanceof DOMException) ? e.message : passkeyErrorMessage(e));
      setIsLoading(false);
    }
  };
  const goSso = (email: string) => {
    window.location.href = `/api/auth/sso/start?email=${encodeURIComponent(email)}`;
  };
  const onEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Enter a valid email address");
      return;
    }
    try {
      const r = await routeMutation.mutateAsync({ email });
      if (r.sso && r.enforced) return goSso(email);
      setValue("email", email);
      setStep(r.sso ? "choose" : "password");
    } catch {
      // If routing can't be checked, fall back to the password form.
      setValue("email", email);
      setStep("password");
    }
  };
  useEffect(() => {
    if (ssoError) toast.error(ssoError);
  }, [ssoError]);

  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [loginCredentials, setLoginCredentials] = useState<LoginFormData | null>(null);

  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    setValue,
    formState: { errors: loginErrors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerMfa,
    handleSubmit: handleSubmitMfa,
    formState: { errors: mfaErrors },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (result) => {
      // Check if MFA is required
      if ("requiresMfa" in result && result.requiresMfa) {
        setMfaRequired(true);
        setMfaUserId(result.userId);
        setMfaMethods((result as { methods?: { totp: boolean; passkey: boolean } }).methods ?? { totp: true, passkey: false });
        setIsLoading(false);
        return;
      }

      // Narrow to the authenticated result branch
      if (!("accessToken" in result)) return;

      // Store session
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      toast.success("Login successful!");

      // Check if user needs to set up MFA
      const enforceMfa = process.env.NEXT_PUBLIC_ENFORCE_MFA === "true";
      if (enforceMfa && !result.user.mfaEnabled) {
        router.push("/mfa-setup?redirect_url=" + encodeURIComponent(getSafeRedirectUrl(redirectUrl)));
        return;
      }

      // Check if user needs to create/join organization
      if (!result.org) {
        router.push("/onboarding");
        return;
      }

      // Redirect to dashboard or original destination
      router.push(getSafeRedirectUrl(redirectUrl));
    },
    onError: (error) => {
      // Detect network errors (API server unreachable)
      const isNetworkError = error.message === "Failed to fetch" ||
        error.message.includes("fetch") ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).cause?.code === "ECONNREFUSED";

      if (isNetworkError) {
        toast.error("Cannot connect to the server. Please ensure the API is running and try again.");
      } else {
        toast.error(error.message || "Login failed");
      }
      setIsLoading(false);
    },
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginCredentials(data);
    loginMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };

  const mfaLoginMutation = trpc.auth.login.useMutation({
    onSuccess: async (result) => {
      // Narrow to the authenticated result branch
      if (!("accessToken" in result)) return;

      // Store session
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      toast.success("Login successful!");

      // Check if user needs to create/join organization
      if (!result.org) {
        router.push("/onboarding");
        return;
      }

      router.push(getSafeRedirectUrl(redirectUrl));
    },
    onError: (error) => {
      // Detect network errors (API server unreachable)
      const isNetworkError = error.message === "Failed to fetch" ||
        error.message.includes("fetch") ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).cause?.code === "ECONNREFUSED";

      if (isNetworkError) {
        toast.error("Cannot connect to the server. Please ensure the API is running and try again.");
      } else {
        toast.error(error.message || "Invalid MFA code");
      }
      setIsLoading(false);
    },
  });

  const onMfaSubmit = async (data: MfaFormData) => {
    if (!loginCredentials) return;

    setIsLoading(true);
    mfaLoginMutation.mutate({
      email: loginCredentials.email,
      password: loginCredentials.password,
      mfaToken: data.mfaToken,
    });
  };

  if (mfaRequired) {
    return (
      <div className="space-y-8">
        {/* BIDAXIOM logo */}
        <div className="flex justify-center pb-[25px]">
          <Image
            src="/BIDAXIOM-Logo-Dark-TransparentBG.png"
            alt="BIDAXIOM"
            width={320}
            height={74}
            className="mx-auto block dark:hidden"
            priority
          />
          <Image
            src="/BIDAXIOM-Logo-Light-TransparentBG.png"
            alt="BIDAXIOM"
            width={320}
            height={74}
            className="mx-auto hidden dark:block"
            priority
          />
        </div>

        <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmitMfa(onMfaSubmit)}>
          <CardContent className="space-y-4">
            {mfaMethods.passkey && canPasskey && (
              <Button type="button" variant={mfaMethods.totp ? "outline" : "default"} className="w-full" disabled={isLoading} onClick={signInWithPasskey}>
                Use a passkey
              </Button>
            )}
            {mfaMethods.passkey && !canPasskey && !mfaMethods.totp && (
              <p className="text-sm text-muted-foreground">This account uses a passkey. Open BidAxiom on a device and browser that supports passkeys over a secure (https) address.</p>
            )}
            {mfaMethods.totp && (<div className="space-y-2">
              <Label htmlFor="mfaToken">Authentication Code</Label>
              <Input
                id="mfaToken"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                {...registerMfa("mfaToken")}
                disabled={isLoading}
              />
              {mfaErrors.mfaToken && (
                <p className="text-sm text-destructive">{mfaErrors.mfaToken.message}</p>
              )}
            </div>)}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            {mfaMethods.totp && (
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMfaRequired(false);
                setMfaUserId(null);
                setLoginCredentials(null);
              }}
              disabled={isLoading}
            >
              Back to login
            </Button>
          </CardFooter>
        </form>
      </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* BIDAXIOM logo */}
      <div className="flex justify-center pb-[25px]">
        <Image
          src="/BIDAXIOM-Logo-Dark-TransparentBG.png"
          alt="BIDAXIOM"
          width={320}
          height={74}
          className="mx-auto block dark:hidden"
          priority
        />
        <Image
          src="/BIDAXIOM-Logo-Light-TransparentBG.png"
          alt="BIDAXIOM"
          width={320}
          height={74}
          className="mx-auto hidden dark:block"
          priority
        />
      </div>

      <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          {step === "email" ? "Enter your email address to continue" : "Enter your credentials to access your account"}
        </CardDescription>
      </CardHeader>
      {step === "email" ? (
        <form onSubmit={onEmailContinue}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-first">Email</Label>
              <Input id="email-first" name="username" type="email" autoComplete="username webauthn" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="you@example.com" autoFocus value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled={routeMutation.isPending} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={routeMutation.isPending || !emailInput.trim()}>
              {routeMutation.isPending ? "Checking..." : "Continue"}
            </Button>
            {canPasskey && (
              <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={signInWithPasskey}>
                Sign in with a passkey
              </Button>
            )}
          </CardFooter>
        </form>
      ) : (
      <form onSubmit={handleSubmitLogin(onLoginSubmit)}>
        <CardContent className="space-y-4">
          {canPasskey && (
            <Button type="button" variant="outline" className="w-full" disabled={isLoading} onClick={signInWithPasskey}>
              Sign in with a passkey
            </Button>
          )}
          {step === "choose" && (
            <Button type="button" className="w-full" onClick={() => goSso(emailInput.trim())}>
              Continue with your company sign-in
            </Button>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} {...registerLogin("email")} disabled={isLoading} />
            {loginErrors.email && (
              <p className="text-sm text-destructive">{loginErrors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" autoFocus {...registerLogin("password")} disabled={isLoading} />
            {loginErrors.password && (
              <p className="text-sm text-destructive">{loginErrors.password.message}</p>
            )}
            <Link href="/reset-password" className="text-sm text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={isLoading} onClick={() => setStep("email")}>
            Use a different email
          </Button>
        </CardFooter>
      </form>
      )}
    </Card>
    </div>
  );
}
