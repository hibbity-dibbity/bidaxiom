import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, isNull, sql, and } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { buildProposalHtml, type ProposalPdfData } from "../../pdf/templates/proposal.js";
import { buildChangeOrderHtml, type ChangeOrderPdfData } from "../../pdf/templates/change-order.js";
import { buildPaymentAppHtml, type PaymentAppPdfData } from "../../pdf/templates/payment-app.js";
import { buildRfqHtml, type RfqPdfData } from "../../pdf/templates/rfq.js";
import {
  getNextDocumentSequence,
  resolveFileName,
  uploadPdfAndSave,
} from "../../pdf/generate.js";
import { generatePdfBuffer } from "../../pdf/engine.js";
import { buildCustomTemplateHtml } from "../../templates/render.js";
import type { FieldMapping } from "@construction/shared";

/**
 * Format a numeric string or number as USD currency.
 * e.g. "12345.67" -> "$12,345.67"
 */
function formatUsd(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(isNaN(num) ? 0 : num);
}

/**
 * Format an ISO date string as "Month DD, YYYY" (e.g., "February 19, 2026").
 */
function formatGeneratedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/**
 * Map DB cost type to display label.
 * DB stores: "labor" | "material" | "equipment" | "subcontractor"
 */
function costTypeLabel(ct: string): string {
  const map: Record<string, string> = {
    labor: "Labor",
    material: "Materials",
    equipment: "Equipment",
    subcontractor: "Subcontractor",
  };
  return map[ct] ?? ct;
}

/**
 * PDF generation router.
 * Shell router for Phase 38 — procedures added by plans 38-03 through 38-06.
 */
export const pdfRouter = router({
  /**
   * Smoke-test procedure to confirm the router loads without error.
   * Returns { ok: true } for all authenticated + tenant-scoped requests.
   */
  getStatus: protectedProcedure
    .query(() => ({ ok: true })),

  /**
   * Generate a Proposal PDF for an estimate.
   *
   * 1. Looks up project and estimate (with line items).
   * 2. Fetches active company profile for documentNamingSettings.
   * 3. Fetches company name from public.tenants.
   * 4. Increments the "proposal" sequence counter.
   * 5. Resolves the PDF file name from naming settings.
   * 6. Builds the HTML via buildProposalHtml().
   * 7. Renders the PDF via Puppeteer (generatePdfBuffer).
   * 8. Uploads to S3 and inserts document + version rows.
   * 9. Returns { documentId, fileName, message }.
   */
  generateProposal: protectedProcedure
    .input(
      z.object({
        projectSlug: z.string(),
        estimateId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // --- 1. Look up project by slug ---
      const [project] = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          street1: schema.projects.street1,
          city: schema.projects.city,
          state: schema.projects.state,
          zip: schema.projects.zip,
        })
        .from(schema.projects)
        .where(eq(schema.projects.slug, input.projectSlug))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // --- 2. Look up estimate with line items ---
      const [estimate] = await db
        .select()
        .from(schema.estimates)
        .where(eq(schema.estimates.id, input.estimateId))
        .limit(1);

      if (!estimate || estimate.projectId !== project.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found for this project",
        });
      }

      const lineItems = await db
        .select()
        .from(schema.estimateLineItems)
        .where(eq(schema.estimateLineItems.estimateId, input.estimateId))
        .orderBy(schema.estimateLineItems.orderIndex);

      // --- 3. Fetch active company profile for naming settings, and company name ---
      const [companyProfile] = await db
        .select({
          documentNamingSettings: schema.companyProfiles.documentNamingSettings,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      // Get company name from public.tenants via raw SQL (cross-schema access)
      const tenantResult = await db.execute(
        sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
      );
      const companyName =
        (tenantResult.rows?.[0] as { name?: string } | undefined)?.name ??
        "Your Company";

      // --- 4. Get next sequence number ---
      const seq = await getNextDocumentSequence(db, schema, "proposal");

      // --- 5. Resolve file name ---
      const fileName = resolveFileName(
        companyProfile?.documentNamingSettings ?? null,
        "proposal",
        project.jobNumber ?? null,
        project.name,
        seq
      );

      // --- 6. Build ProposalPdfData ---
      const addressParts = [project.street1, project.city, project.state, project.zip].filter(Boolean);
      const projectAddress =
        addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

      const generatedDate = formatGeneratedDate(new Date().toISOString());

      // Calculate subtotals by cost type
      let subtotalLabor = 0;
      let subtotalMaterials = 0;
      let subtotalEquipment = 0;
      let subtotalSubcontractor = 0;

      for (const item of lineItems) {
        const qty = parseFloat(item.quantity as string) || 0;
        const uc = parseFloat(item.unitCost as string) || 0;
        const lineTotal = qty * uc;
        switch (item.costType) {
          case "labor":
            subtotalLabor += lineTotal;
            break;
          case "material":
            subtotalMaterials += lineTotal;
            break;
          case "equipment":
            subtotalEquipment += lineTotal;
            break;
          case "subcontractor":
            subtotalSubcontractor += lineTotal;
            break;
        }
      }

      const pdfData: ProposalPdfData = {
        companyName,
        projectName: project.name,
        projectAddress,
        estimateName: estimate.name,
        generatedDate,
        lineItems: lineItems.map((item) => {
          const qty = parseFloat(item.quantity as string) || 0;
          const uc = parseFloat(item.unitCost as string) || 0;
          const lineTotal = qty * uc;
          return {
            description: item.description,
            quantity: String(qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)),
            unit: item.unit,
            unitCost: formatUsd(uc),
            total: formatUsd(lineTotal),
            costType: costTypeLabel(item.costType),
          };
        }),
        subtotalLabor: formatUsd(subtotalLabor),
        subtotalMaterials: formatUsd(subtotalMaterials),
        subtotalEquipment: formatUsd(subtotalEquipment),
        subtotalSubcontractor: formatUsd(subtotalSubcontractor),
        overheadAmount: formatUsd(estimate.overheadAmount as string),
        markupAmount: formatUsd(estimate.markupAmount as string),
        totalCost: formatUsd(estimate.totalCost as string),
      };

      // --- 7. Check for active custom template (TMPL-06) ---
      const [activeTemplate] = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.docType, "proposal"),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1);

      // --- 8. Build HTML (custom template or built-in fallback) ---
      let html: string;
      if (activeTemplate?.fieldMappings?.length) {
        const realData: Record<string, string> = {
          "company.name": companyName,
          "company.primaryColor": "#3B5BDB",
          "project.name": pdfData.projectName,
          "project.address": pdfData.projectAddress,
          "project.jobNumber": project.jobNumber ?? "",
          "doc.estimateTotal": pdfData.totalCost,
          "doc.subtotalLabor": pdfData.subtotalLabor,
          "doc.subtotalMaterials": pdfData.subtotalMaterials,
          "doc.subtotalEquipment": pdfData.subtotalEquipment,
          "doc.subtotalSubcontractor": pdfData.subtotalSubcontractor,
          "doc.overheadAmount": pdfData.overheadAmount,
          "doc.markupAmount": pdfData.markupAmount,
          "doc.preparedBy": pdfData.estimateName,
          "doc.generatedDate": pdfData.generatedDate,
        };
        html = buildCustomTemplateHtml(
          activeTemplate.fieldMappings as FieldMapping[],
          realData,
          pdfData.lineItems.map((li) => ({
            description: String(li.description ?? ""),
            quantity: String(li.quantity ?? ""),
            unit: String(li.unit ?? ""),
            unitCost: String(li.unitCost ?? ""),
            lineTotal: String(li.total ?? ""),
            costType: String(li.costType ?? ""),
          })),
          false // isPreview=false — production
        );
      } else {
        html = buildProposalHtml(pdfData);
      }

      // --- 9. Generate PDF buffer via Puppeteer ---
      const pdfBuffer = await generatePdfBuffer(html);

      // --- 10. Upload to S3 + insert document record ---
      const result = await uploadPdfAndSave({
        db,
        schema,
        tenantId,
        projectId: project.id,
        userId: ctx.userId,
        fileName,
        category: "proposal",
        description: `Proposal: ${estimate.name}`,
        pdfBuffer,
        templateId: activeTemplate?.id ?? null,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "Proposal PDF generated successfully",
      };
    }),

  /**
   * Generate a Change Order PDF for an approved or pending change order.
   *
   * 1. Looks up project by slug.
   * 2. Looks up change order with line items; verifies it belongs to the project.
   * 3. Status gate: only "pco_submitted", "pending_approval", or "approved" allowed.
   * 4. Fetches active company profile for documentNamingSettings.
   * 5. Fetches company name from public.tenants.
   * 6. Increments the "change_order" sequence counter.
   * 7. Resolves the PDF file name from naming settings.
   * 8. Builds the HTML via buildChangeOrderHtml().
   * 9. Renders the PDF via Puppeteer (generatePdfBuffer).
   * 10. Uploads to S3 and inserts document + version rows with category "change_order".
   * 11. Returns { documentId, fileName, message }.
   */
  generateChangeOrder: protectedProcedure
    .input(
      z.object({
        projectSlug: z.string(),
        changeOrderId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // --- 1. Look up project by slug ---
      const [project] = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          street1: schema.projects.street1,
          city: schema.projects.city,
          state: schema.projects.state,
          zip: schema.projects.zip,
          budget: schema.projects.budget,
        })
        .from(schema.projects)
        .where(eq(schema.projects.slug, input.projectSlug))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // --- 2. Look up change order and verify it belongs to this project ---
      const [changeOrder] = await db
        .select()
        .from(schema.changeOrders)
        .where(eq(schema.changeOrders.id, input.changeOrderId))
        .limit(1);

      if (!changeOrder || changeOrder.projectId !== project.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change order not found for this project",
        });
      }

      // --- 3. Status gate: only submitted/pending/approved COs can generate PDFs ---
      const allowedStatuses = ["pco_submitted", "pending_approval", "approved"];
      if (!allowedStatuses.includes(changeOrder.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Cannot generate PDF for a change order in "${changeOrder.status}" status. Only submitted, pending approval, or approved change orders can generate PDFs.`,
        });
      }

      // --- 4. Fetch active company profile for naming settings ---
      const [companyProfile] = await db
        .select({
          documentNamingSettings: schema.companyProfiles.documentNamingSettings,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      // --- 5. Get company name from public.tenants ---
      const tenantResult = await db.execute(
        sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
      );
      const companyName =
        (tenantResult.rows?.[0] as { name?: string } | undefined)?.name ??
        "Your Company";

      // --- 6. Get next sequence number ---
      const seq = await getNextDocumentSequence(db, schema, "change_order");

      // --- 7. Resolve file name ---
      const fileName = resolveFileName(
        companyProfile?.documentNamingSettings ?? null,
        "change_order",
        project.jobNumber ?? null,
        project.name,
        seq
      );

      // --- 8. Build ChangeOrderPdfData ---
      const addressParts = [project.street1, project.city, project.state, project.zip].filter(Boolean);
      const projectAddress =
        addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

      const generatedDate = formatGeneratedDate(new Date().toISOString());

      // Fetch line items
      const lineItems = await db
        .select()
        .from(schema.changeOrderLineItems)
        .where(eq(schema.changeOrderLineItems.changeOrderId, input.changeOrderId));

      // Total is stored directly on the CO
      const totalAmount = parseFloat(changeOrder.totalAmount as string) || 0;
      const totalCost = formatUsd(totalAmount);

      // Contract sum: use project.budget as the base (or "N/A" if not set)
      const budgetValue = project.budget !== null && project.budget !== undefined
        ? parseFloat(project.budget as string)
        : null;

      const contractSumBefore = budgetValue !== null ? formatUsd(budgetValue) : "N/A";
      const contractSumAfter =
        budgetValue !== null ? formatUsd(budgetValue + totalAmount) : "N/A";

      // Map status to display label
      const statusDisplayMap: Record<string, string> = {
        pco_submitted: "Pending Approval",
        pending_approval: "Pending Approval",
        approved: "Approved",
        draft: "Draft",
        rejected: "Rejected",
        void: "Void",
      };
      const statusDisplay = statusDisplayMap[changeOrder.status] ?? changeOrder.status;

      // CO number display: use coNumber if approved, else pcoNumber, else "DRAFT"
      const coNumberDisplay =
        changeOrder.coNumber ?? changeOrder.pcoNumber ?? "DRAFT";

      const pdfData: ChangeOrderPdfData = {
        companyName,
        projectName: project.name,
        jobNumber: project.jobNumber ?? null,
        projectAddress,
        coNumber: coNumberDisplay,
        coTitle: changeOrder.title,
        coDescription: changeOrder.description,
        status: statusDisplay,
        generatedDate,
        totalCost,
        contractSumBefore,
        contractSumAfter,
        scheduleImpactDays: null, // scheduleImpact not in schema; always no impact
        lineItems: lineItems.map((item) => ({
          description: item.description,
          amountChange: formatUsd(parseFloat(item.amountChange as string) || 0),
        })),
      };

      // --- 9. Check for active custom template (TMPL-06) ---
      const [activeTemplate] = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.docType, "change_order"),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1);

      // --- 10. Build HTML (custom template or built-in fallback) ---
      let html: string;
      if (activeTemplate?.fieldMappings?.length) {
        const realData: Record<string, string> = {
          "company.name": companyName,
          "company.primaryColor": "#3B5BDB",
          "project.name": pdfData.projectName,
          "project.address": pdfData.projectAddress,
          "project.jobNumber": project.jobNumber ?? "",
          "doc.coNumber": pdfData.coNumber,
          "doc.coTitle": pdfData.coTitle,
          "doc.coDescription": String(pdfData.coDescription ?? ""),
          "doc.costDelta": pdfData.totalCost,
          "doc.status": pdfData.status,
          "doc.generatedDate": pdfData.generatedDate,
        };
        html = buildCustomTemplateHtml(
          activeTemplate.fieldMappings as FieldMapping[],
          realData,
          pdfData.lineItems.map((li) => ({
            description: String(li.description ?? ""),
            lineTotal: String(li.amountChange ?? ""),
          })),
          false // isPreview=false — production
        );
      } else {
        html = buildChangeOrderHtml(pdfData);
      }

      // --- 11. Generate PDF buffer via Puppeteer ---
      const pdfBuffer = await generatePdfBuffer(html);

      // --- 12. Upload to S3 + insert document record ---
      const result = await uploadPdfAndSave({
        db,
        schema,
        tenantId,
        projectId: project.id,
        userId: ctx.userId,
        fileName,
        category: "change_order",
        description: `Change Order ${coNumberDisplay}: ${changeOrder.title}`,
        pdfBuffer,
        templateId: activeTemplate?.id ?? null,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "Change Order PDF generated successfully",
      };
    }),

  /**
   * Generate an AIA G702/G703 Payment Application PDF.
   *
   * 1. Looks up project by slug (with customer join for owner info).
   * 2. Looks up payment app by id; verifies it belongs to the project.
   * 3. Fetches payment_app_line_items joined with sov_items.
   * 4. Fetches customer (owner) from project.customerId.
   * 5. Gets company name from public.tenants.
   * 6. Gets documentNamingSettings from active companyProfile.
   * 7. Increments the "payment_app" sequence counter.
   * 8. Resolves PDF file name.
   * 9. Builds PaymentAppPdfData and calls buildPaymentAppHtml().
   * 10. Renders PDF via Puppeteer (generatePdfBuffer).
   * 11. Uploads to S3 and inserts document + version rows with category "payment_app".
   * 12. Returns { documentId, fileName, message }.
   */
  generatePaymentApp: protectedProcedure
    .input(
      z.object({
        projectSlug: z.string(),
        paymentAppId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // --- 1. Look up project by slug ---
      const [project] = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          street1: schema.projects.street1,
          city: schema.projects.city,
          state: schema.projects.state,
          zip: schema.projects.zip,
          customerId: schema.projects.customerId,
          startDate: schema.projects.startDate,
        })
        .from(schema.projects)
        .where(eq(schema.projects.slug, input.projectSlug))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // --- 2. Look up payment app; verify it belongs to this project ---
      const [payApp] = await db
        .select()
        .from(schema.paymentApps)
        .where(eq(schema.paymentApps.id, input.paymentAppId))
        .limit(1);

      if (!payApp || payApp.projectId !== project.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment application not found for this project",
        });
      }

      // --- 3. Fetch line items joined with SOV items ---
      const lineItems = await db
        .select({
          id: schema.paymentAppLineItems.id,
          sovItemId: schema.paymentAppLineItems.sovItemId,
          previousPercentComplete: schema.paymentAppLineItems.previousPercentComplete,
          currentPercentComplete: schema.paymentAppLineItems.currentPercentComplete,
          workCompletedThisPeriod: schema.paymentAppLineItems.workCompletedThisPeriod,
          materialsStoredThisPeriod: schema.paymentAppLineItems.materialsStoredThisPeriod,
          totalCompletedAndStored: schema.paymentAppLineItems.totalCompletedAndStored,
          retainagePercent: schema.paymentAppLineItems.retainagePercent,
          retainageAmount: schema.paymentAppLineItems.retainageAmount,
          itemNumber: schema.sovItems.itemNumber,
          description: schema.sovItems.description,
          scheduledValue: schema.sovItems.scheduledValue,
        })
        .from(schema.paymentAppLineItems)
        .innerJoin(
          schema.sovItems,
          eq(schema.sovItems.id, schema.paymentAppLineItems.sovItemId)
        )
        .where(eq(schema.paymentAppLineItems.paymentAppId, input.paymentAppId))
        .orderBy(schema.sovItems.orderIndex);

      // --- 4. Look up customer (owner) ---
      const [customer] = await db
        .select({
          companyName: schema.customers.companyName,
          contactName: schema.customers.contactName,
          street1: schema.customers.street1,
          city: schema.customers.city,
          state: schema.customers.state,
          zip: schema.customers.zip,
        })
        .from(schema.customers)
        .where(eq(schema.customers.id, project.customerId))
        .limit(1);

      // --- 5. Get company name from public.tenants ---
      const tenantResult = await db.execute(
        sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
      );
      const companyName =
        (tenantResult.rows?.[0] as { name?: string } | undefined)?.name ??
        "Your Company";

      // --- 6. Fetch active company profile for naming settings ---
      const [companyProfile] = await db
        .select({
          documentNamingSettings: schema.companyProfiles.documentNamingSettings,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      // --- 7. Get next sequence number ---
      const seq = await getNextDocumentSequence(db, schema, "payment_app");

      // --- 8. Resolve file name ---
      const fileName = resolveFileName(
        companyProfile?.documentNamingSettings ?? null,
        "payment_app",
        project.jobNumber ?? null,
        project.name,
        seq
      );

      // --- 9. Build PaymentAppPdfData ---

      // Project address
      const addressParts = [project.street1, project.city, project.state, project.zip].filter(Boolean);
      const projectAddress =
        addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

      // Owner info
      const ownerName = customer
        ? (customer.companyName ?? customer.contactName)
        : "Not specified";
      const ownerAddressParts = customer
        ? [customer.street1, customer.city, customer.state, customer.zip].filter(Boolean)
        : [];
      const ownerAddress =
        ownerAddressParts.length > 0 ? ownerAddressParts.join(", ") : "";

      // Period dates
      const periodFrom = formatGeneratedDate(new Date(payApp.periodStart).toISOString());
      const periodTo = formatGeneratedDate(new Date(payApp.periodEnd).toISOString());

      // Contract date (project start date)
      const contractDate = project.startDate
        ? formatGeneratedDate(new Date(project.startDate).toISOString())
        : "Not specified";

      // Application number (stored as text in DB e.g. "PAY-2026-001")
      const applicationNumber = payApp.applicationNumber;

      // Retainage percent for header — derive from retainageAmount / totalCompletedAndStored
      const totalCompleted = parseFloat(payApp.totalCompletedAndStored as string) || 0;
      const retainageAmt = parseFloat(payApp.retainageAmount as string) || 0;
      const retainagePct = totalCompleted > 0 ? (retainageAmt / totalCompleted) * 100 : 0;
      const retainagePercent = `${retainagePct.toFixed(2)}%`;

      // Check if retainage is uniform across all line items
      const uniformRetainage =
        lineItems.length === 0 ||
        lineItems.every(
          (li) =>
            String(li.retainagePercent) === String(lineItems[0].retainagePercent)
        );

      // Build line items for G703
      const g703LineItems: PaymentAppPdfData["lineItems"] = lineItems.map((li) => {
        const scheduledVal = parseFloat(li.scheduledValue as string) || 0;
        const previousPct = parseFloat(li.previousPercentComplete as string) || 0;
        const previousWorkCompleted = (previousPct / 100) * scheduledVal;

        return {
          itemNumber: li.itemNumber,
          description: li.description,
          scheduledValue: formatUsd(scheduledVal),
          previousWorkCompleted: formatUsd(previousWorkCompleted),
          thisperiodWork: formatUsd(parseFloat(li.workCompletedThisPeriod as string) || 0),
          materialsStored: formatUsd(parseFloat(li.materialsStoredThisPeriod as string) || 0),
          totalCompletedAndStored: formatUsd(parseFloat(li.totalCompletedAndStored as string) || 0),
          balanceToFinish: formatUsd(scheduledVal - (parseFloat(li.totalCompletedAndStored as string) || 0)),
          retainagePercent: uniformRetainage
            ? null
            : `${parseFloat(li.retainagePercent as string).toFixed(2)}%`,
        };
      });

      const pdfData: PaymentAppPdfData = {
        companyName,
        ownerName,
        ownerAddress,
        projectName: project.name,
        projectAddress,
        architectName: "Not specified",
        applicationNumber,
        periodFrom,
        periodTo,
        contractDate,
        originalContractSum: formatUsd(payApp.originalContractSum as string),
        netChangeByChangeOrders: formatUsd(payApp.netChangeByChangeOrders as string),
        contractSumToDate: formatUsd(payApp.contractSumToDate as string),
        totalCompletedAndStored: formatUsd(payApp.totalCompletedAndStored as string),
        retainagePercent,
        retainageAmount: formatUsd(payApp.retainageAmount as string),
        totalEarnedLessRetainage: formatUsd(payApp.totalEarnedLessRetainage as string),
        previousPayments: formatUsd(payApp.previousPayments as string),
        currentPaymentDue: formatUsd(payApp.currentPaymentDue as string),
        balanceToFinish: formatUsd(payApp.balanceToFinish as string),
        lineItems: g703LineItems,
        uniformRetainage,
      };

      // --- 10. Check for active custom template (TMPL-06) ---
      const [activeTemplate] = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.docType, "payment_app"),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1);

      // --- 11. Build HTML (custom template or built-in fallback) ---
      let html: string;
      if (activeTemplate?.fieldMappings?.length) {
        const realData: Record<string, string> = {
          "company.name": companyName,
          "company.primaryColor": "#3B5BDB",
          "project.name": pdfData.projectName,
          "project.address": pdfData.projectAddress,
          "project.jobNumber": project.jobNumber ?? "",
          "doc.applicationNumber": String(pdfData.applicationNumber ?? ""),
          "doc.periodStart": pdfData.periodFrom,
          "doc.periodEnd": pdfData.periodTo,
          "doc.contractPrice": pdfData.contractSumToDate,
          "doc.retainagePercent": pdfData.retainagePercent,
          "doc.retainageAmount": pdfData.retainageAmount,
          "doc.currentAmountDue": pdfData.currentPaymentDue,
          "doc.totalEarnedLessRetainage": pdfData.totalEarnedLessRetainage,
          "doc.previousPayments": pdfData.previousPayments,
          "doc.generatedDate": new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        };
        html = buildCustomTemplateHtml(
          activeTemplate.fieldMappings as FieldMapping[],
          realData,
          pdfData.lineItems.map((li) => ({
            itemNumber: String(li.itemNumber ?? ""),
            description: String(li.description ?? ""),
            scheduledValue: String(li.scheduledValue ?? ""),
            lineTotal: String(li.totalCompletedAndStored ?? ""),
          })),
          false // isPreview=false — production
        );
      } else {
        html = buildPaymentAppHtml(pdfData);
      }

      // --- 12. Generate PDF buffer via Puppeteer ---
      const pdfBuffer = await generatePdfBuffer(html);

      // --- 13. Upload to S3 + insert document record ---
      const result = await uploadPdfAndSave({
        db,
        schema,
        tenantId,
        projectId: project.id,
        userId: ctx.userId,
        fileName,
        category: "payment_app",
        description: `Payment Application #${payApp.applicationNumber}`,
        pdfBuffer,
        templateId: activeTemplate?.id ?? null,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "Payment Application PDF generated successfully",
      };
    }),

  /**
   * Generate an RFQ PDF for a Request for Quotation.
   *
   * 1. Looks up project by slug.
   * 2. Looks up RFQ by id; verifies it belongs to the project.
   * 3. Gets company name from public.tenants.
   * 4. Gets documentNamingSettings from active companyProfile.
   * 5. Increments the "rfq" sequence counter.
   * 6. Resolves PDF file name from naming settings.
   * 7. Builds RfqPdfData using actual RFQ schema fields.
   * 8. Calls buildRfqHtml().
   * 9. Renders PDF via Puppeteer (generatePdfBuffer).
   * 10. Uploads to S3 and inserts document + version rows with category "rfq".
   * 11. Returns { documentId, fileName, message }.
   */
  generateRfq: protectedProcedure
    .input(
      z.object({
        projectSlug: z.string(),
        rfqId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenant || !ctx.userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Tenant context missing",
        });
      }

      const { db, schema } = ctx.tenant;
      const tenantId = ctx.tenant.tenantId as string;

      // --- 1. Look up project by slug ---
      const [project] = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          jobNumber: schema.projects.jobNumber,
          street1: schema.projects.street1,
          city: schema.projects.city,
          state: schema.projects.state,
          zip: schema.projects.zip,
        })
        .from(schema.projects)
        .where(eq(schema.projects.slug, input.projectSlug))
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // --- 2. Look up RFQ and verify it belongs to this project ---
      const [rfq] = await db
        .select()
        .from(schema.rfqs)
        .where(eq(schema.rfqs.id, input.rfqId))
        .limit(1);

      if (!rfq || rfq.projectId !== project.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found for this project",
        });
      }

      // --- 3. Get company name from public.tenants ---
      const tenantResult = await db.execute(
        sql`SELECT name FROM public.tenants WHERE id = ${tenantId} LIMIT 1`
      );
      const companyName =
        (tenantResult.rows?.[0] as { name?: string } | undefined)?.name ??
        "Your Company";

      // --- 4. Fetch active company profile for naming settings ---
      const [companyProfile] = await db
        .select({
          documentNamingSettings: schema.companyProfiles.documentNamingSettings,
        })
        .from(schema.companyProfiles)
        .where(isNull(schema.companyProfiles.validTo))
        .limit(1);

      // --- 5. Get next sequence number ---
      const seq = await getNextDocumentSequence(db, schema, "rfq");

      // --- 6. Resolve file name ---
      const fileName = resolveFileName(
        companyProfile?.documentNamingSettings ?? null,
        "rfq",
        project.jobNumber ?? null,
        project.name,
        seq
      );

      // --- 7. Build RfqPdfData ---
      const addressParts = [project.street1, project.city, project.state, project.zip].filter(Boolean);
      const projectAddress =
        addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

      const generatedDate = formatGeneratedDate(new Date().toISOString());

      // Format dueDate as "Month DD, YYYY" or null if missing
      const dueDateFormatted = rfq.dueDate
        ? formatGeneratedDate(new Date(rfq.dueDate).toISOString())
        : null;

      // RFQ number: prefer schema rfqNumber, otherwise derive from sequence
      const rfqNumber = rfq.rfqNumber || `RFQ-${seq.toString().padStart(3, "0")}`;

      const pdfData: RfqPdfData = {
        companyName,
        projectName: project.name,
        jobNumber: project.jobNumber ?? null,
        projectAddress,
        rfqTitle: rfq.title,
        rfqNumber,
        scopeOfWork: rfq.scopeOfWork,
        dueDate: dueDateFormatted,
        description: rfq.description ?? null,
        generatedDate,
      };

      // --- 8. Check for active custom template (TMPL-06) ---
      const [activeTemplate] = await db
        .select()
        .from(schema.documentTemplates)
        .where(
          and(
            eq(schema.documentTemplates.docType, "rfq"),
            eq(schema.documentTemplates.isActive, true)
          )
        )
        .limit(1);

      // --- 9. Build HTML (custom template or built-in fallback) ---
      let html: string;
      if (activeTemplate?.fieldMappings?.length) {
        const realData: Record<string, string> = {
          "company.name": companyName,
          "company.primaryColor": "#3B5BDB",
          "project.name": pdfData.projectName,
          "project.address": pdfData.projectAddress,
          "project.jobNumber": project.jobNumber ?? "",
          "doc.rfqNumber": String(pdfData.rfqNumber ?? ""),
          "doc.rfqTitle": String(pdfData.rfqTitle ?? ""),
          "doc.submissionDeadline": String(pdfData.dueDate ?? ""),
          "doc.scopeOfWork": String(pdfData.scopeOfWork ?? ""),
          "doc.paymentTerms": "Net 30",
          "doc.generatedDate": pdfData.generatedDate,
        };
        html = buildCustomTemplateHtml(
          activeTemplate.fieldMappings as FieldMapping[],
          realData,
          [], // RFQ has no line items table
          false // isPreview=false — production
        );
      } else {
        html = buildRfqHtml(pdfData);
      }

      // --- 10. Generate PDF buffer via Puppeteer ---
      const pdfBuffer = await generatePdfBuffer(html);

      // --- 11. Upload to S3 + insert document record ---
      const result = await uploadPdfAndSave({
        db,
        schema,
        tenantId,
        projectId: project.id,
        userId: ctx.userId,
        fileName,
        category: "rfq",
        description: `RFQ: ${rfq.title || rfq.description || "Request for Quotation"}`,
        pdfBuffer,
        templateId: activeTemplate?.id ?? null,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "RFQ PDF generated successfully",
      };
    }),
});
