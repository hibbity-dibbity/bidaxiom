import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { healthRouter } from "./routers/health.js";
import { auditRouter } from "./routers/audit.js";
import { companyRouter } from "./routers/company.js";
import { customerRouter } from "./routers/customer.js";
import { dashboardRouter } from "./routers/dashboard.js";
import { userRouter } from "./routers/user.js";
import { projectRouter } from "./routers/project.js";
import { documentRouter } from "./routers/document.js";
import { pdfRouter } from "./routers/pdf.js";
import { invoiceRouter } from "./routers/invoice.js";
import { subcontractorRouter } from "./routers/subcontractor.js";
import { quickbooksRouter } from "./routers/quickbooks.js";
import { workflowRouter } from "./routers/workflow.js";
import { reportRouter } from "./routers/report.js";
import { reportExportRouter } from "./routers/report-export.js";
import { reportScheduleRouter } from "./routers/report-schedule.js";
import { calendarRouter } from "./routers/calendar.js";
import { organizationRouter } from "./routers/organization.js";
import { searchRouter } from "./routers/search.js";
import { estimatesRouter } from "./routers/estimates.js";
import { proposalRouter } from "./routers/proposal.js";
import { emailRouter } from "./routers/email.js";
import { termsRouter } from "./routers/terms.js";
import { orderRouter } from "./routers/order.js";
import { templateRouter } from "./routers/template.js";
import { notesRouter } from "./routers/notes.js";
import { takeoffRouter } from "./routers/takeoff.js";
import { ssoRouter } from "./routers/sso.js";
import { attentionRouter } from "./routers/attention.js";
import { signingRouter } from "./routers/signing.js";
import { passkeyRouter } from "./routers/passkey.js";
import { platformRouter } from "./routers/platform.js";

/**
 * Root application router.
 * All sub-routers are merged here.
 *
 * Future routers (budgets, bids) will use withAuditLog
 * middleware for sensitive actions (financial changes, bid submissions, etc.)
 */
export const appRouter = router({
  auth: authRouter,
  platform: platformRouter,
  health: healthRouter,
  audit: auditRouter,
  company: companyRouter,
  customer: customerRouter,
  dashboard: dashboardRouter,
  user: userRouter,
  organization: organizationRouter,
  project: projectRouter,
  document: documentRouter,
  pdf: pdfRouter,
  email: emailRouter,
  invoice: invoiceRouter,
  subcontractor: subcontractorRouter,
  quickbooks: quickbooksRouter,
  workflow: workflowRouter,
  report: reportRouter,
  reportExport: reportExportRouter,
  reportSchedule: reportScheduleRouter,
  calendar: calendarRouter,
  search: searchRouter,
  estimates: estimatesRouter,
  proposal: proposalRouter,
  terms: termsRouter,
  order: orderRouter,
  attention: attentionRouter,
  template: templateRouter,
  notes: notesRouter,
  takeoff: takeoffRouter,
  sso: ssoRouter,
  passkey: passkeyRouter,
  signing: signingRouter,
});

/**
 * AppRouter type — exported for client-side type inference.
 * This type is imported by the web package for end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
