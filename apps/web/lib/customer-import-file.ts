import Papa from "papaparse";

export interface ParsedSheet {
  name: string;
  rows: string[][];
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; richText?: { text: string }[]; result?: unknown; hyperlink?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text != null) return cellText(o.text);
    if (o.result != null) return cellText(o.result);
    if (o.hyperlink) return o.hyperlink.replace(/^mailto:/i, "");
    return "";
  }
  return String(v);
}

/** Read a .csv or .xlsx file in the browser. Every sheet of a workbook is returned; empty rows are dropped. */
export async function readSpreadsheet(file: File): Promise<ParsedSheet[]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is larger than 8 MB. Split it into smaller files.");
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".csv") || lower.endsWith(".txt") || file.type === "text/csv") {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return [{ name: "File", rows: parsed.data.map((r) => r.map(cellText)) }];
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheets: ParsedSheet[] = [];
    wb.eachSheet((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        const count = Math.max(row.cellCount, ws.columnCount);
        for (let c = 1; c <= count; c++) cells.push(cellText(row.getCell(c).value));
        if (cells.some((c) => c.trim() !== "")) rows.push(cells);
      });
      if (rows.length) sheets.push({ name: ws.name, rows });
    });
    if (sheets.length === 0) throw new Error("No data was found in that workbook.");
    return sheets;
  }

  if (lower.endsWith(".xls")) throw new Error("Old .xls files aren't supported. Open it in Excel and save as .xlsx or .csv.");
  throw new Error("Choose a .csv or .xlsx file. (A SharePoint list can be exported to Excel or CSV from its toolbar.)");
}
