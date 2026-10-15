import { sealData } from "iron-session";
import { signAccessToken } from "../auth/jwt.js";
import { getBrowser } from "./engine.js";

/** Who the PDF is being made for. The page is opened as this user, so it shows what they can see. */
export interface PdfViewer {
  userId: string;
  orgId: string;
  orgRole: string;
  orgName?: string;
  email?: string;
}

function webBase(): string {
  return (process.env.WEB_INTERNAL_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Print a page of the web app to PDF. The page is opened in headless Chrome with a short-lived
 * session for the viewer, so the PDF is exactly the customer view shown on screen. The page marks
 * the document with the given selector once its data has loaded.
 */
export async function renderWebPageToPdf(viewer: PdfViewer, path: string, readySelector: string): Promise<Buffer> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set, so PDFs cannot be generated.");
  const accessToken = await signAccessToken({ userId: viewer.userId, orgId: viewer.orgId, orgRole: viewer.orgRole, hasMfa: true });
  const sealed = await sealData(
    { userId: viewer.userId, accessToken, orgId: viewer.orgId, orgRole: viewer.orgRole, orgName: viewer.orgName, hasMfa: true, user: { email: viewer.email ?? "" } },
    { password: secret, ttl: 10 * 60 }
  );
  const base = webBase();
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The page is opened as http://web:3000, so tell it where the API is from inside this container.
    const apiUrl = `http://localhost:${process.env.API_PORT ?? process.env.PORT ?? "3001"}`;
    await page.evaluateOnNewDocument(`window.__BIDAXIOM_API_URL__ = ${JSON.stringify(apiUrl)};`);
    const problems: string[] = [];
    page.on("requestfailed", (r) => problems.push(`${r.method()} ${r.url()} failed: ${r.failure()?.errorText ?? "unknown"}`));
    page.on("pageerror", (e) => problems.push(`page error: ${e instanceof Error ? e.message : String(e)}`));
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
    await page.setCookie({ name: "construction_session", value: sealed, url: base, httpOnly: true, secure: false, sameSite: "Lax" });
    await page.emulateMediaType("print");
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    const res = await page.goto(`${base}${path}`, { waitUntil: "networkidle2", timeout: 45_000 });
    if (!res || !res.ok()) throw new Error(`The page for the PDF did not load (${res?.status() ?? "no response"}).`);
    if (page.url().includes("/sign-in")) throw new Error("The PDF renderer could not sign in to the web app.");
    try {
      await page.waitForSelector(readySelector, { timeout: 30_000 });
    } catch {
      const detail = problems.slice(0, 4).join("; ");
      throw new Error(`The document did not finish loading for the PDF.${detail ? ` ${detail}` : ""}`);
    }
    // Let fonts and any late queries settle.
    await new Promise((r) => setTimeout(r, 400));
    // Lift the document out of the app shell, whose fixed-height scroll areas would cut it to one page.
    await page.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(readySelector)});
      if (!el) return;
      document.documentElement.classList.remove("dark");
      document.documentElement.style.cssText = "height:auto;overflow:visible;background:#fff";
      document.body.style.cssText = "height:auto;overflow:visible;background:#fff;margin:0";
      el.style.cssText = "position:static;width:100%;max-width:none;margin:0 auto;border:0;box-shadow:none;padding:0";
      document.body.replaceChildren(el);
    })()`);
    const buf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
  }
}
