"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  PSI_UPCHARGE, REBAR_LB_PER_FT, computeConcrete, computeMetalBuilding, applyOverrides, takeoffTotal,
  type ConcreteInputs, type MetalBuildingInputs, type TakeoffLine,
} from "@construction/shared";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { dollars } from "@/components/invoices/invoice-ui";

type Field = { key: string; label: string; unit?: string; options?: string[]; bool?: boolean };
type Section = { title: string; fields: Field[] };

const CONCRETE_SECTIONS: Section[] = [
  { title: "Slab", fields: [
    { key: "widthFt", label: "Width", unit: "ft" }, { key: "lengthFt", label: "Length", unit: "ft" },
    { key: "slabIn", label: "Slab thickness", unit: "in" },
    { key: "psi", label: "Strength", unit: "psi", options: Object.keys(PSI_UPCHARGE) },
    { key: "dirtPadIn", label: "Dirt pad build-up", unit: "in" },
  ] },
  { title: "Beams", fields: [
    { key: "perimBeamWidthIn", label: "Perimeter beam width", unit: "in" }, { key: "perimBeamDepthIn", label: "Perimeter beam depth", unit: "in" },
    { key: "intBeamWidthIn", label: "Interior beam width", unit: "in" }, { key: "intBeamDepthIn", label: "Interior beam depth", unit: "in" },
    { key: "intBeamQty", label: "Interior beams (across the width)" },
  ] },
  { title: "Piers", fields: [
    { key: "piers", label: "Number of piers" }, { key: "pierDiameterIn", label: "Pier diameter", unit: "in" },
    { key: "pierDepthIn", label: "Pier depth", unit: "in" }, { key: "bellPiers", label: "Bell-bottom piers", bool: true },
  ] },
  { title: "Rebar", fields: [
    { key: "rebarSize", label: "Bar size", options: Object.keys(REBAR_LB_PER_FT) }, { key: "rebarSpacingIn", label: "Slab mat spacing, each way", unit: "in" },
    { key: "beamBars", label: "Bars in each beam" },
  ] },
  { title: "Prices", fields: [
    { key: "baseYardCost", label: "3000 psi concrete", unit: "$/yd" }, { key: "dirtLoadCost", label: "Fill dirt", unit: "$ per 7 yd load" },
    { key: "reinforcementPerSf", label: "Reinforcement allowance", unit: "$/sf" },
    { key: "rebarStickCost", label: "Rebar 20' stick (0 = use allowance)", unit: "$" }, { key: "wastePercent", label: "Concrete overage", unit: "%" },
  ] },
];

const METAL_SECTIONS: Section[] = [
  { title: "Building", fields: [
    { key: "widthFt", label: "Width", unit: "ft" }, { key: "lengthFt", label: "Length", unit: "ft" }, { key: "eaveFt", label: "Eave height", unit: "ft" },
  ] },
  { title: "Frame spacing (bays)", fields: [
    { key: "preferredBayFt", label: "Preferred bay", unit: "ft" }, { key: "minBayFt", label: "Shortest bay", unit: "ft" }, { key: "maxBayFt", label: "Longest bay", unit: "ft" },
  ] },
  { title: "Members and panels", fields: [
    { key: "purlinMaxSpacingFt", label: "Purlins, max on center", unit: "ft" }, { key: "girtMaxSpacingFt", label: "Girts, max on center", unit: "ft" },
    { key: "memberLengthFt", label: "Purlin / girt / strut length", unit: "ft" },
    { key: "maxSheetFt", label: "Longest sheet", unit: "ft" }, { key: "roofLapIn", label: "Roof end lap", unit: "in" }, { key: "wallLapIn", label: "Wall end lap", unit: "in" },
    { key: "panelPerFt", label: "Panel price", unit: "$/ft" },
  ] },
  { title: "Doors, awning, gutter", fields: [
    { key: "walkDoors", label: "3070 walk doors" }, { key: "rollUp12", label: "12x12 roll ups" }, { key: "rollUp10", label: "10x10 roll ups" }, { key: "rollUp8", label: "8x8 roll ups" },
    { key: "awningLengthFt", label: "Awning length", unit: "ft" }, { key: "awningProjectionFt", label: "Awning projection", unit: "ft" }, { key: "gutters", label: "Gutter (lots)" },
  ] },
];

export function TakeoffEditor({ projectSlug, takeoffId }: { projectSlug: string; takeoffId: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.takeoff.get.useQuery({ id: takeoffId });
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const { data: targets } = trpc.takeoff.targets.useQuery({ projectId: project?.id ?? "" }, { enabled: !!project?.id });

  const [name, setName] = React.useState("");
  const [inputs, setInputs] = React.useState<Record<string, number | string | boolean>>({});
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [cost, setCost] = React.useState<Record<string, number>>({});
  const [vendors, setVendors] = React.useState<Record<string, string>>({});
  const vendorList = trpc.order.vendorOptions.useQuery();
  const ordered = trpc.takeoff.orders.useQuery({ takeoffId });
  const [dirty, setDirty] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [mode, setMode] = React.useState<"itemized" | "single">("itemized");
  const [margin, setMargin] = React.useState(0);

  React.useEffect(() => {
    if (!data) return;
    setName(data.name);
    setInputs(data.inputs as Record<string, number | string | boolean>);
    setQty(data.qtyOverrides);
    setCost(data.costOverrides);
    setVendors(data.vendorAssignments ?? {});
    setDirty(false);
  }, [data]);

  const save = trpc.takeoff.save.useMutation({
    onSuccess: () => { setDirty(false); utils.takeoff.get.invalidate({ id: takeoffId }); utils.takeoff.list.invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });
  const makePos = trpc.takeoff.createPurchaseOrders.useMutation({
    onSuccess: (r) => {
      utils.takeoff.orders.invalidate({ takeoffId });
      const n = r.orders.length;
      toast.success(`${n} draft purchase order${n === 1 ? "" : "s"} ${r.orders.some((o) => o.added) ? "created or updated" : "created"}`, {
        description: [r.alreadyOrdered ? `${r.alreadyOrdered} line${r.alreadyOrdered === 1 ? " was" : "s were"} already ordered.` : "", r.skippedOther ? `${r.skippedOther} labor or subcontract line${r.skippedOther === 1 ? "" : "s"} left for work orders.` : ""].filter(Boolean).join(" ") || undefined,
      });
    },
    onError: (e) => toast.error("Could not create purchase orders", { description: e.message }),
  });
  const addTo = trpc.takeoff.addToProposal.useMutation({
    onSuccess: (r) => toast.success(`Added ${r.added} line${r.added === 1 ? "" : "s"} to the proposal`, { description: `Materials total ${dollars(r.total)} before margin and tax.` }),
    onError: (e) => toast.error("Could not add to the proposal", { description: e.message }),
  });

  const kind = data?.kind;
  const computed = React.useMemo(() => {
    if (!kind) return null;
    if (kind === "concrete") {
      const r = computeConcrete(inputs as unknown as ConcreteInputs);
      return { lines: applyOverrides(r.lines, qty, cost), concrete: r, metal: null };
    }
    const r = computeMetalBuilding(inputs as unknown as MetalBuildingInputs);
    return { lines: applyOverrides(r.lines, qty, cost), concrete: null, metal: r };
  }, [kind, inputs, qty, cost]);

  if (isLoading || !data || !computed) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const sections = kind === "concrete" ? CONCRETE_SECTIONS : METAL_SECTIONS;
  const lines = computed.lines;
  const total = takeoffTotal(lines);
  const groups = Array.from(new Set(lines.map((l) => l.group)));

  const setInput = (k: string, v: number | string | boolean) => { setInputs((s) => ({ ...s, [k]: v })); setDirty(true); };
  const orderable = (l: TakeoffLine) => !l.info && (l.type === "material" || l.type === "equipment");
  const setVendor = (keys: string[], vendorId: string) => {
    setVendors((s) => {
      const next = { ...s };
      for (const k of keys) { if (vendorId) next[k] = vendorId; else delete next[k]; }
      return next;
    });
    setDirty(true);
  };
  const setOverride = (which: "qty" | "cost", line: TakeoffLine, raw: string) => {
    const fn = which === "qty" ? setQty : setCost;
    fn((s) => {
      const next = { ...s };
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) delete next[line.key]; else next[line.key] = n;
      return next;
    });
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={name || "Takeoff"}
        description={kind === "concrete" ? "Concrete slab: yards, rebar and cost." : "Metal building: material list and cost. Prices are before sales tax; the proposal adds tax on material lines."}
        actions={
          <>
            <Link href={`/projects/${projectSlug}/takeoffs`} className="text-sm text-muted-foreground hover:underline">All takeoffs</Link>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ id: takeoffId, name, inputs, qtyOverrides: qty, costOverrides: cost, vendorAssignments: vendors })}>
              {save.isPending ? "Saving…" : dirty ? "Save" : "Saved"}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Name</span>
            <input className="mt-1 h-9 w-full rounded-md border bg-background px-3" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
          </label>
          {sections.map((s) => (
            <fieldset key={s.title} className="rounded-md border bg-background p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</legend>
              <div className="space-y-2">
                {s.fields.map((f) => (
                  <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                    <span>{f.label}</span>
                    <span className="flex items-center gap-1">
                      {f.bool ? (
                        <input type="checkbox" checked={Boolean(inputs[f.key])} onChange={(e) => setInput(f.key, e.target.checked)} />
                      ) : f.options ? (
                        <select className="h-8 rounded-md border bg-background px-2" value={String(inputs[f.key])}
                          onChange={(e) => setInput(f.key, typeof inputs[f.key] === "number" ? Number(e.target.value) : e.target.value)}>
                          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="number" min={0} step="any" className="h-8 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
                          value={String(inputs[f.key] ?? "")} onChange={(e) => setInput(f.key, e.target.value === "" ? 0 : Number(e.target.value))} />
                      )}
                      {f.unit && <span className="w-14 text-xs text-muted-foreground">{f.unit}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="space-y-4">
          {computed.concrete && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Concrete" value={`${computed.concrete.yards} yd`} sub={`${computed.concrete.yardsWithWaste} yd with overage`} />
              <Stat label="Price per yard" value={dollars(computed.concrete.pricePerYard)} sub={`${inputs.psi} psi`} />
              <Stat label="Rebar" value={`${computed.concrete.rebarSticks} x 20'`} sub={`${computed.concrete.rebarLbs.toLocaleString()} lb`} />
              <Stat label="Dirt" value={`${computed.concrete.dirtYards} yd`} sub={`${dollars(total / Math.max(1, computed.concrete.sqft))}/sf total`} />
            </div>
          )}
          {computed.metal && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Frames" value={String(computed.metal.frames)} sub={`${computed.metal.bays} bay${computed.metal.bays === 1 ? "" : "s"} at ${computed.metal.bayFt} ft`} />
              <Stat label="Wall + roof area" value={`${computed.metal.surfaceSf.toLocaleString()} sf`} sub="drives screws and sealant" />
              <Stat label="Material cost" value={dollars(total)} sub="before sales tax" />
            </div>
          )}
          {[...(computed.concrete?.warnings ?? []), ...(computed.metal?.warnings ?? [])].map((w) => <p key={w} className="text-sm text-amber-600">{w}</p>)}

          <div className="overflow-x-auto rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-2">Item</th><th className="p-2 text-right">Qty</th><th className="p-2">Unit</th><th className="p-2 text-right">Unit cost</th><th className="p-2 text-right">Total</th><th className="p-2">Vendor</th></tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <React.Fragment key={g}>
                    <tr className="bg-muted/40">
                      <td colSpan={5} className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</td>
                      <td className="px-2 py-1">
                        {lines.some((l) => l.group === g && orderable(l)) && (
                          <select aria-label={`Vendor for all ${g}`} className="h-7 w-full max-w-[200px] rounded border bg-background px-1 text-xs font-normal normal-case"
                            value="" onChange={(e) => { if (e.target.value) setVendor(lines.filter((l) => l.group === g && orderable(l)).map((l) => l.key), e.target.value === "__none" ? "" : e.target.value); }}>
                            <option value="">Set all…</option>
                            <option value="__none">No vendor</option>
                            {(vendorList.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                    {lines.filter((l) => l.group === g).map((l) => (
                      <tr key={l.key} className={`border-b last:border-0 ${l.info ? "text-muted-foreground" : ""}`}>
                        <td className="p-2">{l.name}</td>
                        <td className="p-2 text-right">
                          <input aria-label={`${l.name} quantity`} type="number" min={0} step="any" className={`h-7 w-24 rounded border bg-background px-1 text-right tabular-nums ${qty[l.key] !== undefined ? "border-amber-500" : ""}`}
                            key={`q${l.key}${l.quantity}`} defaultValue={String(l.quantity)} onBlur={(e) => { if (e.target.value !== String(l.quantity)) setOverride("qty", l, e.target.value); }} />
                        </td>
                        <td className="p-2">{l.unit}</td>
                        <td className="p-2 text-right">
                          {l.info ? "included" : (
                            <input aria-label={`${l.name} unit cost`} type="number" step="any" className={`h-7 w-24 rounded border bg-background px-1 text-right tabular-nums ${cost[l.key] !== undefined ? "border-amber-500" : ""}`}
                              key={`c${l.key}${l.unitCost}`} defaultValue={String(l.unitCost)} onBlur={(e) => { if (e.target.value !== String(l.unitCost)) setOverride("cost", l, e.target.value); }} />
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums">{l.info ? "" : dollars(l.quantity * l.unitCost)}</td>
                        <td className="p-2">
                          {ordered.data?.byKey[l.key] ? (
                            <Link className="text-xs text-primary hover:underline" href={`/projects/${projectSlug}/orders/${ordered.data.byKey[l.key].orderId}`}>On {ordered.data.byKey[l.key].number}</Link>
                          ) : orderable(l) ? (
                            <select aria-label={`${l.name} vendor`} className="h-7 w-full max-w-[200px] rounded border bg-background px-1 text-xs" value={vendors[l.key] ?? ""} onChange={(e) => setVendor([l.key], e.target.value)}>
                              <option value="">No vendor yet</option>
                              {(vendorList.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          ) : <span className="text-xs text-muted-foreground">{l.info ? "" : "Work order"}</span>}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot><tr className="border-t font-medium"><td className="p-2" colSpan={4}>Material total</td><td className="p-2 text-right tabular-nums">{dollars(total)}</td><td /></tr></tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Edit any quantity or price to override the calculation; overridden values have an amber border. Clear the box to go back to the calculated value.</p>

          <div className="space-y-2 rounded-md border bg-background p-3">
            <h2 className="text-sm font-medium">Purchase orders</h2>
            <p className="text-xs text-muted-foreground">
              Pick a vendor for each material above, then create draft purchase orders: one per vendor, plus one for lines with no vendor yet. Review and issue them from the Purchase Orders tab. Lines already on an order are skipped, so you can run this again after changes. Labor and subcontract lines are left for work orders.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={makePos.isPending || dirty} onClick={() => makePos.mutate({ takeoffId })}>
                {makePos.isPending ? "Creating…" : "Create purchase orders"}
              </Button>
              {dirty && <span className="text-xs text-muted-foreground">Save first so the orders use the numbers and vendors on screen.</span>}
            </div>
            {(ordered.data?.orders ?? []).length > 0 && (
              <ul className="space-y-1 text-sm">
                {ordered.data!.orders.map((o) => (
                  <li key={o.orderId}>
                    <Link className="text-primary hover:underline" href={`/projects/${projectSlug}/orders/${o.orderId}`}>{o.number}</Link>
                    {" "}· {o.vendor ?? "No vendor yet"} · {o.lines} line{o.lines === 1 ? "" : "s"} · {dollars(o.total)} · {o.status}
                  </li>
                ))}
              </ul>
            )}
            {ordered.data && ordered.data.orders.length > 0 && <p className="text-xs text-muted-foreground">If you also copy this takeoff into a proposal that is later accepted, its purchase orders are drafted again from the proposal. Use one route or the other for the same materials.</p>}
          </div>

          <div className="space-y-2 rounded-md border bg-background p-3">
            <h2 className="text-sm font-medium">Copy to a proposal</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select aria-label="Proposal" className="h-9 min-w-[220px] rounded-md border bg-background px-2" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose a draft proposal or change order…</option>
                {(targets ?? []).map((t) => <option key={t.id} value={t.id}>{t.kind === "change_order" ? "Change order: " : "Proposal: "}{t.name}</option>)}
              </select>
              <select aria-label="How to add" className="h-9 rounded-md border bg-background px-2" value={mode} onChange={(e) => setMode(e.target.value as "itemized" | "single")}>
                <option value="itemized">Every material as a line (customer sees one price)</option>
                <option value="single">One lump-sum line</option>
              </select>
              <label className="flex items-center gap-1">Margin
                <input type="number" min={0} max={99} className="h-9 w-16 rounded-md border bg-background px-2 text-right" value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} />%
              </label>
              <Button disabled={!target || addTo.isPending || dirty} onClick={() => addTo.mutate({ takeoffId, estimateId: target, mode, marginPercent: margin })}>
                Add to proposal
              </Button>
            </div>
            {dirty && <p className="text-xs text-muted-foreground">Save your changes first so the copy uses the numbers on screen.</p>}
            {targets && targets.length === 0 && <p className="text-xs text-muted-foreground">No draft proposals on this project yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
