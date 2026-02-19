/**
 * Change Order PDF HTML template.
 *
 * Generates a complete, styled HTML string for a Change Order document.
 * All styles are inline — no external CDN links or stylesheets.
 * Uses BIDAXIOM brand color #3B5BDB (slate-blue) as the header accent.
 *
 * Note: The CO line items schema stores amountChange per line item (not
 * qty/unit/unitCost). The template reflects the actual DB structure.
 */

export interface ChangeOrderPdfData {
  companyName: string;
  projectName: string;
  jobNumber: string | null;
  /** Formatted address: "{street1}, {city}, {state} {zip}" or "Address not provided" */
  projectAddress: string;
  /** e.g., "CO-003" or "PCO-001" */
  coNumber: string;
  coTitle: string;
  coDescription: string;
  /** "Draft" | "Pending Approval" | "Approved" | "Rejected" */
  status: string;
  /** ISO date string formatted as "February 19, 2026" */
  generatedDate: string;
  /** Formatted total CO amount (all line items summed) */
  totalCost: string;
  /** Formatted contract sum before this CO */
  contractSumBefore: string;
  /** Formatted contract sum after this CO */
  contractSumAfter: string;
  /** null = no schedule impact; number = days impact */
  scheduleImpactDays: number | null;
  lineItems: Array<{
    description: string;
    /** Formatted as "$X,XXX.XX" (positive = increase, negative = decrease) */
    amountChange: string;
  }>;
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

/** Map a status string to a badge background color. */
function statusBadgeColor(status: string): string {
  const map: Record<string, string> = {
    Approved: "#16a34a",
    "Pending Approval": "#d97706",
    Draft: "#64748b",
    Rejected: "#dc2626",
  };
  return map[status] ?? "#64748b";
}

/**
 * Build the complete HTML string for a Change Order PDF.
 *
 * @param data - Structured CO data with pre-formatted currency values
 * @returns Complete HTML document string ready for Puppeteer rendering
 */
export function buildChangeOrderHtml(data: ChangeOrderPdfData): string {
  const badgeColor = statusBadgeColor(data.status);

  const lineItemRows = data.lineItems
    .map(
      (item) => `
      <tr style="page-break-inside: avoid;">
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(item.description)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${escapeHtml(item.amountChange)}</td>
      </tr>`
    )
    .join("");

  const emptyRowMsg =
    data.lineItems.length === 0
      ? `<tr><td colspan="2" style="padding: 16px 10px; text-align: center; color: #94a3b8; font-style: italic;">No line items</td></tr>`
      : "";

  const scheduleImpactText =
    data.scheduleImpactDays === null
      ? "No schedule impact"
      : `${data.scheduleImpactDays} day${data.scheduleImpactDays === 1 ? "" : "s"}`;

  const jobNumberDisplay = data.jobNumber
    ? escapeHtml(data.jobNumber)
    : "N/A";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Change Order — ${escapeHtml(data.coNumber)}</title>
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
          Change Order
        </div>
      </div>
      <div style="text-align: right; font-size: 10pt; opacity: 0.9;">
        <div style="font-weight: 700; font-size: 16pt; letter-spacing: 1px;">${escapeHtml(data.coNumber)}</div>
        <div style="margin-top: 6px;">
          <span style="background-color: ${badgeColor}; color: #ffffff; padding: 3px 10px; border-radius: 4px; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
            ${escapeHtml(data.status)}
          </span>
        </div>
        <div style="margin-top: 8px; font-size: 9pt; opacity: 0.85;">${escapeHtml(data.generatedDate)}</div>
      </div>
    </div>
  </div>

  <!-- ============================
       PROJECT INFORMATION
  ============================= -->
  <div style="margin-bottom: 24px; padding: 20px 24px; background: #f8fafc; border-left: 4px solid #3B5BDB; page-break-inside: avoid;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">
      Project Details
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Name</div>
        <div style="font-size: 11pt; font-weight: 600;">${escapeHtml(data.projectName)}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Job Number</div>
        <div style="font-size: 11pt;">${jobNumberDisplay}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Address</div>
        <div style="font-size: 10pt;">${escapeHtml(data.projectAddress)}</div>
      </div>
    </div>
  </div>

  <!-- ============================
       CO DESCRIPTION
  ============================= -->
  <div style="margin-bottom: 24px; padding: 20px 24px; border: 1px solid #e2e8f0; border-radius: 4px; page-break-inside: avoid;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">
      Change Order Description
    </div>
    <div style="font-size: 12pt; font-weight: 600; margin-bottom: 8px;">${escapeHtml(data.coTitle)}</div>
    <div style="font-size: 10.5pt; color: #334155; line-height: 1.6;">${escapeHtml(data.coDescription)}</div>
  </div>

  <!-- ============================
       LINE ITEMS TABLE
  ============================= -->
  <div style="margin-bottom: 24px;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">
      Cost Breakdown
    </div>
    <table>
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="padding: 10px 10px; text-align: left; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px;">Description</th>
          <th style="padding: 10px 10px; text-align: right; font-size: 9pt; font-weight: 600; letter-spacing: 0.5px; white-space: nowrap;">Amount Change</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
        ${emptyRowMsg}
      </tbody>
    </table>
  </div>

  <!-- ============================
       COST SUMMARY + CONTRACT IMPACT
  ============================= -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 28px; page-break-inside: avoid;">
    <div style="width: 380px;">
      <table>
        <tbody>
          <!-- Total CO Amount -->
          <tr style="border-bottom: 2px solid #3B5BDB;">
            <td style="padding: 8px 10px; font-size: 10pt; color: #475569; font-weight: 600;">Total Change Order Amount</td>
            <td style="padding: 8px 10px; text-align: right; font-size: 10pt; font-weight: 700;">${escapeHtml(data.totalCost)}</td>
          </tr>
          <!-- Contract Impact -->
          <tr>
            <td colspan="2" style="padding: 10px 10px 6px; font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
              Contract Sum Impact
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 10px; color: #475569; font-size: 10pt;">Original Contract Sum</td>
            <td style="padding: 4px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.contractSumBefore)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 10px; color: #475569; font-size: 10pt;">This Change Order</td>
            <td style="padding: 4px 10px; text-align: right; font-size: 10pt;">${escapeHtml(data.totalCost)}</td>
          </tr>
          <tr style="background-color: #3B5BDB; color: #ffffff;">
            <td style="padding: 10px 10px; font-size: 13pt; font-weight: 700;">Revised Contract Sum</td>
            <td style="padding: 10px 10px; text-align: right; font-size: 13pt; font-weight: 700;">${escapeHtml(data.contractSumAfter)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ============================
       SCHEDULE IMPACT
  ============================= -->
  <div style="margin-bottom: 28px; padding: 16px 24px; background: #f8fafc; border-left: 4px solid #cbd5e1; page-break-inside: avoid;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">
      Schedule Impact
    </div>
    <div style="font-size: 11pt; color: #334155;">
      ${scheduleImpactText}
    </div>
  </div>

  <!-- ============================
       AIA-FORMAT SIGNATURE BLOCKS
  ============================= -->
  <div style="page-break-inside: avoid; margin-bottom: 36px;">
    <div style="font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 16px;">
      Authorization &amp; Signatures
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px;">

      <!-- Owner Signature -->
      <div>
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 20px; color: #1e293b;">Owner Signature</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 8px; height: 36px;"></div>
        <div style="margin-top: 10px;">
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Name:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Title:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Date:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px;"></div>
        </div>
      </div>

      <!-- Contractor Signature -->
      <div>
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 20px; color: #1e293b;">Contractor Signature</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 8px; height: 36px;"></div>
        <div style="margin-top: 10px;">
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Name:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Title:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Date:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px;"></div>
        </div>
      </div>

      <!-- Architect/Engineer Signature -->
      <div>
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 20px; color: #1e293b;">Architect / Engineer Signature</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 8px; height: 36px;"></div>
        <div style="margin-top: 10px;">
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Name:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Title:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px; margin-bottom: 8px;"></div>
          <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 2px;">Date:</div>
          <div style="border-bottom: 1px solid #94a3b8; height: 20px;"></div>
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
