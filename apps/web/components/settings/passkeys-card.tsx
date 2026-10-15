"use client";

import * as React from "react";
import { toast } from "sonner";
import { Fingerprint, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { createPasskey, passkeysSupported, passkeyErrorMessage } from "@/lib/passkey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Passkeys: sign in with a fingerprint, face or device PIN. Available to every account. */
export function PasskeysCard({ afterChange }: { afterChange?: () => void }) {
  const utils = trpc.useUtils();
  const list = trpc.passkey.list.useQuery();
  const start = trpc.passkey.registerStart.useMutation();
  const finish = trpc.passkey.registerFinish.useMutation();
  const remove = trpc.passkey.remove.useMutation({
    onSuccess: () => { utils.passkey.list.invalidate(); utils.passkey.status.invalidate(); toast.success("Passkey removed"); },
    onError: (e) => toast.error(e.message),
  });
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [supported, setSupported] = React.useState(true);
  React.useEffect(() => setSupported(passkeysSupported()), []);

  const add = async () => {
    setBusy(true);
    try {
      const { token, options } = await start.mutateAsync();
      const response = await createPasskey(options);
      await finish.mutateAsync({ token, name: name.trim() || "My passkey", response });
      setName("");
      toast.success("Passkey added");
      // The session picks up the new second factor (matters for admins who were asked to set one up).
      await fetch("/api/auth/refresh-session", { method: "POST" });
      utils.passkey.list.invalidate();
      utils.passkey.status.invalidate();
      afterChange?.();
    } catch (e) {
      toast.error(e instanceof Error && !(e instanceof DOMException) ? e.message : passkeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>
          Sign in with your fingerprint, face or device PIN instead of a password. A passkey also counts as your second step, and it works with any email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(list.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <div className="flex items-center gap-2 font-medium"><Fingerprint className="h-4 w-4" /> {p.name}</div>
              <div className="text-muted-foreground">
                Added {new Date(p.createdAt).toLocaleDateString()}
                {p.lastUsedAt ? ` · last used ${new Date(p.lastUsedAt).toLocaleDateString()}` : " · not used yet"}
                {p.synced ? " · synced across your devices" : ""}
              </div>
            </div>
            <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove the passkey "${p.name}"?`)) remove.mutate({ id: p.id }); }}>
              Remove
            </Button>
          </div>
        ))}
        {supported ? (
          <div className="flex gap-2">
            <Input className="max-w-xs" placeholder="Name, for example Work laptop" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <Button onClick={add} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add a passkey
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Passkeys need a secure (https) address, or localhost. Open BidAxiom at its secure address to add one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
