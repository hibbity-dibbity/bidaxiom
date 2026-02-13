import puppeteer from 'puppeteer';
import type { ReportDefinition, ReportData } from '@construction/shared';
import type { ReportExportOptions } from './report-exporter.js';

/**
 * Generate PDF from report data using Puppeteer
 */
export async function generateReportPDF(
  reportData: ReportData,
  reportDefinition: ReportDefinition,
  options: ReportExportOptions = {}
): Promise<Buffer> {
  const {
    pageOrientation = 'portrait',
    paperSize = 'letter',
    includeCharts = false,
  } = options;

  // Build HTML template
  const html = buildHTMLTemplate(reportData, reportDefinition, includeCharts);

  // Launch headless browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdf = await page.pdf({
      format: paperSize,
      landscape: pageOrientation === 'landscape',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Build HTML template for PDF rendering
 */
function buildHTMLTemplate(
  reportData: ReportData,
  reportDefinition: ReportDefinition,
  includeCharts: boolean
): string {
  const { name, description, columns } = reportDefinition;
  const { rows, metadata } = reportData;

  // Build filter summary if filters applied
  let filterSummary = '';
  if (metadata?.filtersApplied && Object.keys(metadata.filtersApplied).length > 0) {
    const filters = Object.entries(metadata.filtersApplied)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    filterSummary = `<div class="filters">Filters: ${filters}</div>`;
  }

  // Build table headers
  const tableHeaders = columns
    .map(col => `<th>${escapeHtml(col.label)}</th>`)
    .join('');

  // Build table rows
  const tableRows = rows
    .map(row => {
      const cells = columns
        .map(col => {
          const value = row[col.field];
          const formatted = formatCellValue(value, col.format);
          return `<td>${escapeHtml(formatted)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  // Chart placeholder (if enabled and chart config exists)
  let chartSection = '';
  if (includeCharts && reportDefinition.chartConfig) {
    chartSection = `
      <div class="chart-section">
        <h3>Chart Visualization</h3>
        <p class="note">Chart rendering requires additional implementation with chart.js-node-canvas</p>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(name)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 5px 0;
      font-size: 24px;
    }
    .description {
      color: #666;
      font-size: 14px;
      margin: 5px 0;
    }
    .metadata {
      font-size: 12px;
      color: #999;
      margin: 10px 0;
    }
    .filters {
      background: #f5f5f5;
      padding: 8px;
      margin: 10px 0;
      border-left: 3px solid #007bff;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 12px;
    }
    th {
      background: #333;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #ddd;
    }
    td {
      padding: 8px;
      border: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .chart-section {
      margin-top: 30px;
      padding: 20px;
      border: 1px dashed #ccc;
      text-align: center;
    }
    .chart-section h3 {
      margin-top: 0;
    }
    .note {
      color: #999;
      font-style: italic;
      font-size: 12px;
    }
    .summary {
      margin-top: 20px;
      padding: 10px;
      background: #f9f9f9;
      border-top: 2px solid #ddd;
    }
    .summary strong {
      display: inline-block;
      min-width: 100px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
    <div class="metadata">Generated: ${new Date().toLocaleString()}</div>
    ${filterSummary}
  </div>

  ${chartSection}

  <table>
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="summary">
    <strong>Total Rows:</strong> ${rows.length}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format cell value based on column format
 */
function formatCellValue(value: any, format?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (format === 'currency') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? String(value) : `$${num.toFixed(2)}`;
  }

  if (format === 'date') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }

  if (format === 'datetime') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  if (format === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? String(value) : num.toLocaleString();
  }

  if (format === 'percentage') {
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? String(value) : `${(num * 100).toFixed(1)}%`;
  }

  return String(value);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, m => map[m] || m);
}

/**
 * Render chart as image (placeholder for future implementation)
 *
 * This function would require chart.js-node-canvas for server-side chart rendering.
 * Implementation would:
 * 1. Create ChartJSNodeCanvas instance
 * 2. Build chart configuration from chartConfig and data
 * 3. Render chart to buffer
 * 4. Convert to base64 data URL
 * 5. Return for embedding in HTML
 */
export async function renderChartAsImage(
  chartConfig: any,
  data: any
): Promise<string> {
  // Placeholder - requires chart.js-node-canvas dependency
  throw new Error('Chart rendering not yet implemented. Install chart.js-node-canvas to enable.');
}
