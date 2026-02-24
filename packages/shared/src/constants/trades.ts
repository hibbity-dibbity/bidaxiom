import { z } from "zod";

export const SIMPLE_TRADES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Concrete",
  "Metal Buildings",
  "Framing",
  "Roofing",
  "Painting",
  "Flooring",
  "Drywall",
  "General",
  "Other",
] as const;

export type TradeValue = (typeof SIMPLE_TRADES)[number];
export const tradeValueEnum = z.enum(SIMPLE_TRADES);
