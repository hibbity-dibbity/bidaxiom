import ExcelJS from 'exceljs';
import type { ReportDefinition, ReportData } from '@construction/shared';
import type { ReportExportOptions } from './report-exporter.js';

/**
 * Generate Excel workbook from report data using ExcelJS
 */
export async function generateReportExcel(
  reportData: ReportData,
  reportDefinition: ReportDefinition,
  options: ReportExportOptions = {}
): Promise<Buffer> {
  const { includeCharts = false } = options;

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Set metadata
  workbook.creator = 'Construction Management System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add main data worksheet
  const dataSheet = workbook.addWorksheet('Report Data', {
    properties: { tabColor: { argb: 'FF0070C0' } },
  });

  // Build header row
  const headerRow = dataSheet.addRow(reportDefinition.columns.map(col => col.label));

  // Style header row
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0070C0' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 20;

  // Add border to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Add data rows
  for (const row of reportData.rows) {
    const values = reportDefinition.columns.map(col => {
      const value = row[col.field];
      return formatCellValue(value, col.format);
    });

    const excelRow = dataSheet.addRow(values);

    // Apply formatting to cells based on column format
    reportDefinition.columns.forEach((col, idx) => {
      const cell = excelRow.getCell(idx + 1);

      // Apply number formats
      if (col.format === 'currency') {
        cell.numFmt = '$#,##0.00';
      } else if (col.format === 'number') {
        cell.numFmt = '#,##0.00';
      } else if (col.format === 'date') {
        cell.numFmt = 'mm/dd/yyyy';
      } else if (col.format === 'datetime') {
        cell.numFmt = 'mm/dd/yyyy hh:mm AM/PM';
      } else if (col.format === 'percentage') {
        cell.numFmt = '0.0%';
      }

      // Add borders
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Alternate row background
    if (excelRow.number % 2 === 0) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };
    }
  }

  // Auto-fit columns
  dataSheet.columns.forEach((column, idx) => {
    const col = reportDefinition.columns[idx];
    if (!col) return;

    // Calculate max length for column
    let maxLength = col.label.length;

    reportData.rows.forEach(row => {
      const value = String(row[col.field] || '');
      maxLength = Math.max(maxLength, value.length);
    });

    // Set column width (with limits)
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  // Add summary worksheet if charts are included
  if (includeCharts && reportDefinition.chartConfig) {
    addSummaryWorksheet(workbook, reportData, reportDefinition);
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Add summary worksheet with statistics
 */
function addSummaryWorksheet(
  workbook: ExcelJS.Workbook,
  reportData: ReportData,
  reportDefinition: ReportDefinition
): void {
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF00B050' } },
  });

  // Add title
  const titleRow = summarySheet.addRow(['Report Summary']);
  titleRow.font = { bold: true, size: 16 };
  titleRow.height = 25;

  summarySheet.addRow([]); // Empty row

  // Add metadata
  summarySheet.addRow(['Report Name:', reportDefinition.name]);
  if (reportDefinition.description) {
    summarySheet.addRow(['Description:', reportDefinition.description]);
  }
  summarySheet.addRow(['Generated:', new Date().toLocaleString()]);
  summarySheet.addRow(['Total Rows:', reportData.rows.length]);

  summarySheet.addRow([]); // Empty row

  // Calculate summary statistics for numeric columns
  const numericColumns = reportDefinition.columns.filter(
    col => col.format === 'currency' || col.format === 'number'
  );

  if (numericColumns.length > 0) {
    const statsHeaderRow = summarySheet.addRow(['Column Statistics']);
    statsHeaderRow.font = { bold: true, size: 14 };

    summarySheet.addRow([]); // Empty row

    // Add statistics header
    const statsHeader = summarySheet.addRow(['Column', 'Count', 'Sum', 'Average', 'Min', 'Max']);
    statsHeader.font = { bold: true };
    statsHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9EAD3' },
    };

    // Calculate stats for each numeric column
    numericColumns.forEach(col => {
      const values = reportData.rows
        .map(row => row[col.field])
        .filter(val => typeof val === 'number' && !isNaN(val)) as number[];

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        const statsRow = summarySheet.addRow([
          col.label,
          values.length,
          sum,
          avg,
          min,
          max,
        ]);

        // Apply currency format if applicable
        if (col.format === 'currency') {
          [3, 4, 5, 6].forEach(cellIdx => {
            statsRow.getCell(cellIdx).numFmt = '$#,##0.00';
          });
        } else {
          [3, 4, 5, 6].forEach(cellIdx => {
            statsRow.getCell(cellIdx).numFmt = '#,##0.00';
          });
        }
      }
    });

    // Auto-fit summary columns
    summarySheet.columns = [
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];
  }

  // Add note about charts
  summarySheet.addRow([]);
  summarySheet.addRow([]);
  const chartNote = summarySheet.addRow([
    'Note: Excel chart generation requires additional implementation.',
  ]);
  chartNote.font = { italic: true, color: { argb: 'FF999999' } };
}

/**
 * Format cell value for Excel
 */
function formatCellValue(value: any, format?: string): any {
  if (value === null || value === undefined) {
    return '';
  }

  // For dates, return as Date object for Excel to handle
  if (format === 'date' || format === 'datetime') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date;
  }

  // For numbers and currency, return as number
  if (format === 'currency' || format === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? String(value) : num;
  }

  // For percentage, return as decimal (Excel will format)
  if (format === 'percentage') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? String(value) : num;
  }

  return value;
}
