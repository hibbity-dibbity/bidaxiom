/**
 * Custom template HTML builder.
 *
 * Converts a stored field mapping configuration + runtime data into a complete
 * HTML document that the existing generatePdfBuffer() Puppeteer pipeline can
 * render as a PDF.
 *
 * This module is the rendering counterpart to extract.ts:
 *   extract.ts  — detects <<field>> names from uploaded .docx/.xlsx files
 *   render.ts   — builds the output HTML from the stored field mapping
 *
 * The output HTML is semantically equivalent to the Phase 38 builder functions
 * (buildProposalHtml, buildChangeOrderHtml, etc.) but driven by user-configured
 * field mappings rather than hardcoded templates.
 */

import type { FieldMapping } from "@construction/shared";
import { PREVIEW_LINE_ITEMS } from "./fixtures.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Flat data object passed to buildCustomTemplateHtml().
 * Keys use BIDAXIOM dot-notation (e.g. "company.name", "project.jobNumber").
 * Compatible with PREVIEW_SAMPLE_DATA from fixtures.ts.
 */
export type TemplateRenderData = Record<string, string>;

// Re-export for convenience so routers can import from a single location.
export type { FieldMapping };

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------

/**
 * Escape user-supplied strings before embedding in HTML.
 * Prevents XSS in Puppeteer-rendered output (same as Phase 38 pattern).
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Field value resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the display value for a detected field given its mapping.
 *
 * - mappedTo === null  → "[UNMAPPED]" in preview mode, "" in production mode
 * - mappedTo === "IGNORED" → "" (field stripped from output)
 * - mappedTo === <key> → data[key] ?? "[UNMAPPED]" in preview, "" in production
 *
 * @param mapping   - The FieldMapping for this field
 * @param data      - Runtime data object (real or fixture)
 * @param isPreview - When true, unmapped fields show "[UNMAPPED]" placeholder
 */
function resolveValue(
  mapping: FieldMapping,
  data: TemplateRenderData,
  isPreview: boolean
): string {
  const unmappedPlaceholder = isPreview ? "[UNMAPPED]" : "";

  if (mapping.mappedTo === null) return unmappedPlaceholder;
  if (mapping.mappedTo === "IGNORED") return "";

  const value = data[mapping.mappedTo];
  if (value === undefined || value === null) return unmappedPlaceholder;
  return value;
}

// ---------------------------------------------------------------------------
// buildCustomTemplateHtml
// ---------------------------------------------------------------------------

/**
 * Build a complete HTML document from a field mapping configuration and data.
 *
 * The output is a self-contained HTML document (inline styles, no external CSS)
 * intended for Puppeteer → PDF rendering via generatePdfBuffer().
 *
 * Rendering rules:
 *  - Scalar fields (mappedTo starts with anything except "table."):
 *    Rendered as a two-column definition list: label → value
 *  - Table-context fields (mappedTo starts with "table."):
 *    Rendered as an HTML <table> iterating over lineItems rows
 *  - Unmapped fields: "[UNMAPPED]" in preview mode, "" in production
 *  - Ignored fields: empty string (stripped from output)
 *  - All user data is HTML-escaped to prevent XSS
 *
 * @param mappings  - Field mappings as stored in document_templates.field_mappings
 * @param data      - Flat data object (real data or PREVIEW_SAMPLE_DATA fixtures)
 * @param lineItems - Line item rows for table-context fields (defaults to PREVIEW_LINE_ITEMS)
 * @param isPreview - When true, unmapped fields render as "[UNMAPPED]" (default: true)
 * @returns Complete HTML string suitable for generatePdfBuffer()
 */
export function buildCustomTemplateHtml(
  mappings: FieldMapping[],
  data: TemplateRenderData,
  lineItems: Array<Record<string, string>> = PREVIEW_LINE_ITEMS,
  isPreview: boolean = true
): string {
  const primaryColor = data["company.primaryColor"] ?? "#3B5BDB";
  const companyName = escapeHtml(data["company.name"] ?? "Your Company");
  const companyAddress = escapeHtml(data["company.address"] ?? "");
  const companyPhone = escapeHtml(data["company.phone"] ?? "");
  const generatedDate = escapeHtml(data["doc.generatedDate"] ?? new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));

  // Separate table-context mappings (table.*) from scalar mappings
  const tableMappings = mappings.filter(
    (m) => m.mappedTo !== null && m.mappedTo !== "IGNORED" && m.mappedTo.startsWith("table.")
  );
  const scalarMappings = mappings.filter(
    (m) => !(m.mappedTo !== null && m.mappedTo !== "IGNORED" && m.mappedTo.startsWith("table."))
  );

  // ---------------------------------------------------------------------------
  // Build scalar fields section (definition list)
  // ---------------------------------------------------------------------------
  const scalarRows = scalarMappings
    .map((m) => {
      const label = escapeHtml(m.displayField.replace(/^<<|>>$/g, "").replace(/_/g, " "));
      const value = escapeHtml(resolveValue(m, data, isPreview));
      const valueStyle =
        value === "[UNMAPPED]"
          ? 'color:#B45309;font-style:italic;'
          : 'color:#111827;';
      return `
        <div style="display:flex;gap:16px;padding:6px 0;border-bottom:1px solid #F3F4F6;">
          <dt style="width:220px;min-width:220px;font-size:12px;color:#6B7280;font-weight:500;text-transform:capitalize;">${label}</dt>
          <dd style="flex:1;margin:0;font-size:13px;${valueStyle}">${value || '<span style="color:#9CA3AF;">—</span>'}</dd>
        </div>`;
    })
    .join("");

  // ---------------------------------------------------------------------------
  // Build table section (HTML table iterating lineItems)
  // ---------------------------------------------------------------------------
  let tableSection = "";
  if (tableMappings.length > 0 && lineItems.length > 0) {
    // Build column headers from displayField labels
    const headerCells = tableMappings
      .map((m) => {
        const label = escapeHtml(m.displayField.replace(/^<<|>>$/g, "").replace(/_/g, " "));
        return `<th style="padding:8px 10px;text-align:left;font-size:12px;font-weight:600;color:#ffffff;background:${escapeHtml(primaryColor)};border:1px solid rgba(255,255,255,0.2);">${label}</th>`;
      })
      .join("");

    // Build body rows from lineItems
    const bodyRows = lineItems
      .map((row, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
        const cells = tableMappings
          .map((m) => {
            // Extract the sub-key after "table." (e.g. "table.description" -> "description")
            const subKey = m.mappedTo!.replace(/^table\./, "");
            const cellValue = escapeHtml(row[subKey] ?? "");
            return `<td style="padding:7px 10px;font-size:12px;color:#111827;border:1px solid #E5E7EB;">${cellValue}</td>`;
          })
          .join("");
        return `<tr style="background:${rowBg};">${cells}</tr>`;
      })
      .join("");

    tableSection = `
      <section style="margin-top:24px;">
        <h3 style="font-size:13px;font-weight:600;color:#374151;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Line Items</h3>
        <table style="width:100%;border-collapse:collapse;font-family:system-ui,sans-serif;">
          <thead>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </section>`;
  }

  // ---------------------------------------------------------------------------
  // Preview watermark (shown only in preview mode)
  // ---------------------------------------------------------------------------
  const previewBanner = isPreview
    ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:4px;padding:8px 12px;margin-bottom:16px;font-size:12px;color:#92400E;">
        <strong>Preview Mode</strong> — Sample data is used. Fields marked [UNMAPPED] have no mapping configured.
       </div>`
    : "";

  // ---------------------------------------------------------------------------
  // Compose full HTML document
  // ---------------------------------------------------------------------------
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Template Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #111827; background: #FFFFFF; }
  </style>
</head>
<body style="padding:0;margin:0;">

  <!-- Header -->
  <header style="background:${escapeHtml(primaryColor)};color:#ffffff;padding:24px 40px 20px;">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.01em;">${companyName}</div>
    ${companyAddress ? `<div style="font-size:12px;margin-top:4px;opacity:0.85;">${companyAddress}</div>` : ""}
    ${companyPhone ? `<div style="font-size:12px;margin-top:2px;opacity:0.85;">${companyPhone}</div>` : ""}
  </header>

  <!-- Main content -->
  <main style="padding:24px 40px 32px;">

    ${previewBanner}

    <!-- Scalar fields section -->
    ${scalarRows
      ? `<section style="margin-bottom:8px;">
          <dl style="list-style:none;margin:0;padding:0;">
            ${scalarRows}
          </dl>
        </section>`
      : '<p style="color:#9CA3AF;font-size:13px;">No scalar fields mapped.</p>'
    }

    <!-- Table section -->
    ${tableSection}

  </main>

  <!-- Footer -->
  <footer style="padding:16px 40px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:11px;color:#9CA3AF;">Generated by BIDAXIOM</span>
    <span style="font-size:11px;color:#9CA3AF;">${generatedDate}</span>
  </footer>

</body>
</html>`;
}
