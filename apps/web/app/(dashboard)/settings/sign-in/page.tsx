"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Conn = { id: string; provider: string; enabled: boolean; enforceSso: boolean; autoProvision: boolean; defaultRole: string; allowedDomains: string[]; youAreLinked: boolean };

/** Admin: company sign-in settings. OpenID Connect; Microsoft first, more providers later. */
export default function SignInSettingsPage() {
  const { orgRole } = useAuth();
  const params = useSearchParams();
  const utils = trpc.useUtils();
  const isAdmin = orgRole === "org:admin";
  const { data, isLoading } = trpc.sso.get.useQuery(undefined, { enabled: isAdmin });

  React.useEffect(() => {
    if (params.get("connected")) toast.success("Microsoft is connected. Set the options below.");
    const err = params.get("error");
    if (err) toast.error(err);
  }, [params]);

  const refresh = () => utils.sso.get.invalidate();
  const disconnect = trpc.sso.disconnect.useMutation({ onSuccess: () => { refresh(); toast.success("Disconnected"); }, onError: (e) => toast.error(e.message) });

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Only a company admin can change sign-in settings.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Single sign-on</h1>
        <p className="text-muted-foreground">Let your team sign in with their work account instead of a separate BidAxiom password.</p>
      </div>
      {data.providers.map((p) => {
        const conn = data.connections.find((c) => c.provider === p.key);
        return (
          <Card key={p.key}>
            <CardHeader>
              <CardTitle>{p.label}</CardTitle>
              <CardDescription>
                {!p.configured
                  ? `${p.label} sign-in has not been set up on this server yet (the BidAxiom administrator adds the app credentials).`
                  : conn
                    ? "Your company's directory is connected. People in it sign in with the Sign in with button on the sign-in page."
                    : "Connect your company's directory. You will sign in once with your work account to prove you own it."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conn ? (
                <ConnectionForm conn={conn} roles={data.roles} onSaved={refresh} onDisconnect={() => { if (window.confirm(`Disconnect ${p.label}? People will sign in with their BidAxiom passwords again.`)) disconnect.mutate({ id: conn.id }); }} />
              ) : (
                <Button disabled={!p.configured} onClick={() => { window.location.href = `/api/auth/sso/setup?provider=${p.key}`; }}>Connect {p.label}</Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ConnectionForm({ conn, roles, onSaved, onDisconnect }: { conn: Conn; roles: { key: string; label: string }[]; onSaved: () => void; onDisconnect: () => void }) {
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
    <div className="space-y-4">
      {!conn.youAreLinked && <p className="text-sm text-amber-600">Your own account is not linked yet. Connect again to link it before requiring sign-in.</p>}
      {check("Allow sign-in with Microsoft", enabled, setEnabled, "Turn off to pause it without disconnecting.")}
      {check("Create accounts on first sign-in", auto, setAuto, "Anyone in your Microsoft directory can join this company as the role below. Leave off to join by invitation only.")}
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
      {check("Require Microsoft sign-in", enforce, setEnforce, "Members must use Microsoft; passwords stop working for them. Admins can still use a password so you can't be locked out.")}
      <div className="flex gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate({ id: conn.id, enabled, enforceSso: enforce, autoProvision: auto, defaultRole: role, allowedDomains: domains.split(/[,\s]+/).filter(Boolean) })}>Save</Button>
        <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>
      </div>
    </div>
  );
}
