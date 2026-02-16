// Reusable validation primitives
export * from "./common";

// Entity schemas
export * from "./estimates";

// Re-export entity schemas from types/ for convenience
// This allows import { createProjectSchema } from "@construction/shared/schemas"
// instead of import { createProjectSchema } from "@construction/shared/types"
export {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  teamMemberSchema,
  projectPhaseSchema,
  projectTypeEnum,
  projectStatusEnum,
  projectRoleEnum,
  phaseStatusEnum,
} from "../types/project";

export {
  createCustomerSchema,
  updateCustomerSchema,
} from "../types/customer";

export {
  createBudgetLineItemSchema,
  updateBudgetLineItemSchema,
  createCommitmentSchema,
  updateCommitmentSchema,
  commitmentTypeEnum,
  commitmentStatusEnum,
} from "../types/budget";

export {
  createChangeOrderSchema,
  updateChangeOrderSchema,
  submitForApprovalSchema,
  approveRejectSchema,
  changeOrderLineItemSchema,
  changeOrderTypeEnum,
  changeOrderStatusEnum,
  internalReasonEnum,
} from "../types/change-order";

export {
  createRfqSchema,
  updateRfqSchema,
  submitBidSchema,
  updateBidVersionSchema,
  awardBidSchema,
  createSubcontractorSchema,
  updateSubcontractorSchema,
  createInvitationSchema,
  createLevelingNoteSchema,
  bidLineItemSchema,
  rfqStatusEnum,
  bidStatusEnum,
  subcontractorStatusEnum,
} from "../types/bidding";
