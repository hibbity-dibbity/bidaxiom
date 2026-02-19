/**
 * AIA G702/G703 Payment Application PDF HTML template.
 *
 * Generates a 2-page HTML document:
 *   Page 1: AIA G702 - Application and Certificate for Payment
 *   Page 2: AIA G703 - Continuation Sheet
 *
 * All styles are inline — no external CDN links or stylesheets.
 * Uses BIDAXIOM brand color #3B5BDB (slate-blue) as the header accent.
 * Compact 11px font on G703 table to fit more SOV rows per page.
 */

export interface PaymentAppPdfData {
  // Project + party info (G702 header)
  companyName: string;        // Contractor name (from tenants.name)
  ownerName: string;          // Customer contactName or companyName
  ownerAddress: string;
  projectName: string;
  projectAddress: string;
  architectName: string;      // "Not specified" if no architect on record
  applicationNumber: number | string;
  periodFrom: string;         // Formatted date
  periodTo: string;           // Formatted date
  contractDate: string;       // project.startDate formatted, or "Not specified"

  // G702 payment lines (all pre-formatted currency strings)
  originalContractSum: string;
  netChangeByChangeOrders: string;
  contractSumToDate: string;
  totalCompletedAndStored: string;
  retainagePercent: string;   // e.g., "10.00%"
  retainageAmount: string;
  totalEarnedLessRetainage: string;
  previousPayments: string;
  currentPaymentDue: string;
  balanceToFinish: string;

  // G703 line items
  lineItems: Array<{
    itemNumber: string;
    description: string;
    scheduledValue: string;
    previousWorkCompleted: string;  // previousPercentComplete * scheduledValue
    thisperiodWork: string;         // workCompletedThisPeriod
    materialsStored: string;        // materialsStoredThisPeriod
    totalCompletedAndStored: string;
    balanceToFinish: string;
    retainagePercent: string | null; // Only rendered if non-uniform retainage
  }>;
  uniformRetainage: boolean;  // true = all line items same rate; Column I omitted
}

/**
 * Escape HTML special characters to prevent XSS in the PDF template.
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build the complete HTML string for an AIA G702/G703 Payment Application PDF.
 *
 * Page 1 = G702 (Application and Certificate for Payment)
 * Page 2 = G703 (Continuation Sheet) — separated by CSS page-break-before: always
 *
 * @param data - Structured payment app data with pre-formatted currency values
 * @returns Complete HTML document string ready for Puppeteer rendering
 */
export function buildPaymentAppHtml(data: PaymentAppPdfData): string {
  const appNumberDisplay = String(data.applicationNumber);

  // -------------------------------------------------------------------------
  // G703 Column I header — only rendered when retainage rates vary
  // -------------------------------------------------------------------------
  const columnIHeader = data.uniformRetainage
    ? ""
    : `<th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 60px; border-right: 1px solid #334155;">I<br/>Retainage %</th>`;

  // -------------------------------------------------------------------------
  // G703 line item rows
  // -------------------------------------------------------------------------
  const lineItemRows = data.lineItems
    .map(
      (item, idx) => {
        const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        const colI = data.uniformRetainage
          ? ""
          : `<td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">${escapeHtml(item.retainagePercent ?? "")}</td>`;
        return `
        <tr style="background-color: ${rowBg}; page-break-inside: avoid;">
          <td style="padding: 5px 4px; text-align: center; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">${escapeHtml(item.itemNumber)}</td>
          <td style="padding: 5px 4px; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">${escapeHtml(item.description)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.scheduledValue)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.previousWorkCompleted)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.thisperiodWork)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.materialsStored)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.totalCompletedAndStored)}</td>
          <td style="padding: 5px 4px; text-align: right; font-size: 10px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(item.balanceToFinish)}</td>
          ${colI}
        </tr>`;
      }
    )
    .join("");

  const emptyRowMsg =
    data.lineItems.length === 0
      ? `<tr><td colspan="${data.uniformRetainage ? 8 : 9}" style="padding: 16px; text-align: center; color: #94a3b8; font-style: italic; font-size: 10px;">No line items</td></tr>`
      : "";

  // -------------------------------------------------------------------------
  // G703 totals row — sum the pre-formatted values; we display them as passed
  // in (the procedure already computes accurate totals from paymentApps fields)
  // -------------------------------------------------------------------------
  const colITotal = data.uniformRetainage
    ? ""
    : `<td style="padding: 6px 4px; text-align: right; font-size: 10px; font-weight: 700; background-color: #1e293b; color: #ffffff; white-space: nowrap;">—</td>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AIA G702/G703 — Application No. ${escapeHtml(appNumberDisplay)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 10pt;
      color: #1e293b;
      background: #ffffff;
    }
    @page {
      size: letter;
      margin: 0.75in;
    }
    table { border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>

  <!-- ==============================================================
       PAGE 1: AIA G702 — APPLICATION AND CERTIFICATE FOR PAYMENT
  =============================================================== -->

  <!-- Header bar -->
  <div style="background-color: #3B5BDB; color: #ffffff; padding: 24px 28px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 9pt; font-weight: 400; opacity: 0.8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">AIA Document G702</div>
        <div style="font-size: 17pt; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2;">APPLICATION AND CERTIFICATE</div>
        <div style="font-size: 17pt; font-weight: 700; letter-spacing: -0.3px; line-height: 1.2;">FOR PAYMENT</div>
        <div style="font-size: 10pt; font-weight: 400; margin-top: 6px; opacity: 0.85;">${escapeHtml(data.companyName)}</div>
      </div>
      <div style="text-align: right; font-size: 9.5pt; opacity: 0.9;">
        <div style="font-size: 9pt; opacity: 0.7; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px;">Application No.</div>
        <div style="font-weight: 700; font-size: 20pt; letter-spacing: 1px;">${escapeHtml(appNumberDisplay)}</div>
        <div style="margin-top: 6px; font-size: 8.5pt; opacity: 0.75;">Period: ${escapeHtml(data.periodFrom)}</div>
        <div style="font-size: 8.5pt; opacity: 0.75;">through ${escapeHtml(data.periodTo)}</div>
      </div>
    </div>
  </div>

  <!-- Project / party info grid -->
  <div style="margin-bottom: 16px; padding: 14px 18px; background: #f8fafc; border-left: 4px solid #3B5BDB; page-break-inside: avoid;">
    <div style="font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 10px;">Project &amp; Contract Information</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
      <div>
        <div style="font-size: 8pt; color: #64748b; margin-bottom: 2px;">Project Name</div>
        <div style="font-size: 10pt; font-weight: 600;">${escapeHtml(data.projectName)}</div>
        <div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">${escapeHtml(data.projectAddress)}</div>
      </div>
      <div>
        <div style="font-size: 8pt; color: #64748b; margin-bottom: 2px;">Owner</div>
        <div style="font-size: 10pt; font-weight: 600;">${escapeHtml(data.ownerName)}</div>
        <div style="font-size: 8.5pt; color: #475569; margin-top: 2px;">${escapeHtml(data.ownerAddress)}</div>
      </div>
      <div>
        <div style="font-size: 8pt; color: #64748b; margin-bottom: 2px;">Architect / Engineer</div>
        <div style="font-size: 10pt;">${escapeHtml(data.architectName)}</div>
        <div style="font-size: 8pt; color: #64748b; margin-top: 8px; margin-bottom: 2px;">Contract Date</div>
        <div style="font-size: 10pt;">${escapeHtml(data.contractDate)}</div>
      </div>
    </div>
  </div>

  <!-- G702 Payment Lines (Lines 1-9) -->
  <div style="margin-bottom: 16px; page-break-inside: avoid;">
    <div style="font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">Payment Summary</div>
    <table style="border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="padding: 8px 10px; text-align: left; font-size: 8pt; width: 30px;">#</th>
          <th style="padding: 8px 10px; text-align: left; font-size: 8pt;">Description</th>
          <th style="padding: 8px 10px; text-align: right; font-size: 8pt; white-space: nowrap;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">1</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Original Contract Sum</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.originalContractSum)}</td>
        </tr>
        <tr>
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">2</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Net Change by Change Orders</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.netChangeByChangeOrders)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">3</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Contract Sum to Date (Lines 1 + 2)</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 600; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.contractSumToDate)}</td>
        </tr>
        <tr>
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">4</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Total Completed and Stored to Date (Column G on G703)</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.totalCompletedAndStored)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">5</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">
            Retainage (${escapeHtml(data.retainagePercent)} of Line 4)
          </td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.retainageAmount)}</td>
        </tr>
        <tr>
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">6</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Total Earned Less Retainage (Lines 4 − 5)</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 600; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.totalEarnedLessRetainage)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b; border-bottom: 1px solid #e2e8f0;">7</td>
          <td style="padding: 7px 10px; font-size: 9.5pt; border-bottom: 1px solid #e2e8f0;">Less Previous Certificates for Payment</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${escapeHtml(data.previousPayments)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 10px; font-size: 9pt; color: #64748b; border-bottom: 2px solid #3B5BDB;">8</td>
          <td style="padding: 10px 10px; font-size: 10.5pt; font-weight: 700; border-bottom: 2px solid #3B5BDB;">CURRENT PAYMENT DUE (Lines 6 − 7)</td>
          <td style="padding: 10px 10px; text-align: right; font-size: 10.5pt; font-weight: 700; border-bottom: 2px solid #3B5BDB; color: #3B5BDB; white-space: nowrap;">${escapeHtml(data.currentPaymentDue)}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 7px 10px; font-size: 9pt; color: #64748b;">9</td>
          <td style="padding: 7px 10px; font-size: 9.5pt;">Balance to Finish, Including Retainage (Lines 3 − 6)</td>
          <td style="padding: 7px 10px; text-align: right; font-size: 9.5pt; font-weight: 500; white-space: nowrap;">${escapeHtml(data.balanceToFinish)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Contractor Certification -->
  <div style="margin-bottom: 16px; padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 4px; page-break-inside: avoid;">
    <div style="font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">Contractor's Certification</div>
    <div style="font-size: 8.5pt; color: #475569; line-height: 1.6;">
      The undersigned Contractor certifies that to the best of the Contractor's knowledge, information, and
      belief the Work covered by this Application for Payment has been completed in accordance with the
      Contract Documents, that all amounts have been paid by the Contractor for Work for which previous
      Certificates for Payment were issued and payments received from the Owner, and that current payment
      shown herein is now due.
    </div>
  </div>

  <!-- Signature blocks -->
  <div style="page-break-inside: avoid; margin-bottom: 20px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px;">

      <!-- Contractor Signature -->
      <div>
        <div style="font-size: 9pt; font-weight: 600; margin-bottom: 4px; color: #1e293b;">Contractor</div>
        <div style="font-size: 8.5pt; color: #64748b; margin-bottom: 16px;">${escapeHtml(data.companyName)}</div>
        <div style="border-bottom: 1px solid #1e293b; margin-bottom: 4px; height: 30px;"></div>
        <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 12px;">Signature</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 2px;">Name:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 18px; margin-bottom: 8px;"></div>
            <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 2px;">Title:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 18px;"></div>
          </div>
          <div>
            <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 2px;">Date:</div>
            <div style="border-bottom: 1px solid #94a3b8; height: 18px;"></div>
          </div>
        </div>
      </div>

      <!-- Architect's Certificate of Payment -->
      <div>
        <div style="font-size: 9pt; font-weight: 600; margin-bottom: 4px; color: #1e293b;">Architect's Certificate for Payment</div>
        <div style="font-size: 8pt; color: #475569; line-height: 1.5; margin-bottom: 10px;">
          In accordance with the Contract Documents, based on on-site observations and the data comprising
          this application, the Architect certifies to the Owner that to the best of the Architect's knowledge,
          information, and belief the Work has progressed as indicated, the quality of the Work is in
          accordance with the Contract Documents, and the Contractor is entitled to payment of the
          AMOUNT CERTIFIED.
        </div>
        <div style="font-size: 8pt; color: #64748b; margin-bottom: 2px;">Amount Certified: $__________________</div>
        <div style="border-bottom: 1px solid #1e293b; margin-top: 14px; margin-bottom: 4px; height: 30px;"></div>
        <div style="font-size: 7.5pt; color: #64748b; margin-bottom: 8px;">Architect's Signature / Date</div>
      </div>

    </div>
  </div>

  <!-- ==============================================================
       PAGE 2: AIA G703 — CONTINUATION SHEET
       CSS page-break-before: always forces a new page in Puppeteer
  =============================================================== -->
  <div style="page-break-before: always;">

    <!-- G703 Header bar -->
    <div style="background-color: #3B5BDB; color: #ffffff; padding: 20px 28px; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 8pt; font-weight: 400; opacity: 0.8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 3px;">AIA Document G703</div>
          <div style="font-size: 16pt; font-weight: 700; letter-spacing: -0.3px;">CONTINUATION SHEET</div>
          <div style="font-size: 9pt; font-weight: 400; margin-top: 4px; opacity: 0.85;">${escapeHtml(data.projectName)}</div>
        </div>
        <div style="text-align: right; font-size: 8.5pt; opacity: 0.9;">
          <div style="font-size: 8pt; opacity: 0.75; text-transform: uppercase; letter-spacing: 1px;">Application No.</div>
          <div style="font-weight: 700; font-size: 18pt;">${escapeHtml(appNumberDisplay)}</div>
          <div style="font-size: 8pt; margin-top: 4px; opacity: 0.75;">Period To: ${escapeHtml(data.periodTo)}</div>
        </div>
      </div>
    </div>

    <!-- G703 Table -->
    <table style="border: 1px solid #cbd5e1; font-size: 11px;">
      <thead>
        <tr style="background-color: #1e293b; color: #ffffff;">
          <th style="padding: 6px 4px; text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 36px; border-right: 1px solid #334155;">A<br/>Item No.</th>
          <th style="padding: 6px 4px; text-align: left; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; border-right: 1px solid #334155;">B<br/>Description of Work</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 75px; border-right: 1px solid #334155;">C<br/>Scheduled Value</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 75px; border-right: 1px solid #334155;">D<br/>Work Completed<br/>Previous</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 75px; border-right: 1px solid #334155;">E<br/>Work Completed<br/>This Period</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 60px; border-right: 1px solid #334155;">F<br/>Materials Stored</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 75px; border-right: 1px solid #334155;">G<br/>Total D+E+F</th>
          <th style="padding: 6px 4px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; width: 75px; border-right: 1px solid #334155;">H<br/>Balance to Finish C−G</th>
          ${columnIHeader}
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
        ${emptyRowMsg}
      </tbody>
      <tfoot>
        <tr style="background-color: #1e293b; color: #ffffff; font-weight: 700; page-break-inside: avoid;">
          <td colspan="2" style="padding: 7px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Totals</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px; white-space: nowrap;">${escapeHtml(data.originalContractSum)}</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px;">—</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px;">—</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px;">—</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px; white-space: nowrap;">${escapeHtml(data.totalCompletedAndStored)}</td>
          <td style="padding: 7px 4px; text-align: right; font-size: 10px; white-space: nowrap;">${escapeHtml(data.balanceToFinish)}</td>
          ${colITotal}
        </tr>
      </tfoot>
    </table>

    <!-- Footer -->
    <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 8pt;">
      <div>AIA G703 Continuation Sheet — Application No. ${escapeHtml(appNumberDisplay)} — Period To: ${escapeHtml(data.periodTo)}</div>
      <div>Generated by BIDAXIOM</div>
    </div>

  </div>

</body>
</html>`;
}
