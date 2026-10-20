/** Dates and reminder times for tasks. Dates are plain YYYY-MM-DD text; reminder moments are worked out in the person's own time zone. */

export type RemindPreset = "none" | "due" | "1d" | "2d" | "1w" | "custom";

export const REMIND_LABELS: Record<RemindPreset, string> = {
  none: "No reminder",
  due: "On the due date",
  "1d": "1 day before",
  "2d": "2 days before",
  "1w": "1 week before",
  custom: "Pick a date and time",
};

const DAYS_BEFORE: Partial<Record<RemindPreset, number>> = { due: 0, "1d": 1, "2d": 2, "1w": 7 };

export const pad = (n: number) => String(n).padStart(2, "0");
export const toDateText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayText = () => toDateText(new Date());

/** A YYYY-MM-DD date and an "HH:MM" time in this person's time zone, as an exact moment (ISO). */
export function localMoment(date: string, time = "08:00"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/** The reminder moment for a preset, counted back from the due date at 8:00 AM. Null when it cannot be worked out. */
export function presetMoment(preset: RemindPreset, dueDate: string | null | undefined): string | null {
  const back = DAYS_BEFORE[preset];
  if (back === undefined || !dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  return new Date(y, m - 1, d - back, 8, 0, 0, 0).toISOString();
}

/** Which preset an existing reminder matches, so editing shows what was chosen. */
export function detectPreset(remindAt: string | Date | null | undefined, dueDate: string | null | undefined): RemindPreset {
  if (!remindAt) return "none";
  const at = new Date(remindAt).getTime();
  for (const p of ["due", "1d", "2d", "1w"] as RemindPreset[]) {
    const m = presetMoment(p, dueDate);
    if (m && new Date(m).getTime() === at) return p;
  }
  return "custom";
}

export function prettyDate(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function prettyMoment(at: string | Date): string {
  return new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "overdue", "today", "soon" (within 3 days) or "later", for colouring a due date. */
export function dueState(dueDate: string | null | undefined, open: boolean): "overdue" | "today" | "soon" | "later" | "none" {
  if (!dueDate || !open) return "none";
  const today = todayText();
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const [y, m, d] = today.split("-").map(Number);
  const soon = toDateText(new Date(y, m - 1, d + 3));
  return dueDate <= soon ? "soon" : "later";
}

/** 8:00 AM tomorrow, in this person's time zone, as an ISO moment (for "remind me tomorrow"). */
export function tomorrowMorning(): string {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 8, 0, 0, 0).toISOString();
}
