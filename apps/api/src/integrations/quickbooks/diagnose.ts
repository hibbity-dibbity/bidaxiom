import { eq } from "drizzle-orm";
import { refreshQboToken } from "./oauth.js";
import { encryptToken } from "./crypto.js";

/**
 * Read-only health check of a company's QuickBooks connection.
 * Only ever issues GET requests (company info, preferences, SELECT queries). The one write is to our own
 * database: if the access token has expired it is refreshed, and QuickBooks hands back a replacement refresh token
 * that has to be stored (the same thing the sync worker does).
 */

export interface DiagnoseItem {
  key: string;
  label: string;
  ok: boolean;
  value?: string;
  note?: string;
}

export interface DiagnoseResult {
  checkedAt: string;
  environment: string;
  tokenRefreshed: boolean;
  items: DiagnoseItem[];
  /** Where it stopped, if it could not even reach QuickBooks. */
  fatal?: string;
}

const BASE: Record<string, string> = {
  production: "https://quickbooks.api.intuit.com",
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
};

async function qboGet(base: string, realmId: string, token: string, path: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}/v3/company/${realmId}/${path}${sep}minorversion=75`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`QuickBooks answered ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json();
}

const sel = (q: string) => `query?query=${encodeURIComponent(q)}`;

export async function diagnoseQboConnection(tenant: { db: any; schema: any }): Promise<DiagnoseResult> {
  const { db, schema } = tenant;
  const result: DiagnoseResult = { checkedAt: new Date().toISOString(), environment: "", tokenRefreshed: false, items: [] };
  const add = (i: DiagnoseItem) => result.items.push(i);

  const [conn] = await db.select().from(schema.qboConnections).where(eq(schema.qboConnections.status, "active")).limit(1);
  if (!conn) {
    result.fatal = "No active QuickBooks connection. Connect first.";
    return result;
  }
  result.environment = conn.environment ?? process.env.QBO_ENVIRONMENT ?? "sandbox";
  const base = BASE[result.environment] ?? BASE.sandbox;

  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET) {
    result.fatal = "The server has no QuickBooks app keys (QBO_CLIENT_ID / QBO_CLIENT_SECRET), so it cannot talk to QuickBooks.";
    return result;
  }

  // Token: use the stored one, refresh when expired.
  let token: string | null = conn.accessToken;
  if (!token || new Date(conn.tokenExpiresAt) <= new Date()) {
    try {
      const t = await refreshQboToken(conn.encryptedRefreshToken);
      await db
        .update(schema.qboConnections)
        .set({
          accessToken: t.accessToken,
          encryptedRefreshToken: encryptToken(t.refreshToken),
          tokenExpiresAt: t.tokenExpiresAt,
          refreshTokenExpiresAt: t.refreshTokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.qboConnections.id, conn.id));
      token = t.accessToken;
      result.tokenRefreshed = true;
    } catch (e) {
      result.fatal = `The saved connection can no longer be renewed (${e instanceof Error ? e.message : "unknown error"}). Disconnect and connect QuickBooks again.`;
      return result;
    }
  }
  add({ key: "token", label: "Sign-in to QuickBooks", ok: true, value: result.tokenRefreshed ? "Renewed" : "Valid" });

  const realm = conn.realmId as string;
  const run = async (key: string, label: string, fn: () => Promise<Omit<DiagnoseItem, "key" | "label" | "ok">>) => {
    try {
      add({ key, label, ok: true, ...(await fn()) });
    } catch (e) {
      add({ key, label, ok: false, note: e instanceof Error ? e.message : "Failed" });
    }
  };

  await run("company", "Company", async () => {
    const d = await qboGet(base, realm, token!, `companyinfo/${realm}`);
    const c = d.CompanyInfo ?? {};
    const nv: Array<{ Name: string; Value: string }> = c.NameValue ?? [];
    const pick = (n: string) => nv.find((x) => x.Name === n)?.Value;
    const plan = pick("OfferingSku");
    const status = pick("SubscriptionStatus");
    return {
      value: [c.CompanyName ?? c.LegalName, c.Country].filter(Boolean).join(" · "),
      note: [plan ? `Plan: ${plan}` : null, status ? `Subscription: ${status}` : null].filter(Boolean).join(" · ") || "QuickBooks did not report the plan.",
    };
  });

  await run("preferences", "Features", async () => {
    const d = await qboGet(base, realm, token!, "preferences");
    const p = d.Preferences ?? {};
    const nv: Array<{ Name: string; Value: string }> = p.OtherPrefs?.NameValue ?? [];
    const projectFlags = nv.filter((x) => /project/i.test(x.Name)).map((x) => `${x.Name}=${x.Value}`);
    const bits = [
      `Class tracking: ${p.AccountingInfoPrefs?.ClassTrackingPerTxn ? "on" : "off"}`,
      `Locations: ${p.AccountingInfoPrefs?.TrackDepartments ? "on" : "off"}`,
      projectFlags.length ? `Projects: ${projectFlags.join(", ")}` : "No Projects setting was reported",
    ];
    return { value: bits.join(" · ") };
  });

  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const count = async (q: string) => {
    const d = await qboGet(base, realm, token!, sel(q));
    return Number(d.QueryResponse?.totalCount ?? 0);
  };

  await run("customers", "Customers", async () => {
    const all = await count("select count(*) from Customer");
    const jobs = await count("select count(*) from Customer where Job = true");
    return { value: `${all} total, ${jobs} sub-customers (jobs)` };
  });

  // What the books actually contain: tells us where income and costs are recorded.
  const kinds: Array<[string, string, string]> = [
    ["deposits", "Deposits (last 12 months)", `select count(*) from Deposit where TxnDate >= '${since}'`],
    ["salesReceipts", "Sales receipts (last 12 months)", `select count(*) from SalesReceipt where TxnDate >= '${since}'`],
    ["payments", "Customer payments (last 12 months)", `select count(*) from Payment where TxnDate >= '${since}'`],
    ["invoices", "Invoices (last 12 months)", `select count(*) from Invoice where TxnDate >= '${since}'`],
    ["purchases", "Expenses and checks (last 12 months)", `select count(*) from Purchase where TxnDate >= '${since}'`],
    ["bills", "Vendor bills (last 12 months)", `select count(*) from Bill where TxnDate >= '${since}'`],
    ["purchaseOrders", "Purchase orders (last 12 months)", `select count(*) from PurchaseOrder where TxnDate >= '${since}'`],
  ];
  for (const [key, label, q] of kinds) await run(key, label, async () => ({ value: String(await count(q)) }));

  return result;
}
