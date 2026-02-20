/**
 * Custom template renderer — supports .docx and .xlsx templates.
 *
 * .docx: docxtemplater fills <<field>> placeholders, mammoth converts to HTML.
 * .xlsx: ExcelJS fills <<field>> placeholders cell-by-cell, rendered as HTML table.
 *
 * Both paths produce a complete HTML document for Puppeteer → PDF rendering.
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { createRequire } from "module";
import type { FieldMapping } from "@construction/shared";

// mammoth has no ESM export — load via createRequire (same pattern as InspectModule)
const require = createRequire(import.meta.url);
const mammoth = require("mammoth") as {
  convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build the docxtemplater values object: detectedField → resolved string value.
 */
function buildValuesMap(
  mappings: FieldMapping[],
  data: Record<string, string>,
  isPreview: boolean
): Record<string, string> {
  const unmappedPlaceholder = isPreview ? "[UNMAPPED]" : "";
  const values: Record<string, string> = {};
  for (const m of mappings) {
    if (m.mappedTo === null) {
      values[m.detectedField] = unmappedPlaceholder;
    } else if (m.mappedTo === "IGNORED") {
      values[m.detectedField] = "";
    } else {
      values[m.detectedField] = data[m.mappedTo] ?? unmappedPlaceholder;
    }
  }
  return values;
}

/**
 * Wrap body HTML in a complete HTML document for Puppeteer.
 */
function wrapHtml(bodyContent: string, isPreview: boolean): string {
  const previewBanner = isPreview
    ? `<div style="background:#FEF3C7;border:1px solid #F59E0B;padding:8px 12px;margin-bottom:16px;font-size:12px;color:#92400E;">
        <strong>Preview Mode</strong> — Sample data used. [UNMAPPED] fields have no mapping configured.
       </div>`
    : "";

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
    h1, h2, h3, h4, h5, h6 { margin: 0 0 8px; }
  </style>
</head>
<body>
  ${previewBanner}
  ${bodyContent}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// .docx renderer — docxtemplater fill → mammoth → HTML
// ---------------------------------------------------------------------------

async function renderDocx(
  buffer: Buffer,
  values: Record<string, string>,
  isPreview: boolean
): Promise<string> {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<<", end: ">>" },
    nullGetter: () => "",
  });
  doc.render(values);
  const filledBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: filledBuffer });
  return wrapHtml(bodyHtml, isPreview);
}

// ---------------------------------------------------------------------------
// .xlsx renderer — ExcelJS cell substitution → HTML table
// ---------------------------------------------------------------------------

async function renderXlsx(
  buffer: Buffer,
  values: Record<string, string>,
  isPreview: boolean
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  let tablesHtml = "";

  workbook.eachSheet((worksheet) => {
    let rowsHtml = "";

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      let cellsHtml = "";

      row.eachCell({ includeEmpty: true }, (cell) => {
        let val = "";
        const cellVal = cell.value;

        if (typeof cellVal === "string") {
          // Replace <<field>> placeholders with resolved values
          val = cellVal.replace(/<<([^<>]+)>>/gi, (_, field: string) => {
            return values[field.toLowerCase()] ?? "";
          });
        } else if (cellVal !== null && cellVal !== undefined) {
          val = String(cellVal);
        }

        const esc = escapeHtml(val);
        // Preserve whitespace in cells; style [UNMAPPED] in amber
        const style =
          val === "[UNMAPPED]"
            ? "padding:6px 10px;border:1px solid #E5E7EB;font-size:13px;color:#B45309;font-style:italic;"
            : "padding:6px 10px;border:1px solid #E5E7EB;font-size:13px;";
        cellsHtml += `<td style="${style}">${esc}</td>`;
      });

      if (cellsHtml) rowsHtml += `<tr>${cellsHtml}</tr>`;
    });

    if (rowsHtml) {
      const sheetName = escapeHtml(worksheet.name ?? "Sheet");
      tablesHtml += `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px;">${sheetName}</h3>
          <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
        </div>`;
    }
  });

  if (!tablesHtml) {
    tablesHtml = `<p style="color:#9CA3AF;">No content found in template.</p>`;
  }

  return wrapHtml(tablesHtml, isPreview);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Render a custom template (.docx or .xlsx) buffer with field mappings applied.
 *
 * @param buffer   - Raw file bytes downloaded from S3
 * @param fileType - "docx" or "xlsx"
 * @param mappings - Stored field mappings (detectedField → mappedTo BIDAXIOM key)
 * @param data     - Flat data keyed by BIDAXIOM dot-notation (e.g. "company.name")
 * @param isPreview - When true, unmapped fields show "[UNMAPPED]" and a banner is added
 * @returns Complete HTML string suitable for generatePdfBuffer()
 */
export async function renderTemplate(
  buffer: Buffer,
  fileType: "docx" | "xlsx",
  mappings: FieldMapping[],
  data: Record<string, string>,
  isPreview: boolean
): Promise<string> {
  const values = buildValuesMap(mappings, data, isPreview);

  if (fileType === "xlsx") {
    return renderXlsx(buffer, values, isPreview);
  }
  return renderDocx(buffer, values, isPreview);
}
