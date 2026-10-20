"use client";

import { DateInput } from "@/components/ui/date-input";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmailDocumentDialog } from "@/components/shared/email-document-dialog";

type Action =
  | { kind: "phase"; label: string; phase: string }
  | { kind: "set_start_date"; label: string }
  | { kind: "email_invoice"; label: string; invoiceId: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "dismiss"; label: string };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The bell: things that need an answer ("send the deposit invoice", "mark this project Active"), each with
 * buttons that do the work, so nobody has to go find the project and make the change.
 */
export function AttentionBell() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data } = trpc.attention.list.useQuery(undefined, { refetchInterval: 120_000, refetchOnWindowFocus: true });
  const items = data ?? [];
  const [open, setOpen] = React.useState(false);
  const [dateFor, setDateFor] = React.useState<string | null>(null);
  const [date, setDate] = React.useState(todayStr());
  const [emailInvoice, setEmailInvoice] = React.useState<string | null>(null);

  const refreshAll = () => {
    utils.attention.list.invalidate();
    utils.project.invalidate();
    utils.invoice.invalidate();
    utils.dashboard.invalidate();
  };
  const act = trpc.attention.act.useMutation({
    onSuccess: () => {
      toast.success("Done");
      setDateFor(null);
      refreshAll();
    },
    onError: (e) => toast.error("That did not work", { description: e.message }),
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <Bell className="h-4 w-4" />
            {items.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {items.length > 9 ? "9+" : items.length}
              </span>
            )}
            <span className="sr-only">{items.length > 0 ? `${items.length} items need your attention` : "Notifications"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
          <div className="border-b px-4 py-3 text-sm font-semibold">Needs your attention</div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing needs an answer right now.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y overflow-y-auto">
              {items.map((it) => {
                const actions = (it.actions ?? []) as unknown as Action[];
                return (
                  <li key={it.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="font-semibold">{it.title}</div>
                    {it.body && <p className="text-muted-foreground">{it.body}</p>}
                    {it.projectSlug && (
                      <Link href={`/projects/${it.projectSlug}`} onClick={() => setOpen(false)} className="inline-block text-xs text-muted-foreground underline underline-offset-2">
                        Open project
                      </Link>
                    )}
                    {dateFor === it.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <DateInput className="h-8 rounded-md border bg-background px-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
                        <Button size="sm" disabled={act.isPending || !date} onClick={() => act.mutate({ id: it.id, index: actions.findIndex((a) => a.kind === "set_start_date"), startDate: date })}>Save date</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDateFor(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {actions.map((a, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant={i === 0 ? "default" : "outline"}
                            disabled={act.isPending}
                            onClick={() => {
                              if (a.kind === "email_invoice") { setOpen(false); setEmailInvoice(a.invoiceId); }
                              else if (a.kind === "link") { setOpen(false); router.push(a.href); }
                              else if (a.kind === "set_start_date") { setDate(todayStr()); setDateFor(it.id); }
                              else act.mutate({ id: it.id, index: i });
                            }}
                          >
                            {a.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {emailInvoice && (
        <EmailDocumentDialog
          kind="invoice"
          id={emailInvoice}
          open
          onOpenChange={(o) => { if (!o) setEmailInvoice(null); }}
          onSent={() => { setEmailInvoice(null); refreshAll(); }}
        />
      )}
    </>
  );
}
