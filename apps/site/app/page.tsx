import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ARTICLES } from "@/lib/articles";

const STAGES = [
  ["Opportunity", "Track the lead and the customer from first contact."],
  ["Proposal", "Price with cost lines, margin, options and tax."],
  ["Signed", "Customer e-signs and the contract value is set."],
  ["Build", "Purchase orders, work orders and change orders."],
  ["Billed and closed", "Milestone invoices, payments and a clean close-out."],
];

const Icon = ({ children }: { children: React.ReactNode }) => (
  <div className="ic">
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{children}</svg>
  </div>
);

const FEATURES: { title: string; body: string; icon: React.ReactNode }[] = [
  { title: "Proposal builder", body: "Build proposals from cost lines with markup, optional add-ons and sales tax. See your margin as you price, then send for e-signature.", icon: <><path d="M3 2h7l3 3v9H3z" /><path d="M5.5 8h5M5.5 11h3" /></> },
  { title: "Change orders", body: "Price extra work, get it approved in writing and roll it into the contract so billing and costs stay accurate.", icon: <path d="M2 8h9M8 4l4 4-4 4" /> },
  { title: "Milestone invoicing", body: "Split the contract into milestones and invoice each one. Contract value, billed and remaining are always in front of you.", icon: <><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M5 10h3" /></> },
  { title: "Purchase and work orders", body: "Issue orders to subs and vendors, then compare projected cost to actual cost on every job.", icon: <><path d="M3 13V6l5-3 5 3v7z" /><path d="M6.5 13V9h3v4" /></> },
  { title: "Owner and PM dashboard", body: "Backlog, billed, margin, aging, cash coming in and the projects that need you, all on one page. Project managers see their own jobs.", icon: <path d="M2 12l4-4 3 3 5-6" /> },
  { title: "QuickBooks Online sync", body: "Invoices and orders flow to QuickBooks, and bills and payments flow back. No double entry.", icon: <><path d="M2.5 8a5.5 5.5 0 019.5-3.7M13.5 8A5.5 5.5 0 014 11.7" /><path d="M12 1.5v3h-3M4 14.5v-3h3" /></> },
];

export default function Home() {
  const featured = ARTICLES.slice(0, 4);
  return (
    <>
      <SiteHeader />

      <section style={{ background: "linear-gradient(180deg,#17222d 0,#17222d 62%,#fff 62%)", color: "#fff" }}>
        <div className="wrap" style={{ paddingTop: 56 }}>
          <div style={{ maxWidth: 760 }}>
            <div className="kick" style={{ color: "#5fd0e6" }}>Construction management software</div>
            <h1 className="d" style={{ margin: "14px 0 0", fontSize: "clamp(38px,6vw,60px)", lineHeight: 1.05, letterSpacing: "-.03em", fontWeight: 700 }}>Win the bid. Run the job. Get paid.</h1>
            <p style={{ margin: "20px 0 0", fontSize: 19, lineHeight: 1.55, color: "#c9d4de", maxWidth: 640 }}>
              BidAxiom is built for contractors who are tired of retyping the same numbers. Track the lead, price the bid, win the job, bill the milestones and watch your costs against the contract, with QuickBooks Online kept in step.
            </p>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link className="btn t" href="/free-trial">Start your 30-day free trial</Link>
              <Link className="btn o" href="/knowledge-base">Browse the knowledge base</Link>
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 14, color: "#8fa3b5" }}>No credit card. No demo call. Your company is ready in a minute.</p>
          </div>

          <div style={{ marginTop: 48, background: "#e3e8ee", borderRadius: "14px 14px 0 0", border: "1px solid #2c3d4d", borderBottom: 0, boxShadow: "0 30px 60px rgba(8,14,20,.35)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 16px", background: "#e3e8ee", borderBottom: "1px solid #d3dbe3" }}>
              {[0, 1, 2].map((i) => (<span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#c4ced8" }} />))}
              <span style={{ marginLeft: 14, fontSize: 12, color: "#5b6b7b" }}>app.bidaxiom.com</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kb/dashboard.png" alt="The BidAxiom dashboard showing backlog, billing, margin, receivables and projects that need attention" style={{ display: "block", width: "100%", height: "auto" }} />
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 0 24px" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640 }}>
            <div className="kick">One job, one record</div>
            <h2 className="d h2">Every stage of the job lives on the same project.</h2>
          </div>
          <ol style={{ listStyle: "none", margin: "36px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
            {STAGES.map(([t, d], i) => (
              <li key={t} style={{ borderTop: "3px solid #0e7490", paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0e7490" }}>{i + 1}</div>
                <div className="d" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{t}</div>
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#4a5b6a" }}>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" style={{ padding: "56px 0 80px" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640 }}>
            <div className="kick">The product</div>
            <h2 className="d h2">What you get</h2>
          </div>
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
            {FEATURES.map((f) => (
              <div className="feat" key={f.title}>
                <Icon>{f.icon}</Icon>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="quickbooks" style={{ background: "#f4f6f8", padding: "80px 0" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div className="kick">QuickBooks Online</div>
            <h2 className="d h2">QuickBooks stays your book of record.</h2>
            <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.6, color: "#4a5b6a" }}>
              BidAxiom handles the job side: proposals, change orders, milestones and job costs. Your bookkeeper keeps working in QuickBooks the way they always have, on a cash basis, with the same accounts and tax codes.
            </p>
            <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 16 }}>
              {["Invoices and purchase orders post to QuickBooks", "Bills, expenses and payments come back for cost tracking", "Tax codes and accounts are mapped once, by you"].map((t) => (
                <li key={t} style={{ display: "flex", gap: 10 }}><span style={{ color: "#0e7490", fontWeight: 700 }}>&#10003;</span>{t}</li>
              ))}
            </ul>
            <p style={{ margin: "22px 0 0" }}><Link href="/knowledge-base/connect-quickbooks-online" style={{ fontWeight: 600, fontSize: 16 }}>Read the setup guide &rarr;</Link></p>
          </div>
          <div style={{ flex: "1 1 420px", minWidth: 0, background: "#fff", border: "1px solid #e3e8ee", borderRadius: 14, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "stretch", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px", border: "1px solid #e3e8ee", borderRadius: 10, padding: 16 }}>
                <div className="d" style={{ fontWeight: 600, fontSize: 17 }}>BidAxiom</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#5b6b7b", lineHeight: 1.6 }}>Proposals<br />Change orders<br />Milestones<br />Purchase orders</div>
              </div>
              <div style={{ flex: "0 0 70px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 6, color: "#0e7490", fontSize: 12, fontWeight: 600 }}><span>invoices &rarr;</span><span>&larr; bills</span></div>
              <div style={{ flex: "1 1 150px", border: "1px solid #e3e8ee", borderRadius: 10, padding: 16, background: "#f9fafb" }}>
                <div className="d" style={{ fontWeight: 600, fontSize: 17 }}>QuickBooks Online</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#5b6b7b", lineHeight: 1.6 }}>Book of record<br />Accounts and tax<br />Payments<br />Bookkeeper</div>
              </div>
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: "#5b6b7b" }}>Sync status, last run and any item that needs a decision show up inside BidAxiom.</p>
          </div>
        </div>
      </section>

      <section id="security" style={{ padding: "80px 0" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640 }}>
            <div className="kick">Security and access</div>
            <h2 className="d h2">The right people see the right numbers.</h2>
          </div>
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
            {[
              ["Roles", "Admins, project managers, accountants, estimators and members each get the access that fits the job. Money screens are limited to the roles that need them."],
              ["Authenticator and passkeys", "Sign in with a password plus an authenticator app, or skip the password with a passkey on your phone or laptop."],
              ["Single sign-on", "Connect Microsoft sign-in for your company, so people use the account they already have."],
              ["Separate company data", "Each company's records are kept in their own separate space, not mixed into a shared table."],
            ].map(([t, b]) => (
              <div className="feat" key={t}><h3 style={{ marginTop: 0 }}>{t}</h3><p>{b}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#f4f6f8", padding: "80px 0" }}>
        <div className="wrap">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
            <div><div className="kick">Knowledge base</div><h2 className="d h2">Step-by-step guides with screenshots.</h2></div>
            <Link href="/knowledge-base" style={{ fontWeight: 600, fontSize: 16 }}>All articles &rarr;</Link>
          </div>
          <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
            {featured.map((a) => (
              <Link className="kb" key={a.slug} href={`/knowledge-base/${a.slug}`}>
                <span className="pill">{a.category}</span>
                <div className="d" style={{ fontSize: 19, fontWeight: 600, marginTop: 12 }}>{a.title}</div>
                <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "#5b6b7b" }}>{a.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: "#0e7490", color: "#fff", padding: "72px 0" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 620 }}>
            <h2 className="d" style={{ margin: 0, fontSize: 40, lineHeight: 1.1, letterSpacing: "-.02em", fontWeight: 700 }}>Try it on a real job. Free for 30 days.</h2>
            <p style={{ margin: "14px 0 0", fontSize: 18, lineHeight: 1.55, color: "#d6f1f7" }}>Enter your company details and you are in. No credit card, no sales call.</p>
          </div>
          <Link className="btn" href="/free-trial" style={{ background: "#17222d", color: "#fff", fontSize: 17, padding: "14px 26px" }}>Start your free trial</Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
