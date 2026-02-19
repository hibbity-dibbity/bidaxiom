/**
 * RFQ PDF HTML template.
 *
 * Generates a complete, styled HTML string for a Request for Quotation document.
 * All styles are inline — no external CDN links or stylesheets.
 * Uses BIDAXIOM brand color #3B5BDB (slate-blue) as the header accent.
 *
 * scopeOfWork is rendered with white-space: pre-wrap to preserve line breaks and
 * formatting entered by the user in the text area.
 *
 * TODO: paymentTerms — hardcoded as "Net 30 from receipt of approved invoice" in Phase 38
 * because the rfqs table has no paymentTerms column. Add rfqs.paymentTerms (Phase 39+)
 * and replace the hardcoded string with data.paymentTerms.
 */

export interface RfqPdfData {
  companyName: string;
  projectName: string;
  jobNumber: string | null;
  /** Formatted address: "{street1}, {city}, {state} {zip}" or "Address not provided" */
  projectAddress: string;
  rfqTitle: string;
  /** e.g., "RFQ-001" — composed from schema rfqNumber or sequence */
  rfqNumber: string;
  /** Free-text scope of work from rfqs.scopeOfWork */
  scopeOfWork: string;
  /** rfqs.dueDate formatted as "February 25, 2026" or "Submission deadline: To be confirmed" */
  dueDate: string | null;
  /** rfqs.description if provided */
  description: string | null;
  /** ISO date string formatted as "February 19, 2026" */
  generatedDate: string;
}

/**
 * Build the complete HTML string for an RFQ PDF.
 *
 * @param data - Structured RFQ data with pre-formatted values
 * @returns Complete HTML document string ready for Puppeteer rendering
 */
export function buildRfqHtml(data: RfqPdfData): string {
  const dueDateLine = data.dueDate
    ? `Please submit your quotation by: <strong>${escapeHtml(data.dueDate)}</strong>`
    : "Submission deadline: <strong>To be confirmed</strong>";

  const descriptionSection = data.description
    ? `
  <div style="margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
      Description
    </div>
    <p style="font-size: 10pt; color: #374151; line-height: 1.5;">${escapeHtml(data.description)}</p>
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RFQ — ${escapeHtml(data.rfqNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      line-height: 1.4;
      background: #ffffff;
    }
    @page {
      size: Letter;
      margin: 0.75in;
    }
  </style>
</head>
<body style="padding: 0; margin: 0;">

  <!-- =============================
       HEADER
  ============================= -->
  <div style="background-color: #3B5BDB; color: #ffffff; padding: 24px 28px; margin-bottom: 24px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
          ${escapeHtml(data.companyName)}
        </div>
        <div style="font-size: 11pt; font-weight: 400; margin-top: 6px; opacity: 0.85; letter-spacing: 3px; text-transform: uppercase;">
          Request for Quotation
        </div>
      </div>
      <div style="text-align: right; font-size: 10pt; opacity: 0.9;">
        <div style="font-weight: 700; font-size: 13pt;">${escapeHtml(data.rfqNumber)}</div>
        <div style="font-weight: 600; font-size: 9pt; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Date Issued</div>
        <div style="margin-top: 2px;">${escapeHtml(data.generatedDate)}</div>
      </div>
    </div>
  </div>

  <!-- =============================
       PROJECT INFORMATION
  ============================= -->
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px 20px; margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #3B5BDB; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
      Project Information
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Name</div>
        <div style="font-size: 11pt; font-weight: 600;">${escapeHtml(data.projectName)}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Job Number</div>
        <div style="font-size: 11pt; font-weight: 600;">${escapeHtml(data.jobNumber ?? "—")}</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">Project Address</div>
        <div style="font-size: 10pt;">${escapeHtml(data.projectAddress)}</div>
      </div>
    </div>
  </div>

  <!-- =============================
       RFQ TITLE + DESCRIPTION
  ============================= -->
  <div style="margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
      RFQ Title
    </div>
    <div style="font-size: 14pt; font-weight: 700; color: #1e293b;">${escapeHtml(data.rfqTitle)}</div>
  </div>
  ${descriptionSection}

  <!-- =============================
       SCOPE OF WORK
  ============================= -->
  <div style="margin-bottom: 24px;">
    <div style="font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 2px solid #3B5BDB; padding-bottom: 6px;">
      Scope of Work
    </div>
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3B5BDB; border-radius: 0 4px 4px 0; padding: 16px 18px;">
      <p style="font-size: 10.5pt; color: #374151; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(data.scopeOfWork)}</p>
    </div>
  </div>

  <!-- =============================
       SUBMISSION DEADLINE
  ============================= -->
  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 14px 18px; margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
      Submission Deadline
    </div>
    <p style="font-size: 11pt; color: #1e3a8a;">${dueDateLine}</p>
  </div>

  <!-- =============================
       PAYMENT TERMS
  ============================= -->
  <div style="margin-bottom: 20px;">
    <div style="font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
      Payment Terms
    </div>
    <!-- TODO: Replace with rfqs.paymentTerms field when added in Phase 39+ -->
    <p style="font-size: 10pt; color: #374151;">Net 30 from receipt of approved invoice.</p>
  </div>

  <!-- =============================
       RESPONSE INSTRUCTIONS
  ============================= -->
  <div style="margin-bottom: 24px;">
    <div style="font-size: 9pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
      Response Instructions
    </div>
    <p style="font-size: 10pt; color: #374151; line-height: 1.6;">
      Please submit your complete bid in response to this Request for Quotation. Your submission must include your company name, contractor license number, and total bid amount. Itemized breakdowns and clarifications are welcome and encouraged. Incomplete submissions may be disqualified.
    </p>
    <p style="font-size: 10pt; color: #374151; line-height: 1.6; margin-top: 8px;">
      Submittals received after the stated deadline will not be considered unless prior written authorization has been granted by ${escapeHtml(data.companyName)}.
    </p>
  </div>

  <!-- =============================
       SUBCONTRACTOR RESPONSE BLOCK
  ============================= -->
  <div style="border: 2px solid #3B5BDB; border-radius: 4px; padding: 16px 20px; page-break-inside: avoid;">
    <div style="font-size: 9pt; font-weight: 700; color: #3B5BDB; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px;">
      Subcontractor Response (Detach and Return)
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">Company Name</div>
        <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 24px;">&nbsp;</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">License #</div>
        <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 24px;">&nbsp;</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">Total Bid Amount</div>
        <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 24px;">&nbsp;</div>
      </div>
      <div>
        <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">Date</div>
        <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 24px;">&nbsp;</div>
      </div>
    </div>
    <div style="margin-top: 16px;">
      <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">Authorized Signature</div>
      <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 32px;">&nbsp;</div>
    </div>
    <div style="margin-top: 12px;">
      <div style="font-size: 9pt; color: #64748b; margin-bottom: 6px;">Printed Name &amp; Title</div>
      <div style="border-bottom: 1px solid #94a3b8; padding-bottom: 4px; min-height: 24px;">&nbsp;</div>
    </div>
  </div>

  <!-- =============================
       FOOTER
  ============================= -->
  <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; text-align: center; color: #94a3b8; font-size: 8.5pt;">
    Issued by ${escapeHtml(data.companyName)} &mdash; Generated by BIDAXIOM
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
