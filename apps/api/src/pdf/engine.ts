import puppeteer, { type Browser } from "puppeteer";

/**
 * Singleton Puppeteer browser instance.
 * Reused across requests to avoid 500ms+ cold starts per PDF generation.
 * Module-level variable — persists for the lifetime of the Node.js process.
 */
let _browser: Browser | null = null;

/**
 * Get (or lazily create) the singleton Puppeteer browser.
 * If the browser has crashed or disconnected, it is relaunched automatically.
 */
export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return _browser;
}

/**
 * Generate a PDF Buffer from an HTML string.
 *
 * Always closes the page in a finally block to prevent orphaned Chrome tabs
 * that would accumulate memory over time.
 *
 * @param html - Full HTML document string (including <html>, <head>, <body>)
 * @returns Buffer containing the PDF bytes
 */
export async function generatePdfBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close(); // ALWAYS close in finally — prevents orphaned Chrome tabs
  }
}
