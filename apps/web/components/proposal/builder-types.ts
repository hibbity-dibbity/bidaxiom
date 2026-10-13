import type { CostLineType } from "@construction/shared";

export type Visibility = "price" | "name_only" | "hidden";

export interface BuilderLine {
  id: string;
  parentId: string | null;
  type: CostLineType;
  name: string;
  costCodeId: number | null;
  quantity: number;
  unit: string;
  unitCost: number;
  marginPercent: number;
  visibility: Visibility;
  isOptional: boolean;
  vendorId: string | null;
}

export interface BuilderGlobal {
  id: string;
  name: string;
  amount: number;
}

export interface BuilderMilestone {
  id: string;
  name: string;
  percent: number;
}

export interface BuilderSettings {
  name: string;
  salesTaxPercent: number;
  paymentTerms: string;
  validDays: number;
}

export const COST_TYPES: Array<{ value: CostLineType; label: string; creates: string }> = [
  { value: "labor", label: "Labor", creates: "Labor, creates a work order line" },
  { value: "material", label: "Material", creates: "Material, creates a purchase order line" },
  { value: "subcontractor", label: "Subcontractor", creates: "Subcontractor, creates a work order line" },
  { value: "equipment", label: "Equipment", creates: "Equipment" },
  { value: "other", label: "Other", creates: "Other, no cost code and no order created" },
];

export const VISIBILITY_NEXT: Record<Visibility, Visibility> = {
  price: "name_only",
  name_only: "hidden",
  hidden: "price",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  price: "Price shown",
  name_only: "Name only",
  hidden: "Hidden",
};

export const VISIBILITY_TONE: Record<Visibility, string> = {
  price: "text-financial-positive",
  name_only: "text-muted-foreground",
  hidden: "text-financial-pending",
};

export const MAX_MARGIN = 95;
