/**
 * Custom template renderer.
 *
 * Fills a .docx Buffer's <<field>> placeholders via docxtemplater, then
 * converts the filled .docx to HTML via mammoth, and wraps the result in a
 * full HTML document for Puppeteer → PDF rendering.
 *
 * This is the rendering counterpart to extract.ts:
 *   extract.ts  — detects <<field>> names from uploaded .docx/.xlsx files
 *   render.ts   — fills those fields and returns HTML for Puppeteer
 *
 * Both docxtemplater and mammoth are CommonJS packages; we use createRequire
 * to load them in this ESM module (same pattern as extract.ts).
 */

import { createRequire } from "module";
import type { FieldMapping } from "@construction/shared";

// CJS modules loaded via createRequire (ESM-safe pattern, same as extract.ts)
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Docxtemplater = require("docxtemplater") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PizZip = require("pizzip") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mammoth = require("mammoth") as {
  convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

/**
 * Fill <<field>> placeholders in a .docx Buffer, convert to HTML, and
 * wrap in a complete HTML document suitable for generatePdfBuffer().
 *
 * Value resolution rules (per FieldMapping):
 *   - mappedTo === null     → "[UNMAPPED]" in preview, "" in production
 *   - mappedTo === "IGNORED"→ ""
 *   - mappedTo === <key>    → data[key] ?? ("[UNMAPPED]" in preview, "" in production)
 *
 * @param docxBuffer - Raw .docx file bytes (from S3)
 * @param mappings   - Field mappings as stored in document_templates.field_mappings
 * @param data       - Flat data object keyed by BIDAXIOM dot-notation (e.g. "company.name")
 * @param isPreview  - When true, unmapped fields render as "[UNMAPPED]" and a banner is shown
 * @returns Complete HTML string suitable for generatePdfBuffer()
 */
export async function renderDocxTemplate(
  docxBuffer: Buffer,
  mappings: FieldMapping[],
  data: Record<string, string>,
  isPreview: boolean
): Promise<string> {
  // -------------------------------------------------------------------------
  // 1. Build values object keyed by detectedField (lowercased tag name)
  // -------------------------------------------------------------------------
  const unmappedPlaceholder = isPreview ? "[UNMAPPED]" : "";

  const values: Record<string, string> = {};
  for (const mapping of mappings) {
    if (mapping.mappedTo === null) {
      values[mapping.detectedField] = unmappedPlaceholder;
    } else if (mapping.mappedTo === "IGNORED") {
      values[mapping.detectedField] = "";
    } else {
      values[mapping.detectedField] = data[mapping.mappedTo] ?? unmappedPlaceholder;
    }
  }

  // -------------------------------------------------------------------------
  // 2. Fill .docx placeholders with docxtemplater
  // -------------------------------------------------------------------------
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<<", end: ">>" },
    // nullGetter: suppress errors for any tags not present in values map
    nullGetter: () => "",
  });
  doc.render(values);
  const filledBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

  // -------------------------------------------------------------------------
  // 3. Convert filled .docx to HTML with mammoth
  // -------------------------------------------------------------------------
  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: filledBuffer });

  // -------------------------------------------------------------------------
  // 4. Preview watermark banner (shown only in preview mode)
  // -------------------------------------------------------------------------
  const previewBanner = isPreview
    ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;padding:8px 12px;margin-bottom:16px;font-size:12px;color:#92400E;">
        <strong>Preview Mode</strong> — Sample data used. [UNMAPPED] fields have no mapping configured.
       </div>`
    : "";

  // -------------------------------------------------------------------------
  // 5. Wrap in full HTML document for Puppeteer
  // -------------------------------------------------------------------------
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document Preview</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #111827;
           padding: 32px 48px; margin: 0; background: #fff; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #E5E7EB; padding: 6px 10px; }
    th { background: #F3F4F6; font-weight: 600; }
    p { margin: 0 0 8px; }
  </style>
</head>
<body>
  ${previewBanner}
  ${bodyHtml}
</body>
</html>`;
}
