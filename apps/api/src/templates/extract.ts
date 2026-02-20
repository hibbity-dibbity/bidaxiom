/**
 * Template field extraction utilities.
 *
 * Parses .docx and .xlsx template files to detect <<field_name>> merge field
 * placeholders. Field names are stored as lowercased keys (detectedField) plus
 * the original display form as typed by the user (displayField).
 *
 * Used by the templateRouter after a user uploads a template file.
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { createRequire } from "module";

// InspectModule ships inside docxtemplater — no separate package needed.
// Must be loaded via CJS require because it has no ESM named export.
const require = createRequire(import.meta.url);
const InspectModule = require("docxtemplater/js/inspect-module.js");

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * A single detected merge field from a template document.
 * Matches the DetectedField interface from @construction/shared.
 */
export interface ExtractedField {
  /** Lowercased key used as the canonical map key, e.g. "project_name" */
  detectedField: string;
  /** As typed in the document including delimiters, e.g. "<<Project_Name>>" */
  displayField: string;
}

// ---------------------------------------------------------------------------
// parseDocxFields
// ---------------------------------------------------------------------------

/**
 * Parse a .docx Buffer and extract all <<field_name>> merge field tags.
 *
 * Strategy:
 *  1. Extract word/document.xml text via PizZip and regex-scan for <<field>>
 *     patterns to build an original-case display map (InspectModule lowercases
 *     keys, so we capture case before that step).
 *  2. Use InspectModule + Docxtemplater to get the authoritative tag list,
 *     which handles split XML runs that direct regex would miss.
 *  3. Merge: use InspectModule keys (lowercase) as canonical keys; look up the
 *     original-case display form from the XML regex map.
 *
 * @param buffer - Raw Buffer of the uploaded .docx file
 * @returns Array of unique fields found in the document
 */
export function parseDocxFields(buffer: Buffer): ExtractedField[] {
  // Step 1: Unzip the .docx (it is a ZIP archive)
  const zip = new PizZip(buffer);

  // Step 2: Extract original-case display forms from raw XML text.
  // InspectModule normalizes tag names to lowercase internally, so we need to
  // capture the user's original capitalisation before docxtemplater processes it.
  const xmlContent = (() => {
    try {
      return zip.files["word/document.xml"]?.asText() ?? "";
    } catch {
      return "";
    }
  })();

  const displayRegex = /<<([^<>]+)>>/gi;
  // Map from lowercase key -> first-seen original "<<DisplayCase>>"
  const originalCaseMap = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = displayRegex.exec(xmlContent)) !== null) {
    const lower = m[1].toLowerCase();
    if (!originalCaseMap.has(lower)) {
      originalCaseMap.set(lower, `<<${m[1]}>>`);
    }
  }

  // Step 3: Use InspectModule for authoritative tag detection (handles split XML runs)
  const iModule = InspectModule();

  const doc = new Docxtemplater(zip, {
    modules: [iModule],
    delimiters: { start: "<<", end: ">>" },
    paragraphLoop: true,
    linebreaks: true,
    // CRITICAL: suppress errors for undefined tags during extraction-only render.
    // Without this, doc.render({}) throws TemplateError for every <<field>>.
    nullGetter() {
      return "";
    },
  });

  try {
    doc.render({});
  } catch {
    // Template errors are expected — unknown tags produce errors when data is {}.
    // InspectModule still captures all tags even when render() throws.
  }

  // getAllTags() returns Record<string, unknown> keyed by lowercased field names
  const allTags: Record<string, unknown> = iModule.getAllTags();
  const fields: ExtractedField[] = [];

  for (const key of Object.keys(allTags)) {
    fields.push({
      detectedField: key,
      // Prefer the original-case form captured from raw XML; fall back to
      // reconstructed "<<key>>" if the XML regex didn't capture it (e.g. a
      // field that was fully split across runs and merged by docxtemplater).
      displayField: originalCaseMap.get(key) ?? `<<${key}>>`,
    });
  }

  return fields;
}

// ---------------------------------------------------------------------------
// parseXlsxFields
// ---------------------------------------------------------------------------

/**
 * Parse an .xlsx Buffer and extract all <<field_name>> merge field tags.
 *
 * Iterates all worksheets and cells, handling both plain string cells and
 * RichText cells (which exceljs returns as `{ richText: [{text: "..."}] }`).
 * The first occurrence of each field name (case-insensitive) wins for display.
 *
 * @param buffer - Raw Buffer of the uploaded .xlsx file
 * @returns Array of unique fields found across all worksheets
 */
export async function parseXlsxFields(buffer: Buffer): Promise<ExtractedField[]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS declares its own Buffer interface (extends ArrayBuffer), which
  // conflicts with Node.js Buffer<ArrayBufferLike>. Cast to avoid TS2345.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  // Map from lowercase key -> first-seen original "<<DisplayCase>>"
  const found = new Map<string, string>();

  // Stateful regex — must reset lastIndex before each new string
  const FIELD_REGEX = /<<([^<>]+)>>/gi;

  const processText = (text: string) => {
    FIELD_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FIELD_REGEX.exec(text)) !== null) {
      const lower = match[1].toLowerCase();
      if (!found.has(lower)) {
        found.set(lower, `<<${match[1]}>>`);
      }
    }
  };

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const val = cell.value;

        // Plain string cells
        if (typeof val === "string") {
          processText(val);
          return;
        }

        // RichText cells: { richText: Array<{ text: string; font?: ... }> }
        if (val && typeof val === "object" && "richText" in val) {
          const richText = (val as { richText: Array<{ text: string }> }).richText;
          for (const rt of richText) {
            if (typeof rt.text === "string") {
              processText(rt.text);
            }
          }
        }
      });
    });
  });

  return Array.from(found.entries()).map(([key, display]) => ({
    detectedField: key,
    displayField: display,
  }));
}
