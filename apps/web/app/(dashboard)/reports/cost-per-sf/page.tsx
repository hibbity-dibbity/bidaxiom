"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { LifecyclePhase } from "@construction/shared";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiFilterSelect } from "@/components/shared/list-toolbar";

const PHASES: { value: LifecyclePhase; label: string }[] = [
  { value: "opportunity", label: "Opportunity" },
  { value: "estimating", label: "Estimating" },
  { value: "submitted", label: "Submitted" },
  { value: "awarded", label: "Awarded" },
  { value: "active", label: "Active" },
  { value: "substantial_completion", label: "Substantial Completion" },
  { value: "closed", label: "Closed" },
  { value: "warranty", label: "Warranty" },
  { value: "archived", label: "Archived" },
  { value: "on_hold", label: "On Hold" },
  { value: "lost", label: "Lost" },
];
const DEFAULT_PHASES: LifecyclePhase[] = ["active", "substantial_completion", "closed", "warranty"];

const sf = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export default function CostPerSfPage() {
  const [basis, setBasis] = useState<"projected" | "budget">("projected");
  const [phases, setPhases] = useState<LifecyclePhase[]>(DEFAULT_PHASES);
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = trpc.costPerSf.report.useQuery({ basis, lifecyclePhases: phases.length ? phases : undefined });

  const exportCsv = () => {
    if (!data) return;
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const out: string[] = [];
    out.push(["Category", "Avg $/sf (weighted)", "Job average $/sf", "Low $/sf", "High $/sf", "Jobs", "Total cost"].map(q).join(","));
    for (const s of [...data.stats, data.all]) out.push([s.name, s.weighted, s.jobAverage, s.low, s.high, s.jobs, s.totalCost].map(q).join(","));
    out.push("");
    out.push(["Job number", "Project", "Sq ft", "Total cost", "Total $/sf", ...data.categoryNames.map((n) => `${n} $/sf`)].map(q).join(","));
    for (const r of data.rows) out.push([r.jobNumber ?? "", r.name, r.sqft, r.total, r.perSf, ...data.categoryNames.map((n) => r.byCategory[n] ?? "")].map(q).join(","));
    const url = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-per-sf-${basis}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Reports
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Cost per SF</h1>
            <p className="mt-1 text-muted-foreground">What we pay per square foot for each part of a building, across jobs.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Categories
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!data?.rows.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
          {(
            [
              ["projected", "Projected cost"],
              ["budget", "Budget at acceptance"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setBasis(v)}
              className={`rounded px-3 py-1 ${basis === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <MultiFilterSelect label="Phase" allLabel="All phases" options={PHASES} selected={phases} onChange={(v) => setPhases(v as LifecyclePhase[])} />
        {data && (
          <p className="text-sm text-muted-foreground">
            {data.rows.length} {data.rows.length === 1 ? "job" : "jobs"} measured
            {data.withoutSqft > 0 && (
              <>
                {" · "}
                <Link href="/projects" className="underline underline-offset-2">
                  {data.withoutSqft} without square footage
                </Link>{" "}
                (left out)
              </>
            )}
            {data.withoutCost > 0 && <> · {data.withoutCost} with no cost lines yet</>}
          </p>
        )}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No jobs to measure yet. A job needs square footage (edit the project and fill in Building Size) and purchase or work order lines.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Average cost per square foot</CardTitle>
              <CardDescription>
                Avg $/sf is the total spent on the category divided by the total square feet of the jobs that had it, so bigger buildings count for more.
                Job average is the plain average of each job&apos;s own rate. A job only counts toward a category it spent money on.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Avg $/sf</TableHead>
                    <TableHead className="text-right">Job average</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Total cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stats.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{s.jobs ? sf(s.weighted) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.jobs ? sf(s.jobAverage) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.jobs ? sf(s.low) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.jobs ? sf(s.high) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.jobs}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(s.totalCost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 bg-muted/40">
                    <TableCell className="font-semibold">All costs</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{sf(data.all.weighted)}</TableCell>
                    <TableCell className="text-right tabular-nums">{sf(data.all.jobAverage)}</TableCell>
                    <TableCell className="text-right tabular-nums">{sf(data.all.low)}</TableCell>
                    <TableCell className="text-right tabular-nums">{sf(data.all.high)}</TableCell>
                    <TableCell className="text-right tabular-nums">{data.all.jobs}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(data.all.totalCost)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By job</CardTitle>
              <CardDescription>Each job&apos;s own cost per square foot.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-right">Sq ft</TableHead>
                    <TableHead className="text-right">Total $/sf</TableHead>
                    {data.categoryNames.map((n) => (
                      <TableHead key={n} className="text-right">{n}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.slug ? (
                          <Link href={`/projects/${r.slug}`} className="hover:underline">
                            <span className="text-muted-foreground">{r.jobNumber ? `${r.jobNumber} ` : ""}</span>
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.sqft.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{sf(r.perSf)}</TableCell>
                      {data.categoryNames.map((n) => (
                        <TableCell key={n} className="text-right tabular-nums">{r.byCategory[n] != null ? sf(r.byCategory[n]) : "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.uncategorized.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Not in any category</CardTitle>
                <CardDescription>
                  These cost lines did not match a category&apos;s keywords. Add a keyword (or a new category) under Categories to count them.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {data.uncategorized.map((u) => (
                      <TableRow key={u.description}>
                        <TableCell>{u.description}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{u.count} {u.count === 1 ? "line" : "lines"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(u.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <CategoriesDialog open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

type Row = { name: string; keywords: string };

function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data } = trpc.costPerSf.categories.useQuery(undefined, { enabled: open });
  const [rows, setRows] = useState<Row[] | null>(null);
  const current = useMemo<Row[]>(() => rows ?? (data ?? []).map((c) => ({ name: c.name, keywords: c.keywords.join(", ") })), [rows, data]);

  const save = trpc.costPerSf.saveCategories.useMutation({
    onSuccess: () => {
      toast.success("Categories saved");
      utils.costPerSf.invalidate();
      setRows(null);
      onClose();
    },
    onError: (e) => toast.error(e.message || "Could not save"),
  });

  const set = (i: number, patch: Partial<Row>) => setRows(current.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...current];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (setRows(null), onClose())}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cost categories</DialogTitle>
          <DialogDescription>
            A cost line goes in the first category (top to bottom) that has one of its keywords in the line&apos;s description. Put the more specific ones
            first, for example PEMB Erection above PEMB Material. Keywords are separated by commas and ignore capital letters.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {current.map((r, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Category name" aria-label="Category name" />
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === current.length - 1} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setRows(current.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <Textarea rows={2} value={r.keywords} onChange={(e) => set(i, { keywords: e.target.value })} placeholder="Keywords, e.g. concrete, slab, footing" aria-label="Keywords" />
            </div>
          ))}
          <Button variant="outline" onClick={() => setRows([...current, { name: "", keywords: "" }])}>
            <Plus className="mr-2 h-4 w-4" /> Add category
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => (setRows(null), onClose())}>Cancel</Button>
          <Button
            disabled={save.isPending || current.some((r) => !r.name.trim())}
            onClick={() =>
              save.mutate({
                categories: current.map((r) => ({
                  name: r.name.trim(),
                  keywords: r.keywords.split(",").map((k) => k.trim()).filter(Boolean),
                })),
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
