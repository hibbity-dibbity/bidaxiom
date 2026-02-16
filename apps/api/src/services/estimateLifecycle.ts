import type { EstimateStatus, BidStatus } from "@construction/shared";

/**
 * Valid status transitions for estimates
 * Implements state machine pattern for estimate lifecycle
 */
const VALID_ESTIMATE_TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ["submitted"],
  submitted: ["accepted", "draft"], // Can revert if not accepted
  accepted: ["under_contract"],
  under_contract: [], // Terminal state
};

/**
 * Valid status transitions for bids
 * Implements state machine pattern for bid lifecycle
 */
const VALID_BID_TRANSITIONS: Record<BidStatus, BidStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["won", "lost", "withdrawn"],
  won: [], // Terminal state
  lost: [], // Terminal state
  withdrawn: [], // Terminal state
};

/**
 * Check if an estimate can transition from one status to another
 */
export function canTransitionEstimate(from: EstimateStatus, to: EstimateStatus): boolean {
  return VALID_ESTIMATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a bid can transition from one status to another
 */
export function canTransitionBid(from: BidStatus, to: BidStatus): boolean {
  return VALID_BID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get list of valid status transitions for an estimate
 */
export function getValidEstimateTransitions(status: EstimateStatus): EstimateStatus[] {
  return VALID_ESTIMATE_TRANSITIONS[status] ?? [];
}

/**
 * Get list of valid status transitions for a bid
 */
export function getValidBidTransitions(status: BidStatus): BidStatus[] {
  return VALID_BID_TRANSITIONS[status] ?? [];
}
