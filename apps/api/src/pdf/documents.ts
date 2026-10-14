import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { buildTenantContext } from "../tenant/context.js";
import { renderWebPageToPdf, type PdfViewer } from "./render.js";

type Tenant = NonNullable<Awaited<ReturnType<typeof buildTenantContext>>>;

export type PdfKind = "proposal" | "invoice" | "order";

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();

/**
 * Print one customer-facing document to PDF. Proposals and change orders are the customer view,
 * invoices are the invoice page, and orders are the purchase or work order for the vendor.
 */
export async function renderDocumentPdf(
  tenant: Tenant,
  viewer: PdfViewer,
  kind: PdfKind,
  id: string
): Promise<{ filename: string; buffer: Buffer }> {
  const { db, schema } = tenant;
  const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "Document not found." });
  const projectOf = async (projectId: string) => {
    const [p] = await db.select({ slug: schema.projects.slug, jobNumber: schema.projects.jobNumber, name: schema.projects.name }).from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!p?.slug) throw notFound();
    return p as { slug: string; jobNumber: string | null; name: string };
  };

  let path: string;
  let selector: string;
  let filename: string;
  if (kind === "proposal") {
    const [e] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, id));
    if (!e || !e.slug) throw notFound();
    const p = await projectOf(e.projectId);
    const co = e.kind === "change_order";
    path = `/projects/${p.slug}/${co ? "change-orders" : "estimates"}/${e.slug}/preview`;
    selector = "#proposal-doc";
    const rev = e.revision > 0 ? ` Rev ${e.revision}` : "";
    filename = co ? `${e.number ?? "Change Order"}${rev} - ${e.name}` : `${p.jobNumber ? `${p.jobNumber} ` : ""}Proposal${rev} - ${e.name}`;
  } else if (kind === "invoice") {
    const [i] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (!i) throw notFound();
    const p = await projectOf(i.projectId);
    path = `/projects/${p.slug}/invoices/${i.id}`;
    selector = "#invoice-doc";
    filename = i.number;
  } else {
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
    if (!o) throw notFound();
    const p = await projectOf(o.projectId);
    path = `/projects/${p.slug}/orders/${o.id}/document`;
    selector = "#order-doc";
    filename = `${o.number}${o.revision > 0 ? ` Rev ${o.revision}` : ""}`;
  }
  const buffer = await renderWebPageToPdf(viewer, path, selector);
  return { filename: `${safe(filename)}.pdf`, buffer };
}
