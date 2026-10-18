import Link from "next/link";
import { APP_URL } from "@/lib/config";

export function SiteHeader({ active }: { active?: "kb" }) {
  return (
    <header style={{ background: "#17222d", color: "#fff" }}>
      <div className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 16, paddingBottom: 16 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", textDecoration: "none" }}>
          <span className="d" style={{ width: 32, height: 32, borderRadius: 8, background: "#0e9bb8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 }}>B</span>
          <span className="d" style={{ fontWeight: 600, fontSize: 20, letterSpacing: "-.01em" }}>BidAxiom</span>
        </Link>
        <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 22 }}>
          <Link className="nl" href="/#features">Product</Link>
          <Link className="nl" href="/#quickbooks">QuickBooks</Link>
          <Link className="nl" href="/#security">Security</Link>
          <Link className={`nl${active === "kb" ? " on" : ""}`} href="/knowledge-base" aria-current={active === "kb" ? "page" : undefined}>Knowledge base</Link>
          <a className="nl" href={`${APP_URL}/login`}>Sign in</a>
          <Link className="btn t sm" href="/free-trial">Start free trial</Link>
        </nav>
      </div>
    </header>
  );
}
