import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, isNull, sql } from "drizzle-orm";
import { router } from "../trpc.js";
import { protectedProcedure } from "../procedures.js";
import { buildProposalHtml, type ProposalPdfData } from "../../pdf/templates/proposal.js";
import { buildChangeOrderHtml, type ChangeOrderPdfData } from "../../pdf/templates/change-order.js";
import {
  getNextDocumentSequence,
  resolveFileName,
  uploadPdfAndSave,
} from "../../pdf/generate.js";
import { generatePdfBuffer } from "../../pdf/engine.js";

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

      // --- 7. Build HTML ---
      const html = buildProposalHtml(pdfData);

      // --- 8. Generate PDF buffer via Puppeteer ---
      const pdfBuffer = await generatePdfBuffer(html);

      // --- 9. Upload to S3 + insert document record ---
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

      // --- 9. Build HTML ---
      const html = buildChangeOrderHtml(pdfData);

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
        category: "change_order",
        description: `Change Order ${coNumberDisplay}: ${changeOrder.title}`,
        pdfBuffer,
      });

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        message: "Change Order PDF generated successfully",
      };
    }),
});
