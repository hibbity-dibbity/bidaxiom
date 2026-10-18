import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { LIFECYCLE_PHASE_LABELS, isOverdue, isSent } from "@construction/shared";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";

/**
 * The dashboard: one query that works out every number on the page, for the whole company or only the jobs the
 * signed-in person is on. Amounts are dollars. Money is read from BidAxiom's own records (proposals, invoices, orders)
 * and from the QuickBooks bills and expenses already read into BidAxiom; nothing here calls QuickBooks.
 */

const MONEY_ROLES = new Set(["org:admin", "org:project_manager", "org:accountant"]);
const IN_PROGRESS = ["awarded", "active", "substantial_completion"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86400000;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (text: string, n: number) => {
  const d = new Date(`${text}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / DAY);

type CostLine = { job: string | null; amount: number; account: string | null };
function costForJob(lines: CostLine[] | null | undefined, jobId: string, total: number): number {
  const mine = (lines ?? []).filter((l) => l.job === jobId);
  if (mine.length) return r2(mine.reduce((a, l) => a + l.amount, 0));
  return (lines ?? []).some((l) => l.job) ? 0 : total;
}

export const dashboardRouter = router({
  overview: protectedProcedure.input(z.object({ scope: z.enum(["company", "mine"]) })).query(async ({ ctx, input }) => {
    if (!ctx.tenant || !ctx.userId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Tenant context missing" });
    const { db, schema } = ctx.tenant;
    const money = MONEY_ROLES.has(ctx.orgRole ?? "");
    const today = ymd(new Date());
    const nowMs = Date.now();

    // ---- Which projects ------------------------------------------------------------------------------------------
    const allProjects = await db.select().from(schema.projects).where(isNull(schema.projects.deletedAt));
    const team = await db.select().from(schema.projectTeamMembers);
    const mineIds = new Set(team.filter((t) => t.userId === ctx.userId).map((t) => t.projectId));
    // Anyone outside the money roles only ever sees their own jobs.
    const scope = money ? input.scope : "mine";
    const projects = scope === "mine" ? allProjects.filter((p) => mineIds.has(p.id)) : allProjects;
    const ids = projects.map((p) => p.id);
    const byId = new Map(projects.map((p) => [p.id, p]));
    const people = await db.select().from(schema.userProfiles);
    const nameOf = (userId: string) => {
      const u = people.find((x) => x.clerkUserId === userId);
      return u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email : "";
    };
    const managerOf = new Map<string, string>();
    for (const t of team) if (t.role === "project_manager" && !managerOf.has(t.projectId)) managerOf.set(t.projectId, nameOf(t.userId));

    const phase = (p: { lifecyclePhase: string }) => p.lifecyclePhase;
    const inProgress = projects.filter((p) => IN_PROGRESS.includes(phase(p)));

    if (!money) {
      return {
        canSeeMoney: false as const,
        scope,
        projects: inProgress.map((p) => ({ id: p.id, name: p.name, slug: p.slug, jobNumber: p.jobNumber, phase: LIFECYCLE_PHASE_LABELS[p.lifecyclePhase as keyof typeof LIFECYCLE_PHASE_LABELS] ?? p.lifecyclePhase, manager: managerOf.get(p.id) ?? "" })),
      };
    }

    // ---- Load everything for these projects -----------------------------------------------------------------------
    const none = ids.length === 0;
    const invoices = none ? [] : await db.select().from(schema.invoices).where(inArray(schema.invoices.projectId, ids));
    const payments = invoices.length ? await db.select().from(schema.invoicePayments).where(inArray(schema.invoicePayments.invoiceId, invoices.map((i) => i.id))) : [];
    const estimates = none ? [] : await db.select().from(schema.estimates).where(inArray(schema.estimates.projectId, ids));
    const orders = none ? [] : await db.select().from(schema.orders).where(inArray(schema.orders.projectId, ids));
    const orderLines = orders.length ? await db.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, orders.map((o) => o.id))) : [];
    const mappings = none ? [] : await db.select().from(schema.qboEntityMappings).where(and(eq(schema.qboEntityMappings.entityType, "project"), inArray(schema.qboEntityMappings.platformId, ids)));
    const bills = none ? [] : await db.select().from(schema.qboBills);
    const expenses = none ? [] : await db.select().from(schema.qboExpenses);

    const jobOfProject = new Map(mappings.map((m) => [m.platformId, m.qboId]));
    const projectOfJob = new Map(mappings.map((m) => [m.qboId, m.platformId]));
    const projectOfOrder = new Map(orders.map((o) => [o.id, o.projectId]));

    // ---- Per-project money ------------------------------------------------------------------------------------------
    type Fin = { contract: number; billed: number; received: number; projected: number; spentOnOrders: number; unaccounted: number; overdue: number; overdueOldest: number };
    const fin = new Map<string, Fin>();
    for (const p of projects) fin.set(p.id, { contract: 0, billed: 0, received: 0, projected: 0, spentOnOrders: 0, unaccounted: 0, overdue: 0, overdueOldest: 0 });
    const paidOn = new Map<string, number>();
    for (const x of payments) paidOn.set(x.invoiceId, r2((paidOn.get(x.invoiceId) ?? 0) + Number(x.amount)));
    for (const i of invoices) {
      const f = fin.get(i.projectId);
      if (!f) continue;
      const amt = Number(i.amount);
      f.contract += amt;
      if (isSent(i.status)) {
        f.billed += amt;
        const got = paidOn.get(i.id) ?? 0;
        f.received += got;
        const out = Math.max(amt - got, 0);
        if (out > 0.004 && isOverdue(i.status, i.dueOn, today)) {
          f.overdue += out;
          f.overdueOldest = Math.max(f.overdueOldest, i.dueOn ? daysBetween(i.dueOn, today) : 0);
        }
      }
    }
    for (const l of orderLines) {
      const pid = projectOfOrder.get(l.orderId);
      const f = pid ? fin.get(pid) : undefined;
      if (f) f.projected += Number(l.projectedCost);
    }
    const unaccountedItems: Array<{ projectId: string; amount: number }> = [];
    for (const b of bills) {
      const lines = (b.lines as CostLine[] | null) ?? [];
      if (b.orderId && projectOfOrder.has(b.orderId)) {
        const pid = projectOfOrder.get(b.orderId)!;
        const job = jobOfProject.get(pid);
        const f = fin.get(pid)!;
        f.spentOnOrders += job ? costForJob(lines, job, Number(b.total)) : Number(b.total);
      } else if (!b.orderId && b.status !== "ignored") {
        const jobs = new Set<string>([...((b.qboCustomerIds as string[]) ?? []), ...lines.map((l) => l.job).filter((j): j is string => !!j)]);
        for (const j of jobs) {
          const pid = projectOfJob.get(j);
          if (!pid) continue;
          const amt = costForJob(lines, j, Number(b.total));
          if (amt) { fin.get(pid)!.unaccounted += amt; unaccountedItems.push({ projectId: pid, amount: amt }); }
        }
      }
    }
    for (const e of expenses) {
      if (e.ignored) continue;
      const lines = (e.lines as CostLine[]) ?? [];
      for (const j of new Set(lines.map((l) => l.job).filter((x): x is string => !!x))) {
        const pid = projectOfJob.get(j);
        if (!pid) continue;
        const amt = costForJob(lines, j, Number(e.total));
        if (amt) { fin.get(pid)!.unaccounted += amt; unaccountedItems.push({ projectId: pid, amount: amt }); }
      }
    }

    // ---- Proposals: value, win rate, pipeline ----------------------------------------------------------------------------
    const proposals = estimates.filter((e) => e.kind === "proposal");
    const changeOrders = estimates.filter((e) => e.kind === "change_order");
    const valueOf = new Map<string, number>();
    for (const p of projects) {
      const mine = proposals.filter((e) => e.projectId === p.id);
      const pick = mine.find((e) => e.isActive) ?? mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (pick) valueOf.set(p.id, Number(pick.totalCost));
    }
    const WON = ["accepted", "under_contract"];
    type Outcome = { projectId: string; sentOn: string; result: "won" | "lost" | "open"; decidedOn: string | null };
    const outcomes: Outcome[] = [];
    for (const p of projects) {
      const mine = proposals.filter((e) => e.projectId === p.id && e.submittedAt);
      if (!mine.length) continue;
      const first = mine.reduce((a, b) => (a.submittedAt!.getTime() <= b.submittedAt!.getTime() ? a : b));
      const won = mine.find((e) => WON.includes(e.status));
      const declined = mine.every((e) => e.status === "declined") || phase(p) === "lost";
      outcomes.push({
        projectId: p.id,
        sentOn: ymd(first.submittedAt!),
        result: won ? "won" : declined ? "lost" : "open",
        decidedOn: won?.acceptedAt ? ymd(won.acceptedAt) : null,
      });
    }
    const rate = (from: string, to: string) => {
      const set = outcomes.filter((o) => o.sentOn >= from && o.sentOn < to && o.result !== "open");
      const won = set.filter((o) => o.result === "won").length;
      return { won, decided: set.length, pct: set.length ? Math.round((won / set.length) * 100) : null };
    };
    const d90 = addDays(today, -90);
    const d180 = addDays(today, -180);
    const winNow = rate(d90, addDays(today, 1));
    const winPrev = rate(d180, d90);

    // ---- Months ----------------------------------------------------------------------------------------------------------
    const months: Array<{ key: string; label: string }> = [];
    {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 11);
      for (let i = 0; i < 12; i++) {
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "short" }) });
        d.setMonth(d.getMonth() + 1);
      }
    }
    const billedBy = new Map<string, number>();
    const collectedBy = new Map<string, number>();
    for (const i of invoices) if (isSent(i.status) && i.sentOn) billedBy.set(i.sentOn.slice(0, 7), (billedBy.get(i.sentOn.slice(0, 7)) ?? 0) + Number(i.amount));
    for (const x of payments) collectedBy.set(x.receivedAt.slice(0, 7), (collectedBy.get(x.receivedAt.slice(0, 7)) ?? 0) + Number(x.amount));
    const monthly = months.map((m) => {
      const [y, mo] = m.key.split("-").map(Number);
      const from = `${m.key}-01`;
      const to = ymd(new Date(y, mo, 1));
      return { label: m.label, billed: r2(billedBy.get(m.key) ?? 0), collected: r2(collectedBy.get(m.key) ?? 0), winPct: rate(from, to).pct };
    });

    const year = today.slice(0, 4);
    const lastYear = String(Number(year) - 1);
    const sameDayLastYear = `${lastYear}${today.slice(4)}`;
    let billedYtd = 0;
    let billedLastYtd = 0;
    for (const i of invoices) {
      if (!isSent(i.status) || !i.sentOn) continue;
      if (i.sentOn.startsWith(year)) billedYtd += Number(i.amount);
      else if (i.sentOn.startsWith(lastYear) && i.sentOn <= sameDayLastYear) billedLastYtd += Number(i.amount);
    }

    // ---- Receivables -------------------------------------------------------------------------------------------------------
    const aging = { notDue: 0, d1_30: 0, d31_60: 0, d60: 0 };
    let owed = 0;
    let overdueTotal = 0;
    let overdueCount = 0;
    const paidDays: number[] = [];
    for (const i of invoices) {
      if (!isSent(i.status)) continue;
      const amt = Number(i.amount);
      const got = paidOn.get(i.id) ?? 0;
      const out = Math.max(amt - got, 0);
      if (out <= 0.004) {
        const last = payments.filter((x) => x.invoiceId === i.id).map((x) => x.receivedAt).sort().pop();
        if (last && i.sentOn && amt > 0) paidDays.push(Math.max(daysBetween(i.sentOn, last), 0));
        continue;
      }
      owed += out;
      if (isOverdue(i.status, i.dueOn, today)) {
        overdueTotal += out;
        overdueCount++;
        const late = i.dueOn ? daysBetween(i.dueOn, today) : 0;
        if (late <= 30) aging.d1_30 += out;
        else if (late <= 60) aging.d31_60 += out;
        else aging.d60 += out;
      } else aging.notDue += out;
    }

    // ---- Backlog, margin, pipeline ---------------------------------------------------------------------------------------
    let backlog = 0;
    let marginContract = 0;
    let marginProjected = 0;
    for (const p of inProgress) {
      const f = fin.get(p.id)!;
      backlog += Math.max(f.contract - f.billed, 0);
      if (f.projected > 0 && f.contract > 0) {
        marginContract += f.contract;
        marginProjected += f.projected;
      }
    }
    const stage = (phases: string[]) => {
      const set = projects.filter((p) => phases.includes(phase(p)));
      return { count: set.length, value: r2(set.reduce((a, p) => a + (valueOf.get(p.id) ?? 0), 0)) };
    };
    const awardedRecently = outcomes.filter((o) => o.result === "won" && o.decidedOn && o.decidedOn >= d90 && byId.has(o.projectId));
    const awarded90 = { count: awardedRecently.length, value: r2(awardedRecently.reduce((a, o) => a + (valueOf.get(o.projectId) ?? 0), 0)) };
    const decideDays = outcomes.filter((o) => o.result === "won" && o.decidedOn).map((o) => Math.max(daysBetween(o.sentOn, o.decidedOn!), 0));
    const openSubmitted = projects.filter((p) => phase(p) === "submitted").map((p) => valueOf.get(p.id) ?? 0);

    // ---- Project table & cost-against-billing ----------------------------------------------------------------------------
    const rows = inProgress.map((p) => {
      const f = fin.get(p.id)!;
      const spent = f.spentOnOrders + f.unaccounted;
      const billedPct = f.contract > 0 ? Math.round((f.billed / f.contract) * 100) : 0;
      const spentPct = f.projected > 0 ? Math.round((spent / f.projected) * 100) : null;
      const ahead = spentPct !== null ? spentPct - billedPct : 0;
      let status: "over" | "watch" | "ok" = "ok";
      let statusLabel = "On track";
      if (spentPct !== null && ahead > 10) { status = "over"; statusLabel = "Spending ahead of billing"; }
      else if (f.overdueOldest > 30) { status = "over"; statusLabel = "Invoice over 30 days late"; }
      else if (f.overdue > 0) { status = "watch"; statusLabel = "Invoice past due"; }
      else if (spentPct !== null && ahead > 3) { status = "watch"; statusLabel = "Watch spending"; }
      else if (phase(p) === "substantial_completion") { status = "watch"; statusLabel = "Closing out"; }
      return {
        id: p.id, name: p.name, slug: p.slug, jobNumber: p.jobNumber,
        manager: managerOf.get(p.id) ?? "",
        phase: LIFECYCLE_PHASE_LABELS[p.lifecyclePhase as keyof typeof LIFECYCLE_PHASE_LABELS] ?? p.lifecyclePhase,
        contract: r2(f.contract), billed: r2(f.billed), billedPct,
        projected: r2(f.projected), spent: r2(spent), spentPct, ahead,
        margin: f.projected > 0 && f.contract > 0 ? Math.round(((f.contract - f.projected) / f.contract) * 1000) / 10 : null,
        status, statusLabel, unaccounted: r2(f.unaccounted),
      };
    });
    const rank = { over: 0, watch: 1, ok: 2 } as const;
    rows.sort((a, b) => rank[a.status] - rank[b.status] || b.contract - a.contract);
    const costBars = rows
      .filter((r) => r.spentPct !== null)
      .sort((a, b) => b.ahead - a.ahead)
      .slice(0, 5)
      .map((r) => ({ id: r.id, name: r.name, slug: r.slug, spent: r.spent, projected: r.projected, spentPct: r.spentPct!, billedPct: r.billedPct, status: r.status }));

    // ---- Cash forecast: 8 weeks ------------------------------------------------------------------------------------------------
    const weeks = Array.from({ length: 8 }, (_, k) => ({ start: addDays(today, k * 7), inn: 0, out: 0 }));
    const weekOf = (date: string | null) => {
      if (!date || date < today) return 0;
      const k = Math.floor(daysBetween(today, date) / 7);
      return k > 7 ? -1 : k;
    };
    for (const i of invoices) {
      if (!isSent(i.status)) continue;
      const out = Math.max(Number(i.amount) - (paidOn.get(i.id) ?? 0), 0);
      if (out <= 0.004) continue;
      const k = weekOf(i.dueOn);
      if (k >= 0) weeks[k].inn += out;
    }
    const scopedJobs = new Set(jobOfProject.values());
    for (const b of bills) {
      const bal = Number(b.balance);
      if (bal <= 0.004 || b.status === "ignored") continue;
      const lines = (b.lines as CostLine[] | null) ?? [];
      const ours = (b.orderId && projectOfOrder.has(b.orderId)) || ((b.qboCustomerIds as string[]) ?? []).some((j) => scopedJobs.has(j)) || lines.some((l) => l.job && scopedJobs.has(l.job));
      if (!ours) continue;
      const k = weekOf(b.dueDate ?? addDays(b.txnDate, 30));
      if (k >= 0) weeks[k].out += bal;
    }
    let running = 0;
    const cash = weeks.map((w) => {
      running += w.inn - w.out;
      return { start: w.start, inn: r2(w.inn), out: r2(w.out), running: r2(running) };
    });
    const tightest = cash.reduce((a, c) => (c.inn - c.out < a.inn - a.out ? c : a), cash[0]);

    // ---- Attention --------------------------------------------------------------------------------------------------------------
    const unsigned = proposals.filter((e) => e.status === "submitted" && e.submittedAt && nowMs - e.submittedAt.getTime() > 7 * DAY && !proposals.some((o) => o.projectId === e.projectId && WON.includes(o.status)));
    const pendingCo = changeOrders.filter((e) => e.status === "submitted");
    const unlinked = bills.filter((b) => b.relevant && !b.orderId && b.status === "open" && (((b.qboCustomerIds as string[]) ?? []).some((j) => scopedJobs.has(j)) || ((b.lines as CostLine[] | null) ?? []).some((l) => l.job && scopedJobs.has(l.job))));
    const overBilled = orders.filter((o) => {
      const proj = orderLines.filter((l) => l.orderId === o.id).reduce((a, l) => a + Number(l.projectedCost), 0);
      const billedOn = bills.filter((b) => b.orderId === o.id).reduce((a, b) => a + Number(b.total), 0);
      return proj > 0 && billedOn > proj + 0.5;
    });
    const aheadProjects = rows.filter((r) => r.status === "over" && r.statusLabel === "Spending ahead of billing");
    const slugOf = (id: string) => byId.get(id)?.slug ?? null;
    const attention: Array<{ tone: "bad" | "warn"; text: string; href: string; cta: string }> = [];
    if (overdueCount) attention.push({ tone: "bad", text: `${overdueCount} invoice${overdueCount === 1 ? "" : "s"} past due · ${money$(overdueTotal)}`, href: "/invoices", cta: "Review" });
    for (const r of aheadProjects.slice(0, 2)) attention.push({ tone: "bad", text: `${r.name}: spending is ahead of billing`, href: r.slug ? `/projects/${r.slug}` : "/projects", cta: "Open" });
    if (unsigned.length) attention.push({ tone: "warn", text: `${unsigned.length} proposal${unsigned.length === 1 ? "" : "s"} unsigned for 7+ days`, href: unsigned.length === 1 && slugOf(unsigned[0].projectId) ? `/projects/${slugOf(unsigned[0].projectId)}` : "/projects", cta: "Follow up" });
    if (pendingCo.length) attention.push({ tone: "warn", text: `${pendingCo.length} change order${pendingCo.length === 1 ? "" : "s"} waiting on approval · ${money$(pendingCo.reduce((a, e) => a + Number(e.totalCost), 0))}`, href: "/projects", cta: "Open" });
    if (unlinked.length) attention.push({ tone: "warn", text: `${unlinked.length} QuickBooks bill${unlinked.length === 1 ? "" : "s"} not on any order · ${money$(unlinked.reduce((a, b) => a + Number(b.total), 0))}`, href: "/outstanding", cta: "Assign" });
    if (overBilled.length) attention.push({ tone: "warn", text: `${overBilled.length} order${overBilled.length === 1 ? "" : "s"} billed over their amount`, href: "/orders", cta: "Open" });

    // ---- Coming up (next 7 days) ---------------------------------------------------------------------------------------------------
    const weekEnd = addDays(today, 6);
    const coming: Array<{ date: string; text: string; href: string | null }> = [];
    for (const i of invoices) {
      if (!isSent(i.status) || !i.dueOn || i.dueOn < today || i.dueOn > weekEnd) continue;
      const out = Math.max(Number(i.amount) - (paidOn.get(i.id) ?? 0), 0);
      if (out > 0.004) coming.push({ date: i.dueOn, text: `Invoice ${i.number} due · ${money$(out)}`, href: slugOf(i.projectId) ? `/projects/${slugOf(i.projectId)}/invoices/${i.id}` : null });
    }
    for (const o of orders) {
      const label = `${o.number}${o.kind === "purchase" ? " delivery" : " starts"}`;
      const date = o.kind === "purchase" ? o.deliveryDate : o.startDate;
      if (date && date >= today && date <= weekEnd) coming.push({ date, text: `${byId.get(o.projectId)?.name ?? ""}: ${label}`, href: slugOf(o.projectId) ? `/projects/${slugOf(o.projectId)}/orders/${o.id}` : null });
    }
    for (const e of proposals) {
      if (e.status !== "submitted" || !e.submittedAt) continue;
      const exp = addDays(ymd(e.submittedAt), e.validDays);
      if (exp >= today && exp <= weekEnd) coming.push({ date: exp, text: `${byId.get(e.projectId)?.name ?? "Proposal"}: proposal expires · ${money$(Number(e.totalCost))}`, href: slugOf(e.projectId) ? `/projects/${slugOf(e.projectId)}` : null });
    }
    for (const p of inProgress) {
      if (p.endDate && ymd(p.endDate) >= today && ymd(p.endDate) <= weekEnd) coming.push({ date: ymd(p.endDate), text: `${p.name}: scheduled end date`, href: p.slug ? `/projects/${p.slug}` : null });
    }
    coming.sort((a, b) => a.date.localeCompare(b.date));

    // ---- Change orders -------------------------------------------------------------------------------------------------------------
    const approvedCo = changeOrders.filter((e) => WON.includes(e.status) && e.acceptedAt && ymd(e.acceptedAt).startsWith(year));
    const baseContract = proposals.filter((e) => WON.includes(e.status) && e.isActive).reduce((a, e) => a + Number(e.totalCost), 0);
    const oldestCo = pendingCo.filter((e) => e.submittedAt).sort((a, b) => a.submittedAt!.getTime() - b.submittedAt!.getTime())[0];
    const coBlock = {
      pendingCount: pendingCo.length,
      pendingValue: r2(pendingCo.reduce((a, e) => a + Number(e.totalCost), 0)),
      approvedCount: approvedCo.length,
      approvedValue: r2(approvedCo.reduce((a, e) => a + Number(e.totalCost), 0)),
      addedPct: baseContract > 0 ? Math.round((approvedCo.reduce((a, e) => a + Number(e.totalCost), 0) / baseContract) * 1000) / 10 : null,
      oldest: oldestCo ? { label: `${byId.get(oldestCo.projectId)?.name ?? "Project"}, ${oldestCo.number ?? "change order"}`, days: Math.floor((nowMs - oldestCo.submittedAt!.getTime()) / DAY) } : null,
    };

    // ---- Recent activity -------------------------------------------------------------------------------------------------------------
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const events: Array<{ at: Date; text: string }> = [];
    for (const x of payments) {
      const inv = invById.get(x.invoiceId);
      events.push({ at: x.createdAt, text: `Payment of ${money$(Number(x.amount))} received on ${inv?.number ?? "an invoice"}` });
    }
    for (const e of estimates) {
      const name = byId.get(e.projectId)?.name ?? "a project";
      if (e.acceptedAt) events.push({ at: e.acceptedAt, text: e.kind === "change_order" ? `Change order ${e.number ?? ""} signed on ${name}` : `Proposal for ${name} signed` });
      if (e.submittedAt) events.push({ at: e.submittedAt, text: e.kind === "change_order" ? `Change order ${e.number ?? ""} sent on ${name}` : `Proposal for ${name} sent` });
    }
    events.sort((a, b) => b.at.getTime() - a.at.getTime());

    // ---- QuickBooks ------------------------------------------------------------------------------------------------------------------
    const [conn] = await db.select({ status: schema.qboConnections.status, lastSyncAt: schema.qboConnections.lastSyncAt, errorMessage: schema.qboConnections.errorMessage }).from(schema.qboConnections).limit(1);
    const failing = await db.select({ id: schema.qboSyncNotifications.id }).from(schema.qboSyncNotifications).where(and(eq(schema.qboSyncNotifications.dismissed, false), eq(schema.qboSyncNotifications.severity, "error")));
    const [prof] = await db.select({ last: schema.companyProfiles.qboBillsLastCheckAt }).from(schema.companyProfiles).where(isNull(schema.companyProfiles.validTo)).limit(1);

    const unaccountedProjects = new Set(unaccountedItems.map((u) => u.projectId));
    return {
      canSeeMoney: true as const,
      scope,
      asOf: today,
      kpis: {
        backlog: { value: r2(backlog), projects: inProgress.length },
        billedYtd: { value: r2(billedYtd), lastYearValue: r2(billedLastYtd) },
        margin: { pct: marginContract > 0 ? Math.round(((marginContract - marginProjected) / marginContract) * 1000) / 10 : null, projects: rows.filter((r) => r.margin !== null).length },
        owed: { value: r2(owed), overdue: r2(overdueTotal), overdueCount },
        winRate: { pct: winNow.pct, won: winNow.won, decided: winNow.decided, previousPct: winPrev.pct },
        active: { count: inProgress.length, needAttention: rows.filter((r) => r.status === "over").length, closingOut: inProgress.filter((p) => phase(p) === "substantial_completion").length },
      },
      attention,
      qbo: { connected: Boolean(conn) && conn.status === "active", status: conn?.status ?? null, lastSyncAt: (prof?.last ?? conn?.lastSyncAt ?? null)?.toString() ?? null, failing: failing.length },
      monthly,
      pipeline: {
        opportunities: stage(["opportunity"]),
        estimating: stage(["estimating"]),
        sent: stage(["submitted"]),
        awarded90,
        avgDaysToDecision: decideDays.length ? Math.round(decideDays.reduce((a, b) => a + b, 0) / decideDays.length) : null,
        largestOpen: openSubmitted.length ? Math.max(...openSubmitted) : null,
      },
      aging: { total: r2(owed), notDue: r2(aging.notDue), d1_30: r2(aging.d1_30), d31_60: r2(aging.d31_60), d60: r2(aging.d60), avgDaysToPay: paidDays.length ? Math.round(paidDays.reduce((a, b) => a + b, 0) / paidDays.length) : null },
      costBars,
      unaccounted: { total: r2(unaccountedItems.reduce((a, u) => a + u.amount, 0)), projects: unaccountedProjects.size },
      cash,
      tightest: { start: tightest.start, net: r2(tightest.inn - tightest.out) },
      projects: rows.slice(0, 10),
      projectCount: rows.length,
      coming: coming.slice(0, 7),
      changeOrders: coBlock,
      activity: events.slice(0, 6).map((e) => ({ at: e.at.toISOString(), text: e.text })),
    };
  }),
});

function money$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
