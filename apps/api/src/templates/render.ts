/**
 * Custom template renderer — supports .docx and .xlsx templates.
 *
 * .docx: docxtemplater fills <<field>> placeholders, then:
 *   - LibreOffice converts the filled .docx directly to PDF (preserves formatting), OR
 *   - mammoth converts to HTML → Puppeteer (fallback when LibreOffice not installed)
 * .xlsx: ExcelJS fills <<field>> placeholders cell-by-cell, rendered as HTML table → Puppeteer.
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { createRequire } from "module";
import type { FieldMapping } from "@construction/shared";

// CJS modules loaded via createRequire
const require = createRequire(import.meta.url);

// mammoth: docx → HTML fallback when LibreOffice not installed
const mammoth = require("mammoth") as {
  convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

// libreoffice-convert: docx → PDF directly (preserves Word formatting)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let libreConvert: any = null;
try {
  libreConvert = require("libreoffice-convert");
} catch {
  // Package not installed — will fall back to mammoth
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

/**
 * renderTemplate() returns either:
 *   { type: "pdf"; buffer: Buffer }  — LibreOffice produced a native PDF
 *   { type: "html"; html: string }   — caller must pass html to generatePdfBuffer()
 *
 * Callers should handle both:
 *   const rendered = await renderTemplate(...);
 *   const pdfBuffer = rendered.type === "pdf"
 *     ? rendered.buffer
 *     : await generatePdfBuffer(rendered.html);
 */
export type RenderResult =
  | { type: "pdf"; buffer: Buffer }
  | { type: "html"; html: string };

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
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000;
           padding: 1in; margin: 0; background: #fff; line-height: 1.15; }
    p { margin: 0 0 8pt; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ccc; padding: 4pt 8pt; }
    th { background: #f5f5f5; font-weight: 600; }
    h1 { font-size: 16pt; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  </style>
</head>
<body>
  ${previewBanner}
  ${bodyContent}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// .docx renderer
// ---------------------------------------------------------------------------

async function renderDocx(
  buffer: Buffer,
  values: Record<string, string>,
  isPreview: boolean
): Promise<RenderResult> {
  // Step 1: Fill the template with docxtemplater
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "<<", end: ">>" },
    nullGetter: () => "",
  });
  doc.render(values);
  const filledBuffer: Buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;

  // Step 2a: LibreOffice → PDF (preserves Word formatting faithfully)
  // writer_pdf_Export filter ensures LibreOffice uses the document's own page size
  // and margins rather than system/printer defaults (fixes A4 vs Letter shift).
  if (libreConvert) {
    try {
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        libreConvert.convert(filledBuffer, ".pdf", "writer_pdf_Export", (err: Error | null, result: Buffer) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      return { type: "pdf", buffer: pdfBuffer };
    } catch (err) {
      // LibreOffice found but conversion failed — fall through to mammoth
      console.warn("[render] LibreOffice conversion failed, falling back to mammoth:", err);
    }
  }

  // Step 2b: Mammoth → HTML fallback (LibreOffice not installed or failed)
  const { value: bodyHtml } = await mammoth.convertToHtml({ buffer: filledBuffer });
  return { type: "html", html: wrapHtml(bodyHtml, isPreview) };
}

// ---------------------------------------------------------------------------
// .xlsx renderer
// ---------------------------------------------------------------------------

async function renderXlsx(
  buffer: Buffer,
  values: Record<string, string>,
  isPreview: boolean
): Promise<RenderResult> {
  // Step 1: Fill <<field>> placeholders in all cells using ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const cellVal = cell.value;
        if (typeof cellVal === "string" && cellVal.includes("<<")) {
          cell.value = cellVal.replace(/<<([^<>]+)>>/gi, (_, field: string) => {
            return values[field.toLowerCase()] ?? "";
          });
        }
      });
    });
  });

  // Step 2a: LibreOffice → PDF (preserves Excel formatting faithfully)
  // calc_pdf_Export filter ensures LibreOffice uses the spreadsheet's own page settings.
  if (libreConvert) {
    try {
      const filledBuffer = Buffer.from(
        await workbook.xlsx.writeBuffer() as unknown as Parameters<typeof Buffer.from>[0]
      );
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        libreConvert.convert(filledBuffer, ".pdf", "calc_pdf_Export", (err: Error | null, result: Buffer) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      return { type: "pdf", buffer: pdfBuffer };
    } catch (err) {
      console.warn("[render] LibreOffice xlsx conversion failed, falling back to HTML:", err);
    }
  }

  // Step 2b: HTML table fallback (LibreOffice not installed or failed)
  let tablesHtml = "";

  workbook.eachSheet((worksheet) => {
    let rowsHtml = "";

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      let cellsHtml = "";

      row.eachCell({ includeEmpty: true }, (cell) => {
        const val = typeof cell.value === "string" ? cell.value
          : cell.value !== null && cell.value !== undefined ? String(cell.value)
          : "";

        const esc = escapeHtml(val);
        const style =
          val === "[UNMAPPED]"
            ? "padding:4pt 8pt;border:1px solid #ccc;font-size:11pt;color:#B45309;font-style:italic;"
            : "padding:4pt 8pt;border:1px solid #ccc;font-size:11pt;";
        cellsHtml += `<td style="${style}">${esc}</td>`;
      });

      if (cellsHtml) rowsHtml += `<tr>${cellsHtml}</tr>`;
    });

    if (rowsHtml) {
      const sheetName = escapeHtml(worksheet.name ?? "Sheet");
      tablesHtml += `
        <div style="margin-bottom:24pt;">
          <h3 style="font-size:10pt;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6pt;">${sheetName}</h3>
          <table style="border-collapse:collapse;width:100%;">${rowsHtml}</table>
        </div>`;
    }
  });

  if (!tablesHtml) {
    tablesHtml = `<p style="color:#9CA3AF;">No content found in template.</p>`;
  }

  return { type: "html", html: wrapHtml(tablesHtml, isPreview) };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Render a custom template (.docx or .xlsx) buffer with field mappings applied.
 *
 * Returns a RenderResult — callers must check .type to determine whether to
 * use the PDF buffer directly or pass the HTML to generatePdfBuffer().
 */
export async function renderTemplate(
  buffer: Buffer,
  fileType: "docx" | "xlsx",
  mappings: FieldMapping[],
  data: Record<string, string>,
  isPreview: boolean
): Promise<RenderResult> {
  const values = buildValuesMap(mappings, data, isPreview);
  if (fileType === "xlsx") {
    return renderXlsx(buffer, values, isPreview);
  }
  return renderDocx(buffer, values, isPreview);
}
