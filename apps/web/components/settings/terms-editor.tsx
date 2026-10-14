"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAbilities } from "@/lib/abilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";

interface Section {
  key: string;
  title: string;
  body: string;
}

const fieldInput =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

const newKey = () => crypto.randomUUID();

/**
 * Master text for one kind of document: proposal terms and conditions, or the change order
 * authorization. Saving creates a new version; documents already sent keep the version they
 * were sent with.
 */
export function TermsEditor({ kind, title, description, footnote }: { kind: "proposal" | "change_order"; title: string; description: string; footnote: string }) {
  const utils = trpc.useUtils();
  const abilities = useAbilities();
  const canManage = abilities.can("manage", "CompanySettings");
  const { data, isLoading } = trpc.terms.current.useQuery({ kind });
  const [sections, setSections] = React.useState<Section[]>([]);
  const [loadedVersion, setLoadedVersion] = React.useState<number | null>(null);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (!data || data.version === loadedVersion) return;
    setSections(data.sections.map((s) => ({ key: s.id, title: s.title, body: s.body })));
    setLoadedVersion(data.version);
    setDirty(false);
  }, [data, loadedVersion]);

  const save = trpc.terms.save.useMutation({
    onSuccess: (saved) => {
      toast.success(`Saved as version ${saved.version}`);
      utils.terms.current.setData({ kind }, saved);
    },
    onError: (e) => toast.error("Could not save terms", { description: e.message }),
  });

  const patch = (i: number, p: Partial<Section>) => {
    setSections((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setSections((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const copy = [...ss];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  };
  const remove = (i: number) => {
    setSections((ss) => ss.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const add = () => {
    setSections((ss) => [...ss, { key: newKey(), title: "New section", body: "" }]);
    setDirty(true);
  };

  const onSave = () => {
    if (sections.some((s) => !s.title.trim())) {
      toast.error("Every section needs a title");
      return;
    }
    save.mutate({ kind, sections: sections.map((s) => ({ title: s.title.trim(), body: s.body })) });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/settings" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant="draft">Version {data.version}</StatusBadge>
            <Button type="button" disabled={!canManage || !dirty || save.isPending} onClick={onSave}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-md border bg-muted px-4 py-3 text-sm">Only company administrators can edit the terms.</div>
      )}

      {sections.map((s, i) => (
        <section key={s.key} className="flex flex-col gap-3 rounded-md border bg-background p-4">
          <div className="flex items-center gap-2">
            <span className="w-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{i + 1}.</span>
            <input className={fieldInput} aria-label="Section title" disabled={!canManage} value={s.title}
              onChange={(e) => patch(i, { title: e.target.value })} />
            <Button type="button" variant="ghost" size="sm" disabled={!canManage || i === 0} onClick={() => move(i, -1)} aria-label="Move section up">Up</Button>
            <Button type="button" variant="ghost" size="sm" disabled={!canManage || i === sections.length - 1} onClick={() => move(i, 1)} aria-label="Move section down">Down</Button>
            <Button type="button" variant="ghost" size="sm" className="text-financial-negative" disabled={!canManage} onClick={() => remove(i)} aria-label="Remove section">Remove</Button>
          </div>
          <textarea
            className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            aria-label="Section text"
            disabled={!canManage}
            value={s.body}
            onChange={(e) => patch(i, { body: e.target.value })}
          />
        </section>
      ))}

      <div>
        <Button type="button" variant="outline" disabled={!canManage} onClick={add}>+ Add section</Button>
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">{footnote}</p>
    </div>
  );
}
