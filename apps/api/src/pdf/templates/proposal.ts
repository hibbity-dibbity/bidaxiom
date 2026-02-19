/**
 * Proposal PDF HTML template.
 *
 * Generates a complete, styled HTML string for a project cost proposal.
 * All styles are inline — no external CDN links or stylesheets.
 * Uses BIDAXIOM brand color #3B5BDB (slate-blue) as the header accent.
 */

export interface ProposalPdfData {
  companyName: string;
  projectName: string;
  /** Formatted address: "{street1}, {city}, {state} {zip}" or "Address not provided" */
  projectAddress: string;
  estimateName: string;
  /** ISO date string formatted as "February 19, 2026" */
  generatedDate: string;
  lineItems: Array<{
    description: string;
    quantity: string;
    unit: string;
    /** Formatted as "$X,XXX.XX" */
    unitCost: string;
    /** Formatted as "$X,XXX.XX" */
    total: string;
    /** "Labor" | "Materials" | "Equipment" | "Subcontractor" */
    costType: string;
  }>;
  subtotalLabor: string;
  subtotalMaterials: string;
  subtotalEquipment: string;
  subtotalSubcontractor: string;
  overheadAmount: string;
  markupAmount: string;
  totalCost: string;
}

/**
 * Build the complete HTML string for a Proposal PDF.
 *
 * @param data - Structured proposal data with pre-formatted currency values
 * @returns Complete HTML document string ready for Puppeteer rendering
 */
export function buildProposalHtml(data: ProposalPdfData): string {
  const lineItemRows = data.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">${escapeHtml(item.description)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; white-space: nowrap;">${escapeHtml(item.costType)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${escapeHtml(item.quantity)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${escapeHtml(item.unit)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${escapeHtml(item.unitCost)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${escapeHtml(item.total)}</td>
      </tr>`
    )
    .join("");

  const emptyRowMsg =
    data.lineItems.length === 0
      ? `<tr><td colspan="6" style="padding: 16px 10px; text-align: center; color: #94a3b8; font-style: italic;">No line items</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposal — ${escapeHtml(data.projectName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      background: #ffffff;
    }
    @page {
      size: letter;
      margin: 0.75in;
    }
    .page-break-avoid { page-break-inside: avoid; }
    table { border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>

  <!-- ============================
       HEADER
  ============================= -->
  <div style="background-color: #3B5BDB; color: #ffffff; padding: 28px 32px; margin-bottom: 28px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
          ${escapeHtml(data.companyName)}
        </div>
        <div style="font-size: 13pt; font-weight: 400; margin-top: 6px; opacity: 0.85; letter-spacing: 3px; text-transform: uppercase;">
          Proposal
        </div>
      </div>
      <div style="text-align: right; font-size: 10pt; opacity: 0.9;">
        <div style="font-weight: 600; font-size: 11pt;">Date</div>
        <div style="margin-top: 4px;">${escapeHtml(data.generatedDate)}</div>
      </div>
    </div>
  </div>

  <!-- ============================
       PROJECT INFORMATION
  ============================= -->
  <div style="margin-bottom: 28px; padding: 20px 24px; background: #f8fafc; border-left: 4px solid #3B5BDB; page-break-inside: avoid;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">
      Project Details
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Name</div>
        <div style="font-size: 13pt; font-weight: 600;">${escapeHtml(data.projectName)}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Address</div>
        <div style="font-size: 11pt;">${escapeHtml(data.projectAddress)}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Estimate</div>
        <div style="font-size: 11pt;">${escapeHtml(data.estimateName)}</div>
      </div>
    </div>
  </div>

  <!-- ============================
       LINE ITEMS TABLE
  ============================= -->
  <div style="margin-bottom: 28px;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">
      Scope of Work &amp; Cost Breakdown
    </div>
    <table>
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="padding: 10px 10px; text-align: left; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px;">Description</th>
          <th style="padding: 10px 10px; text-align: center; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px; white-space: nowrap;">Cost Type</th>
          <th style="padding: 10px 10px; text-align: right; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px;">Qty</th>
          <th style="padding: 10px 10px; text-align: center; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px;">Unit</th>
          <th style="padding: 10px 10px; text-align: right; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px; white-space: nowrap;">Unit Cost</th>
          <th style="padding: 10px 10px; text-align: right; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
        ${emptyRowMsg}
      </tbody>
    </table>
  </div>

  <!-- ============================
       SUBTOTALS + GRAND TOTAL
  ============================= -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 36px; page-break-inside: avoid;">
    <div style="width: 340px;">
      <table>
        <tbody>
          <!-- Cost type subtotals -->
          <tr>
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Labor</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.subtotalLabor)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Materials</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.subtotalMaterials)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Equipment</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.subtotalEquipment)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Subcontractor</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.subtotalSubcontractor)}</td>
          </tr>
          <!-- Overhead + Markup -->
          <tr>
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Overhead</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.overheadAmount)}</td>
          </tr>
          <tr style="border-bottom: 2px solid #3B5BDB;">
            <td style="padding: 6px 10px; color: #475569; font-size: 10pt;">Markup</td>
            <td style="padding: 6px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.markupAmount)}</td>
          </tr>
          <!-- Grand Total -->
          <tr style="background-color: #3B5BDB; color: #ffffff;">
            <td style="padding: 10px 10px; font-size: 13pt; font-weight: 700;">TOTAL</td>
            <td style="padding: 10px 10px; text-align: right; font-size: 13pt; font-weight: 700;">${escapeHtml(data.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ============================
       SIGNATURE BLOCK
  ============================= -->
  <div style="page-break-inside: avoid; margin-bottom: 36px;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 16px;">
      Authorization &amp; Signatures
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">

      <!-- Contractor Signature -->
      <div>
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 24px; color: #1e293b;">Contractor Signature</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 8px; height: 40px;"></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
          <div>
            <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Name:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
          </div>
          <div>
            <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Date:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Title:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
        </div>
      </div>

      <!-- Owner/Client Signature -->
      <div>
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 24px; color: #1e293b;">Owner / Client Signature</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 8px; height: 40px;"></div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
          <div>
            <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Name:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
          </div>
          <div>
            <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Date:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <div style="font-size: 9pt; color: #64748b; margin-bottom: 4px;">Title:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 22px;"></div>
        </div>
      </div>

    </div>
  </div>

  <!-- ============================
       FOOTER
  ============================= -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 8.5pt;">
    Generated by BIDAXIOM &mdash; ${escapeHtml(data.generatedDate)}
  </div>

</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS in the PDF template.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
