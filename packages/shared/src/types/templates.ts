export const TEMPLATE_DOC_TYPES = ["proposal", "change_order"] as const;
export type TemplateDocType = (typeof TEMPLATE_DOC_TYPES)[number];

export interface DetectedField {
  detectedField: string; // lowercased key, e.g. "project_name"
  displayField: string; // as-typed in document, e.g. "<<Project_Name>>"
}

export interface FieldMapping extends DetectedField {
  mappedTo: string | null; // BIDAXIOM data key | "IGNORED" | null (unmapped)
}

/**
 * Canonical list of BIDAXIOM data keys available for field mapping.
 * Used in the field picker dropdown. Grouped by context.
 *
 * Key values use dot-notation:
 *   company.*  — company/branding context
 *   project.*  — project context
 *   doc.*      — document-specific context (per doc type)
 *   table.*    — repeating line item table context
 */
export const BIDAXIOM_FIELD_KEYS = {
  company: [
    { key: "company.name", label: "Company Name" },
    { key: "company.phone", label: "Company Phone" },
    { key: "company.license", label: "License Number" },
    { key: "company.address", label: "Company Address (combined)" },
    { key: "company.street1", label: "Company Street 1" },
    { key: "company.street2", label: "Company Street 2" },
    { key: "company.city", label: "Company City" },
    { key: "company.state", label: "Company State" },
    { key: "company.zip", label: "Company ZIP" },
    { key: "company.primaryColor", label: "Primary Color" },
  ],
  project: [
    { key: "project.name", label: "Project Name" },
    { key: "project.jobNumber", label: "Job Number" },
    { key: "project.clientName", label: "Client Name" },
    { key: "project.address", label: "Project Address (combined)" },
    { key: "project.street1", label: "Project Street 1" },
    { key: "project.street2", label: "Project Street 2" },
    { key: "project.city", label: "Project City" },
    { key: "project.state", label: "Project State" },
    { key: "project.zip", label: "Project ZIP" },
    { key: "project.lifecyclePhase", label: "Lifecycle Phase" },
    { key: "project.startDate", label: "Start Date" },
    { key: "project.endDate", label: "End Date" },
  ],
  proposal: [
    { key: "doc.estimateTotal", label: "Estimate Total" },
    { key: "doc.subtotalLabor", label: "Labor Subtotal" },
    { key: "doc.subtotalMaterials", label: "Materials Subtotal" },
    { key: "doc.subtotalEquipment", label: "Equipment Subtotal" },
    { key: "doc.subtotalSubcontractor", label: "Subcontractor Subtotal" },
    { key: "doc.overheadAmount", label: "Overhead Amount" },
    { key: "doc.markupAmount", label: "Markup Amount" },
    { key: "doc.salesTaxRate", label: "Sales Tax Rate" },
    { key: "doc.salesTaxAmount", label: "Sales Tax Amount" },
    { key: "doc.expirationDate", label: "Bid Expiration Date" },
    { key: "doc.preparedBy", label: "Prepared By" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  change_order: [
    { key: "doc.coNumber", label: "CO Number" },
    { key: "doc.coTitle", label: "CO Title" },
    { key: "doc.coDescription", label: "Description" },
    { key: "doc.costDelta", label: "Cost Delta" },
    { key: "doc.status", label: "Status" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  payment_app: [
    { key: "doc.applicationNumber", label: "Application Number" },
    { key: "doc.periodStart", label: "Period Start Date" },
    { key: "doc.periodEnd", label: "Period End Date" },
    { key: "doc.contractPrice", label: "Contract Price" },
    { key: "doc.retainagePercent", label: "Retainage %" },
    { key: "doc.retainageAmount", label: "Retainage Amount" },
    { key: "doc.currentAmountDue", label: "Amount Due" },
    { key: "doc.totalEarnedLessRetainage", label: "Total Earned Less Retainage" },
    { key: "doc.previousPayments", label: "Previous Payments" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  rfq: [
    { key: "doc.rfqNumber", label: "RFQ Number" },
    { key: "doc.rfqTitle", label: "RFQ Title" },
    { key: "doc.submissionDeadline", label: "Submission Deadline" },
    { key: "doc.paymentTerms", label: "Payment Terms" },
    { key: "doc.scopeOfWork", label: "Scope of Work" },
    { key: "doc.generatedDate", label: "Generated Date" },
  ],
  lineTable: [
    { key: "table.description", label: "Line Item Description" },
    { key: "table.quantity", label: "Quantity" },
    { key: "table.unit", label: "Unit" },
    { key: "table.unitCost", label: "Unit Cost" },
    { key: "table.lineTotal", label: "Line Total" },
    { key: "table.costType", label: "Cost Type" },
    { key: "table.itemNumber", label: "Item Number" },
    { key: "table.scheduledValue", label: "Scheduled Value" },
  ],
} as const;
