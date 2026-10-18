"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  id: string;
  name: string;
  description: string | null;
  scope: "personal" | "global";
  kind: "group" | "addon";
  appliesTo: string | null;
  isMine: boolean;
  ownerName: string;
  canChange: boolean;
  childCount: number;
  preview: string[];
};

function EditDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? "");
  const [appliesTo, setAppliesTo] = useState(row.appliesTo ?? "");
  const [scope, setScope] = useState<"personal" | "global">(row.scope);
  const save = trpc.proposalTemplate.updateDetails.useMutation({
    onSuccess: () => {
      utils.proposalTemplate.list.invalidate();
      onClose();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pt-name">Name</Label>
            <Input id="pt-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-desc">Description</Label>
            <Input id="pt-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {row.kind === "addon" && (
            <div className="space-y-1">
              <Label htmlFor="pt-applies">Goes with (group name)</Label>
              <Input id="pt-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} />
            </div>
          )}
          {row.isMine && (
            <div className="space-y-1">
              <Label>Who can use it</Label>
              <div className="flex flex-col gap-1 text-sm">
                <label className="flex items-center gap-2"><input type="radio" checked={scope === "personal"} onChange={() => setScope("personal")} />Only me</label>
                <label className="flex items-center gap-2"><input type="radio" checked={scope === "global"} onChange={() => setScope("global")} />Everyone</label>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">To change the lines, add the template to a proposal, edit them there, then use Save as template with the same name to replace it.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || save.isPending}
            onClick={() => save.mutate({ id: row.id, name: name.trim(), description: description.trim() || null, scope: row.isMine ? scope : undefined, appliesTo: row.kind === "addon" ? appliesTo.trim() || null : undefined })}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProposalTemplatesPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.proposalTemplate.list.useQuery();
  const { data: viewer } = trpc.proposalTemplate.viewer.useQuery();
  const [editing, setEditing] = useState<Row | null>(null);
  const done = () => utils.proposalTemplate.list.invalidate();
  const starters = trpc.proposalTemplate.addStarters.useMutation({
    onSuccess: (r) => {
      done();
      toast.success(r.added.length ? `Added ${r.added.length} starter template${r.added.length === 1 ? "" : "s"}` : "The starter templates are already here");
    },
    onError: (e) => toast.error("Could not add the starters", { description: e.message }),
  });
  const remove = trpc.proposalTemplate.remove.useMutation({ onSuccess: done, onError: (e) => toast.error("Could not delete", { description: e.message }) });
  const unshare = trpc.proposalTemplate.unshare.useMutation({ onSuccess: done, onError: (e) => toast.error("Could not remove from shared", { description: e.message }) });

  const rows = data ?? [];
  const shared = rows.filter((t) => t.scope === "global");
  const mine = rows.filter((t) => t.scope === "personal");

  const card = (t: Row) => (
    <Card key={t.id}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {t.name}
              {t.kind === "addon" && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">Add-on{t.appliesTo ? ` to ${t.appliesTo}` : ""}</span>}
            </CardTitle>
            <CardDescription>
              {t.description ? `${t.description} ` : ""}
              {t.childCount} lines{t.scope === "global" ? `, made by ${t.ownerName}` : ""}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {t.canChange && <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>}
            {t.scope === "global" && t.canChange && !t.isMine && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={unshare.isPending}
                onClick={() => {
                  if (confirm(`Remove "${t.name}" from the shared catalog? ${t.ownerName} keeps it as a personal template. Proposals already using it are not affected.`)) unshare.mutate({ id: t.id });
                }}
              >
                Remove from shared
              </Button>
            )}
            {t.isMine && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Delete the template "${t.name}"? Proposals already using it are not affected.`)) remove.mutate({ id: t.id });
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {t.preview.length > 0 && (
        <CardContent>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {t.preview.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proposal templates</h1>
          <p className="max-w-2xl text-muted-foreground">
            A template is a ready-made group of lines: a parent, hidden labor and material lines to build your costs in, and name-only lines that print as inclusions and exclusions. Use Add from template in a proposal or change order to stack as many as the job needs. An add-on is a smaller template, such as a roll-up door, that goes inside a group as extra child lines. Save any group from the builder; keep it to yourself or share it with everyone.
          </p>
        </div>
        {viewer?.isAdmin && (
          <Button variant="outline" onClick={() => starters.mutate()} disabled={starters.isPending}>
            {starters.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add starter templates
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No templates yet. {viewer?.isAdmin ? "Add the starter set (concrete slab, metal building and its add-ons, insulation), or " : ""}open a proposal and use Save as template on any group.
          </CardContent>
        </Card>
      )}
      {shared.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Shared with everyone</h2>
          {shared.map(card)}
        </section>
      )}
      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Only me</h2>
          {mine.map(card)}
        </section>
      )}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
