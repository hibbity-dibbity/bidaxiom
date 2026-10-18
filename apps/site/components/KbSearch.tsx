"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

type Item = { slug: string; title: string; category: string; summary: string };

export function KbSearch({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return items.filter((a) => {
      const hay = `${a.title} ${a.category} ${a.summary}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [q, items]);

  return (
    <div style={{ marginTop: 26, maxWidth: 640 }}>
      <label htmlFor="kb-q" style={{ position: "absolute", left: -9999 }}>Search articles</label>
      <input
        id="kb-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search, for example: QuickBooks, passkey, change order"
        style={{ width: "100%", font: "inherit", fontSize: 16, padding: "14px 16px", borderRadius: 9, border: 0, color: "#1f2d3a" }}
      />
      {q.trim() && (
        <div style={{ marginTop: 10, background: "#fff", borderRadius: 9, color: "#1f2d3a", padding: "4px 14px" }} aria-live="polite">
          {results.length === 0 ? (
            <p style={{ margin: 0, padding: "14px 0", fontSize: 15, color: "#5b6b7b" }}>No articles match. Try a shorter word.</p>
          ) : (
            results.map((a) => (
              <Link key={a.slug} href={`/knowledge-base/${a.slug}`} style={{ display: "block", padding: "12px 0", borderBottom: "1px solid #e3e8ee", color: "#1f2d3a" }}>
                <span style={{ fontWeight: 600 }}>{a.title}</span> <span style={{ fontSize: 12, color: "#5b6b7b" }}>&middot; {a.category}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
