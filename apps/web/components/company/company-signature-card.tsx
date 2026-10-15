"use client";

import * as React from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignaturePad } from "@/components/shared/signature-pad";

const script = { fontFamily: "'Brush Script MT','Segoe Script','Snell Roundhand',cursive" };
const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";

/**
 * The company's stored signature. When a customer signs a proposal or change order, this is applied
 * automatically as the company's countersignature, so nobody has to sign each one by hand.
 */
export function CompanySignatureCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.signing.companyGet.useQuery();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [mode, setMode] = React.useState<"typed" | "drawn">("typed");
  const [image, setImage] = React.useState<string | null>(null);
  const [authorize, setAuthorize] = React.useState(false);
  const done = () => { utils.signing.companyGet.invalidate(); setEditing(false); };
  const save = trpc.signing.companySave.useMutation({
    onSuccess: () => { toast.success("Company signature saved"); done(); },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });
  const disable = trpc.signing.companyDisable.useMutation({
    onSuccess: () => { toast.success("Automatic countersigning is off"); done(); },
    onError: (e) => toast.error("Could not change it", { description: e.message }),
  });

  const startEdit = () => {
    setName(data?.signerName ?? ""); setTitle(data?.signerTitle ?? ""); setMode((data?.signatureType as "typed" | "drawn") ?? "typed");
    setImage(null); setAuthorize(false); setEditing(true);
  };
  const canSave = name.trim().length >= 2 && authorize && (mode === "typed" || !!image) && !save.isPending;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Company signature</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Applied automatically as {"the company's"} countersignature when a customer signs a proposal or change order, so you do not sign each one by hand. The customer gets a copy with both signatures.
      </p>
      {isLoading ? null : !editing ? (
        <div className="space-y-3 text-sm">
          {data ? (
            <>
              <div className="flex h-16 items-end">
                {data.signatureType === "drawn" && data.signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.signatureImage} alt="Company signature" className="max-h-14 rounded border bg-white p-1" />
                ) : (
                  <span style={script} className="text-3xl">{data.signerName}</span>
                )}
              </div>
              <div>
                {data.signerName}{data.signerTitle ? `, ${data.signerTitle}` : ""}.{" "}
                <strong>{data.enabled ? "On" : "Off"}</strong>. Authorized {new Date(data.authorizedAt).toLocaleDateString()}.
              </div>
            </>
          ) : (
            <p>No signature set up yet. Until you add one, signed documents show “Sent electronically” on the company side.</p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={startEdit}>{data ? "Replace signature" : "Set up signature"}</Button>
            {data?.enabled && <Button type="button" variant="outline" disabled={disable.isPending} onClick={() => disable.mutate()}>Turn off</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Only administrators can change this.</p>
        </div>
      ) : (
        <div className="max-w-xl space-y-3 text-sm">
          <label className="block space-y-1"><span className="font-medium">Authorized signer</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>
          <label className="block space-y-1"><span className="font-medium">Title</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Owner, President, ..." />
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1"><input type="radio" checked={mode === "typed"} onChange={() => setMode("typed")} /> Type</label>
            <label className="flex items-center gap-1"><input type="radio" checked={mode === "drawn"} onChange={() => setMode("drawn")} /> Draw</label>
          </div>
          {mode === "typed" ? (
            <div className="flex h-20 items-center rounded-md border bg-white px-4 text-3xl text-black" style={script}>{name || <span className="text-sm text-gray-400">Name appears as the signature</span>}</div>
          ) : (
            <SignaturePad onChange={setImage} />
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={authorize} onChange={(e) => setAuthorize(e.target.checked)} />
            <span>I am authorized to sign for the company, and I authorize BidAxiom to apply this signature automatically when a customer signs a proposal or change order.</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" disabled={!canSave} onClick={() => save.mutate({ signerName: name.trim(), signerTitle: title.trim() || undefined, signatureType: mode, signatureImage: mode === "drawn" ? image : null, authorize: true, enabled: true })}>
              {save.isPending ? "Saving…" : "Save signature"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
