"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/shared/signature-pad";
import { ProposalDocument } from "@/components/proposal/proposal-document";

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const MESSAGES: Record<string, string> = {
  expired: "This link has expired. Please ask the sender for a new one.",
  revoked: "This link is no longer active. Please ask the sender for a new one.",
  superseded: "This proposal has been updated. Please ask the sender for the current version.",
};

/**
 * Public page a customer opens from the emailed link. No account is needed: the link itself is
 * the credential. They review the document, choose optional items, and sign or decline.
 */
export default function SignPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.signing.view.useQuery({ token }, { retry: false, refetchOnWindowFocus: false });
  const [options, setOptions] = React.useState<string[]>([]);
  const preview = trpc.signing.preview.useQuery({ token, optionIds: options }, { enabled: data?.state === "open", placeholderData: (p) => p });
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<"typed" | "drawn">("typed");
  const [image, setImage] = React.useState<string | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [done, setDone] = React.useState<"signed" | "declined" | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);

  const sign = trpc.signing.submit.useMutation({
    onSuccess: () => { setDone("signed"); utils.signing.view.invalidate({ token }); },
    onError: (e) => setProblem(e.message),
  });
  const decline = trpc.signing.decline.useMutation({
    onSuccess: () => setDone("declined"),
    onError: (e) => setProblem(e.message),
  });

  const shell = (children: React.ReactNode) => <div className="min-h-screen bg-muted/50 px-4 py-8">{children}</div>;
  if (isLoading) return shell(<p className="text-center text-sm text-muted-foreground">Loading…</p>);
  if (error || !data) return shell(<p className="mx-auto max-w-md rounded-md border bg-background p-6 text-center text-sm">{error?.message ?? "This link is not valid."}</p>);

  const contact = [data.contact.name, data.contact.email].filter(Boolean).join(" · ");
  if (done === "signed" || data.state === "signed") {
    return shell(
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border bg-background p-6 text-center">
          <h1 className="text-xl font-semibold">{done === "signed" ? "Thank you. It's signed." : "This has been signed."}</h1>
          <p className="mt-2 text-sm text-muted-foreground">A signed copy is on its way to your email{contact ? `. Questions? ${contact}` : ""}.</p>
        </div>
        {data.doc && <div className="flex justify-center overflow-x-auto"><ProposalDocument data={data.doc} /></div>}
      </div>
    );
  }
  if (done === "declined" || data.state === "declined") {
    return shell(<p className="mx-auto max-w-md rounded-md border bg-background p-6 text-center text-sm">You declined this. {data.companyName} has been notified{contact ? `. Contact: ${contact}` : ""}.</p>);
  }
  if (data.state !== "open" || !data.doc) {
    return shell(<p className="mx-auto max-w-md rounded-md border bg-background p-6 text-center text-sm">{MESSAGES[data.state] ?? "This link cannot be used."}{contact ? ` ${contact}` : ""}</p>);
  }

  const doc = data.doc;
  const noun = doc.kind === "change_order" ? "change order" : "proposal";
  const toggle = (id: string) => setOptions((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const canSign = name.trim().length >= 2 && consent && (mode === "typed" || !!image) && !sign.isPending;

  return shell(
    <div className="mx-auto max-w-[900px] space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{data.companyName}</h1>
        <p className="text-sm text-muted-foreground">Please review the {noun} below{doc.view.options.length > 0 ? ", choose any optional items you want," : ""} and sign at the bottom.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="flex justify-center">
          <ProposalDocument data={doc} selectedOptionIds={options} onToggleOption={toggle} optionsTotal={preview.data?.contractValue ?? null} scheduleOverride={preview.data?.schedule ?? null} />
        </div>
      </div>

      <div className="space-y-4 rounded-md border bg-background p-6">
        <h2 className="text-lg font-semibold">Sign</h2>
        {doc.view.options.length > 0 && (
          <p className="text-sm">
            Optional items selected: <strong>{options.length}</strong> of {doc.view.options.length}. Contract total:{" "}
            <strong>{preview.data ? money(preview.data.contractValue) : money(doc.view.total)}</strong>
          </p>
        )}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Your full name</span>
          <input className="w-full rounded-md border bg-background px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <div className="space-y-2 text-sm">
          <div className="flex gap-4">
            <label className="flex items-center gap-1"><input type="radio" checked={mode === "typed"} onChange={() => setMode("typed")} /> Type my signature</label>
            <label className="flex items-center gap-1"><input type="radio" checked={mode === "drawn"} onChange={() => setMode("drawn")} /> Draw my signature</label>
          </div>
          {mode === "typed" ? (
            <div className="flex h-20 items-center rounded-md border bg-white px-4 text-black" style={{ fontFamily: "'Brush Script MT','Segoe Script','Snell Roundhand',cursive", fontSize: 34 }}>
              {name || <span className="text-sm text-gray-400" style={{ fontFamily: "inherit" }}>Your name appears here as your signature</span>}
            </div>
          ) : (
            <SignaturePad onChange={setImage} />
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I agree to sign this {noun} electronically, and I understand my electronic signature has the same effect as a handwritten one. I have reviewed the terms above{doc.view.options.length > 0 ? " and the optional items I selected" : ""}.</span>
        </label>
        {problem && <p className="text-sm text-financial-negative">{problem}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={!canSign}
            onClick={() => {
              setProblem(null);
              sign.mutate({ token, signerName: name.trim(), signatureType: mode, signatureImage: mode === "drawn" ? image : null, acceptedOptionIds: options, consent: true, userAgent: navigator.userAgent });
            }}
          >
            {sign.isPending ? "Signing…" : `Sign and accept${preview.data ? ` (${money(preview.data.contractValue)})` : ""}`}
          </Button>
          <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => setDeclining((d) => !d)}>
            I don&apos;t want to accept
          </button>
        </div>
        {declining && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p>Let {data.companyName} know why (optional). Type your name above, then decline.</p>
            <textarea className="w-full rounded-md border bg-background px-2 py-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="outline" disabled={name.trim().length < 2 || decline.isPending} onClick={() => { setProblem(null); decline.mutate({ token, signerName: name.trim(), reason: reason.trim() || undefined }); }}>
              {decline.isPending ? "Sending…" : "Decline"}
            </Button>
          </div>
        )}
        {contact && <p className="text-xs text-muted-foreground">Questions? {contact}</p>}
      </div>
    </div>
  );
}
