/**
 * Dates in emails and server-written messages are shown in the company's time zone, not the server's (UTC).
 * Set COMPANY_TIMEZONE to an IANA name to change it; there is no per-company setting yet.
 */
export const COMPANY_TIMEZONE = process.env.COMPANY_TIMEZONE || "America/Chicago";

export function formatCompanyDateTime(date: Date | string | number = new Date(), opts: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" }): string {
  const d = new Date(date);
  return `${d.toLocaleString("en-US", { ...opts, timeZone: COMPANY_TIMEZONE })} ${tzAbbrev(d)}`;
}

function tzAbbrev(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: COMPANY_TIMEZONE, timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "";
}
