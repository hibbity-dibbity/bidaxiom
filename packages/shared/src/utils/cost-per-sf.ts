/**
 * Cost per square foot: sorts order lines into named categories (by keywords in the line description) and works out
 * dollars per square foot for each category across jobs.
 *
 * Two averages are given for every category:
 * - weighted: all the dollars spent on the category divided by all the square feet of the jobs that had it.
 *   This is the one to price with, since a big building counts for more than a small one.
 * - job average: the plain average of each job's own $/sf.
 * A job only counts toward a category when it spent something on it, so a job with no concrete does not pull concrete down.
 */

export type SfCategory = { name: string; keywords: string[] };
export type SfProject = { id: string; name: string; jobNumber: string | null; slug: string | null; sqft: number; phase: string };
export type SfLine = { projectId: string; description: string; amount: number };

export const OTHER_CATEGORY = "Other (no category)";

export const DEFAULT_SF_CATEGORIES: SfCategory[] = [
  { name: "PEMB Erection", keywords: ["pemb erect", "pemb install", "building erect", "steel erect", "erection"] },
  { name: "PEMB Material", keywords: ["pemb", "metal building", "building package", "steel building"] },
  { name: "Concrete", keywords: ["concrete", "slab", "footing", "foundation", "rebar"] },
  { name: "Insulation", keywords: ["insulation", "insulate"] },
  { name: "Site Work", keywords: ["excavat", "grading", "site work", "sitework", "gravel", "backfill"] },
];

/** Name of the first category with a keyword in the description, or null. Order of the list decides ties. */
export function categorizeLine(description: string, categories: SfCategory[]): string | null {
  const d = description.toLowerCase();
  for (const c of categories) {
    for (const k of c.keywords) {
      const kw = k.trim().toLowerCase();
      if (kw && d.includes(kw)) return c.name;
    }
  }
  return null;
}

export type SfCategoryStat = {
  name: string;
  jobs: number;
  totalCost: number;
  totalSf: number;
  weighted: number;
  jobAverage: number;
  low: number;
  high: number;
};

export type SfProjectRow = SfProject & { total: number; perSf: number; byCategory: Record<string, number> };

export type CostPerSfResult = {
  stats: SfCategoryStat[];
  all: SfCategoryStat;
  rows: SfProjectRow[];
  /** Descriptions that matched no category, biggest first, to help tune keywords. */
  uncategorized: { description: string; count: number; amount: number }[];
  categoryNames: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function stat(name: string, per: { cost: number; sf: number }[]): SfCategoryStat {
  const used = per.filter((p) => p.cost > 0 && p.sf > 0);
  const totalCost = used.reduce((a, p) => a + p.cost, 0);
  const totalSf = used.reduce((a, p) => a + p.sf, 0);
  const rates = used.map((p) => p.cost / p.sf);
  return {
    name,
    jobs: used.length,
    totalCost: r2(totalCost),
    totalSf: r2(totalSf),
    weighted: totalSf ? r2(totalCost / totalSf) : 0,
    jobAverage: rates.length ? r2(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
    low: rates.length ? r2(Math.min(...rates)) : 0,
    high: rates.length ? r2(Math.max(...rates)) : 0,
  };
}

/** Only projects with square footage are measured; the caller reports how many were left out. */
export function buildCostPerSf(projects: SfProject[], lines: SfLine[], categories: SfCategory[]): CostPerSfResult {
  const names = [...categories.map((c) => c.name), OTHER_CATEGORY];
  const byProject = new Map<string, Record<string, number>>();
  const unc = new Map<string, { description: string; count: number; amount: number }>();
  const sized = new Map(projects.filter((p) => p.sqft > 0).map((p) => [p.id, p]));

  for (const l of lines) {
    if (!sized.has(l.projectId) || !l.amount) continue;
    const cat = categorizeLine(l.description, categories);
    const bucket = byProject.get(l.projectId) ?? {};
    const key = cat ?? OTHER_CATEGORY;
    bucket[key] = (bucket[key] ?? 0) + l.amount;
    byProject.set(l.projectId, bucket);
    if (!cat) {
      const k = l.description.trim().toLowerCase();
      const u = unc.get(k) ?? { description: l.description.trim(), count: 0, amount: 0 };
      u.count += 1;
      u.amount += l.amount;
      unc.set(k, u);
    }
  }

  const rows: SfProjectRow[] = [];
  for (const p of sized.values()) {
    const b = byProject.get(p.id);
    if (!b) continue;
    const total = Object.values(b).reduce((a, n) => a + n, 0);
    rows.push({
      ...p,
      total: r2(total),
      perSf: r2(total / p.sqft),
      byCategory: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, r2(v / p.sqft)])),
    });
  }
  rows.sort((a, b) => (a.jobNumber ?? "").localeCompare(b.jobNumber ?? "") || a.name.localeCompare(b.name));

  const stats = names.map((n) =>
    stat(n, rows.map((r) => ({ cost: (byProject.get(r.id)?.[n] ?? 0), sf: r.sqft }))),
  );
  const all = stat("All costs", rows.map((r) => ({ cost: r.total, sf: r.sqft })));
  return {
    stats: stats.filter((s) => s.name !== OTHER_CATEGORY || s.jobs > 0),
    all,
    rows,
    uncategorized: [...unc.values()].map((u) => ({ ...u, amount: r2(u.amount) })).sort((a, b) => b.amount - a.amount).slice(0, 25),
    categoryNames: names.filter((n) => n !== OTHER_CATEGORY || rows.some((r) => r.byCategory[OTHER_CATEGORY])),
  };
}
