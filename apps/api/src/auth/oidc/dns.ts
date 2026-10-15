import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";

export const TXT_PREFIX = "_bidaxiom-verify";

export const newDomainToken = () => randomBytes(18).toString("hex");
export const txtName = (domain: string) => `${TXT_PREFIX}.${domain}`;
export const txtValue = (token: string) => `bidaxiom-verify=${token}`;

/** True when the domain publishes the company's token. */
export async function domainHasToken(domain: string, token: string): Promise<boolean> {
  try {
    const records = await resolveTxt(txtName(domain));
    return records.some((chunks) => chunks.join("") === txtValue(token));
  } catch {
    return false;
  }
}
