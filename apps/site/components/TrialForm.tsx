"use client";
import { useState } from "react";
import { APP_URL } from "@/lib/config";

export function TrialForm() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setState("busy");
    const f = new FormData(e.currentTarget);
    const payload = Object.fromEntries(f.entries());
    try {
      const res = await fetch("/api/trial", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "We could not start your trial. Please try again.");
        setState("idle");
        return;
      }
      setEmail(String(payload.email));
      setState("done");
    } catch {
      setError("We could not reach BidAxiom just now. Please try again in a minute.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div role="status" style={{ background: "#e6f6fa", border: "1px solid #b7e3ee", borderRadius: 12, padding: 28 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 26 }}>Check your email.</h2>
        <p style={{ margin: "10px 0 0", fontSize: 16.5, lineHeight: 1.6 }}>
          We sent a link to <strong>{email}</strong>. Open it to choose your password, then sign in at{" "}
          <a href={`${APP_URL}/sign-in`}>app.bidaxiom.com</a> and set up your authenticator app. The link works for 7 days. If it is not in your inbox in a few minutes, look in spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label className="lbl" htmlFor="companyName">Company name</label>
        <input className="fld" id="companyName" name="companyName" required minLength={2} maxLength={120} autoComplete="organization" />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label className="lbl" htmlFor="firstName">First name</label>
          <input className="fld" id="firstName" name="firstName" required maxLength={80} autoComplete="given-name" />
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <label className="lbl" htmlFor="lastName">Last name</label>
          <input className="fld" id="lastName" name="lastName" maxLength={80} autoComplete="family-name" />
        </div>
      </div>
      <div>
        <label className="lbl" htmlFor="email">Work email</label>
        <input className="fld" id="email" name="email" type="email" required maxLength={200} autoComplete="email" />
      </div>
      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, height: 0, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {error && <p role="alert" style={{ margin: 0, color: "#991b1b", background: "#fee2e2", padding: "10px 12px", borderRadius: 8, fontSize: 14.5 }}>{error}</p>}
      <button className="btn p" type="submit" disabled={state === "busy"} style={{ fontSize: 16 }}>
        {state === "busy" ? "Setting up your company..." : "Start my free trial"}
      </button>
      <p style={{ margin: 0, fontSize: 13, color: "#5b6b7b", lineHeight: 1.5 }}>
        30 days, no credit card. We email you a link to choose your password. When the 30 days end the account switches off on its own and your work is kept for you.
      </p>
    </form>
  );
}
