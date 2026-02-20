/**
 * Preview sample data fixtures for custom template PDF generation.
 *
 * Used when generating a preview PDF during field mapping — before the user
 * has a real project to associate. Real company branding can be injected via
 * buildPreviewData() to override the placeholder company values.
 *
 * All keys use the BIDAXIOM dot-notation format matching BIDAXIOM_FIELD_KEYS
 * from @construction/shared.
 */

// ---------------------------------------------------------------------------
// PREVIEW_SAMPLE_DATA
// ---------------------------------------------------------------------------

/**
 * Flat fixture data object covering all 4 doc types + company + project.
 *
 * Company keys use placeholder values — the router overrides these with real
 * company branding at preview generation time via buildPreviewData().
 */
export const PREVIEW_SAMPLE_DATA: Record<string, string> = {
  // Company (overridden at runtime with real company data)
  "company.name": "Acme Construction Co.",
  "company.address": "123 Main Street, Denver, CO 80203",
  "company.phone": "(303) 555-0100",
  "company.license": "GC-2026-001234",
  "company.primaryColor": "#3B5BDB",

  // Project
  "project.name": "Project Alpha",
  "project.jobNumber": "2026-001",
  "project.address": "456 Oak Avenue, Denver, CO 80204",
  "project.clientName": "Acme Property Group",
  "project.lifecyclePhase": "construction",
  "project.startDate": "January 15, 2026",
  "project.endDate": "December 31, 2026",

  // Proposal
  "doc.estimateTotal": "$125,000.00",
  "doc.subtotalLabor": "$60,000.00",
  "doc.subtotalMaterials": "$45,000.00",
  "doc.subtotalEquipment": "$10,000.00",
  "doc.subtotalSubcontractor": "$0.00",
  "doc.overheadAmount": "$6,250.00",
  "doc.markupAmount": "$3,750.00",
  "doc.preparedBy": "Jane Smith",
  "doc.generatedDate": "February 20, 2026",

  // Change Order
  "doc.coNumber": "CO-2026-001",
  "doc.coTitle": "Additional Electrical Work",
  "doc.coDescription":
    "Install additional electrical circuits in east wing per owner request.",
  "doc.costDelta": "$8,500.00",
  "doc.status": "Approved",

  // Payment Application
  "doc.applicationNumber": "PAY-2026-003",
  "doc.periodStart": "January 1, 2026",
  "doc.periodEnd": "January 31, 2026",
  "doc.contractPrice": "$500,000.00",
  "doc.retainagePercent": "10.00%",
  "doc.retainageAmount": "$12,500.00",
  "doc.currentAmountDue": "$112,500.00",
  "doc.totalEarnedLessRetainage": "$112,500.00",
  "doc.previousPayments": "$87,500.00",

  // RFQ
  "doc.rfqNumber": "RFQ-2026-005",
  "doc.rfqTitle": "Concrete Flatwork",
  "doc.submissionDeadline": "March 15, 2026",
  "doc.paymentTerms": "Net 30",
  "doc.scopeOfWork":
    "Provide and install 4,000 sq ft of concrete flatwork per specs.",
};

// ---------------------------------------------------------------------------
// PREVIEW_LINE_ITEMS
// ---------------------------------------------------------------------------

/**
 * Fixture line items for table field rendering in preview PDFs.
 * Keys match the BIDAXIOM table.* field group (without the "table." prefix).
 */
export const PREVIEW_LINE_ITEMS: Array<Record<string, string>> = [
  {
    description: "Mobilization",
    quantity: "1",
    unit: "LS",
    unitCost: "$5,000.00",
    lineTotal: "$5,000.00",
    costType: "Labor",
    itemNumber: "1",
    scheduledValue: "$5,000.00",
  },
  {
    description: "Concrete Flatwork (4,000 SF)",
    quantity: "4000",
    unit: "SF",
    unitCost: "$10.00",
    lineTotal: "$40,000.00",
    costType: "Material",
    itemNumber: "2",
    scheduledValue: "$40,000.00",
  },
  {
    description: "Finishing and Sealing",
    quantity: "1",
    unit: "LS",
    unitCost: "$8,000.00",
    lineTotal: "$8,000.00",
    costType: "Labor",
    itemNumber: "3",
    scheduledValue: "$8,000.00",
  },
];

// ---------------------------------------------------------------------------
// buildPreviewData
// ---------------------------------------------------------------------------

/**
 * Merge PREVIEW_SAMPLE_DATA with real company branding overrides.
 *
 * At preview generation time, the router passes real company values (name,
 * address, phone, etc.) to replace the placeholder company fixtures while
 * leaving all project/document fixtures intact.
 *
 * @param companyOverrides - Real company data to inject (e.g. from getCompanyBranding)
 * @returns Merged flat data object suitable for passing to buildCustomTemplateHtml()
 */
export function buildPreviewData(
  companyOverrides: Partial<Record<string, string>> = {}
): Record<string, string> {
  // Filter out undefined values from companyOverrides before merging
  const cleanOverrides = Object.fromEntries(
    Object.entries(companyOverrides).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
  return { ...PREVIEW_SAMPLE_DATA, ...cleanOverrides };
}
