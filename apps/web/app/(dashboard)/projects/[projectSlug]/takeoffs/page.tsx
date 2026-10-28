"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { ListToolbar, ListActions } from "@/components/shared/list-toolbar";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { dollars } from "@/components/invoices/invoice-ui";

const KINDS = { concrete: "Concrete slab", metal_building: "Metal building" } as const;

/** Material takeoffs: enter dimensions, get a priced material list, copy it into a proposal. */
export default function TakeoffsPage({ params }: { params: { projectSlug: string } }) {
  const { projectSlug } = params;
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: project } = trpc.project.getBySlug.useQuery({ slug: projectSlug });
  const projectId = project?.id ?? "";
  const { data: rows, isLoading } = trpc.takeoff.list.useQuery({ projectId }, { enabled: !!projectId });
  const [kind, setKind] = React.useState<keyof typeof KINDS | null>(null);
  const [name, setName] = React.useState("");

  const create = trpc.takeoff.create.useMutation({
    onSuccess: (r) => {
      utils.takeoff.list.invalidate();
      router.push(`/projects/${projectSlug}/takeoffs/${r.id}`);
    },
    onError: (e) => toast.error("Could not create the takeoff", { description: e.message }),
  });
  const remove = trpc.takeoff.remove.useMutation({
    onSuccess: () => utils.takeoff.list.invalidate(),
    onError: (e) => toast.error("Could not delete", { description: e.message }),
  });

  if (!project) return null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Takeoffs"
        description="Enter the dimensions and specs and get a material list with costs. Copy it into a proposal so you don't retype it."
      />
      <ListToolbar
        actions={
          <ListActions
            addMenu={[
              { label: "Concrete slab", onSelect: () => { setKind("concrete"); setName("Concrete slab"); } },
              { label: "Metal building", onSelect: () => { setKind("metal_building"); setName("Metal building"); } },
            ]}
          />
        }
      />
      {kind && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate({ projectId, kind, name: name.trim() });
          }}
        >
          <span className="text-sm text-muted-foreground">{KINDS[kind]}</span>
          <input autoFocus aria-label="Takeoff name" className="h-9 min-w-[240px] flex-1 rounded-md border bg-background px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={create.isPending || !name.trim()}>Create</Button>
          <Button type="button" variant="outline" onClick={() => setKind(null)}>Cancel</Button>
        </form>
      )}
      <div className="rounded-md border bg-background">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !rows || rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No takeoffs yet. Start a concrete or metal building takeoff.</p>
        ) : (
          <div className="table-sheet"><table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3 text-right">Material cost</th><th className="w-12 p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3"><Link className="font-medium hover:underline" href={`/projects/${projectSlug}/takeoffs/${r.id}`}>{r.name}</Link></td>
                  <td className="p-3">{KINDS[r.kind as keyof typeof KINDS] ?? r.kind}</td>
                  <td className="p-3 text-right tabular-nums">{dollars(r.total)}</td>
                  <td className="p-3 text-right">
                    <button aria-label={`Delete ${r.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm(`Delete "${r.name}"?`)) remove.mutate({ id: r.id }); }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
