import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrialForm } from "@/components/TrialForm";

export const metadata: Metadata = {
  title: "Start your free trial",
  description: "Try BidAxiom free for 30 days. No credit card. Your company is set up in a minute.",
};

export default function FreeTrialPage() {
  return (
    <>
      <SiteHeader />
      <main style={{ background: "#f4f6f8" }}>
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", gap: 56, padding: "64px 32px 96px", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div className="kick">Free for 30 days</div>
            <h1 className="d" style={{ margin: "10px 0 0", fontSize: 46, lineHeight: 1.08, letterSpacing: "-.025em", fontWeight: 700 }}>Try BidAxiom on your own jobs.</h1>
            <p style={{ margin: "16px 0 0", fontSize: 18, lineHeight: 1.6, color: "#4a5b6a" }}>Tell us who you are and your company is created in a minute. No demo call, no credit card.</p>
            <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 16 }}>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#0e7490", fontWeight: 700 }}>&#10003;</span>Your own private company with every feature turned on</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#0e7490", fontWeight: 700 }}>&#10003;</span>Connect QuickBooks Online&apos;s sandbox to test safely</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#0e7490", fontWeight: 700 }}>&#10003;</span>Step-by-step guides in the knowledge base</li>
              <li style={{ display: "flex", gap: 10 }}><span style={{ color: "#0e7490", fontWeight: 700 }}>&#10003;</span>Switches off by itself after 30 days; nothing to cancel</li>
            </ul>
          </div>
          <div style={{ flex: "1 1 380px", maxWidth: 520, background: "#fff", border: "1px solid #e3e8ee", borderRadius: 14, padding: 28 }}>
            <TrialForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
