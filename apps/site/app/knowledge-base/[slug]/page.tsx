import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Rich } from "@/components/Rich";
import { ARTICLES } from "@/lib/articles";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = ARTICLES.find((x) => x.slug === params.slug);
  return a ? { title: a.title, description: a.summary } : {};
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const idx = ARTICLES.findIndex((x) => x.slug === params.slug);
  if (idx < 0) notFound();
  const a = ARTICLES[idx];
  const prev = ARTICLES[idx - 1];
  const next = ARTICLES[idx + 1];
  const related = a.related.map((s) => ARTICLES.find((x) => x.slug === s)).filter(Boolean) as typeof ARTICLES;

  return (
    <>
      <SiteHeader active="kb" />
      <div style={{ background: "#f4f6f8", borderBottom: "1px solid #e3e8ee" }}>
        <div className="wrap" style={{ paddingTop: 14, paddingBottom: 14, fontSize: 14, color: "#5b6b7b" }}>
          <Link href="/knowledge-base">Knowledge base</Link> / {a.category} / {a.title}
        </div>
      </div>

      <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 48, paddingTop: 44, paddingBottom: 72, alignItems: "flex-start" }}>
        <article style={{ flex: "999 1 560px", minWidth: 0, maxWidth: 760 }}>
          <span className="pill">{a.category}</span>
          <h1 className="d" style={{ margin: "14px 0 0", fontSize: "clamp(32px,5vw,44px)", lineHeight: 1.1, letterSpacing: "-.025em", fontWeight: 700 }}>{a.title}</h1>
          <p style={{ margin: "14px 0 0", fontSize: 19, lineHeight: 1.6, color: "#4a5b6a" }}>{a.intro}</p>
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "#5b6b7b" }}>About {a.minutes} minutes &middot; {a.steps.length} steps</p>

          {a.steps.map((s, i) => (
            <div className="step" key={i} id={`step-${i + 1}`}>
              <div className="num" aria-hidden="true">{i + 1}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2>{s.title}</h2>
                {s.body.map((p, j) => (<p key={j}><Rich text={p} /></p>))}
                {s.shot && (
                  <figure className="shot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.shot.src} alt={s.shot.alt} loading="lazy" />
                    <figcaption>{s.shot.caption}</figcaption>
                  </figure>
                )}
                {s.tip && <div className="note tip"><strong>Tip.</strong> <Rich text={s.tip} /></div>}
                {s.warn && <div className="note warn"><strong>Careful.</strong> <Rich text={s.warn} /></div>}
              </div>
            </div>
          ))}

          <section style={{ marginTop: 56, padding: "22px 24px", background: "#f4f6f8", border: "1px solid #e3e8ee", borderRadius: 12 }}>
            <h2 className="d" style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Want to try this yourself?</h2>
            <p style={{ margin: "8px 0 14px", fontSize: 15.5, color: "#4a5b6a" }}>Start a free 30-day trial and follow along in your own company.</p>
            <Link className="btn p sm" href="/free-trial">Start free trial</Link>
          </section>

          <nav aria-label="Article navigation" style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 14 }}>
            {prev && (
              <Link href={`/knowledge-base/${prev.slug}`} style={{ flex: "1 1 240px", border: "1px solid #e3e8ee", borderRadius: 10, padding: "14px 16px", color: "#1f2d3a" }}>
                <span style={{ display: "block", fontSize: 12, color: "#5b6b7b" }}>Previous</span><span style={{ fontWeight: 600 }}>{prev.title}</span>
              </Link>
            )}
            {next && (
              <Link href={`/knowledge-base/${next.slug}`} style={{ flex: "1 1 240px", border: "1px solid #e3e8ee", borderRadius: 10, padding: "14px 16px", color: "#1f2d3a", textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 12, color: "#5b6b7b" }}>Next</span><span style={{ fontWeight: 600 }}>{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <aside style={{ flex: "1 1 240px", minWidth: 0, maxWidth: 300 }}>
          <div className="toc" style={{ position: "sticky", top: 24 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#5b6b7b" }}>On this page</p>
            {a.steps.map((s, i) => (<a key={i} href={`#step-${i + 1}`}>{i + 1}. {s.title}</a>))}
            {related.length > 0 && (
              <div style={{ marginTop: 28, padding: 16, border: "1px solid #e3e8ee", borderRadius: 10, fontSize: 14, lineHeight: 1.6, color: "#4a5b6a" }}>
                <strong style={{ color: "#1f2d3a" }}>Related</strong>
                {related.map((r) => (<div key={r.slug}><Link href={`/knowledge-base/${r.slug}`} style={{ display: "inline", padding: 0, border: 0 }}>{r.title}</Link></div>))}
              </div>
            )}
          </div>
        </aside>
      </div>
      <SiteFooter />
    </>
  );
}
