import { z } from "zod";
import {
  estimateStatusEnum,
  costTypeEnum,
  templateScopeEnum,
  markupBaseEnum,
  overheadTypeEnum,
  sovGroupingMethodEnum,
  unitEnum,
} from "../types/estimates";

/**
 * Create estimate schema
 */
export const createEstimateSchema = z.object({
  name: z.string().min(1).max(200),
  projectId: z.string().uuid(),
  projectType: z.enum(["commercial", "residential", "infrastructure", "industrial"]),
  description: z.string().max(2000).optional(),
});

/**
 * Update estimate schema
 */
export const updateEstimateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: estimateStatusEnum.optional(),
  overheadType: overheadTypeEnum.optional(),
  overheadValue: z.number().min(0).optional(),
  markupBase: markupBaseEnum.optional(),
});

/**
 * Create estimate line item schema
 */
export const createLineItemSchema = z.object({
  estimateId: z.string().uuid(),
  costCodeId: z.number().int().min(0),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit: unitEnum,
  unitCost: z.number().min(0),
  costType: costTypeEnum,
  customMarkupPercent: z.number().min(0).max(100).optional(),
});

/**
 * Update estimate line item schema
 */
export const updateLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().positive().optional(),
  unit: unitEnum.optional(),
  unitCost: z.number().min(0).optional(),
  costType: costTypeEnum.optional(),
  customMarkupPercent: z.number().min(0).max(100).nullable().optional(),
  costCodeId: z.number().int().min(0).optional(),
});

/**
 * Apply template to estimate schema
 */
export const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  estimateId: z.string().uuid(),
  overrides: z.object({
    applyLaborRates: z.boolean().default(false),
  }).optional(),
});

/**
 * Create cost code template schema
 */
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scope: templateScopeEnum,
  projectType: z.enum(["commercial", "residential", "infrastructure", "industrial"]).optional(),
});

/**
 * Create labor rate template schema
 */
export const createLaborRateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scope: templateScopeEnum,
  rates: z.record(z.string(), z.number().positive()), // { "Foreman": 65, "Carpenter": 45 }
});

/**
 * Generate SOV from estimate schema
 */
export const generateSOVSchema = z.object({
  estimateId: z.string().uuid(),
  groupingMethod: sovGroupingMethodEnum,
});

/**
 * Update SOV line item schema
 */
export const updateSOVLineItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
