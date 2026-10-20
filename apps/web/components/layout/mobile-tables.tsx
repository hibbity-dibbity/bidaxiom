"use client";

import { useEffect } from "react";

/** The column name above each cell, counting colSpan. */
function labelTable(table: HTMLTableElement) {
  if (table.dataset.stack === "off") return;
  table.classList.add("stack-mobile");
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
  if (!headRow) return;
  const labels: string[] = [];
  Array.from(headRow.cells).forEach((th) => {
    const text = (th.textContent ?? "").trim();
    for (let i = 0; i < Math.max(1, th.colSpan); i++) labels.push(i === 0 ? text : "");
  });
  Array.from(table.tBodies).forEach((body) =>
    Array.from(body.rows).forEach((row) => {
      let col = 0;
      Array.from(row.cells).forEach((cell) => {
        const label = col === 0 ? "" : (labels[col] ?? "");
        if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        col += Math.max(1, cell.colSpan);
      });
    }),
  );
}

/**
 * Phone tables: every table in the app shows each row as a card (see globals.css), with each value's column name in
 * front of it. The names are read from the header row here, and kept up to date as rows load or change.
 * A table opts out with data-stack="off" (the Table component's stack={false}).
 */
export function MobileTables() {
  useEffect(() => {
    const pending = new Set<HTMLTableElement>();
    let frame = 0;
    const flush = () => {
      frame = 0;
      pending.forEach(labelTable);
      pending.clear();
    };
    const queue = (node: Node | null) => {
      const el = node instanceof Element ? node : node?.parentElement ?? null;
      if (!el) return;
      const own = el.closest("table");
      if (own) pending.add(own);
      el.querySelectorAll?.("table").forEach((t) => pending.add(t));
      if (!frame && pending.size) frame = requestAnimationFrame(flush);
    };
    document.querySelectorAll("table").forEach((t) => pending.add(t));
    frame = requestAnimationFrame(flush);
    const mo = new MutationObserver((records) => records.forEach((r) => {
      if (r.type === "childList") queue(r.target);
    }));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
