"use client";

import * as React from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@construction/api/src/trpc/router";

export type ProposalDocData = inferRouterOutputs<AppRouter>["proposal"]["customerView"];

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * The customer-facing proposal or change order, exactly as it is previewed, printed to PDF, and
 * shown on the public signing page. Once signed it shows the signature and a certificate.
 * Pass onToggleOption (with selectedOptionIds and optionsTotal) for the interactive signing page.
 */
export function ProposalDocument({
  data,
  selectedOptionIds,
  onToggleOption,
  optionsTotal,
  scheduleOverride,
}: {
  data: ProposalDocData;
  selectedOptionIds?: string[];
  onToggleOption?: (id: string) => void;
  /** Contract total (cents) with the selected options, while choosing. */
  optionsTotal?: number | null;
  /** Invoicing schedule amounts recomputed for the options being chosen on the signing page. */
  scheduleOverride?: { id: string; amount: number }[] | null;
}) {
  const { view } = data;
  const sig = data.signature;
  const signed = !!sig;
  const chosen = new Set(sig ? sig.acceptedOptionIds : selectedOptionIds ?? []);
  const withOptions = sig ? sig.contractValueCents : optionsTotal ?? null;
  const scheduleAmount = (id: string, fallback: number) => scheduleOverride?.find((r) => r.id === id)?.amount ?? fallback;
  const scheduleHasOptions = view.scheduleOptionIds.length > 0 || (!!scheduleOverride && chosen.size > 0);
  const noun = data.kind === "change_order" ? "change order" : "proposal";
  const dateLabel = new Date(data.sentAt ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return (
  <div id="proposal-doc" className="flex w-full max-w-[860px] flex-col gap-8 border bg-background px-5 py-8 shadow-sm sm:px-16 sm:py-14">
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {data.kind === "change_order" ? `Change order${data.number ? ` ${data.number}` : ""}` : "Proposal"}
        </div>
        <div className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">
          {[data.projectNumber, data.projectName].filter(Boolean).join(" - ") || "Proposal"}
        </div>
        {data.kind === "change_order" && <div className="text-base font-semibold">{data.title}</div>}
        {data.revision > 0 && <div className="text-sm text-muted-foreground">Rev {data.revision}</div>}
        <div className="text-sm text-muted-foreground">Prepared for {data.customerName ?? "[Customer]"}</div>
        {data.poNumber && <div className="text-sm font-semibold">Customer PO: {data.poNumber}</div>}
        {data.projectAddress && <div className="text-sm text-muted-foreground">{data.projectAddress}</div>}
      </div>
      <div className="text-[13px] leading-relaxed text-muted-foreground sm:text-right">
        <span className="font-semibold text-foreground">{data.companyName}</span>
        {data.companyContact.map((line) => (
          <React.Fragment key={line}>
            <br />
            {line}
          </React.Fragment>
        ))}
        <br />
        {dateLabel} · valid {data.validDays} days
      </div>
    </div>

    <section>
      <SectionHead left="Scope of work" right="Price" />
      {view.groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-1.5 border-b py-3.5">
          <div className="flex justify-between gap-4 text-[15px] font-semibold">
            <span className="min-w-0 flex-1">{g.name}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">{money(g.price)}</span>
          </div>
          {g.lines.length > 0 && (
            <div className="flex flex-col gap-1 pl-3 text-sm text-muted-foreground sm:gap-0.5 sm:pl-5">
              {g.lines.map((l) => (
                <div key={l.id} className="flex flex-col justify-between gap-0.5 sm:flex-row sm:gap-4">
                  <span className="min-w-0">{l.name}</span>
                  {l.mode === "price" && l.price !== null && (
                    <span className="shrink-0 whitespace-nowrap tabular-nums italic">{money(l.price)} included above</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-col items-end gap-1.5 pb-2 pt-3.5">
        <TotalRow label="Subtotal" value={money(view.subtotal)} />
        <TotalRow label="Sales tax" value={money(view.tax)} />
        <div className="mt-1 flex w-full max-w-[300px] justify-between border-t-2 border-foreground pt-2 text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(view.total)}</span>
        </div>
      </div>
      {data.contract && (
        <div className="flex flex-col items-end gap-1 pb-2 pt-1">
          <TotalRow label="Contract value before this change order" value={money(data.contract.before)} />
          <TotalRow label="This change order" value={money(data.contract.change)} />
          <div className="flex w-full max-w-[300px] justify-between border-t pt-1.5 text-sm font-semibold">
            <span>New contract value</span>
            <span className="tabular-nums">{money(data.contract.after)}</span>
          </div>
        </div>
      )}
    </section>

    {view.options.length > 0 && (
      <section>
        <SectionHead left="Optional items (not included in the total)" right="Price" />
        {view.options.map((o) => (
          <div key={o.id} className="flex flex-col gap-1.5 border-b py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
              <span className="min-w-[60%] flex-1 font-medium">{o.name}</span>
              {onToggleOption ? (
                  <label className="flex items-center gap-2 whitespace-nowrap text-[13px] print:hidden">
                    <input type="checkbox" className="h-4 w-4" checked={chosen.has(o.id)} onChange={() => onToggleOption(o.id)} aria-label={`Include ${o.name}`} />
                    Include
                  </label>
                ) : (
                  <span className="whitespace-nowrap text-[13px] text-muted-foreground">
                    {signed ? (chosen.has(o.id) ? "☑ Accepted" : "☐ Declined") : "☐ Accept\u00a0\u00a0☐ Decline"}
                  </span>
                )}
              <span className="w-28 shrink-0 text-right font-semibold tabular-nums">{money(o.price)}</span>
            </div>
            {o.lines.length > 0 && (
              <div className="flex flex-col gap-0.5 pl-5 text-[13px] text-muted-foreground">
                {o.lines.map((l) => (
                  <div key={l.id} className="flex flex-col justify-between gap-0.5 sm:flex-row sm:gap-4">
                    <span className="min-w-0">{l.name}</span>
                    {l.mode === "price" && l.price !== null && (
                      <span className="shrink-0 whitespace-nowrap tabular-nums italic">{money(l.price)} included above</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="pt-2 text-xs text-muted-foreground">Sales tax is added to accepted material items.</div>
      </section>
    )}

    <section>
      <SectionHead left="Invoicing schedule" right={data.paymentTerms} />
      <div className="grid grid-cols-[1fr_48px_96px] gap-x-2 sm:grid-cols-[1fr_64px_120px] sm:gap-x-3 text-sm">
        {view.schedule.map((m) => (
          <React.Fragment key={m.id}>
            <span className="border-b py-2.5">{m.name}</span>
            <span className="border-b py-2.5 text-right tabular-nums">{m.percent}%</span>
            <span className="border-b py-2.5 text-right tabular-nums">{money(scheduleAmount(m.id, m.amount))}</span>
          </React.Fragment>
        ))}
      </div>
      {view.options.length > 0 && (
        <div className="pt-2 text-xs text-muted-foreground">
          {scheduleHasOptions
            ? `Amounts include the accepted options, billed on the same percentages.`
            : `Amounts shown for the base ${noun}. Accepted options are invoiced on the same percentages.`}
        </div>
      )}
    </section>

    {data.kind === "change_order" ? (
      <section>
        <SectionHead left="Change Order / Extra Work Authorization" right="" />
        <div className="flex flex-col gap-2 pt-3 text-[10.5px] leading-snug text-muted-foreground">
          {data.terms.sections.map((sec) => (
            <div key={sec.id} style={{ breakInside: "avoid" }}>
              <strong className="text-foreground">{sec.title}</strong>
              {sec.body && <div className="whitespace-pre-wrap">{sec.body}</div>}
            </div>
          ))}
        </div>
      </section>
    ) : data.terms.sections.length === 0 ? null : (
      <section>
        <SectionHead left="Terms and conditions" right={`Master terms, version ${data.terms.version}`} />
        <div className="flex flex-col gap-2 pt-3 text-[10.5px] leading-snug text-muted-foreground">
          {data.terms.sections.map((s, i) => (
            <div key={s.id} style={{ breakInside: "avoid" }}>
              <strong className="text-foreground">{i + 1}. {s.title}</strong>
              {s.body && <div className="whitespace-pre-wrap">{s.body}</div>}
            </div>
          ))}
        </div>
      </section>
    )}

    {sig ? (
        <>
          <div style={{ breakInside: "avoid" }} className="flex flex-wrap gap-8 pt-4 sm:gap-12">
            <div className="min-w-[200px] flex-1">
              <div className="flex h-16 items-end border-b border-foreground pb-1">
                {sig.signatureType === "drawn" && sig.signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sig.signatureImage} alt={`Signature of ${sig.signerName}`} className="max-h-14" />
                ) : (
                  <span style={{ fontFamily: "'Brush Script MT','Segoe Script','Snell Roundhand',cursive" }} className="text-3xl">{sig.signerName}</span>
                )}
              </div>
              <div className="pt-1 text-xs text-muted-foreground">Accepted by {sig.signerName} · {new Date(sig.signedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
            </div>
            <div className="min-w-[200px] flex-1">
              {sig.company ? (
                <>
                  <div className="flex h-16 items-end border-b border-foreground pb-1">
                    {sig.company.type === "drawn" && sig.company.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sig.company.image} alt={`Signature of ${sig.company.name}`} className="max-h-14" />
                    ) : (
                      <span style={{ fontFamily: "'Brush Script MT','Segoe Script','Snell Roundhand',cursive" }} className="text-3xl">{sig.company.name}</span>
                    )}
                  </div>
                  <div className="pt-1 text-xs text-muted-foreground">{data.companyName} · {sig.company.name}{sig.company.title ? `, ${sig.company.title}` : ""} · {new Date(sig.signedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                </>
              ) : (
                <>
                  <div className="flex h-16 items-end border-b border-foreground pb-1 text-sm italic text-muted-foreground">Sent electronically by {data.companyName}</div>
                  <div className="pt-1 text-xs text-muted-foreground">{data.companyName}</div>
                </>
              )}
            </div>
          </div>
          <section style={{ breakInside: "avoid" }} className="rounded border p-4 text-[11px] leading-relaxed text-muted-foreground">
            <div className="pb-1 text-xs font-semibold uppercase tracking-wider text-foreground">Certificate of electronic signature</div>
            <div>Signed by <strong className="text-foreground">{sig.signerName}</strong>{sig.signerEmail ? ` (${sig.signerEmail})` : ""}</div>
            <div>Signed on {new Date(sig.signedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "long" })}</div>
            {sig.ip && <div>From IP address {sig.ip}</div>}
            <div>Signature method: {sig.signatureType === "drawn" ? "drawn" : "typed name"}; the signer agreed to sign electronically.</div>
            {sig.contractValueCents !== null && <div>Contract value accepted: {money(sig.contractValueCents)}{view.options.length > 0 ? ` (${sig.acceptedOptionIds.length} of ${view.options.length} optional items)` : ""}</div>}
            {sig.documentHash && <div className="break-all">Document fingerprint (SHA-256): {sig.documentHash}</div>}
            {sig.company && <div>Countersigned for {data.companyName} by {sig.company.name}{sig.company.title ? `, ${sig.company.title}` : ""}, whose stored signature the company authorized to be applied automatically when a customer signs.</div>}
            <div>Terms version {data.terms.version}. This is a record created by BidAxiom for {data.companyName}.</div>
          </section>
        </>
      ) : (
        <div style={{ breakInside: "avoid" }} className="flex flex-wrap gap-8 pt-4 sm:gap-12">
          <div className="min-w-[200px] flex-1 border-t border-foreground pt-2 text-xs text-muted-foreground">Accepted by (signature and date)</div>
          <div className="min-w-[200px] flex-1 border-t border-foreground pt-2 text-xs text-muted-foreground">{data.companyName} (signature and date)</div>
        </div>
      )}
  </div>
  );
}

function SectionHead({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ breakAfter: "avoid" }} className="flex justify-between gap-4 border-b-2 border-foreground pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full max-w-[300px] justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
