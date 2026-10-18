"use client";

import * as React from "react";

/** Small hand-drawn SVG charts for the dashboard. They read their colors from the theme so dark mode follows. */

const POS = "hsl(var(--financial-positive))";
const NEG = "hsl(var(--financial-negative))";
const PEND = "hsl(var(--financial-pending))";
const PRIMARY = "hsl(var(--primary))";
const INK = "hsl(var(--foreground))";
const GRID = "hsl(var(--border))";
const MUTED = "hsl(var(--muted-foreground))";

export function compact(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)}k`;
  return `${s}$${Math.round(a)}`;
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 96).toFixed(1)},${(26 - ((v - min) / span) * 22).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height="30" viewBox="0 0 96 28" preserveAspectRatio="none" role="img" aria-label={label} className="mt-3">
      <polyline points={pts} fill="none" stroke={PRIMARY} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Niceish upper bound for an axis. */
function niceMax(v: number): number {
  if (v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function BilledCollectedChart({ data }: { data: Array<{ label: string; billed: number; collected: number }> }) {
  const W = 660, H = 220, left = 48, right = 24, base = 190, top = 24;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.billed, d.collected)), 1));
  const slot = (W - left - right) / data.length;
  const y = (v: number) => base - (v / max) * (base - top);
  const ticks = [0, 1, 2, 3].map((i) => (max / 3) * i);
  const total = data.reduce((a, d) => a + d.billed, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Billed and collected dollars by month. Billed in the last 12 months: ${compact(total)}.`} className="block">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left - 4} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={left - 8} y={y(t) + 3} textAnchor="end" fontSize="10.5" fill={MUTED}>{compact(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = left + i * slot + slot * 0.12;
        const bw = slot * 0.36;
        return (
          <g key={i}>
            <rect x={x} y={y(d.billed)} width={bw} height={Math.max(base - y(d.billed), 0)} rx="2" fill={PRIMARY}>
              <title>{`${d.label}: billed ${compact(d.billed)}`}</title>
            </rect>
            <rect x={x + bw + 2} y={y(d.collected)} width={bw} height={Math.max(base - y(d.collected), 0)} rx="2" fill={INK} opacity="0.85">
              <title>{`${d.label}: collected ${compact(d.collected)}`}</title>
            </rect>
            <text x={x + bw} y={H - 12} textAnchor="middle" fontSize="10.5" fill={MUTED}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function WinRateChart({ data }: { data: Array<{ label: string; winPct: number | null }> }) {
  const W = 660, H = 150, left = 48, right = 24, base = 126, top = 14;
  const slot = (W - left - right) / data.length;
  const y = (p: number) => base - (p / 100) * (base - top);
  const pts = data.map((d, i) => (d.winPct === null ? null : { x: left + i * slot + slot / 2, y: y(d.winPct), p: d.winPct, label: d.label }));
  const line = pts.filter(Boolean) as Array<{ x: number; y: number; p: number; label: string }>;
  const last = line[line.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={last ? `Win rate by month; the latest month is ${last.p} percent.` : "Win rate by month; no decided proposals yet."} className="block">
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <line x1={left - 4} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={left - 8} y={y(t) + 3} textAnchor="end" fontSize="10.5" fill={MUTED}>{t}%</text>
        </g>
      ))}
      {line.length > 1 && <polyline points={line.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinejoin="round" />}
      {line.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === line.length - 1 ? 4.5 : 3} fill={PRIMARY}>
          <title>{`${p.label}: ${p.p}% won`}</title>
        </circle>
      ))}
      {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
        <text key={i} x={left + i * slot + slot / 2} y={H - 4} textAnchor="middle" fontSize="10.5" fill={MUTED}>{data[i].label}</text>
      ))}
    </svg>
  );
}

export function CashChart({ weeks }: { weeks: Array<{ start: string; inn: number; out: number; running: number }> }) {
  const W = 600, H = 200, left = 40, right = 10, mid = 100;
  const maxAbs = niceMax(Math.max(...weeks.map((w) => Math.max(w.inn, w.out, Math.abs(w.running))), 1));
  const scale = 82 / maxAbs;
  const slot = (W - left - right) / weeks.length;
  const fmtDate = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const run = weeks.map((w, i) => `${left + i * slot + slot / 2},${mid - w.running * scale}`).join(" ");
  const end = weeks[weeks.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Expected cash in and out over eight weeks. The running balance ends at ${compact(end.running)}.`} className="block">
      <line x1={left - 6} x2={W - right} y1={mid} y2={mid} stroke={MUTED} opacity="0.6" />
      {weeks.map((w, i) => {
        const x = left + i * slot + slot * 0.14;
        const bw = slot * 0.32;
        return (
          <g key={i}>
            <rect x={x} y={mid - w.inn * scale} width={bw} height={w.inn * scale} rx="2" fill={POS}><title>{`Week of ${fmtDate(w.start)}: ${compact(w.inn)} expected in`}</title></rect>
            <rect x={x + bw + 2} y={mid} width={bw} height={w.out * scale} rx="2" fill={NEG} opacity="0.85"><title>{`Week of ${fmtDate(w.start)}: ${compact(w.out)} expected out`}</title></rect>
            <text x={x + bw} y={H - 8} textAnchor="middle" fontSize="10.5" fill={MUTED}>{fmtDate(w.start)}</text>
          </g>
        );
      })}
      <polyline points={run} fill="none" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx={left + (weeks.length - 1) * slot + slot / 2} cy={mid - end.running * scale} r="4" fill={INK} />
    </svg>
  );
}
