import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrialForm } from "@/components/TrialForm";
import { PRICE_PER_MONTH } from "@/lib/config";

export const metadata: Metadata = {
  title: "Start your free trial",
  description: "Try BidAxiom free for 30 days. No credit card. Your company is set up in a minute.",
};

export default function FreeTrialPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ background: "#F3F1EC" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 56, padding: "64px 32px 96px", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div className="kick">Free for 30 days</div>
            <h1 className="d" style={{ margin: "10px 0 0", fontSize: 46, lineHeight: 1.08, letterSpacing: "-.025em", fontWeight: 700 }}>Try BidAxiom on your own jobs.</h1>
            <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.6, color: "#4A4F5C" }}>Tell us who you are and your company is created in a minute. No demo call, no credit card.</p>
            <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 16 }}>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#9A5A22", fontWeight: 700 }}>&#10003;</span>Your own private company with every feature turned on</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#9A5A22", fontWeight: 700 }}>&#10003;</span>Connect QuickBooks Online&apos;s sandbox to test safely</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#9A5A22", fontWeight: 700 }}>&#10003;</span>Step-by-step guides in the knowledge base</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#9A5A22", fontWeight: 700 }}>&#10003;</span>Switches off by itself after 30 days; nothing to cancel</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#9A5A22", fontWeight: 700 }}>&#10003;</span>If you keep it: ${PRICE_PER_MONTH} a month per company, unlimited users</li>
            </ul>
          </div>
          <div style={{ flex: "1 1 380px", maxWidth: 520, background: "#fff", border: "1px solid #E4E0D6", borderRadius: 14, padding: 28 }}>
            <TrialForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
