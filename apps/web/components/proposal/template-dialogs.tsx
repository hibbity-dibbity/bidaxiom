"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BuilderLine } from "./builder-types";

type TemplateLine = Omit<BuilderLine, "isOptional" | "vendorId">;
type TemplateLines = { lines: TemplateLine[] };

const asBuilder = (l: TemplateLine, id: string, parentId: string | null, margin: number): BuilderLine => ({
  ...l,
  id,
  parentId,
  // A margin saved in the template is kept; otherwise the group's margin (or the proposal's standard margin) applies.
  marginPercent: l.marginPercent > 0 ? l.marginPercent : margin,
  notes: l.notes ?? "",
  isOptional: false,
  vendorId: null,
});

/**
 * Put add-on lines inside a group that is already in `existing`, as more child lines of that parent. They go in just before
 * the group's first "Excludes" line, so the customer reads the inclusions together and the exclusions last.
 */
export function attachAddonLines(existing: BuilderLine[], parentId: string, addons: TemplateLines[], defaultMargin: number): BuilderLine[] {
  const kids = existing.filter((l) => l.parentId === parentId);
  const margins = kids.map((k) => k.marginPercent);
  const groupMargin = margins.length > 0 && margins.every((m) => m === margins[0]) && margins[0]! > 0 ? margins[0]! : defaultMargin;
  const added: BuilderLine[] = [];
  for (const a of addons) {
    for (const l of a.lines) added.push(asBuilder(l, crypto.randomUUID(), parentId, groupMargin));
  }
  if (added.length === 0) return existing;
  const firstExclusion = kids.find((k) => /^\s*exclu/i.test(k.name));
  let at: number;
  if (firstExclusion) at = existing.indexOf(firstExclusion);
  else if (kids.length > 0) at = existing.indexOf(kids[kids.length - 1]!) + 1;
  else at = existing.findIndex((l) => l.id === parentId) + 1;
  return [...existing.slice(0, at), ...added, ...existing.slice(at)];
}

/** Turn template lines into proposal lines: fresh ids, one new parent group per template, in the order given, with any add-ons inside it. */
export function templateToBuilderLines(templates: Array<TemplateLines & { addons?: TemplateLines[] }>, defaultMargin: number): BuilderLine[] {
  let out: BuilderLine[] = [];
  for (const t of templates) {
    const idMap = new Map(t.lines.map((l) => [l.id, crypto.randomUUID()]));
    let chunk = t.lines.map((l) => asBuilder(l, idMap.get(l.id)!, l.parentId ? idMap.get(l.parentId) ?? null : null, defaultMargin));
    const parent = chunk.find((l) => !l.parentId);
    if (parent && t.addons?.length) chunk = attachAddonLines(chunk, parent.id, t.addons, defaultMargin);
    out = [...out, ...chunk];
  }
  return out;
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function ScopeBadge({ scope }: { scope: "personal" | "global" }) {
  return scope === "personal" ? <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">Only me</span> : null;
}

export type TemplateSelection = Array<{ id: string; addonIds: string[] }>;

/** Pick one or more templates; each is added to the proposal (or change order) as its own group, stacked after what is already there. */
export function AddFromTemplateDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (picked: TemplateSelection) => Promise<void> | void }) {
  const { data, isLoading } = trpc.proposalTemplate.list.useQuery();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [addonPicks, setAddonPicks] = React.useState<Record<string, string[]>>({});
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAddon = (groupId: string, addonId: string) =>
    setAddonPicks((m) => {
      const cur = m[groupId] ?? [];
      return { ...m, [groupId]: cur.includes(addonId) ? cur.filter((x) => x !== addonId) : [...cur, addonId] };
    });
  const groups = (data ?? []).filter((t) => t.kind === "group");
  const addons = (data ?? []).filter((t) => t.kind === "addon");
  const shown = groups.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add from templates</DialogTitle>
          <DialogDescription>Tick as many as you need. Each one is added as its own group. Options that go inside a group appear under it once you tick it.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search templates" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No templates yet. An administrator can add the starter set in Settings, under Proposal templates, or save any group as a template.</p>
          )}
          {shown.map((t) => {
            const order = picked.indexOf(t.id);
            const related = addons.filter((a) => norm(a.appliesTo) === norm(t.name));
            return (
              <div key={t.id} className="rounded-md border hover:bg-muted/30">
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={order >= 0} onChange={() => toggle(t.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {t.name}
                      <ScopeBadge scope={t.scope} />
                      {order >= 0 && <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">{order + 1}</span>}
                    </div>
                    {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                    <div className="text-xs text-muted-foreground">{t.childCount} lines{t.preview.length ? `, ${t.preview.length} shown to the customer` : ""}</div>
                  </div>
                </label>
                {order >= 0 && related.length > 0 && (
                  <div className="space-y-1 border-t bg-muted/30 px-3 py-2 pl-10">
                    <div className="text-xs font-medium text-muted-foreground">Options inside {t.name}</div>
                    {related.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" className="h-4 w-4" checked={(addonPicks[t.id] ?? []).includes(a.id)} onChange={() => toggleAddon(t.id, a.id)} />
                        {a.name}
                        <ScopeBadge scope={a.scope} />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={picked.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAdd(picked.map((id) => ({ id, addonIds: addonPicks[id] ?? [] })));
                onClose();
              } catch (e) {
                toast.error("Could not add the templates", { description: e instanceof Error ? e.message : undefined });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {picked.length > 1 ? `${picked.length} templates` : "template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pick add-ons (roll-up door, awning...) to put inside one group that is already on the proposal. */
export function AddAddonsDialog({ parentName, onClose, onAdd }: { parentName: string; onClose: () => void; onAdd: (addonIds: string[]) => Promise<void> | void }) {
  const { data, isLoading } = trpc.proposalTemplate.list.useQuery();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const addons = (data ?? []).filter((t) => t.kind === "addon");
  const suggested = addons.filter((a) => norm(a.appliesTo) === norm(parentName));
  const others = addons.filter((a) => norm(a.appliesTo) !== norm(parentName));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const row = (a: (typeof addons)[number]) => (
    <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          {a.name}
          <ScopeBadge scope={a.scope} />
        </div>
        {a.description && <div className="text-sm text-muted-foreground">{a.description}</div>}
        {a.preview.map((p, i) => (
          <div key={i} className="text-xs text-muted-foreground">{p}</div>
        ))}
      </div>
    </label>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add options to {parentName || "this group"}</DialogTitle>
          <DialogDescription>Their lines are added inside this group, so their cost rolls into the group price.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && addons.length === 0 && (
            <p className="text-sm text-muted-foreground">No add-on templates yet. In a group, tick some of its lines and use Save as template, choosing Add-on.</p>
          )}
          {suggested.length > 0 && <div className="text-xs font-medium text-muted-foreground">Made for {parentName}</div>}
          {suggested.map(row)}
          {others.length > 0 && <div className="pt-1 text-xs font-medium text-muted-foreground">Other add-ons</div>}
          {others.map(row)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={picked.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAdd(picked);
                onClose();
              } catch (e) {
                toast.error("Could not add the options", { description: e instanceof Error ? e.message : undefined });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {picked.length > 1 ? `${picked.length} options` : "option"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Save a group (the parent and its child lines), or some of its child lines as an add-on, as a reusable template. */
export function SaveAsTemplateDialog({ group, onClose }: { group: BuilderLine[]; onClose: () => void }) {
  const parent = group.find((l) => !l.parentId);
  const kids = group.filter((l) => l.parentId);
  const [mode, setMode] = React.useState<"group" | "addon">("group");
  const [scope, setScope] = React.useState<"personal" | "global">("personal");
  const [name, setName] = React.useState(parent?.name ?? "");
  const [description, setDescription] = React.useState("");
  const [appliesTo, setAppliesTo] = React.useState(parent?.name ?? "");
  const [chosen, setChosen] = React.useState<string[]>(kids.map((k) => k.id));
  const { data: existing } = trpc.proposalTemplate.list.useQuery();
  const same = (existing ?? []).find((t) => norm(t.name) === norm(name) && (t.isMine || (scope === "global" && t.scope === "global" && t.canChange)));
  const utils = trpc.useUtils();
  const save = trpc.proposalTemplate.save.useMutation({
    onSuccess: (r) => {
      toast.success(r.replaced ? "Template updated" : "Template saved");
      utils.proposalTemplate.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Could not save the template", { description: e.message }),
  });
  const toLine = (l: BuilderLine, parentId: string | null) => ({
    id: l.id,
    parentId,
    type: l.type,
    name: l.name || "Untitled",
    quantity: l.quantity,
    unit: l.unit || "ea",
    unitCost: Math.max(0, l.unitCost),
    marginPercent: l.marginPercent,
    contingencyPercent: l.contingencyPercent,
    notes: l.notes || null,
    visibility: l.visibility,
  });
  const lines = mode === "group" ? group.map((l) => toLine(l, l.parentId)) : kids.filter((k) => chosen.includes(k.id)).map((l) => toLine(l, null));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>Saves the lines with their types, hidden settings and any costs you entered.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>What to save</Label>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "group"} onChange={() => { setMode("group"); if (!name.trim()) setName(parent?.name ?? ""); }} />
                The whole group, as its own template
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={mode === "addon"} onChange={() => { setMode("addon"); if (name === parent?.name) setName(""); }} />
                Add-on: chosen lines that go inside a group (a roll-up door in a metal building)
              </label>
            </div>
          </div>
          {mode === "addon" && (
            <div className="space-y-1">
              <Label>Lines in the add-on</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                {kids.map((k) => (
                  <label key={k.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={chosen.includes(k.id)} onChange={() => setChosen((c) => (c.includes(k.id) ? c.filter((x) => x !== k.id) : [...c, k.id]))} />
                    <span className="truncate">{k.name || "Untitled"}</span>
                    <span className="text-xs text-muted-foreground">{k.visibility === "hidden" ? "hidden" : k.visibility === "name_only" ? "name only" : "price"}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            {same && <p className="text-xs text-destructive">You already have a template with this name{same.isMine ? "" : " in the shared catalog"}. Saving replaces it.</p>}
          </div>
          {mode === "addon" && (
            <div className="space-y-1">
              <Label htmlFor="tpl-applies">Goes with (group name)</Label>
              <Input id="tpl-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} />
              <p className="text-xs text-muted-foreground">It is offered under that group when you add it from a template. Leave blank to offer it only from a group&apos;s own add-ons button.</p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Who can use it</Label>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={scope === "personal"} onChange={() => setScope("personal")} />
                Only me
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={scope === "global"} onChange={() => setScope("global")} />
                Everyone (shared catalog; an administrator can take it back out)
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || lines.length === 0 || save.isPending}
            onClick={() => save.mutate({ name: name.trim(), description: description.trim() || null, scope, kind: mode, appliesTo: mode === "addon" ? appliesTo.trim() || null : null, lines })}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {same ? "Replace template" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
