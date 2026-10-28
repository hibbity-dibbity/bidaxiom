import Link from "next/link";
import { APP_URL } from "@/lib/config";

export function SiteHeader({ active }: { active?: "kb" }) {
  return (
    <header style={{ background: "#1B2332", color: "#fff" }}>
      <div className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 16, paddingBottom: 16 }}>
        <Link href="/" aria-label="BidAxiom home" style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bidaxiom-logo-light.webp" alt="BidAxiom" width={155} height={36} style={{ height: 36, width: "auto", display: "block" }} />
        </Link>
        <nav aria-label="Main" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 22 }}>
          <Link className="nl" href="/#features">Product</Link>
          <Link className="nl" href="/#quickbooks">QuickBooks</Link>
          <Link className="nl" href="/#security">Security</Link>
          <Link className="nl" href="/#pricing">Pricing</Link>
          <Link className={`nl${active === "kb" ? " on" : ""}`} href="/knowledge-base" aria-current={active === "kb" ? "page" : undefined}>Knowledge base</Link>
          <a className="nl" href={`${APP_URL}/sign-in`}>Sign in</a>
          <Link className="btn t sm" href="/free-trial">Start free trial</Link>
        </nav>
      </div>
    </header>
  );
}
