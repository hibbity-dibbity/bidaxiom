"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Picked = { id: string; label: string } | null;

/** Choose a project by typing part of its job number or name, or choose none (a general task). */
export function ProjectPicker({ value, onChange }: { value: Picked; onChange: (p: Picked) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = trpc.project.list.useQuery(
    { search: debounced || undefined, sortBy: "createdAt", sortOrder: "desc", limit: 20, offset: 0 },
    { enabled: open },
  );
  const items = data?.items ?? [];
  const label = (p: { jobNumber?: string | null; name: string }) => `${p.jobNumber ? `${p.jobNumber} - ` : ""}${p.name}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? value.label : "No project (general task)"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,24rem)] p-2">
        <Input autoFocus placeholder="Search job number or name" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-2 max-h-64 overflow-auto">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => { onChange(null); setOpen(false); }}
          >
            <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
            No project (general task)
          </button>
          {items.map((p: { id: string; name: string; jobNumber?: string | null }) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => { onChange({ id: p.id, label: label(p) }); setOpen(false); }}
            >
              <Check className={cn("h-4 w-4 shrink-0", value?.id === p.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{label(p)}</span>
            </button>
          ))}
          {isFetching && <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching...</p>}
          {!isFetching && items.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects match.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
