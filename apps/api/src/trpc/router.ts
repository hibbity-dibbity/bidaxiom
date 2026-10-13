import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { healthRouter } from "./routers/health.js";
import { tenantRouter } from "./routers/tenant.js";
import { auditRouter } from "./routers/audit.js";
import { companyRouter } from "./routers/company.js";
import { customerRouter } from "./routers/customer.js";
import { dashboardRouter } from "./routers/dashboard.js";
import { userRouter } from "./routers/user.js";
import { projectRouter } from "./routers/project.js";
import { documentRouter } from "./routers/document.js";
import { budgetRouter } from "./routers/budget.js";
import { commitmentRouter } from "./routers/commitment.js";
import { changeOrderRouter } from "./routers/change-order.js";
import { sovRouter } from "./routers/sov.js";
import { paymentAppRouter } from "./routers/payment-app.js";
import { pdfRouter } from "./routers/pdf.js";
import { lienWaiverRouter } from "./routers/lien-waiver.js";
import { invoiceTrackingRouter } from "./routers/invoice-tracking.js";
import { rfqRouter } from "./routers/rfq.js";
import { subcontractorRouter } from "./routers/subcontractor.js";
import { bidRouter } from "./routers/bid.js";
import { quickbooksRouter } from "./routers/quickbooks.js";
import { workflowRouter } from "./routers/workflow.js";
import { reportRouter } from "./routers/report.js";
import { reportExportRouter } from "./routers/report-export.js";
import { reportScheduleRouter } from "./routers/report-schedule.js";
import { calendarRouter } from "./routers/calendar.js";
import { organizationRouter } from "./routers/organization.js";
import { searchRouter } from "./routers/search.js";
import { estimatesRouter } from "./routers/estimates.js";
import { estimateTemplatesRouter } from "./routers/estimateTemplates.js";
import { proposalRouter } from "./routers/proposal.js";
import { templateRouter } from "./routers/template.js";
import { notesRouter } from "./routers/notes.js";

/**
 * Root application router.
 * All sub-routers are merged here.
 *
 * Future routers (budgets, bids) will use withAuditLog
 * middleware for sensitive actions (financial changes, bid submissions, etc.)
 */
export const appRouter = router({
  auth: authRouter,
  health: healthRouter,
  tenant: tenantRouter,
  audit: auditRouter,
  company: companyRouter,
  customer: customerRouter,
  dashboard: dashboardRouter,
  user: userRouter,
  organization: organizationRouter,
  project: projectRouter,
  document: documentRouter,
  budget: budgetRouter,
  commitment: commitmentRouter,
  changeOrder: changeOrderRouter,
  sov: sovRouter,
  paymentApp: paymentAppRouter,
  pdf: pdfRouter,
  lienWaiver: lienWaiverRouter,
  invoiceTracking: invoiceTrackingRouter,
  rfq: rfqRouter,
  subcontractor: subcontractorRouter,
  bid: bidRouter,
  quickbooks: quickbooksRouter,
  workflow: workflowRouter,
  report: reportRouter,
  reportExport: reportExportRouter,
  reportSchedule: reportScheduleRouter,
  calendar: calendarRouter,
  search: searchRouter,
  estimates: estimatesRouter,
  estimateTemplates: estimateTemplatesRouter,
  proposal: proposalRouter,
  template: templateRouter,
  notes: notesRouter,
});

/**
 * AppRouter type — exported for client-side type inference.
 * This type is imported by the web package for end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
