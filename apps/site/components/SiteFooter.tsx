import Link from "next/link";
import { APP_URL } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer style={{ background: "#1B2332", color: "#E6E1D6", padding: "56px 0 36px" }}>
      <div className="wrap">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
          <div style={{ maxWidth: 300 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bidaxiom-logo-light.webp" alt="BidAxiom" width={140} height={33} style={{ height: 33, width: "auto", display: "block" }} />
            <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55 }}>Bids, proposals, change orders, invoicing and job costs for contractors.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 56 }}>
            <div><p className="fh">Product</p><Link className="fl" href="/#features">Features</Link><Link className="fl" href="/#quickbooks">QuickBooks</Link><Link className="fl" href="/#security">Security</Link><Link className="fl" href="/#pricing">Pricing</Link></div>
            <div><p className="fh">Learn</p><Link className="fl" href="/knowledge-base">Knowledge base</Link><Link className="fl" href="/knowledge-base/connect-quickbooks-online">Connect QuickBooks</Link><Link className="fl" href="/knowledge-base/set-up-single-sign-on">Set up SSO</Link></div>
            <div><p className="fh">Account</p><Link className="fl" href="/free-trial">Start free trial</Link><a className="fl" href={`${APP_URL}/sign-in`}>Sign in</a></div>
          </div>
        </div>
        <p style={{ margin: "40px 0 0", paddingTop: 20, borderTop: "1px solid #2A3447", fontSize: 13, color: "#9AA3B2" }}>
          &copy; {new Date().getFullYear()} BidAxiom. QuickBooks is a trademark of Intuit Inc.; BidAxiom is not affiliated with Intuit.
        </p>
      </div>
    </footer>
  );
}
