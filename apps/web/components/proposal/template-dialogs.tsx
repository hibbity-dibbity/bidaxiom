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

/** Turn template lines into proposal lines: fresh ids, one new parent group per template, in the order given. */
export function templateToBuilderLines(
  templates: Array<{ lines: Array<Omit<BuilderLine, "isOptional" | "vendorId">> }>,
  defaultMargin: number
): BuilderLine[] {
  const out: BuilderLine[] = [];
  for (const t of templates) {
    const idMap = new Map(t.lines.map((l) => [l.id, crypto.randomUUID()]));
    for (const l of t.lines) {
      out.push({
        ...l,
        id: idMap.get(l.id)!,
        parentId: l.parentId ? idMap.get(l.parentId) ?? null : null,
        // A margin saved in the template is kept; otherwise the proposal's standard margin applies.
        marginPercent: l.marginPercent > 0 ? l.marginPercent : defaultMargin,
        notes: l.notes ?? "",
        isOptional: false,
        vendorId: null,
      });
    }
  }
  return out;
}

/** Pick one or more templates; each is added to the proposal as its own group, stacked after what is already there. */
export function AddFromTemplateDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (ids: string[]) => Promise<void> | void }) {
  const { data, isLoading } = trpc.proposalTemplate.list.useQuery();
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const shown = (data ?? []).filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add from templates</DialogTitle>
          <DialogDescription>Tick as many as you need. Each one is added as its own group, and you can still add your own lines or other templates after.</DialogDescription>
        </DialogHeader>
        <Input placeholder="Search templates" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No templates yet. Add the starter set in Settings, under Proposal templates, or save any group in a proposal as a template.</p>
          )}
          {shown.map((t) => {
            const order = picked.indexOf(t.id);
            return (
              <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={order >= 0} onChange={() => toggle(t.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-medium">
                    {t.name}
                    {order >= 0 && <span className="rounded bg-primary px-1.5 text-xs text-primary-foreground">{order + 1}</span>}
                  </div>
                  {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                  <div className="text-xs text-muted-foreground">{t.childCount} lines{t.preview.length ? `, ${t.preview.length} shown to the customer` : ""}</div>
                </div>
              </label>
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
                await onAdd(picked);
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

/** Save a group (the parent and its child lines) from this proposal as a reusable template. */
export function SaveAsTemplateDialog({ group, onClose }: { group: BuilderLine[]; onClose: () => void }) {
  const parent = group.find((l) => !l.parentId);
  const [name, setName] = React.useState(parent?.name ?? "");
  const [description, setDescription] = React.useState("");
  const { data: existing } = trpc.proposalTemplate.list.useQuery();
  const replaces = (existing ?? []).some((t) => t.name.toLowerCase() === name.trim().toLowerCase());
  const utils = trpc.useUtils();
  const save = trpc.proposalTemplate.save.useMutation({
    onSuccess: (r) => {
      toast.success(r.replaced ? "Template updated" : "Template saved");
      utils.proposalTemplate.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Could not save the template", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>Saves this group with all of its lines, including hidden ones and any costs you entered.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            {replaces && <p className="text-xs text-destructive">A template with this name exists. Saving replaces it.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate({
                name: name.trim(),
                description: description.trim() || null,
                lines: group.map((l) => ({
                  id: l.id,
                  parentId: l.parentId,
                  type: l.type,
                  name: l.name || "Untitled",
                  quantity: l.quantity,
                  unit: l.unit || "ea",
                  unitCost: Math.max(0, l.unitCost),
                  marginPercent: l.marginPercent,
                  contingencyPercent: l.contingencyPercent,
                  notes: l.notes || null,
                  visibility: l.visibility,
                })),
              })
            }
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {replaces ? "Replace template" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
