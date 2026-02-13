import { router } from "./trpc.js";
import { healthRouter } from "./routers/health.js";
import { tenantRouter } from "./routers/tenant.js";
import { auditRouter } from "./routers/audit.js";
import { companyRouter } from "./routers/company.js";
import { customerRouter } from "./routers/customer.js";
import { userRouter } from "./routers/user.js";
import { projectRouter } from "./routers/project.js";
import { documentRouter } from "./routers/document.js";
import { budgetRouter } from "./routers/budget.js";
import { commitmentRouter } from "./routers/commitment.js";
import { changeOrderRouter } from "./routers/change-order.js";
import { sovRouter } from "./routers/sov.js";
import { paymentAppRouter } from "./routers/payment-app.js";
import { lienWaiverRouter } from "./routers/lien-waiver.js";
import { invoiceTrackingRouter } from "./routers/invoice-tracking.js";
import { rfqRouter } from "./routers/rfq.js";
import { subcontractorRouter } from "./routers/subcontractor.js";
import { bidRouter } from "./routers/bid.js";

/**
 * Root application router.
 * All sub-routers are merged here.
 *
 * Future routers (budgets, bids) will use withAuditLog
 * middleware for sensitive actions (financial changes, bid submissions, etc.)
 */
export const appRouter = router({
  health: healthRouter,
  tenant: tenantRouter,
  audit: auditRouter,
  company: companyRouter,
  customer: customerRouter,
  user: userRouter,
  project: projectRouter,
  document: documentRouter,
  budget: budgetRouter,
  commitment: commitmentRouter,
  changeOrder: changeOrderRouter,
  sov: sovRouter,
  paymentApp: paymentAppRouter,
  lienWaiver: lienWaiverRouter,
  invoiceTracking: invoiceTrackingRouter,
  rfq: rfqRouter,
  subcontractor: subcontractorRouter,
  bid: bidRouter,
});

/**
 * AppRouter type — exported for client-side type inference.
 * This type is imported by the web package for end-to-end type safety.
 */
export type AppRouter = typeof appRouter;
