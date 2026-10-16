"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Conn = { id: string; provider: string; issuer: string; clientId: string; verified: boolean; enabled: boolean; enforceSso: boolean; autoProvision: boolean; defaultRole: string; domains: { id: string; domain: string; verified: boolean }[]; youAreLinked: boolean };
type Preset = { key: string; label: string; field: { name: string; label: string; help: string } | null };

/** Admin: this company's own single sign-on (OpenID Connect). You register an app with your identity provider. */
export default function SignInSettingsPage() {
  const { orgRole } = useAuth();
  const params = useSearchParams();
  const utils = trpc.useUtils();
  const isAdmin = orgRole === "org:admin";
  const { data, isLoading } = trpc.sso.get.useQuery(undefined, { enabled: isAdmin });
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  React.useEffect(() => {
    if (params.get("connected")) toast.success("The connection works and your account is linked. Now turn it on below.");
    const err = params.get("error");
    if (err) toast.error(err);
  }, [params]);

  const refresh = () => utils.sso.get.invalidate();
  const disconnect = trpc.sso.disconnect.useMutation({ onSuccess: () => { refresh(); toast.success("Disconnected"); }, onError: (e) => toast.error(e.message) });

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only a company admin can change sign-in settings.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const conn = data.connection;
  const redirect = `${origin}/api/auth/sso/callback`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Single sign-on</h1>
        <p className="text-muted-foreground">Let your team sign in with your company's own identity provider (Microsoft, Google, Okta and others) instead of a separate BidAxiom password.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Register BidAxiom with your identity provider</CardTitle>
          <CardDescription>
            In your provider's admin area, create an app (a "web" or "OpenID Connect" app) and use this as its redirect (callback) address. Then copy its client ID and client secret.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm">{redirect}</code>
        </CardContent>
      </Card>

      <ConnectionDetails key={conn?.id ?? "new"} presets={data.presets as Preset[]} conn={conn} onSaved={refresh} />

      {conn && <Domains conn={conn} onChanged={refresh} />}

      {conn && (
        <Card>
          <CardHeader>
            <CardTitle>4. Test and turn on</CardTitle>
            <CardDescription>
              {conn.verified ? "The connection works and your account is linked." : "Sign in through your provider once to confirm the details are right. This also links your own account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant={conn.verified ? "outline" : "default"} onClick={() => { window.location.href = "/api/auth/sso/setup"; }}>
              {conn.verified ? "Test again" : "Test connection"}
            </Button>
            {conn.verified && <Options conn={conn} roles={data.roles} onSaved={refresh} />}
            <Status conn={conn} />
            <div>
              <Button variant="outline" onClick={() => { if (window.confirm("Disconnect single sign-on? People will sign in with their BidAxiom passwords again.")) disconnect.mutate(); }}>Disconnect</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConnectionDetails({ presets, conn, onSaved }: { presets: Preset[]; conn: Conn | null; onSaved: () => void }) {
  const [preset, setPreset] = React.useState(conn?.provider ?? "microsoft");
  const [value, setValue] = React.useState(conn?.provider === "oidc" ? conn.issuer : "");
  const [clientId, setClientId] = React.useState(conn?.clientId ?? "");
  const [secret, setSecret] = React.useState("");
  const save = trpc.sso.save.useMutation({
    onSuccess: () => { toast.success("Saved. Now test the connection."); setSecret(""); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const field = presets.find((p) => p.key === preset)?.field ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>2. Enter its details</CardTitle>
        <CardDescription>The client secret is stored encrypted and never shown again{conn ? ". Leave it blank to keep the saved one" : ""}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Provider</span>
          <select className="mt-1 block h-9 w-72 rounded-md border bg-background px-2" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {presets.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        {field && (
          <label className="block text-sm">
            <span className="font-medium">{field.label}</span> <span className="text-muted-foreground">{field.help}</span>
            <Input className="mt-1 max-w-xl" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <label className="block text-sm">
          <span className="font-medium">Client ID</span>
          <Input className="mt-1 max-w-xl" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Client secret</span>
          <Input className="mt-1 max-w-xl" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={conn ? "(saved)" : ""} />
        </label>
        <Button disabled={save.isPending || !clientId.trim() || (!conn && !secret)} onClick={() => save.mutate({ preset: preset as "microsoft" | "google" | "oidc", value, clientId, clientSecret: secret || undefined })}>
          {conn ? "Save changes" : "Save"}
        </Button>
        {conn && <p className="text-xs text-muted-foreground">Changing these turns single sign-on off until you test it again.</p>}
      </CardContent>
    </Card>
  );
}

function Options({ conn, roles, onSaved }: { conn: Conn; roles: { key: string; label: string }[]; onSaved: () => void }) {
  const [enabled, setEnabled] = React.useState(conn.enabled);
  const [enforce, setEnforce] = React.useState(conn.enforceSso);
  const [auto, setAuto] = React.useState(conn.autoProvision);
  const [role, setRole] = React.useState(conn.defaultRole);
  const save = trpc.sso.update.useMutation({ onSuccess: () => { toast.success("Saved"); onSaved(); }, onError: (e) => toast.error(e.message) });
  const check = (label: string, value: boolean, set: (v: boolean) => void, help: string) => (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1" checked={value} onChange={(e) => set(e.target.checked)} />
      <span><span className="font-medium">{label}</span><br /><span className="text-muted-foreground">{help}</span></span>
    </label>
  );
  return (
    <div className="space-y-4 border-t pt-4">
      {check("Allow single sign-on", enabled, setEnabled, "People type their work email on the sign-in page and are sent to your provider automatically when it matches one of your verified domains.")}
      {check("Create accounts on first sign-in", auto, setAuto, "Anyone who can sign in through your provider joins this company as the role below. Leave off to join by invitation only.")}
      <label className="block text-sm">
        <span className="font-medium">Role for new accounts</span>
        <select className="mt-1 block h-9 w-64 rounded-md border bg-background px-2" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
      {check("Require single sign-on", enforce, setEnforce, "Members must use it; passwords stop working for them. Admins can still use a password so you can't be locked out.")}
      <Button disabled={save.isPending} onClick={() => save.mutate({ enabled, enforceSso: enforce, autoProvision: auto, defaultRole: role })}>Save options</Button>
    </div>
  );
}

function Domains({ conn, onChanged }: { conn: Conn; onChanged: () => void }) {
  const [domain, setDomain] = React.useState("");
  const add = trpc.sso.domainAdd.useMutation({
    onSuccess: (r) => { setDomain(""); if (r.verified) toast.success("Domain verified"); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.sso.domainRemove.useMutation({ onSuccess: onChanged, onError: (e) => toast.error(e.message) });
  return (
    <Card>
      <CardHeader>
        <CardTitle>3. Your email domains</CardTitle>
        <CardDescription>
          People whose email ends in one of these domains are sent to your provider when they sign in. We confirm you own a domain by emailing a code to an address there. At least one verified domain is required to turn single sign-on on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conn.domains.map((d) => (
          <DomainRow key={d.id} d={d} onChanged={onChanged} onRemove={() => remove.mutate({ id: d.id })} />
        ))}
        <div className="flex gap-2">
          <Input className="max-w-xs" placeholder="yourcompany.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <Button disabled={add.isPending || !domain.trim()} onClick={() => add.mutate({ domain })}>Add domain</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DomainRow({ d, onChanged, onRemove }: { d: Conn["domains"][number]; onChanged: () => void; onRemove: () => void }) {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const send = trpc.sso.domainSendCode.useMutation({ onSuccess: () => { setSent(true); toast.success("Code sent"); }, onError: (e) => toast.error(e.message) });
  const verify = trpc.sso.domainVerify.useMutation({ onSuccess: () => { toast.success("Domain verified"); onChanged(); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{d.domain} {d.verified ? <span className="text-green-600">✓ verified</span> : <span className="text-amber-600">not verified</span>}</span>
        <Button size="sm" variant="outline" onClick={onRemove}>Remove</Button>
      </div>
      {!d.verified && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input className="max-w-xs" placeholder={`you@${d.domain}`} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button size="sm" disabled={send.isPending || !email.trim()} onClick={() => send.mutate({ id: d.id, email })}>{sent ? "Resend code" : "Email me a code"}</Button>
          </div>
          {sent && (
            <div className="flex gap-2">
              <Input className="w-32" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
              <Button size="sm" disabled={verify.isPending || code.trim().length !== 6} onClick={() => verify.mutate({ id: d.id, code })}>Verify</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Plain statement of what the sign-in page will do right now, so a missing step is obvious. */
function Status({ conn }: { conn: Conn }) {
  const verifiedDomains = conn.domains.filter((d) => d.verified).map((d) => d.domain);
  let tone = "text-amber-700";
  let text: string;
  if (!conn.verified) text = "Not active yet: test the connection above first.";
  else if (!conn.enabled) text = "Not active: tick \"Allow single sign-on\" above and save. Until then the sign-in page only asks for passwords.";
  else if (verifiedDomains.length === 0) text = "Active for your own account only (you tested the connection, so your email is sent to your provider). To include other people, verify their email domain in step 3: their sign-in is routed by the part after the @.";
  else {
    tone = "text-green-700";
    text = `Active. Anyone who types an email ending in ${verifiedDomains.map((d) => "@" + d).join(", ")} is sent to your provider${conn.enforceSso ? ". Administrators can still use a password (the link under the email box on the sign-in page), so a provider outage cannot lock you out" : ""}.`;
  }
  return <p className={`rounded-md border px-3 py-2 text-sm ${tone}`}>{text}</p>;
}
