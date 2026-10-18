"use client";

import Link from "next/link";
import * as React from "react";
import { useTheme } from "next-themes";
import { Search, Sun } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SETTINGS_GROUPS, canOpen, type SettingsItem } from "./settings-nav";

type Chip = { text: string; tone?: "good" | "warn" } | null;

function ChipView({ chip }: { chip: Chip }) {
  if (!chip) return null;
  const c = chip.tone === "good" ? "bg-financial-positive/15 text-financial-positive" : chip.tone === "warn" ? "bg-financial-pending/15 text-financial-pending" : "bg-muted text-muted-foreground";
  return <span className={cn("mt-2.5 inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", c)}>{chip.text}</span>;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const TYPE_LABEL: Record<string, string> = { general_contractor: "General contractor", gc_only: "General contractor", sub_only: "Subcontractor", both: "General contractor and subcontractor" };

function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const cur = mounted ? theme ?? "system" : "";
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3.5">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary"><Sun className="h-5 w-5" /></div>
        <div>
          <div className="text-[15px] font-semibold">Appearance</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Light, dark, or match this device.</div>
        </div>
      </div>
      <div role="group" aria-label="Theme" className="flex shrink-0 overflow-hidden rounded-md border">
        {([["light", "Light"], ["dark", "Dark"], ["system", "Auto"]] as const).map(([v, l]) => (
          <Button key={v} type="button" size="sm" variant={cur === v ? "default" : "ghost"} className="rounded-none" aria-pressed={cur === v} onClick={() => setTheme(v)}>{l}</Button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { orgRole } = useAuth();
  const isAdmin = !orgRole || orgRole === "org:admin";
  const q = trpc.settings.summary.useQuery(undefined, { staleTime: 30_000 });
  const [find, setFind] = React.useState("");
  const d = q.data;

  const chips: Record<string, Chip> = React.useMemo(() => {
    if (!d) return {};
    const out: Record<string, Chip> = {
      "/settings/account": { text: d.you.authenticator || d.you.passkeys > 0 ? `${d.you.authenticator ? "Authenticator on" : "No authenticator"}${d.you.passkeys ? ` · ${plural(d.you.passkeys, "passkey")}` : ""}` : "No second step yet", tone: d.you.authenticator || d.you.passkeys > 0 ? "good" : "warn" },
      "/settings/proposal-templates": { text: `${d.you.templatesMine} yours · ${d.you.templatesShared} shared` },
    };
    if (d.isAdmin) {
      const c = d.company;
      out["/settings/company"] = { text: `${c.type ? TYPE_LABEL[c.type] ?? c.type : "Not set up"}${c.trades ? ` · ${plural(c.trades, "trade")}` : ""}` };
      out["/settings/members"] = { text: `${c.members} active${c.invited ? ` · ${c.invited} invited` : ""}` };
      out["/settings/proposal-terms"] = c.proposalTerms ? { text: `Version ${c.proposalTerms.version} · ${plural(c.proposalTerms.sections, "section")}` } : { text: "Not written yet", tone: "warn" };
      out["/settings/change-order-terms"] = c.changeOrderTerms ? { text: `Version ${c.changeOrderTerms.version}` } : { text: "Using the standard wording" };
      out["/settings/document-naming"] = { text: c.namingFormats ? plural(c.namingFormats, "custom format") : "Standard names" };
      const qb = d.connections.qbo;
      out["/settings/integrations"] = !qb
        ? { text: "Not connected" }
        : qb.status === "active"
          ? { text: `Connected${qb.lastSyncAt ? ` · last read ${new Date(qb.lastSyncAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}`, tone: "good" }
          : { text: "Needs to be reconnected", tone: "warn" };
      const sso = d.connections.sso;
      out["/settings/sign-in"] = sso && sso.enabled ? { text: "On", tone: "good" } : { text: sso ? "Set up, switched off" : "Off" };
      const last = d.records.lastActivityAt;
      out["/settings/activity"] = { text: last ? `Latest: ${new Date(last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Nothing yet" };
      out["/settings/deleted-projects"] = d.records.deletedProjects ? { text: `${d.records.deletedProjects} can be restored`, tone: "warn" } : { text: "None" };
    }
    return out;
  }, [d]);

  const needle = find.trim().toLowerCase();
  const groups = SETTINGS_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => canOpen(i, orgRole) && (!needle || `${i.label} ${i.blurb}`.toLowerCase().includes(needle))),
  })).filter((g) => g.items.length > 0);

  const card = (i: SettingsItem) => {
    const Icon = i.icon;
    return (
      <Link key={i.href} href={i.href} className="flex min-w-0 items-start gap-3.5 rounded-lg border bg-card p-4 transition-colors hover:border-primary">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{i.label}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{i.blurb}</div>
          <ChipView chip={chips[i.href] ?? null} />
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Your account, plus everything that runs the company. You are signed in as an administrator." : "Your account and your own templates."}
          </p>
        </div>
        <label className="flex h-9 min-w-[260px] items-center gap-2 rounded-md border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search settings</span>
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search settings" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </header>

      {groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches “{find}”.</p>}

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`h-${g.id}`}>
          <div className="mb-3 flex items-center gap-2.5">
            <h2 id={`h-${g.id}`} className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
            {g.adminOnly && <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">Admin only</span>}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3.5">
            {g.items.map(card)}
            {g.id === "you" && !needle && <ThemeRow />}
          </div>
        </section>
      ))}

      {!isAdmin && !needle && (
        <section className="max-w-3xl rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Company settings</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">Team members, QuickBooks, sign-in, terms and company records are managed by your company administrators.</p>
        </section>
      )}
    </div>
  );
}
