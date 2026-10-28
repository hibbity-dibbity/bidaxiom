import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { KbSearch } from "@/components/KbSearch";
import { ARTICLES } from "@/lib/articles";
import { CATEGORIES } from "@/lib/kb";

export const metadata: Metadata = {
  title: "Knowledge base",
  description: "Step-by-step BidAxiom guides with screenshots: connect QuickBooks, set up single sign-on, build proposals and invoice by milestone.",
};

export default function KnowledgeBase() {
  const cats = CATEGORIES.map((c) => ({ ...c, count: ARTICLES.filter((a) => a.category === c.name).length })).filter((c) => c.count > 0);
  const items = ARTICLES.map(({ slug, title, category, summary }) => ({ slug, title, category, summary }));
  return (
    <>
      <SiteHeader active="kb" />
      <section style={{ background: "#1B2332", color: "#fff", padding: "56px 0 72px" }}>
        <div className="wrap">
          <div style={{ fontSize: 13, color: "#9AA3B2" }}>Knowledge base</div>
          <h1 className="d" style={{ margin: "10px 0 0", fontSize: 48, lineHeight: 1.08, letterSpacing: "-.025em", fontWeight: 700 }}>How can we help?</h1>
          <KbSearch items={items} />
        </div>
      </section>

      <section style={{ padding: "56px 0 24px" }}>
        <div className="wrap">
          <h2 className="d" style={{ margin: "0 0 20px", fontSize: 26, fontWeight: 600 }}>Browse by topic</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            {cats.map((c) => {
              const first = ARTICLES.find((a) => a.category === c.name)!;
              return (
                <Link className="cat" key={c.name} href={`/knowledge-base/${first.slug}`}>
                  <h3 className="d" style={{ marginTop: 0 }}>{c.name}</h3>
                  <p>{c.blurb}</p>
                  <span style={{ display: "block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "#9A5A22" }}>{c.count} {c.count === 1 ? "article" : "articles"}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: "32px 0 88px" }}>
        <div className="wrap" style={{ maxWidth: 880 }}>
          <h2 className="d" style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>All articles</h2>
          <div style={{ marginTop: 12, borderTop: "1px solid #E4E0D6" }}>
            {ARTICLES.map((a) => (
              <Link className="row" key={a.slug} href={`/knowledge-base/${a.slug}`}>
                <span style={{ fontSize: 17, fontWeight: 500 }}>{a.title}</span>
                <span className="pill gray">{a.category}</span>
              </Link>
            ))}
          </div>
          <p style={{ marginTop: 28, fontSize: 15, color: "#4A4F5C" }}>New to BidAxiom? <Link href="/free-trial">Start a free 30-day trial</Link> and follow along on your own company.</p>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
