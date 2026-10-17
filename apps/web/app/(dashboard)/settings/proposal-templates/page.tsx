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

type Row = { id: string; name: string; description: string | null; childCount: number; preview: string[] };

function EditDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? "");
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
          <p className="text-xs text-muted-foreground">To change the lines, add the template to a proposal, edit them there, then use Save as template with the same name to replace it.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ id: row.id, name: name.trim(), description: description.trim() || null })}>
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
  const [editing, setEditing] = useState<Row | null>(null);
  const starters = trpc.proposalTemplate.addStarters.useMutation({
    onSuccess: (r) => {
      utils.proposalTemplate.list.invalidate();
      toast.success(r.added.length ? `Added ${r.added.length} starter template${r.added.length === 1 ? "" : "s"}` : "The starter templates are already here");
    },
    onError: (e) => toast.error("Could not add the starters", { description: e.message }),
  });
  const remove = trpc.proposalTemplate.remove.useMutation({
    onSuccess: () => utils.proposalTemplate.list.invalidate(),
    onError: (e) => toast.error("Could not delete", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proposal templates</h1>
          <p className="max-w-2xl text-muted-foreground">
            A template is a ready-made group of proposal lines: a parent, hidden labor and material lines to build your costs in, and name-only lines that print as inclusions and exclusions. In a proposal, use Add from template to stack as many as the job needs, alongside lines you type yourself.
          </p>
        </div>
        <Button variant="outline" onClick={() => starters.mutate()} disabled={starters.isPending}>
          {starters.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add starter templates
        </Button>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && (data ?? []).length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No templates yet. Add the starter set (concrete slab, metal building, insulation), or open a proposal and use Save as template on any group.
          </CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {(data ?? []).map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{t.name}</CardTitle>
                  <CardDescription>
                    {t.description ? `${t.description} ` : ""}
                    {t.childCount} lines
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
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
        ))}
      </div>
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
