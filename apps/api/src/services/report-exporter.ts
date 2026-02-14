import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import Papa from 'papaparse';
import { generateReportPDF } from './pdf-generator.js';
import { generateReportExcel } from './excel-generator.js';
import type { ReportDefinition, ReportData } from '@construction/shared';

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ReportExportOptions {
  pageOrientation?: 'portrait' | 'landscape';
  paperSize?: 'letter' | 'legal' | 'a4';
  includeCharts?: boolean;
}

export interface ExportResult {
  filePath: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Get temp directory from env or use system default
const REPORTS_TEMP_DIR = process.env.REPORTS_TEMP_DIR || path.join(os.tmpdir(), 'construction-reports');

/**
 * Ensure temp directory exists
 */
async function ensureTempDirectory(): Promise<void> {
  try {
    await fs.access(REPORTS_TEMP_DIR);
  } catch {
    await fs.mkdir(REPORTS_TEMP_DIR, { recursive: true });
  }
}

/**
 * Export report in specified format
 */
export async function exportReport(
  reportData: ReportData,
  reportDefinition: ReportDefinition,
  format: ExportFormat,
  options: ReportExportOptions = {}
): Promise<ExportResult> {
  await ensureTempDirectory();

  let buffer: Buffer;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'pdf':
      buffer = await generateReportPDF(reportData, reportDefinition, options);
      mimeType = 'application/pdf';
      extension = 'pdf';
      break;

    case 'excel':
      buffer = await generateReportExcel(reportData, reportDefinition, options);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
      break;

    case 'csv':
      const csvString = await generateReportCSV(reportData, reportDefinition.columns);
      buffer = Buffer.from(csvString, 'utf-8');
      mimeType = 'text/csv';
      extension = 'csv';
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Generate unique filename
  const sanitizedName = reportDefinition.name.replace(/[^a-z0-9-_]/gi, '-');
  const filename = `${sanitizedName}-${Date.now()}.${extension}`;
  const filePath = path.join(REPORTS_TEMP_DIR, filename);

  // Save file
  await fs.writeFile(filePath, buffer);

  // Get file size
  const stats = await fs.stat(filePath);

  return {
    filePath,
    filename,
    mimeType,
    size: stats.size,
  };
}

/**
 * Generate CSV from report data
 */
async function generateReportCSV(
  reportData: ReportData,
  columns: ReportDefinition['columns']
): Promise<string> {
  // Extract column headers and field mappings
  const fields = columns.map(col => ({
    label: col.label,
    value: col.field,
  }));

  // Convert to CSV using papaparse
  const csv = Papa.unparse({
    fields: fields.map(f => f.label),
    data: reportData.rows.map(row =>
      fields.map(f => row[f.value] ?? '')
    ),
  });

  return csv;
}

/**
 * Clean up expired export files (older than 24 hours)
 */
export async function cleanupExpiredExports(): Promise<number> {
  try {
    await ensureTempDirectory();

    const files = await fs.readdir(REPORTS_TEMP_DIR);
    const now = Date.now();
    const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(REPORTS_TEMP_DIR, file);

      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > EXPIRY_MS) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch (error) {
        // File may have been deleted by another process, skip
        console.warn(`Could not clean up file ${file}:`, error);
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error during export cleanup:', error);
    return 0;
  }
}
