import { isNull } from "drizzle-orm";
import type { buildTenantContext } from "../tenant/context.js";

type Tenant = NonNullable<Awaited<ReturnType<typeof buildTenantContext>>>;

/** Phone, website and mailing address lines of the company, for the top of printed documents. */
export async function companyContactLines(tenant: Tenant): Promise<string[]> {
  const { db, schema } = tenant;
  const [p] = await db
    .select({
      phone: schema.companyProfiles.phone,
      website: schema.companyProfiles.website,
      street1: schema.companyProfiles.street1,
      street2: schema.companyProfiles.street2,
      city: schema.companyProfiles.city,
      state: schema.companyProfiles.state,
      zip: schema.companyProfiles.zip,
    })
    .from(schema.companyProfiles)
    .where(isNull(schema.companyProfiles.validTo))
    .limit(1);
  const cityState = [p?.city, [p?.state, p?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [p?.phone, p?.website, [[p?.street1, p?.street2].filter(Boolean).join(" "), cityState].filter(Boolean).join(", ")].filter(
    (v): v is string => Boolean(v && v.trim())
  );
}
