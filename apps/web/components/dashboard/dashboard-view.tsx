"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BilledCollectedChart, CashChart, Sparkline, WinRateChart, compact } from "./charts";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const when = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
const dayName = (s: string, today: string) =>
  s === today ? "Today" : new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("min-w-0 rounded-lg border bg-card p-5", className)}>{children}</section>;
}
function Head({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
function Dot({ className }: { className: string }) {
  return <span className={cn("mr-2 inline-block h-2 w-2 rounded-full align-middle", className)} />;
}
function Pill({ tone, children }: { tone: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const c = tone === "ok" ? "bg-financial-positive/15 text-financial-positive" : tone === "warn" ? "bg-financial-pending/15 text-financial-pending" : "bg-financial-negative/15 text-financial-negative";
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", c)}>{children}</span>;
}
function Kpi({ label, value, note, spark, sparkLabel }: { label: string; value: string; note: React.ReactNode; spark?: number[]; sparkLabel?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{value}</div>
      <div className="mt-1.5 text-xs text-muted-foreground">{note}</div>
      {spark && <Sparkline values={spark} label={sparkLabel ?? label} />}
    </div>
  );
}
const Up = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-financial-positive">{children}</span>;
const Down = ({ children }: { children: React.ReactNode }) => <span className="font-semibold text-financial-negative">{children}</span>;

function delta(now: number, before: number | null | undefined, unit = "") {
  if (before === null || before === undefined) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <span>no change</span>;
  return d > 0 ? <Up>▲ {d}{unit}</Up> : <Down>▼ {Math.abs(d)}{unit}</Down>;
}

export function DashboardView() {
  const { orgRole } = useAuth();
  const [scope, setScope] = React.useState<"company" | "mine">(orgRole === "org:project_manager" ? "mine" : "company");
  const q = trpc.dashboard.overview.useQuery({ scope }, { refetchOnWindowFocus: true, staleTime: 30_000 });
  const d = q.data;

  const toggle = (
    <div role="group" aria-label="Which projects" className="flex overflow-hidden rounded-md border">
      {(["company", "mine"] as const).map((s) => (
        <Button key={s} type="button" size="sm" variant={scope === s ? "default" : "ghost"} className="rounded-none" aria-pressed={scope === s} onClick={() => setScope(s)}>
          {s === "company" ? "Company" : "My projects"}
        </Button>
      ))}
    </div>
  );

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {scope === "mine" ? "Only the projects you are on" : "Every project in the company"}
          {d && d.canSeeMoney ? ` · as of ${new Date(`${d.asOf}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}` : ""}
        </p>
      </div>
      {toggle}
    </header>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-5">
        {header}
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Working out your numbers…</div>
      </div>
    );
  }
  if (q.error || !d) {
    return (
      <div className="space-y-5">
        {header}
        <p className="text-sm text-financial-negative">The dashboard could not load: {q.error?.message ?? "no data"}. Reload the page to try again.</p>
      </div>
    );
  }

  if (!d.canSeeMoney) {
    return (
      <div className="space-y-5">
        {header}
        <Panel>
          <Head title="Your projects" sub="Your role does not include company finances, so only your own jobs are shown." />
          <div className="mt-3 divide-y">
            {d.projects.length === 0 && <p className="py-3 text-sm text-muted-foreground">You are not on any active project yet.</p>}
            {d.projects.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <Link className="font-medium text-primary hover:underline" href={p.slug ? `/projects/${p.slug}` : "/projects"}>{p.name}</Link>
                <span className="text-muted-foreground">{p.phase}{p.manager ? ` · ${p.manager}` : ""}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  const k = d.kpis;
  const empty = d.projectCount === 0 && d.pipeline.opportunities.count === 0 && d.pipeline.sent.count === 0;
  const monthBilled = d.monthly.map((m) => m.billed);
  const winSeries = d.monthly.map((m) => m.winPct).filter((x): x is number => x !== null);
  const funnel = [
    { label: "Opportunities", ...d.pipeline.opportunities, tone: "bg-primary/30" },
    { label: "Being estimated", ...d.pipeline.estimating, tone: "bg-primary/55" },
    { label: "Proposal sent", ...d.pipeline.sent, tone: "bg-primary/80" },
    { label: "Awarded, last 90 days", ...d.pipeline.awarded90, tone: "bg-primary" },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.count), 1);
  const ag = d.aging;
  const agPct = (v: number) => (ag.total > 0 ? (v / ag.total) * 100 : 0);

  return (
    <div className="space-y-5">
      {header}

      {empty && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            {scope === "mine" ? "You are not on any project yet. Ask an admin to add you to one, or switch to Company." : "Nothing to show yet. Create a project and send a proposal, and this page fills in."}
          </p>
        </Panel>
      )}

      {/* Key numbers */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Kpi label="Backlog" value={compact(k.backlog.value)} note={<>awarded, not yet billed · {k.backlog.projects} project{k.backlog.projects === 1 ? "" : "s"}</>} />
        <Kpi
          label="Billed this year"
          value={compact(k.billedYtd.value)}
          note={k.billedYtd.lastYearValue > 0 ? <>{delta(Math.round((k.billedYtd.value / k.billedYtd.lastYearValue - 1) * 100), 0, "%")} vs the same dates last year</> : "year to date"}
          spark={monthBilled}
          sparkLabel="Billed per month over the last 12 months"
        />
        <Kpi
          label="Expected margin"
          value={k.margin.pct === null ? "—" : `${k.margin.pct}%`}
          note={k.margin.pct === null ? "needs purchase or work orders with costs" : <>contract less projected order costs · {k.margin.projects} project{k.margin.projects === 1 ? "" : "s"}</>}
        />
        <Kpi
          label="Money owed to us"
          value={compact(k.owed.value)}
          note={k.owed.overdue > 0 ? <><Down>{compact(k.owed.overdue)} past due</Down> · {k.owed.overdueCount} invoice{k.owed.overdueCount === 1 ? "" : "s"}</> : "nothing past due"}
        />
        <Kpi
          label="Win rate, last 90 days"
          value={k.winRate.pct === null ? "—" : `${k.winRate.pct}%`}
          note={k.winRate.pct === null ? "no decided proposals yet" : <>{k.winRate.won} of {k.winRate.decided} decided{k.winRate.previousPct !== null && <> · {delta(k.winRate.pct, k.winRate.previousPct, " pts")}</>}</>}
          spark={winSeries}
          sparkLabel="Win rate by month"
        />
        <Kpi
          label="Active projects"
          value={String(k.active.count)}
          note={<>{k.active.needAttention > 0 ? <Down>{k.active.needAttention} need attention</Down> : "none need attention"}{k.active.closingOut > 0 && <> · {k.active.closingOut} closing out</>}</>}
        />
      </div>

      {/* Attention + billed/collected */}
      <div className="flex flex-wrap gap-3.5">
        <Panel className="flex-[1_1_340px]">
          <Head title="Needs your attention" sub="Things waiting on you or past their date" right={d.attention.length > 0 ? <Pill tone="bad">{d.attention.length} item{d.attention.length === 1 ? "" : "s"}</Pill> : <Pill tone="ok">All clear</Pill>} />
          <div className="mt-2 divide-y text-sm">
            {d.attention.length === 0 && <p className="py-3 text-muted-foreground">Nothing is overdue or waiting on anyone.</p>}
            {d.attention.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5">
                <span><Dot className={a.tone === "bad" ? "bg-financial-negative" : "bg-financial-pending"} />{a.text}</span>
                <Link className="shrink-0 text-primary hover:underline" href={a.href}>{a.cta}</Link>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            <Dot className={d.qbo.connected && d.qbo.failing === 0 ? "bg-financial-positive" : d.qbo.connected ? "bg-financial-pending" : "bg-financial-negative"} />
            {!d.qbo.status ? "QuickBooks is not connected" : !d.qbo.connected ? "QuickBooks needs to be reconnected" : d.qbo.failing > 0 ? `QuickBooks connected · ${d.qbo.failing} sync problem${d.qbo.failing === 1 ? "" : "s"}` : "QuickBooks connected · nothing failing"}
            {d.qbo.lastSyncAt ? ` · last read ${new Date(d.qbo.lastSyncAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
          </div>
        </Panel>

        <Panel className="flex-[2_1_520px]">
          <Head
            title="Billed and collected, by month"
            sub="Billed is invoices sent. Collected is payments received."
            right={<div className="flex gap-4 text-xs text-muted-foreground"><span><Dot className="bg-primary" />Billed</span><span><Dot className="bg-foreground" />Collected</span></div>}
          />
          <div className="mt-2"><BilledCollectedChart data={d.monthly} /></div>
        </Panel>
      </div>

      {/* Pipeline, win rate, receivables */}
      <div className="flex flex-wrap gap-3.5">
        <Panel className="flex-[1.3_1_400px]">
          <Head title="Sales pipeline" sub="Open work by stage, with the dollar value of each" />
          <div className="mt-4 space-y-3">
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="flex justify-between text-sm"><span>{f.label}</span><span className="tabular-nums"><strong>{f.count}</strong> · {compact(f.value)}</span></div>
                <div className="mt-1 h-3.5 rounded-full bg-muted"><div className={cn("h-full rounded-full", f.tone)} style={{ width: `${Math.max((f.count / funnelMax) * 100, f.count > 0 ? 4 : 0)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span>Average days to a decision: <strong className="text-foreground">{d.pipeline.avgDaysToDecision ?? "—"}</strong></span>
            <span>Largest open proposal: <strong className="text-foreground">{d.pipeline.largestOpen ? compact(d.pipeline.largestOpen) : "—"}</strong></span>
          </div>
        </Panel>

        <Panel className="flex-[1.3_1_380px]">
          <Head title="Win rate by month" sub="Share of decided proposals that were signed" />
          <div className="mt-3"><WinRateChart data={d.monthly} /></div>
        </Panel>

        <Panel className="flex-[1_1_340px]">
          <Head title="Who owes us, by age" sub={`${money(ag.total)} outstanding on sent invoices`} />
          <div className="mt-4 flex h-5 overflow-hidden rounded-md bg-muted" role="img" aria-label={`Not yet due ${Math.round(agPct(ag.notDue))} percent, 1 to 30 days late ${Math.round(agPct(ag.d1_30))} percent, 31 to 60 days ${Math.round(agPct(ag.d31_60))} percent, over 60 days ${Math.round(agPct(ag.d60))} percent`}>
            <div className="bg-primary" style={{ width: `${agPct(ag.notDue)}%` }} />
            <div className="bg-primary/40" style={{ width: `${agPct(ag.d1_30)}%` }} />
            <div className="bg-financial-pending" style={{ width: `${agPct(ag.d31_60)}%` }} />
            <div className="bg-financial-negative" style={{ width: `${agPct(ag.d60)}%` }} />
          </div>
          <div className="mt-3 divide-y text-sm">
            {([["Not yet due", ag.notDue, "bg-primary"], ["1–30 days late", ag.d1_30, "bg-primary/40"], ["31–60 days late", ag.d31_60, "bg-financial-pending"], ["Over 60 days late", ag.d60, "bg-financial-negative"]] as const).map(([label, v, c]) => (
              <div key={label} className="flex items-center justify-between py-2"><span><Dot className={c} />{label}</span><strong className="tabular-nums">{compact(v)}</strong></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Average days to get paid: <strong className="text-foreground">{ag.avgDaysToPay ?? "—"}</strong></p>
        </Panel>
      </div>

      {/* Cost against billing + cash forecast */}
      <div className="flex flex-wrap gap-3.5">
        <Panel className="flex-[1.4_1_460px]">
          <Head
            title="Cost against billing"
            sub="Money spent so far (bar) against how much of the contract has been billed (marker). A bar past the marker means spending is ahead of billing."
            right={<Link href="/projects" className="text-sm text-primary hover:underline">All projects →</Link>}
          />
          <div className="mt-4 space-y-4">
            {d.costBars.length === 0 && <p className="text-sm text-muted-foreground">Appears once a project has purchase or work orders with costs.</p>}
            {d.costBars.map((c) => (
              <div key={c.id}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold">{c.name} {c.status === "over" && <Pill tone="bad">Spending ahead</Pill>}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{money(c.spent)} of {money(c.projected)} · {c.spentPct}% spent · {c.billedPct}% billed</span>
                </div>
                <div className="relative mt-1.5 h-3 rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", c.status === "over" ? "bg-financial-negative" : c.status === "watch" ? "bg-financial-pending" : "bg-primary")} style={{ width: `${Math.min(c.spentPct, 100)}%` }} />
                  <div className="absolute -top-1 h-5 w-[3px] rounded bg-foreground" style={{ left: `${Math.min(c.billedPct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span>Spent in QuickBooks but not on any order: <strong className="text-foreground">{money(d.unaccounted.total)}</strong>{d.unaccounted.projects > 0 && <> across {d.unaccounted.projects} project{d.unaccounted.projects === 1 ? "" : "s"}</>}</span>
            <Link href="/outstanding" className="text-primary hover:underline">Sort them out →</Link>
          </div>
        </Panel>

        <Panel className="flex-[1_1_400px]">
          <Head title="Cash in and out, next 8 weeks" sub="Sent invoices by due date (green) against open vendor bills by due date (red). Late items count in the first week." />
          <div className="mt-3"><CashChart weeks={d.cash} /></div>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><Dot className="bg-financial-positive" />Expected in</span><span><Dot className="bg-financial-negative" />Expected out</span><span><Dot className="bg-foreground" />Running balance</span>
          </div>
          <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Tightest week: <strong className="text-foreground">week of {new Date(`${d.tightest.start}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, {d.tightest.net < 0 ? `${money(-d.tightest.net)} more going out than coming in` : `${money(d.tightest.net)} more coming in than going out`}</strong>
          </div>
        </Panel>
      </div>

      {/* Projects */}
      <Panel className="px-2 pb-2">
        <div className="px-3">
          <Head title="Active projects" sub="Worst first" right={<Link href="/projects" className="text-sm text-primary hover:underline">Open all {d.projectCount} →</Link>} />
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Project</th><th className="px-3 py-2 font-semibold">Manager</th><th className="px-3 py-2 font-semibold">Phase</th>
                <th className="min-w-[130px] px-3 py-2 font-semibold">Billed</th>
                <th className="px-3 py-2 text-right font-semibold">Contract</th><th className="px-3 py-2 text-right font-semibold">Billed $</th>
                <th className="px-3 py-2 text-right font-semibold">Cost vs plan</th><th className="px-3 py-2 text-right font-semibold">Margin</th><th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {d.projects.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No awarded or active projects.</td></tr>}
              {d.projects.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-3"><Link href={p.slug ? `/projects/${p.slug}` : "/projects"} className="font-semibold text-primary hover:underline">{p.name}</Link><div className="text-xs text-muted-foreground">{p.jobNumber}</div></td>
                  <td className="px-3 py-3">{p.manager || "—"}</td>
                  <td className="px-3 py-3">{p.phase}</td>
                  <td className="px-3 py-3"><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(p.billedPct, 100)}%` }} /></div></td>
                  <td className="px-3 py-3 text-right">{compact(p.contract)}</td>
                  <td className="px-3 py-3 text-right">{compact(p.billed)}</td>
                  <td className={cn("px-3 py-3 text-right", p.spentPct !== null && p.ahead > 10 ? "font-semibold text-financial-negative" : p.spentPct !== null && p.ahead > 3 ? "font-semibold text-financial-pending" : "")}>{p.spentPct === null ? "—" : `${p.spentPct}% spent`}</td>
                  <td className="px-3 py-3 text-right">{p.margin === null ? "—" : `${p.margin}%`}</td>
                  <td className="px-3 py-3"><Pill tone={p.status === "over" ? "bad" : p.status === "watch" ? "warn" : "ok"}>{p.statusLabel}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Coming up, change orders, activity */}
      <div className="flex flex-wrap gap-3.5">
        <Panel className="flex-[1_1_320px]">
          <Head title="Coming up this week" sub="Dates that matter, soonest first" />
          <div className="mt-2 divide-y text-sm">
            {d.coming.length === 0 && <p className="py-3 text-muted-foreground">Nothing is due in the next 7 days.</p>}
            {d.coming.map((c, i) => (
              <div key={i} className="flex gap-3 py-2.5"><strong className="w-24 shrink-0">{dayName(c.date, d.asOf)}</strong>{c.href ? <Link href={c.href} className="hover:underline">{c.text}</Link> : <span>{c.text}</span>}</div>
            ))}
          </div>
        </Panel>

        <Panel className="flex-[1_1_320px]">
          <Head title="Changes in scope" sub="Change orders and what they add to contracts" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div><div className="text-xs font-medium text-muted-foreground">Waiting on approval</div><div className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{compact(d.changeOrders.pendingValue)}</div><div className="text-xs text-muted-foreground">{d.changeOrders.pendingCount} order{d.changeOrders.pendingCount === 1 ? "" : "s"}</div></div>
            <div><div className="text-xs font-medium text-muted-foreground">Signed this year</div><div className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{compact(d.changeOrders.approvedValue)}</div><div className="text-xs text-muted-foreground">{d.changeOrders.approvedCount} order{d.changeOrders.approvedCount === 1 ? "" : "s"}</div></div>
            <div><div className="text-xs font-medium text-muted-foreground">Added to contracts</div><div className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{d.changeOrders.addedPct === null ? "—" : `${d.changeOrders.addedPct}%`}</div><div className="text-xs text-muted-foreground">of original value</div></div>
          </div>
          {d.changeOrders.oldest && (
            <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">Oldest unsigned: <strong className="text-foreground">{d.changeOrders.oldest.label}, {d.changeOrders.oldest.days} day{d.changeOrders.oldest.days === 1 ? "" : "s"}</strong></div>
          )}
        </Panel>

        <Panel className="flex-[1_1_320px]">
          <Head title="Recent activity" sub="Latest payments, proposals and change orders" />
          <div className="mt-2 divide-y text-sm">
            {d.activity.length === 0 && <p className="py-3 text-muted-foreground">Nothing yet.</p>}
            {d.activity.map((a, i) => (
              <div key={i} className="flex items-start justify-between gap-3 py-2.5"><span>{a.text}</span><span className="shrink-0 text-xs text-muted-foreground">{when(a.at)}</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
