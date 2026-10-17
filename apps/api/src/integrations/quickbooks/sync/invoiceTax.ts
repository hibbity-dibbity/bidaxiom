/**
 * Sales tax on an invoice. BidAxiom stores one amount per invoice (tax included); the tax is the invoice's share of the
 * proposal or change order it came from. QuickBooks needs the taxable part, the rest, and the tax code, and then works the
 * tax out itself from its rate, so the pieces here are chosen to make that come to exactly BidAxiom's tax.
 */
const cents = (n: number) => Math.round(n * 100);

export interface TaxSplit {
  taxable: number; // dollars of the invoice that QuickBooks should tax
  rest: number; // dollars that are not taxed
  tax: number; // dollars of sales tax inside the invoice amount
  ratePct: number; // the proposal's sales tax rate
}

/** The tax inside `amount` dollars of the given proposal or change order, and the part of the amount it applies to. */
export async function splitInvoiceAmount(tenant: any, estimateId: string, amount: number): Promise<TaxSplit> {
  const { loadComputed } = await import('../../../trpc/routers/proposal.js');
  const { applyAcceptance } = await import('@construction/shared');
  const c = await loadComputed(tenant, estimateId);
  const accepted = c.lines.filter((l: any) => l.isOptional && l.optionAccepted === true).map((l: any) => l.id);
  const a = applyAcceptance(c.result, accepted);
  const taxCents = c.result.totals.tax + a.optionsTax;
  const rate = Number(c.estimate.salesTaxPercent) / 100;
  if (taxCents <= 0 || rate <= 0 || a.contractValue <= 0) return { taxable: 0, rest: amount, tax: 0, ratePct: 0 };
  const tax = cents(amount) * taxCents / a.contractValue / 100;
  const taxRounded = Math.round(tax * 100) / 100;
  let taxable = Math.round((taxRounded / rate) * 100) / 100;
  const maxTaxable = Math.round((amount - taxRounded) * 100) / 100;
  if (taxable > maxTaxable) taxable = maxTaxable;
  return { taxable, rest: Math.round((amount - taxRounded - taxable) * 100) / 100, tax: taxRounded, ratePct: rate * 100 };
}

/** The combined rate (percent) of a QuickBooks sales tax code, or null when it cannot be read. */
export async function qboTaxCodeRate(accessToken: string, realmId: string, taxCodeId: string): Promise<number | null> {
  const { qboQueryRows, qboQuote } = await import('../client.js');
  try {
    const [code] = await qboQueryRows<any>(accessToken, realmId, 'TaxCode', `select * from TaxCode where Id = ${qboQuote(taxCodeId)}`);
    const refs: string[] = ((code?.SalesTaxRateList?.TaxRateDetail ?? []) as any[]).map((d) => String(d.TaxRateRef?.value));
    if (!refs.length) return null;
    const rates = await qboQueryRows<any>(accessToken, realmId, 'TaxRate', 'select * from TaxRate MAXRESULTS 500');
    const byId = new Map(rates.map((r) => [String(r.Id), Number(r.RateValue ?? 0)]));
    return Math.round(refs.reduce((a, id) => a + (byId.get(id) ?? 0), 0) * 1000) / 1000;
  } catch {
    return null;
  }
}
