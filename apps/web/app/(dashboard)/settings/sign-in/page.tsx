"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Conn = { id: string; provider: string; issuer: string; clientId: string; verified: boolean; enabled: boolean; enforceSso: boolean; autoProvision: boolean; defaultRole: string; allowedDomains: string[]; youAreLinked: boolean };
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

      {conn && (
        <Card>
          <CardHeader>
            <CardTitle>3. Test and turn on</CardTitle>
            <CardDescription>
              {conn.verified ? "The connection works and your account is linked." : "Sign in through your provider once to confirm the details are right. This also links your own account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant={conn.verified ? "outline" : "default"} onClick={() => { window.location.href = "/api/auth/sso/setup"; }}>
              {conn.verified ? "Test again" : "Test connection"}
            </Button>
            {conn.verified && <Options conn={conn} roles={data.roles} companyCode={data.companyCode} onSaved={refresh} />}
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

function Options({ conn, roles, companyCode, onSaved }: { conn: Conn; roles: { key: string; label: string }[]; companyCode: string; onSaved: () => void }) {
  const [enabled, setEnabled] = React.useState(conn.enabled);
  const [enforce, setEnforce] = React.useState(conn.enforceSso);
  const [auto, setAuto] = React.useState(conn.autoProvision);
  const [role, setRole] = React.useState(conn.defaultRole);
  const [domains, setDomains] = React.useState(conn.allowedDomains.join(", "));
  const save = trpc.sso.update.useMutation({ onSuccess: () => { toast.success("Saved"); onSaved(); }, onError: (e) => toast.error(e.message) });
  const check = (label: string, value: boolean, set: (v: boolean) => void, help: string) => (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1" checked={value} onChange={(e) => set(e.target.checked)} />
      <span><span className="font-medium">{label}</span><br /><span className="text-muted-foreground">{help}</span></span>
    </label>
  );
  return (
    <div className="space-y-4 border-t pt-4">
      {check("Allow single sign-on", enabled, setEnabled, `People choose "Sign in with single sign-on" on the sign-in page and enter your company code${companyCode ? `: ${companyCode}` : ""}.`)}
      {check("Create accounts on first sign-in", auto, setAuto, "Anyone who can sign in through your provider joins this company as the role below. Leave off to join by invitation only.")}
      <label className="block text-sm">
        <span className="font-medium">Role for new accounts</span>
        <select className="mt-1 block h-9 w-64 rounded-md border bg-background px-2" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Only these email domains (optional)</span>
        <Input className="mt-1 max-w-md" placeholder="thomsonenterprises.com" value={domains} onChange={(e) => setDomains(e.target.value)} />
      </label>
      {check("Require single sign-on", enforce, setEnforce, "Members must use it; passwords stop working for them. Admins can still use a password so you can't be locked out.")}
      <Button disabled={save.isPending} onClick={() => save.mutate({ enabled, enforceSso: enforce, autoProvision: auto, defaultRole: role, allowedDomains: domains.split(/[,\s]+/).filter(Boolean) })}>Save options</Button>
    </div>
  );
}
