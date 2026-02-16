/**
 * Verification script for estimate calculations
 * Run with: npx tsx apps/api/src/services/test-estimate-calculations.ts
 */

import {
  calculateEstimateTotals,
  calculateLineItemMarkup,
  type EstimateLineItem,
  type MarkupConfig,
  type OverheadConfig,
} from "./estimateCalculations";

// Test 1: Basic calculation with company defaults
console.log("=== Test 1: Basic calculation with company defaults ===");

const config1: MarkupConfig = {
  companyDefaults: {
    laborMarkup: 20,
    materialMarkup: 15,
    equipmentMarkup: 10,
    subcontractorMarkup: 5,
  },
  markupBaseType: "direct",
};

const overhead1: OverheadConfig = {
  type: "percentage",
  value: 10, // 10% overhead
};

const lineItems1: EstimateLineItem[] = [
  {
    id: "1",
    quantity: "100",
    unitCost: "50",
    costType: "labor",
  },
  {
    id: "2",
    quantity: "200",
    unitCost: "25",
    costType: "material",
  },
];

const result1 = calculateEstimateTotals(lineItems1, config1, overhead1);

console.log("Line items:");
console.log("  Labor: 100 * $50 = $5,000");
console.log("  Material: 200 * $25 = $5,000");
console.log("Expected direct costs: $10,000");
console.log("Actual direct costs:", result1.directCosts);

console.log("\nExpected overhead (10% of $10,000): $1,000");
console.log("Actual overhead:", result1.overhead);

console.log("\nExpected markup:");
console.log("  Labor (20% of $5,000): $1,000");
console.log("  Material (15% of $5,000): $750");
console.log("  Total: $1,750");
console.log("Actual total markup:", result1.totalMarkup);

console.log("\nExpected total cost: $10,000 + $1,000 + $1,750 = $12,750");
console.log("Actual total cost:", result1.totalCost);

console.log("\nExpected margin %: ($1,750 / $12,750) * 100 = 13.73%");
console.log("Actual margin %:", result1.marginPercent);

// Test 2: Override cascade
console.log("\n\n=== Test 2: Override cascade ===");

const config2: MarkupConfig = {
  companyDefaults: {
    laborMarkup: 20,
    materialMarkup: 15,
    equipmentMarkup: 10,
    subcontractorMarkup: 5,
  },
  estimateOverrides: {
    labor: 25, // Override labor to 25%
  },
  markupBaseType: "direct",
};

const lineItems2: EstimateLineItem[] = [
  {
    id: "1",
    quantity: "100",
    unitCost: "50",
    costType: "labor",
    customMarkupPercent: "30", // Line item override
  },
  {
    id: "2",
    quantity: "100",
    unitCost: "50",
    costType: "labor",
    // No line item override, should use estimate override (25%)
  },
  {
    id: "3",
    quantity: "100",
    unitCost: "50",
    costType: "material",
    // No overrides, should use company default (15%)
  },
];

console.log("Line item 1 markup (line item override):");
console.log("Expected: 30%");
console.log("Actual:", calculateLineItemMarkup(lineItems2[0], config2));

console.log("\nLine item 2 markup (estimate override):");
console.log("Expected: 25%");
console.log("Actual:", calculateLineItemMarkup(lineItems2[1], config2));

console.log("\nLine item 3 markup (company default):");
console.log("Expected: 15%");
console.log("Actual:", calculateLineItemMarkup(lineItems2[2], config2));

// Test 3: Markup base with overhead
console.log("\n\n=== Test 3: Markup base with overhead ===");

const config3: MarkupConfig = {
  companyDefaults: {
    laborMarkup: 20,
    materialMarkup: 15,
    equipmentMarkup: 10,
    subcontractorMarkup: 5,
  },
  markupBaseType: "direct_plus_overhead",
};

const overhead3: OverheadConfig = {
  type: "percentage",
  value: 10,
};

const lineItems3: EstimateLineItem[] = [
  {
    id: "1",
    quantity: "100",
    unitCost: "50",
    costType: "labor",
  },
];

const result3 = calculateEstimateTotals(lineItems3, config3, overhead3);

console.log("Direct costs: $5,000");
console.log("Overhead (10%): $500");
console.log("Markup base (direct + overhead): $5,500");
console.log("\nNote: Even with 'direct_plus_overhead' markup base,");
console.log("markup is still calculated per line item on direct costs.");
console.log("\nExpected markup (20% of $5,000): $1,000");
console.log("Actual markup:", result3.totalMarkup);

console.log("\nExpected total: $5,000 + $500 + $1,000 = $6,500");
console.log("Actual total:", result3.totalCost);

// Test 4: Fixed overhead
console.log("\n\n=== Test 4: Fixed overhead ===");

const config4: MarkupConfig = {
  companyDefaults: {
    laborMarkup: 20,
    materialMarkup: 15,
    equipmentMarkup: 10,
    subcontractorMarkup: 5,
  },
  markupBaseType: "direct",
};

const overhead4: OverheadConfig = {
  type: "fixed",
  value: 2000, // Fixed $2,000 overhead
};

const lineItems4: EstimateLineItem[] = [
  {
    id: "1",
    quantity: "100",
    unitCost: "50",
    costType: "labor",
  },
];

const result4 = calculateEstimateTotals(lineItems4, config4, overhead4);

console.log("Direct costs: $5,000");
console.log("Expected overhead (fixed): $2,000");
console.log("Actual overhead:", result4.overhead);

console.log("\nExpected total: $5,000 + $2,000 + $1,000 = $8,000");
console.log("Actual total:", result4.totalCost);

console.log("\n=== All tests complete ===");
