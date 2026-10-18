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
  noPasscode: boolean;
};
type Company = { id: string; name: string; createdAt: string; disabled: boolean; noPasscode: boolean; trialEndsAt: string | null; deletedAt: string | null; daysLeft: number | null; members: Member[] };
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
  const [binning, setBinning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");

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

  async function setPasscodeOff(target: { kind: "company"; c: Company; exempt: boolean } | { kind: "user"; m: Member; exempt: boolean }) {
    setBusy(true);
    setNotice(null);
    try {
      if (target.kind === "company") await rpc("setCompanyPasscodeExempt", { organizationId: target.c.id, exempt: target.exempt });
      else await rpc("setUserPasscodeExempt", { userId: target.m.userId, exempt: target.exempt });
      const who = target.kind === "company" ? target.c.name : target.m.email;
      setNotice({ ok: true, text: target.exempt ? `${who} no longer needs an authenticator or passkey to sign in (password only).` : `${who} needs an authenticator or passkey to sign in again.` });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function trialAction(c: Company, kind: "extend" | "convert") {
    setBusy(true);
    setNotice(null);
    try {
      if (kind === "extend") await rpc("extendTrial", { organizationId: c.id, days: 14 });
      else await rpc("convertTrial", { organizationId: c.id });
      setNotice({ ok: true, text: kind === "extend" ? `${c.name}'s trial was extended by 14 days.` : `${c.name} is now a regular customer; the trial timer is gone.` });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function setDisabled(c: Company, disabled: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      await rpc("setCompanyDisabled", { organizationId: c.id, disabled });
      setNotice({ ok: true, text: disabled ? `${c.name} is disabled. Its people can't use it; nothing was deleted.` : `${c.name} is enabled again.` });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function moveToBin(c: Company) {
    setBusy(true);
    setNotice(null);
    setBinning(null);
    try {
      const r = await rpc<{ retentionDays: number }>("moveCompanyToBin", { organizationId: c.id });
      setNotice({ ok: true, text: `${c.name} is in the recycle bin. Its people are locked out, and you can restore it for ${r.retentionDays} days before it is removed for good.` });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function restore(c: Company) {
    setBusy(true);
    setNotice(null);
    try {
      await rpc("restoreCompany", { organizationId: c.id });
      setNotice({ ok: true, text: `${c.name} was restored. It is still disabled; click Enable when you want its people back in.` });
      await load();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteForever(c: Company) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await rpc<{ filesDeleted: number; accountsDeleted: number }>("deleteCompanyForever", { organizationId: c.id, confirmName: typedName });
      setNotice({ ok: true, text: `${c.name} was permanently deleted (${r.filesDeleted} files, ${r.accountsDeleted} accounts).` });
      setDeleting(null);
      setTypedName("");
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
          {companies && companies.filter((c) => !c.deletedAt).length === 0 && <p className="text-sm text-muted-foreground">No companies yet.</p>}
          {companies?.filter((c) => !c.deletedAt).map((c) => (
            <div key={c.id} className="rounded-md border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
                <div className="font-medium">
                  {c.name} <span className="ml-2 text-xs font-normal text-muted-foreground">created {new Date(c.createdAt).toLocaleDateString()}</span>
                  {c.disabled && <span className="ml-2 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Disabled</span>}
                  {c.noPasscode && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Passcodes off</span>}
                  {c.trialEndsAt && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {new Date(c.trialEndsAt).getTime() > Date.now() ? `Free trial, ends ${new Date(c.trialEndsAt).toLocaleDateString()}` : `Trial ended ${new Date(c.trialEndsAt).toLocaleDateString()}`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.trialEndsAt && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => trialAction(c, "extend")}>Extend 14 days</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => trialAction(c, "convert")}>Make a customer</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setPasscodeOff({ kind: "company", c, exempt: !c.noPasscode })}>
                    {c.noPasscode ? "Require passcodes" : "Turn passcodes off"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setDisabled(c, !c.disabled)}>
                    {c.disabled ? "Enable" : "Disable"}
                  </Button>
                  {binning === c.id ? (
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => moveToBin(c)}>
                      Confirm: move to recycle bin
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setBinning(c.id)}>
                      Delete…
                    </Button>
                  )}
                </div>
              </div>
              <div className="divide-y">
                {c.members.map((m) => (
                  <div key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div>
                      <div>
                        {m.name || m.email} <span className="text-muted-foreground">· {m.role}</span>
                        {m.noPasscode && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Passcodes off</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.email} · {m.authenticator ? "authenticator ✓" : "no authenticator"} · {m.passkeys > 0 ? `${m.passkeys} passkey(s)` : "no passkey"} ·{" "}
                        {m.lastLoginAt ? `last sign-in ${new Date(m.lastLoginAt).toLocaleDateString()}` : "never signed in"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPasscodeOff({ kind: "user", m, exempt: !m.noPasscode })}>
                        {m.noPasscode ? "Require passcode" : "Turn passcode off"}
                      </Button>
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

      {companies && companies.some((c) => c.deletedAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Recycle bin</CardTitle>
            <CardDescription>
              Deleted companies stay here, locked out but complete, until their time runs out and they are removed for good. Restore brings one back (disabled).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {companies.filter((c) => c.deletedAt).map((c) => (
              <div key={c.id} className="rounded-md border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      deleted {new Date(c.deletedAt!).toLocaleDateString()} · {c.daysLeft} day{c.daysLeft === 1 ? "" : "s"} left
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => restore(c)}>Restore</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setDeleting(deleting === c.id ? null : c.id); setTypedName(""); }}>
                      Delete forever…
                    </Button>
                  </div>
                </div>
                {deleting === c.id && (
                  <div className="mt-3 space-y-2">
                    <p>
                      This permanently deletes <strong>{c.name}</strong>: all projects, documents, files and financial records, and its people&apos;s accounts. It cannot be undone. Type the company name to confirm.
                    </p>
                    <div className="flex gap-2">
                      <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={c.name} />
                      <Button variant="destructive" disabled={busy || typedName.trim() !== c.name} onClick={() => deleteForever(c)}>
                        Delete forever
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
