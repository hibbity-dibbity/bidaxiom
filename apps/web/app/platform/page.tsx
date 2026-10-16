"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

type Member = {
  userId: string;
  email: string;
  name: string;
  role: string;
  authenticator: boolean;
  passkeys: number;
  lastLoginAt: string | null;
};
type Company = { id: string; name: string; createdAt: string; members: Member[] };
type MailResult = { email: string; emailSent: boolean; emailProblem?: string };

async function rpc<T>(proc: string, input?: unknown): Promise<T> {
  const res = await fetch("/api/platform/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proc, input }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && body.signedOut) {
    window.location.href = "/platform/login";
    throw new Error("Signed out");
  }
  if (!res.ok) throw new Error(body.error ?? "Request failed");
  return body.data as T;
}

function mailNotice(r: MailResult, what: string) {
  return r.emailSent
    ? { ok: true, text: `${what} Email sent to ${r.email} with a link to choose a password. It works once and lasts 7 days.` }
    : { ok: false, text: `${what} The email to ${r.email} was NOT sent: ${r.emailProblem ?? "unknown problem"} Fix that, then use “Resend setup email” on their row.` };
}

export default function PlatformPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCompanies(await rpc<Company[]>("companies"));
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load companies");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createCompany(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setNotice(null);
    try {
      const r = await rpc<MailResult & { companyName: string }>("createCompany", {
        companyName: String(f.get("companyName")),
        adminFirstName: String(f.get("firstName")),
        adminLastName: String(f.get("lastName") ?? ""),
        adminEmail: String(f.get("email")),
      });
      setNotice(mailNotice({ ...r, email: r.email ?? String(f.get("email")) }, `${r.companyName} created.`));
      form.reset();
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Could not create the company" });
    } finally {
      setBusy(false);
    }
  }

  async function memberAction(proc: "resetSignIn" | "resendSetupEmail", userId: string) {
    setBusy(true);
    setNotice(null);
    setConfirmReset(null);
    try {
      const r = await rpc<MailResult>(proc, { userId });
      setNotice(mailNotice(r, proc === "resetSignIn" ? "Sign-in reset (password, authenticator and passkeys removed)." : "Done."));
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/platform/logout", { method: "POST" });
    window.location.href = "/platform/login";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">BidAxiom operator</h1>
          <p className="text-sm text-muted-foreground">Accounts only. Company projects, documents and financials are not visible here.</p>
        </div>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>

      {notice && (
        <Alert variant={notice.ok ? "default" : "destructive"}>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Set up a new company</CardTitle>
          <CardDescription>
            Creates the company and its first admin, then emails the admin a link to choose a password. They sign in, set up an authenticator app and a passkey, and add their own users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createCompany} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" name="companyName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">Admin first name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Admin last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Admin email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create company and email admin
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies</CardTitle>
          <CardDescription>
            “Reset sign-in” removes someone’s password, authenticator and passkeys, signs them out everywhere, and emails them a link to start over.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!companies && !loadError && <Loader2 className="h-4 w-4 animate-spin" />}
          {companies?.length === 0 && <p className="text-sm text-muted-foreground">No companies yet.</p>}
          {companies?.map((c) => (
            <div key={c.id} className="rounded-md border">
              <div className="border-b px-4 py-2 font-medium">
                {c.name} <span className="ml-2 text-xs font-normal text-muted-foreground">created {new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="divide-y">
                {c.members.map((m) => (
                  <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div>
                      <div>
                        {m.name || m.email} <span className="text-muted-foreground">· {m.role}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.email} · {m.authenticator ? "authenticator ✓" : "no authenticator"} · {m.passkeys > 0 ? `${m.passkeys} passkey(s)` : "no passkey"} ·{" "}
                        {m.lastLoginAt ? `last sign-in ${new Date(m.lastLoginAt).toLocaleDateString()}` : "never signed in"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => memberAction("resendSetupEmail", m.userId)}>
                        Resend setup email
                      </Button>
                      {confirmReset === m.userId ? (
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => memberAction("resetSignIn", m.userId)}>
                          Confirm reset
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmReset(m.userId)}>
                          Reset sign-in
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
