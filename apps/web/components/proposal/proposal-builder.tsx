"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Loader2, Check, X, StickyNote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  PAYMENT_TERMS,
  computeProposal,
  computeSchedule,
  milestonesTotal100,
  type CostLineInput,
} from "@construction/shared";
import { NumField } from "./num-field";
import { DocumentActions } from "@/components/shared/document-actions";
import { AcceptDialog } from "./accept-dialog";
import { SigningStatus } from "./signing-status";
import { AddAddonsDialog, AddFromTemplateDialog, SaveAsTemplateDialog, attachAddonLines, templateToBuilderLines, type TemplateSelection } from "./template-dialogs";
import {
  COST_TYPES,
  MAX_MARGIN,
  VISIBILITY_LABEL,
  VISIBILITY_NEXT,
  VISIBILITY_TONE,
  type BuilderGlobal,
  type BuilderLine,
  type BuilderMilestone,
  type BuilderSettings,
  type Visibility,
} from "./builder-types";

const COLS =
  "grid-cols-[300px_112px_168px_72px_60px_104px_76px_112px_84px_116px_108px_116px_124px_148px_36px_36px]";

const cellInput =
  "h-7 w-full rounded border border-transparent bg-transparent px-1.5 text-sm text-foreground hover:border-border focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";
const fieldInput =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";
const smallField =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";
const labelText = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const clampCont = (n: number) => Math.min(Math.max(n, 0), 1000);
const clampMargin = (n: number) => Math.min(Math.max(n, 0), MAX_MARGIN);
const newId = () => crypto.randomUUID();

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

interface Props {
  projectSlug: string;
  estimateSlug: string;
}

export function ProposalBuilder({ projectSlug, estimateSlug }: Props) {
  const { data: estimate, isLoading: estimateLoading } = trpc.estimates.getBySlug.useQuery({
    slug: estimateSlug,
  });
  const estimateId = estimate?.id ?? "";
  // Always load fresh from the server when the builder opens (a cached copy from before the
  // last save would otherwise load an empty or outdated proposal). Edits live in local state,
  // so background refetches must never overwrite them: hydration happens once.
  const { data, isLoading: proposalLoading, isFetchedAfterMount } = trpc.proposal.get.useQuery(
    { estimateId },
    { enabled: !!estimateId, refetchOnMount: "always", refetchOnWindowFocus: false, refetchOnReconnect: false, staleTime: 0 }
  );
  const { data: vendorList } = trpc.subcontractor.list.useQuery({});

  const [lines, setLines] = React.useState<BuilderLine[]>([]);
  const [globals, setGlobals] = React.useState<BuilderGlobal[]>([]);
  const [milestones, setMilestones] = React.useState<BuilderMilestone[]>([]);
  const [settings, setSettings] = React.useState<BuilderSettings>({
    name: "",
    salesTaxPercent: 0,
    paymentTerms: "Due on receipt",
    validDays: 30,
  });
  const [blanket, setBlanket] = React.useState(25);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [notesOpen, setNotesOpen] = React.useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "idle" });
  const [focusTick, setFocusTick] = React.useState(0);

  const locked = data?.estimate.isLocked ?? false;
  const isCO = data?.estimate.kind === "change_order";
  // Change orders use the same builder under their own tab.
  const section = isCO ? "change-orders" : "estimates";
  const noun = isCO ? "change order" : "proposal";
  const router = useRouter();
  const utils = trpc.useUtils();
  const createNext = trpc.proposal.createNext.useMutation({
    onSuccess: (r) => {
      toast.success(`Rev ${r.revision} created`);
      utils.estimates.list.invalidate();
      router.push(`/projects/${projectSlug}/estimates/${r.slug}`);
    },
    onError: (e) => toast.error("Could not create a revision", { description: e.message }),
  });
  const reviseCO = trpc.proposal.reviseChangeOrder.useMutation({
    onSuccess: (r) => {
      toast.success(`Rev ${r.revision} created`);
      utils.proposal.listChangeOrders.invalidate();
      router.push(`/projects/${projectSlug}/change-orders/${r.slug}`);
    },
    onError: (e) => toast.error("Could not create a revision", { description: e.message }),
  });
  const setActive = trpc.proposal.setActive.useMutation({
    onSuccess: () => {
      toast.success("Active proposal changed");
      utils.proposal.get.invalidate({ estimateId });
      utils.estimates.list.invalidate();
    },
    onError: (e) => toast.error("Could not change the active proposal", { description: e.message }),
  });
  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const status = data?.estimate.status ?? "draft";
  const latestRevision = data?.estimate.latestRevision ?? null;
  const isActive = data?.estimate.isActive ?? false;

  // Load server data into local editing state once
  React.useEffect(() => {
    if (!data || hydrated || !isFetchedAfterMount) return;
    setLines(
      upgradeLegacy(data.lines.map((l) => ({
        id: l.id,
        parentId: l.parentId,
        type: l.type,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        unitCost: l.unitCost,
        marginPercent: l.marginPercent,
        contingencyPercent: l.contingencyPercent,
        notes: l.notes ?? "",
        visibility: l.visibility as Visibility,
        isOptional: l.isOptional,
        vendorId: l.vendorId,
      })))
    );
    setGlobals(data.globals);
    setMilestones(withBalance(data.milestones));
    setSettings({
      name: data.estimate.name,
      salesTaxPercent: data.estimate.salesTaxPercent,
      paymentTerms: data.estimate.paymentTerms,
      validDays: data.estimate.validDays,
    });
    const firstChild = data.lines.find((l) => l.parentId);
    if (firstChild) setBlanket(firstChild.marginPercent);
    version.current = data.estimate.updatedAt;
    setHydrated(true);
  }, [data, hydrated, isFetchedAfterMount]);

  // ---- calculation (shared module, runs locally for instant totals) ----
  const roundToDollar = data?.roundToDollar ?? false;
  const result = React.useMemo(() => {
    const input: CostLineInput[] = lines.map((l) => ({
      id: l.id,
      parentId: l.parentId,
      type: l.type,
      quantity: l.quantity,
      unitCost: l.unitCost,
      marginPercent: clampMargin(l.marginPercent),
      contingencyPercent: clampCont(l.contingencyPercent),
      isOptional: l.isOptional,
    }));
    return computeProposal({
      lines: input,
      globals: globals.map((g) => ({ id: g.id, amount: g.amount })),
      taxRatePercent: settings.salesTaxPercent,
      roundToDollar,
    });
  }, [lines, globals, settings.salesTaxPercent, roundToDollar]);

  const schedule = React.useMemo(
    () => computeSchedule(result.totals.total, milestones, roundToDollar),
    [result.totals.total, milestones, roundToDollar]
  );
  const schedOk = milestonesTotal100(milestones);
  const schedDiff = 100 - milestones.reduce((a, m) => a + m.percent, 0);

  // ---- autosave ----
  const saveContent = trpc.proposal.saveContent.useMutation();
  const saveSettings = trpc.proposal.updateSettings.useMutation();
  const version = React.useRef<string | undefined>(undefined); // the updatedAt this editor last saw, so a save by someone else is noticed
  const [conflict, setConflict] = React.useState<string | null>(null);
  const inFlight = React.useRef(false);
  const latest = React.useRef({ lines, globals, milestones, settings });
  latest.current = { lines, globals, milestones, settings };

  // Counts edits so a finished save only clears "unsaved" if nothing changed while it ran.
  const editVersion = React.useRef(0);
  const mark = React.useCallback(() => {
    editVersion.current += 1;
    setDirty(true);
    setSaveState({ kind: "idle" });
  }, []);

  React.useEffect(() => {
    if (!dirty || !hydrated || locked || conflict) return;
    const run = async () => {
      if (inFlight.current) return;
      const cur = latest.current;
      const savingVersion = editVersion.current;
      const problem = validate(cur.lines, cur.globals, cur.milestones, cur.settings);
      if (problem) {
        setSaveState({ kind: "error", message: problem });
        return;
      }
      setSaveState({ kind: "saving" });
      inFlight.current = true;
      try {
        const savedSettings = await saveSettings.mutateAsync({
          estimateId,
          expectedUpdatedAt: version.current,
          name: cur.settings.name,
          salesTaxPercent: cur.settings.salesTaxPercent,
          paymentTerms: cur.settings.paymentTerms as (typeof PAYMENT_TERMS)[number],
          validDays: cur.settings.validDays,
        });
        version.current = savedSettings.updatedAt;
        const savedContent = await saveContent.mutateAsync({
          estimateId,
          expectedUpdatedAt: version.current,
          lines: cur.lines.map((l) => ({
            id: l.id,
            parentId: l.parentId,
            type: l.type,
            name: l.name,
            quantity: l.quantity,
            unit: l.unit,
            unitCost: l.unitCost,
            marginPercent: clampMargin(l.marginPercent),
            contingencyPercent: clampCont(l.contingencyPercent),
            notes: l.notes.trim() ? l.notes : null,
            visibility: l.visibility,
            isOptional: l.isOptional,
            vendorId: l.vendorId,
          })),
          globals: cur.globals,
          milestones: cur.milestones,
        });
        if (savedContent.updatedAt) version.current = savedContent.updatedAt;
        if (editVersion.current === savingVersion) setDirty(false);
        setSaveState({ kind: "saved" });
      } catch (err) {
        if ((err as { data?: { code?: string } })?.data?.code === "CONFLICT") {
          setConflict(err instanceof Error ? err.message : "Someone else changed this.");
          setSaveState({ kind: "idle" });
          return;
        }
        setSaveState({ kind: "error", message: err instanceof Error ? err.message : "Could not save" });
      } finally {
        inFlight.current = false;
      }
    };
    const timer = setTimeout(run, 800);
    // A hidden tab's timers are slowed by the browser, which would let an edit made here be saved after a later edit in
    // another tab. Save as soon as this tab is left instead.
    const leave = () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener("visibilitychange", leave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, globals, milestones, settings, dirty, hydrated, locked, estimateId, conflict]);

  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  React.useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = document.querySelector<HTMLInputElement>(`input[data-line-name="${id}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
      el.select();
    }
  }, [lines, collapsed, focusTick]);

  // ---- edit helpers ----
  const patchLine = (id: string, patch: Partial<BuilderLine>) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    mark();
  };
  const setParentMargin = (parentId: string, margin: number) => {
    const m = clampMargin(margin);
    setLines((ls) => ls.map((l) => (l.parentId === parentId || l.id === parentId ? { ...l, marginPercent: m } : l)));
    mark();
  };
  const cycleChild = (id: string) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, visibility: VISIBILITY_NEXT[l.visibility] } : l)));
    mark();
  };
  const cycleAll = (parentId: string) => {
    setLines((ls) => {
      const kids = ls.filter((l) => l.parentId === parentId);
      if (kids.length === 0) return ls;
      const same = kids.every((k) => k.visibility === kids[0].visibility);
      const next: Visibility = same ? VISIBILITY_NEXT[kids[0].visibility] : "name_only";
      return ls.map((l) => (l.parentId === parentId ? { ...l, visibility: next } : l));
    });
    mark();
  };
  const blank = (over: Partial<BuilderLine>): BuilderLine => ({
    id: newId(),
    parentId: null,
    type: "labor",
    name: "",
    quantity: 1,
    unit: "ea",
    unitCost: 0,
    marginPercent: blanket,
    contingencyPercent: 0,
    notes: "",
    visibility: "hidden",
    isOptional: false,
    vendorId: null,
    ...over,
  });
  // Where the cursor should land after the next render (a line was just added or jumped to).
  const pendingFocus = React.useRef<string | null>(null);
  const addParent = () => {
    const parent = blank({ type: "other", name: "", quantity: 0, visibility: "price" });
    const child = blank({ parentId: parent.id, visibility: "name_only" });
    pendingFocus.current = parent.id;
    setLines((ls) => [...ls, parent, child]);
    mark();
  };
  // A new child takes the view its siblings share. When they differ ("Mixed") or there are none,
  // it starts as Name only.
  const addChild = (parentId: string) => {
    const child = blank({ parentId, visibility: "name_only" });
    pendingFocus.current = child.id;
    setLines((ls) => {
      const kids = ls.filter((l) => l.parentId === parentId);
      const same = kids.length > 0 && kids.every((k) => k.visibility === kids[0].visibility);
      child.visibility = same ? kids[0].visibility : "name_only";
      const lastIdx = ls.reduce((acc, l, i) => (l.id === parentId || l.parentId === parentId ? i : acc), -1);
      const copy = [...ls];
      copy.splice(lastIdx + 1, 0, child);
      return copy;
    });
    mark();
  };
  // Move a whole parent line between the base proposal and the optional items (and back).
  const toggleOptional = (id: string) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, isOptional: !l.isOptional } : l)));
    mark();
  };
  const addOption = () => {
    const option = blank({ isOptional: true, type: "other", name: "", quantity: 0, unit: "ls", visibility: "price" });
    const child = blank({ parentId: option.id, visibility: "name_only" });
    pendingFocus.current = option.id;
    setLines((ls) => [...ls, option, child]);
    mark();
  };
  // Templates: stack saved groups onto this proposal, or save one of its groups for reuse.
  const [templatePicker, setTemplatePicker] = React.useState(false);
  const [saveGroupId, setSaveGroupId] = React.useState<string | null>(null);
  const trpcUtils = trpc.useUtils();
  const [addonGroupId, setAddonGroupId] = React.useState<string | null>(null);
  const addTemplates = async (picked: TemplateSelection) => {
    const ids = [...new Set(picked.flatMap((p) => [p.id, ...p.addonIds]))];
    const fetched = await trpcUtils.proposalTemplate.getMany.fetch({ ids });
    const byId = (id: string) => fetched.find((t) => t.id === id);
    const ordered = picked
      .map((p) => {
        const t = byId(p.id);
        return t ? { ...t, addons: p.addonIds.map(byId).filter((a): a is NonNullable<typeof a> => Boolean(a)) } : null;
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    const added = templateToBuilderLines(ordered, blanket);
    if (added.length === 0) return;
    const firstParent = added.find((l) => !l.parentId);
    if (firstParent) pendingFocus.current = firstParent.id;
    setLines((ls) => [...ls, ...added]);
    mark();
    toast.success(ordered.length > 1 ? `Added ${ordered.length} templates` : `Added "${ordered[0]!.name}"`);
  };
  // Add-ons go inside a group already on the proposal, as extra child lines.
  const addAddons = async (parentId: string, addonIds: string[]) => {
    const fetched = await trpcUtils.proposalTemplate.getMany.fetch({ ids: addonIds });
    const ordered = addonIds.map((id) => fetched.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (ordered.length === 0) return;
    setLines((ls) => attachAddonLines(ls, parentId, ordered, blanket));
    setCollapsed((c) => (c[parentId] ? { ...c, [parentId]: false } : c));
    mark();
    toast.success(ordered.length > 1 ? `Added ${ordered.length} options` : `Added "${ordered[0]!.name}"`);
  };
  // Enter in a name box: move to the next line, adding one at the end of the group.
  const onNameEnter = (line: BuilderLine) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || locked) return;
    e.preventDefault();
    const groupId = line.parentId ?? line.id;
    const kids = lines.filter((l) => l.parentId === groupId);
    const next = line.parentId ? kids[kids.findIndex((k) => k.id === line.id) + 1] : kids[0];
    if (next) {
      pendingFocus.current = next.id;
      setCollapsed((c) => (c[groupId] ? { ...c, [groupId]: false } : c));
      focusNow();
    } else {
      addChild(groupId);
    }
  };
  const focusNow = () => setFocusTick((t) => t + 1);
  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id && l.parentId !== id));
    mark();
  };
  const applyBlanket = () => {
    const m = clampMargin(blanket);
    setLines((ls) => ls.map((l) => (l.parentId || l.isOptional ? { ...l, marginPercent: m } : l)));
    mark();
  };

  // ---- derived rows ----
  const parents = lines.filter((l) => !l.parentId && !l.isOptional);
  const options = lines.filter((l) => l.isOptional);
  const childrenOf = (id: string) => lines.filter((l) => l.parentId === id);
  const parentResult = (id: string) => {
    const base = result.parents.find((p) => p.id === id);
    if (base) return base;
    const o = result.options.find((x) => x.id === id);
    return o ? { ...o, globalShare: 0, proposalPrice: o.price } : undefined;
  };
  const vendors = vendorList ?? [];

  if (estimateLoading || proposalLoading || !hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const marginAmt = result.totals.basePrice - result.totals.baseCost;
  const marginPct = result.totals.basePrice > 0 ? (marginAmt / result.totals.basePrice) * 100 : 0;
  const optionsTotal = result.options.reduce((a, o) => a + o.price + o.tax, 0);

  const NotesButton = (line: BuilderLine) => {
    const has = line.notes.trim().length > 0;
    return (
      <button
        type="button"
        aria-label={has ? "Edit internal notes" : "Add internal notes"}
        title={has ? "Internal notes (never shown to customer)" : "Add internal notes"}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted",
          has ? "text-primary" : "text-muted-foreground"
        )}
        onClick={() => setNotesOpen((o) => ({ ...o, [line.id]: !o[line.id] }))}
      >
        <StickyNote className="h-4 w-4" />
      </button>
    );
  };

  const NotesRow = (line: BuilderLine) => {
    if (!notesOpen[line.id]) return null;
    return (
      <div className="flex border-b bg-muted/40">
        <div className="sticky left-0 z-[2] w-[min(720px,90vw)] px-4 py-2 pl-10">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Internal notes · never shown to the customer
          </label>
          <textarea
            rows={2}
            maxLength={5000}
            disabled={locked}
            aria-label="Internal notes"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            value={line.notes}
            onChange={(e) => patchLine(line.id, { notes: e.target.value })}
          />
        </div>
      </div>
    );
  };

  const VendorSelect = ({ line }: { line: BuilderLine }) => (
    <select
      className={cellInput}
      aria-label="Vendor"
      disabled={locked}
      value={line.vendorId ?? ""}
      onChange={(e) => patchLine(line.id, { vendorId: e.target.value || null })}
    >
      <option value="">Unassigned</option>
      {vendors.filter((v) => v.status === "active").map((v) => (
        <option key={v.id} value={v.id}>
          {v.companyName}
        </option>
      ))}
    </select>
  );

  const TypeSelect = ({ line }: { line: BuilderLine }) => (
    <select
      className={cellInput}
      aria-label="Cost type"
      disabled={locked}
      value={line.type}
      onChange={(e) => patchLine(line.id, { type: e.target.value as BuilderLine["type"] })}
    >
      {COST_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );

  const Cells = ({ line, showShare }: { line: BuilderLine; showShare?: boolean }) => {
    const r = result.lines[line.id];
    return (
      <>
        <div className="px-1">{TypeSelect({ line })}</div>
        <div className="px-1">{VendorSelect({ line })}</div>
        <div className="px-1">
          <NumField className={cn(cellInput, "text-right")} aria-label="Quantity" min={0} disabled={locked}
            value={line.quantity} onChange={(v) => patchLine(line.id, { quantity: Math.max(v, 0) })} />
        </div>
        <div className="px-1">
          <input className={cellInput} aria-label="Unit" disabled={locked} value={line.unit}
            onChange={(e) => patchLine(line.id, { unit: e.target.value })} />
        </div>
        <div className="px-1">
          <NumField className={cn(cellInput, "text-right")} aria-label="Unit cost" min={isCO ? undefined : 0} step="0.01" disabled={locked}
            value={line.unitCost} onChange={(v) => patchLine(line.id, { unitCost: isCO ? v : Math.max(v, 0) })} />
        </div>
        <div className="px-1">
          <NumField className={cn(cellInput, "text-right")} aria-label="Contingency percent" min={0} max={1000} step="0.5" disabled={locked}
            value={line.contingencyPercent} onChange={(v) => patchLine(line.id, { contingencyPercent: clampCont(v) })} />
        </div>
        <div className="px-2 text-right tabular-nums">{money(r?.cost ?? 0)}</div>
        <div className="px-1">
          <NumField className={cn(cellInput, "text-right")} aria-label="Line margin percent" min={0} max={MAX_MARGIN} step="0.5"
            disabled={locked} value={line.marginPercent}
            onChange={(v) => patchLine(line.id, { marginPercent: clampMargin(v) })} />
        </div>
        <div className="px-2 text-right tabular-nums">{money(r?.price ?? 0)}</div>
        <div className="px-2 text-right tabular-nums text-financial-positive">{money(r?.profit ?? 0)}</div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {conflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm">
          <div>
            <strong>Not saved.</strong> {conflict} Your last edits here were not saved, so nothing of theirs was overwritten.
          </div>
          <Button type="button" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      )}
      {locked && (status === "submitted" || status === "declined") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted px-4 py-3 text-sm">
          <div>
            <strong>{status === "declined" ? "Declined by the customer." : "Sent to the customer and locked."}</strong>{" "}
            {latestRevision
              ? `A newer revision exists (Rev ${latestRevision.revision}).`
              : "To change it, create a new revision. This one stays as the record of what was sent."}
          </div>
          {latestRevision ? (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/projects/${projectSlug}/${section}/${latestRevision.slug}`}>Open Rev {latestRevision.revision}</Link>
              </Button>
              <Button type="button" onClick={() => setAcceptOpen(true)}>Mark accepted</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" disabled={createNext.isPending || reviseCO.isPending} variant="outline" onClick={() => (isCO ? reviseCO.mutate({ estimateId }) : createNext.mutate({ projectId: data!.estimate.projectId, copyFromId: estimateId }))}>
                {createNext.isPending || reviseCO.isPending ? "Creating…" : "Create new revision"}
              </Button>
              <Button type="button" onClick={() => setAcceptOpen(true)}>Mark accepted</Button>
            </div>
          )}
        </div>
      )}
      {locked && status !== "submitted" && status !== "declined" && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm">
          <strong>Accepted and locked.</strong>{" "}
          {data?.estimate.acceptedAt ? `Accepted ${new Date(data.estimate.acceptedAt).toLocaleDateString()}. ` : ""}
          {isCO ? "Change order value" : "Contract value"} {money(data?.acceptance.contractValue ?? 0)}. {isCO ? "A further change needs a new change order." : "Scope changes go through change orders."}
        </div>
      )}

      <SigningStatus estimateId={estimateId} enabled={locked} />

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-[480px] flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {isCO && data?.estimate.number && <span className="mr-2 text-muted-foreground">{data.estimate.number}{(data.estimate.revision ?? 0) > 0 ? ` Rev ${data.estimate.revision}` : ""}</span>}
            {settings.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              Valid for
              <NumField className={cn(fieldInput, "w-16 text-right")} aria-label="Valid for days" min={1} disabled={locked}
                value={settings.validDays} onChange={(v) => { setSettings((s) => ({ ...s, validDays: Math.max(1, Math.round(v)) })); mark(); }} />
              days
            </label>
            <StatusBadge variant={data?.estimate.status === "draft" ? "draft" : "pending"}>
              {STATUS_LABEL[data?.estimate.status ?? "draft"] ?? data?.estimate.status ?? ""}
            </StatusBadge>
            {isCO ? null : isActive ? (
              <StatusBadge variant="approved">Active proposal</StatusBadge>
            ) : (
              <Button type="button" size="sm" variant="outline" disabled={setActive.isPending} onClick={() => setActive.mutate({ estimateId })}>
                Make active
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {conflict ? <span className="text-sm text-financial-negative">Not saved</span> : <SaveIndicator state={saveState} dirty={dirty} />}
          <DocumentActions
            kind="proposal"
            id={estimateId}
            size="default"
            previewHref={`/projects/${projectSlug}/${section}/${estimateSlug}/preview`}
            disabled={dirty || saveState.kind === "saving"}
            disabledReason="Waiting for your changes to save"
            onSent={() => { utils.proposal.get.invalidate({ estimateId }); }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* ---- Cost table ---- */}
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
          <div className="relative max-h-[70vh] overflow-auto rounded-md border bg-background">
            <div className="min-w-[1790px]">
              <div className={cn("sticky top-0 z-[3] grid h-9 items-center border-b bg-muted text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", COLS)}>
                <div className="sticky left-0 z-[4] flex h-full items-center border-r bg-muted px-4">Item</div>
                <div className="px-2">Type</div>
                <div className="px-2">Vendor</div>
                <div className="px-2 text-right">Qty</div>
                <div className="px-2">Unit</div>
                <div className="px-2 text-right">Unit cost</div>
                <div className="px-2 text-right" title="Percent added to cost for waste or unforeseen expenses">Cont. %</div>
                <div className="px-2 text-right" title="Includes contingency">Cost</div>
                <div className="px-2 text-right">Margin %</div>
                <div className="px-2 text-right">Price</div>
                <div className="px-2 text-right" title="Price minus cost (cost includes contingency). Unspent contingency becomes extra profit at project end.">Profit</div>
                <div className="px-2 text-right">Global share</div>
                <div className="px-2 text-right">Proposal price</div>
                <div className="px-2">On proposal</div>
                <div /><div />
              </div>

              {[...parents, ...options].map((p) => {
                const kids = childrenOf(p.id);
                const pr = parentResult(p.id);
                const isOpt = p.isOptional;
                const open = !collapsed[p.id];
                const totalCost = result.totals.baseCost;
                const share = totalCost > 0 && pr ? pr.cost / totalCost : 0;
                const margins = kids.map((k) => k.marginPercent);
                const uniform = margins.length > 0 && margins.every((m) => m === margins[0]);
                const blended = pr && pr.price > 0 ? (1 - pr.cost / pr.price) * 100 : 0;
                const marginShown = uniform ? margins[0] : Math.round(blended * 10) / 10;
                const vis = kids.map((k) => k.visibility);
                const sameVis = vis.length > 0 && vis.every((v) => v === vis[0]);
                return (
                  <React.Fragment key={p.id}>
                    {isOpt && options[0]?.id === p.id && (
                      <div className="grid min-h-11 grid-cols-[300px_1fr] items-center border-y bg-secondary/50">
                        <div className="sticky left-0 z-[2] flex h-full min-h-11 items-center border-r bg-secondary px-4 text-sm font-semibold">Optional items</div>
                        <div className="px-2 text-[13px] text-muted-foreground">
                          Not in the proposal total. You choose which ones the customer accepted when you mark the proposal accepted.
                        </div>
                      </div>
                    )}
                    <div className={cn("grid min-h-10 items-center border-b bg-muted text-sm font-semibold", COLS)}>
                      <div className="sticky left-0 z-[2] flex h-full min-h-10 items-center gap-1.5 border-r bg-muted px-2">
                        <button type="button" aria-label="Collapse or expand group"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                          onClick={() => setCollapsed((c) => ({ ...c, [p.id]: !c[p.id] }))}>
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
                        </button>
                        <input className={cn(cellInput, "font-semibold")} aria-label={isOpt ? "Optional item name" : "Parent line name"} disabled={locked}
                          data-line-name={p.id} placeholder={isOpt ? "New optional item" : "New parent line"} autoComplete="off" enterKeyHint="next"
                          value={p.name} onChange={(e) => patchLine(p.id, { name: e.target.value })} onKeyDown={onNameEnter(p)} />
                        {isOpt ? (
                          <StatusBadge variant="draft">Optional</StatusBadge>
                        ) : (
                          <span className="whitespace-nowrap rounded bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {(share * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div /><div /><div /><div /><div /><div />
                      <div className="px-2 text-right tabular-nums">{money(pr?.cost ?? 0)}</div>
                      <div className="px-1">
                        <NumField className={cn(cellInput, "text-right")} aria-label="Group margin percent" min={0} max={MAX_MARGIN} step="0.5"
                          disabled={locked || kids.length === 0} value={marginShown} onChange={(v) => setParentMargin(p.id, v)} />
                        {!uniform && kids.length > 0 && (
                          <div className="text-right text-[11px] font-medium text-muted-foreground">blended</div>
                        )}
                      </div>
                      <div className="px-2 text-right tabular-nums">{money(pr?.price ?? 0)}</div>
                      <div className="px-2 text-right tabular-nums text-financial-positive">{money(pr?.profit ?? 0)}</div>
                      <div className="px-2 text-right font-medium tabular-nums text-muted-foreground">{isOpt ? "" : `+${money(pr?.globalShare ?? 0)}`}</div>
                      <div className="px-2 text-right tabular-nums">{money(pr?.proposalPrice ?? 0)}</div>
                      <div className="flex flex-col items-start gap-1 px-2">
                        {kids.length > 0 && (
                          <button type="button" disabled={locked}
                            className={cn("whitespace-nowrap rounded bg-background px-2.5 py-1 text-xs font-semibold hover:bg-border/60", sameVis ? VISIBILITY_TONE[vis[0]] : "text-muted-foreground")}
                            onClick={() => cycleAll(p.id)}>
                            {sameVis ? `All: ${VISIBILITY_LABEL[vis[0]]}` : "Mixed"}
                          </button>
                        )}
                        {!locked && (
                          <button type="button"
                            className="whitespace-nowrap text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            title={isOpt ? "Move this item into the base proposal" : "Make this an optional item the customer can accept or decline"}
                            onClick={() => toggleOptional(p.id)}>
                            {isOpt ? "Make base item" : "Make optional"}
                          </button>
                        )}
                        {!locked && kids.length > 0 && (
                          <button type="button"
                            className="whitespace-nowrap text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            title="Save this group, with its lines, so it can be added to other proposals"
                            onClick={() => setSaveGroupId(p.id)}>
                            Save as template
                          </button>
                        )}
                      </div>
                      <div className="flex justify-center">{NotesButton(p)}</div>
                      <div className="flex justify-center">
                        <RemoveButton label={isOpt ? "Remove optional item and its lines" : "Remove parent line and its children"} disabled={locked} onClick={() => removeLine(p.id)} />
                      </div>
                    </div>

                    {NotesRow(p)}

                    {open && kids.map((c) => (
                      <React.Fragment key={c.id}>
                      <div className={cn("grid min-h-9 items-center border-b text-sm", COLS)}>
                        <div className="sticky left-0 z-[2] flex h-full min-h-9 items-center border-r bg-background pl-10 pr-2">
                          <input className={cellInput} aria-label="Line item name" disabled={locked} value={c.name}
                            data-line-name={c.id} placeholder="New line" autoComplete="off" enterKeyHint="next"
                            onChange={(e) => patchLine(c.id, { name: e.target.value })} onKeyDown={onNameEnter(c)} />
                        </div>
                        {Cells({ line: c })}
                        <div /><div />
                        <div className="px-2">
                          <button type="button" disabled={locked}
                            className={cn("whitespace-nowrap rounded bg-muted px-2.5 py-1 text-xs font-semibold hover:bg-border/60", VISIBILITY_TONE[c.visibility])}
                            onClick={() => cycleChild(c.id)}>
                            {VISIBILITY_LABEL[c.visibility]}
                          </button>
                        </div>
                        <div className="flex justify-center">{NotesButton(c)}</div>
                        <div className="flex justify-center">
                          <RemoveButton label="Remove line" disabled={locked} onClick={() => removeLine(c.id)} />
                        </div>
                      </div>
                      {NotesRow(c)}
                    </React.Fragment>
                    ))}

                    {open && !locked && (
                      <div className="flex border-b">
                        <div className="sticky left-0 z-[2] w-[360px] whitespace-nowrap bg-background py-0.5 pl-10 pr-2">
                          <button type="button" className="text-[13px] font-medium underline underline-offset-4 hover:text-primary"
                            onClick={() => addChild(p.id)}>
                            + Add child line
                          </button>
                          <button type="button" className="ml-4 text-[13px] font-medium underline underline-offset-4 hover:text-primary"
                            title="Add saved options (such as a roll-up door) inside this group"
                            onClick={() => setAddonGroupId(p.id)}>
                            + Add-on
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {!locked && (
                <div className="sticky left-0 flex w-fit gap-2 px-4 py-2.5">
                  <Button type="button" variant="outline" onClick={() => setTemplatePicker(true)}>+ Add from template</Button>
                  <Button type="button" variant="outline" onClick={addParent}>+ Add parent line</Button>
                  <Button type="button" variant="outline" onClick={addOption}>+ Add optional item</Button>
                </div>
              )}
            </div>
          </div>

          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">On proposal:</strong> Price shown lists the child with its price marked as included in the parent, so it is not added again. Name only lists the child without a price. Hidden keeps the line for costing and removes it from the customer&apos;s copy. Margin set on a parent applies to every child; a later edit to a child overrides it. Vendor is optional and only pre-sorts the draft orders; you can change it on the order. Type Other is for inclusion and exclusion wording or notes: it creates no order.
          </p>
        </div>

        {/* ---- Right rail ---- */}
        <div className="flex min-w-[300px] max-w-[380px] flex-[1_1_340px] flex-col gap-3 self-start">

          <section className="flex shrink-0 flex-col gap-1.5 rounded-md border-2 border-primary bg-background p-4 shadow-sm">
            <Row label="Cost" value={money(result.totals.baseCost)} />
            <Row label="Contingency (inside cost)" value={money(result.totals.baseContingency)} />
            <Row label={`Profit (${marginPct.toFixed(1)}% margin)`} value={money(marginAmt)} />
            <Row label="Global costs" value={money(result.totals.globalTotal)} />
            <Row label="Sales tax" value={money(result.totals.tax)} />
            <div className="flex items-baseline justify-between border-t pt-2.5">
              <span className="text-sm font-semibold">{isCO ? "Change order total" : "Proposal total"}</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums">{money(result.totals.total)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-muted-foreground">
              <span>Optional items, not included</span>
              <span className="tabular-nums">{money(optionsTotal)}</span>
            </div>
          </section>
          <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-3 rounded-md border bg-background p-4">
              <div className={labelText}>Adjustments</div>
              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
                  Margin on all lines (%)
                  <NumField className={cn(fieldInput, "text-right")} aria-label="Margin on all lines" min={0} max={MAX_MARGIN} step="0.5"
                    disabled={locked} value={blanket} onChange={(v) => setBlanket(clampMargin(v))} />
                </label>
                <Button type="button" variant="outline" disabled={locked} onClick={applyBlanket}>Apply to all</Button>
              </div>
              <label className="flex flex-col gap-1 text-sm text-muted-foreground">
                Sales tax on material lines (%)
                <NumField className={cn(fieldInput, "text-right")} aria-label="Sales tax percent" min={0} max={100} step="0.05"
                  disabled={locked} value={settings.salesTaxPercent}
                  onChange={(v) => { setSettings((s) => ({ ...s, salesTaxPercent: Math.min(Math.max(v, 0), 100) })); mark(); }} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted-foreground">
                Payment terms
                <select className={fieldInput} disabled={locked} value={settings.paymentTerms}
                  onChange={(e) => { setSettings((s) => ({ ...s, paymentTerms: e.target.value })); mark(); }}>
                  {PAYMENT_TERMS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </label>
            </section>

            <section className="flex flex-col gap-3 rounded-md border bg-background p-4">
              <div className={labelText}>Global costs</div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Split across parent lines by each line&apos;s share of project cost, then added to that line&apos;s price on the proposal.
              </p>
              {globals.map((g) => (
                <div key={g.id} className="grid grid-cols-[1fr_96px_28px] items-center gap-1.5">
                  <input className={smallField} aria-label="Global cost name" disabled={locked} value={g.name}
                    onChange={(e) => { setGlobals((gs) => gs.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x))); mark(); }} />
                  <NumField className={cn(smallField, "text-right")} aria-label="Global cost amount" min={0} step="0.01" disabled={locked}
                    value={g.amount} onChange={(v) => { setGlobals((gs) => gs.map((x) => (x.id === g.id ? { ...x, amount: Math.max(v, 0) } : x))); mark(); }} />
                  <RemoveButton label="Remove global cost" disabled={locked}
                    onClick={() => { setGlobals((gs) => gs.filter((x) => x.id !== g.id)); mark(); }} />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button type="button" size="sm" variant="outline" disabled={locked}
                  onClick={() => { setGlobals((gs) => [...gs, { id: newId(), name: "New global cost", amount: 0 }]); mark(); }}>
                  + Global cost
                </Button>
                <span className="text-sm font-semibold tabular-nums">{money(result.totals.globalTotal)}</span>
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-md border bg-background p-4">
              <div className="flex items-center justify-between">
                <div className={labelText}>Invoicing schedule</div>
                <div className="flex overflow-hidden rounded-md border text-xs font-medium">
                  <span className="bg-muted px-2.5 py-1.5 font-semibold">By total</span>
                  <span className="px-2.5 py-1.5 text-muted-foreground">By line</span>
                </div>
              </div>
              {milestones.map((m, i) => {
                // The last row is the balance: it always equals what the other rows leave over.
                const isBalance = i === milestones.length - 1;
                return (
                  <div key={m.id} className="grid grid-cols-[1fr_60px_92px_28px] items-center gap-1.5">
                    <input className={smallField} aria-label="Milestone name" disabled={locked} value={m.name}
                      onChange={(e) => { setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x))); mark(); }} />
                    {isBalance ? (
                      <div className={cn(smallField, "flex items-center justify-end bg-muted tabular-nums")} title="The balance after the other milestones. It adjusts on its own." aria-label="Percent of total (balance)">
                        {m.percent}
                      </div>
                    ) : (
                      <NumField className={cn(smallField, "text-right")} aria-label="Percent of total" min={0} max={100} step="1" disabled={locked}
                        value={m.percent} onChange={(v) => { setMilestones((ms) => withBalance(ms.map((x) => (x.id === m.id ? { ...x, percent: Math.min(Math.max(v, 0), 100) } : x)))); mark(); }} />
                    )}
                    <div className="text-right text-sm tabular-nums">{money(schedule[i]?.amount ?? 0)}</div>
                    {isBalance ? (
                      <span />
                    ) : (
                      <RemoveButton label="Remove milestone" disabled={locked}
                        onClick={() => { setMilestones((ms) => withBalance(ms.filter((x) => x.id !== m.id))); mark(); }} />
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={locked}
                  onClick={() => {
                    setMilestones((ms) => {
                      // New milestones go above the Substantial Completion balance row.
                      const added = ms.length; // 1 existing row means this is the first extra milestone
                      const name = added <= 1 ? "Material & Mobilization Deposit" : `Draw ${added}`;
                      return withBalance([...ms.slice(0, -1), { id: newId(), name, percent: 0 }, ...ms.slice(-1)]);
                    });
                    mark();
                  }}>
                  + Milestone
                </Button>
              </div>
              <div className={cn("rounded-md bg-muted px-2.5 py-2 text-[13px] font-semibold", schedOk ? "text-financial-positive" : "text-financial-pending")}>
                {schedOk
                  ? "Schedule totals 100%"
                  : schedDiff > 0
                  ? `${schedDiff.toFixed(1)}% unscheduled. Must total 100%.`
                  : `${Math.abs(schedDiff).toFixed(1)}% over. Must total 100%.`}
              </div>
            </section>
          </div>

        </div>
      </div>


      {data && (
        <AcceptDialog
          open={acceptOpen}
          onOpenChange={setAcceptOpen}
          estimateId={estimateId}
          lines={data.lines}
          computed={data.computed}
          milestones={data.milestones}
          roundToDollar={data.roundToDollar}
          changeOrder={isCO}
          onAccepted={() => {
            utils.proposal.get.invalidate({ estimateId });
            utils.order.listCards.invalidate();
            utils.order.projectSummary.invalidate();
            utils.estimates.list.invalidate();
            utils.invoice.list.invalidate();
            utils.proposal.activeForProject.invalidate();
            utils.proposal.listChangeOrders.invalidate();
            // Orders now live in the project's Purchase Orders and Work Orders tabs.
            router.push(isCO ? `/projects/${projectSlug}/change-orders` : `/projects/${projectSlug}/purchase-orders`);
          }}
        />
      )}
        {templatePicker && <AddFromTemplateDialog onClose={() => setTemplatePicker(false)} onAdd={addTemplates} />}
    {addonGroupId && <AddAddonsDialog parentName={lines.find((l) => l.id === addonGroupId)?.name ?? ""} onClose={() => setAddonGroupId(null)} onAdd={(ids) => addAddons(addonGroupId, ids)} />}
    {saveGroupId && <SaveAsTemplateDialog group={lines.filter((l) => l.id === saveGroupId || l.parentId === saveGroupId)} onClose={() => setSaveGroupId(null)} />}
</div>
  );
}

/**
 * Lines saved before groups held their own children: a top-level line with no children and a
 * cost becomes an empty group with that line as its single child.
 */
function upgradeLegacy(lines: BuilderLine[]): BuilderLine[] {
  const hasKids = new Set(lines.filter((l) => l.parentId).map((l) => l.parentId as string));
  const out: BuilderLine[] = [];
  for (const l of lines) {
    if (!l.parentId && !hasKids.has(l.id) && l.quantity * l.unitCost > 0) {
      out.push({ ...l, type: "other", quantity: 0, unitCost: 0, contingencyPercent: 0, notes: l.notes });
      out.push({ ...l, id: crypto.randomUUID(), parentId: l.id, isOptional: false, notes: "" });
    } else {
      out.push(l);
    }
  }
  return out;
}

/**
 * The invoicing schedule always ends with Substantial Completion, which is the balance: 100 minus
 * the other milestones. An empty schedule gets that row. Percents are kept to two decimals.
 */
function withBalance(ms: BuilderMilestone[]): BuilderMilestone[] {
  if (ms.length === 0) return [{ id: crypto.randomUUID(), name: "Substantial Completion", percent: 100 }];
  const others = ms.slice(0, -1).reduce((a, m) => a + Math.round((Number(m.percent) || 0) * 100), 0);
  const balance = Math.max(10000 - others, 0) / 100;
  return ms.map((m, i) => (i === ms.length - 1 ? { ...m, percent: balance } : m));
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Sent",
  accepted: "Accepted",
  under_contract: "Under contract",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function SaveIndicator({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state.kind === "saving")
    return (<span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span>);
  if (state.kind === "error")
    return (<span className="max-w-sm text-sm text-financial-negative">Not saved: {state.message}</span>);
  if (state.kind === "saved" && !dirty)
    return (<span className="flex items-center gap-1.5 text-sm text-financial-positive"><Check className="h-4 w-4" />Saved</span>);
  if (dirty) return <span className="text-sm text-muted-foreground">Unsaved changes…</span>;
  return null;
}

/** Client-side checks that mirror the API so we can say what is wrong instead of failing silently. */
function validate(
  lines: BuilderLine[],
  globals: BuilderGlobal[],
  milestones: BuilderMilestone[],
  settings: BuilderSettings
): string | null {
  if (!settings.name.trim()) return "Give it a name.";
  if (lines.some((l) => !l.name.trim())) return "Every line needs a name.";
  if (lines.some((l) => !l.unit.trim())) return "Every line needs a unit.";
  if (globals.some((g) => !g.name.trim())) return "Every global cost needs a name.";
  if (milestones.some((m) => !m.name.trim())) return "Every milestone needs a name.";
  return null;
}
