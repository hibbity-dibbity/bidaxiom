import { PAYMENT_TERMS } from "../types/bidding";

/**
 * Customer import: turns rows from any spreadsheet into customers, given the column mapping the user set on screen.
 * Pure functions, used by the browser for the live preview and by the API as the authoritative check on import.
 */

export const CUSTOMER_IMPORT_FIELDS = [
  { key: "companyName", label: "Company name", hint: "Business name, if the customer is a company" },
  { key: "contactName", label: "Contact name", hint: "Full name of the person. Required unless you use the company name below" },
  { key: "firstName", label: "First name", hint: "Used with Last name when there is no single Contact name column" },
  { key: "lastName", label: "Last name", hint: "" },
  { key: "email", label: "Email", hint: "" },
  { key: "phone", label: "Phone", hint: "Reformatted to (555) 123-4567" },
  { key: "fullAddress", label: "Full address (one column)", hint: "Split into street, city, state and ZIP as well as possible" },
  { key: "street1", label: "Street", hint: "" },
  { key: "street2", label: "Street 2 / suite", hint: "" },
  { key: "city", label: "City", hint: "" },
  { key: "state", label: "State", hint: "Full names are converted to 2 letters" },
  { key: "zip", label: "ZIP", hint: "" },
  { key: "paymentTerms", label: "Payment terms", hint: "Due on receipt, Net 15, Net 30, Net 45, Net 60" },
] as const;

export type CustomerImportFieldKey = (typeof CUSTOMER_IMPORT_FIELDS)[number]["key"];
/** Field → index of the source column (undefined = not imported). */
export type CustomerImportMapping = Partial<Record<CustomerImportFieldKey, number>>;

export interface CustomerImportOptions {
  /** When a row has a company but no person, use the company name as the contact name. */
  useCompanyAsContact: boolean;
}

export interface ImportedCustomer {
  companyName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  paymentTerms: string | null;
}

export type RowStatus = "ready" | "warning" | "duplicate" | "error";

export interface ImportRowResult {
  /** 1-based row number in the source file, not counting the header. */
  rowNumber: number;
  status: RowStatus;
  messages: string[];
  customer: ImportedCustomer | null;
}

/** What already exists, for spotting duplicates. */
export interface ExistingCustomerKey {
  email: string | null;
  companyName: string | null;
  contactName: string;
}

const SYNONYMS: Record<CustomerImportFieldKey, string[]> = {
  companyName: ["company", "company name", "business", "business name", "organization", "organisation", "customer", "customer name", "client", "client name", "account", "account name", "name of company"],
  contactName: ["contact", "contact name", "full name", "primary contact", "person", "contact person", "name"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address", "e-mail address", "mail"],
  phone: ["phone", "phone number", "telephone", "tel", "mobile", "cell", "work phone", "business phone", "main phone"],
  fullAddress: ["address", "full address", "mailing address", "business address", "billing address"],
  street1: ["street", "street address", "address 1", "address1", "address line 1", "street 1", "street1", "addr1"],
  street2: ["address 2", "address2", "address line 2", "street 2", "street2", "suite", "unit", "apt", "addr2"],
  city: ["city", "town"],
  state: ["state", "st", "province", "state/province", "region"],
  zip: ["zip", "zip code", "zipcode", "postal code", "postal", "postcode"],
  paymentTerms: ["payment terms", "terms", "payment term", "net terms"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();
}

/** Best-guess mapping from the file's header names. The user reviews and corrects it on screen. */
export function suggestCustomerMapping(headers: string[]): CustomerImportMapping {
  const mapping: CustomerImportMapping = {};
  const used = new Set<number>();
  const normalized = headers.map(norm);
  // Exact matches first, so "Company" is not swallowed by a looser guess.
  for (const f of CUSTOMER_IMPORT_FIELDS) {
    const idx = normalized.findIndex((h, i) => !used.has(i) && SYNONYMS[f.key].some((syn) => norm(syn) === h));
    if (idx >= 0) {
      mapping[f.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const STATE_CODES = new Set(Object.values(STATES));

export function normalizeState(v: string): string | null {
  const t = v.trim().replace(/\./g, "");
  if (!t) return null;
  const up = t.toUpperCase();
  if (up.length === 2 && STATE_CODES.has(up)) return up;
  return STATES[t.toLowerCase()] ?? null;
}

export function normalizePhone(v: string): string | null {
  // Drop an extension, then keep digits.
  const base = v.replace(/\s*(ext\.?|x|extension)\s*\d+.*$/i, "");
  let d = base.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function normalizeZip(v: string): string | null {
  let t = v.trim();
  if (!t) return null;
  if (/^\d{4}$/.test(t)) t = "0" + t; // spreadsheets drop leading zeros
  if (/^\d{9}$/.test(t)) t = `${t.slice(0, 5)}-${t.slice(5)}`;
  return /^\d{5}(-\d{4})?$/.test(t) ? t : null;
}

function normalizeTerms(v: string): string | null {
  const t = v.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!t) return null;
  for (const term of PAYMENT_TERMS) if (term.toLowerCase().replace(/[^a-z0-9]/g, "") === t) return term;
  const days = t.match(/^(?:net)?(\d+)(?:days?)?$/);
  if (days) {
    const m = PAYMENT_TERMS.find((x) => x === `Net ${days[1]}`);
    if (m) return m;
  }
  if (t === "cod" || t === "receipt" || t === "immediate") return "Due on receipt";
  return null;
}

/** "123 Main St, Suite 4, Springfield, IL 62704" → parts. Best effort; the preview shows the result. */
export function splitFullAddress(v: string): Partial<Pick<ImportedCustomer, "street1" | "street2" | "city" | "state" | "zip">> {
  let t = v.replace(/\r?\n/g, ", ").replace(/\s+/g, " ").trim().replace(/,\s*(USA|US|United States)$/i, "");
  if (!t) return {};
  const out: Partial<Pick<ImportedCustomer, "street1" | "street2" | "city" | "state" | "zip">> = {};
  const m = t.match(/[,\s]\s*([A-Za-z][A-Za-z .]*?)[,\s]+(\d{5}(?:-\d{4})?)$/);
  if (m) {
    const st = normalizeState(m[1]);
    if (st) {
      out.state = st;
      out.zip = m[2];
      t = t.slice(0, m.index).replace(/[,\s]+$/, "");
    }
  }
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return out;
  if (parts.length === 1) {
    out.street1 = parts[0];
  } else {
    out.city = parts[parts.length - 1];
    out.street1 = parts[0];
    if (parts.length > 2) out.street2 = parts.slice(1, -1).join(", ");
    // "190 Jester Blvd., Suite 200 Houston": the suite ran into the city with no comma between them.
    const run = out.city.match(/^((?:suite|ste|unit|apt|bldg|building|floor|fl|room|rm|#)\.?\s*[\w-]+)\s+(\S.*)$/i);
    if (run) {
      out.street2 = [out.street2, run[1]].filter(Boolean).join(", ");
      out.city = run[2];
    }
  }
  return out;
}

/** Values systems put in a cell to mean "nothing". */
const PLACEHOLDERS = new Set(["no address", "n/a", "na", "none", "null", "unknown", "tbd", "tba", "-", "--", "no email", "no phone", "not provided"]);
const clean = (v: unknown): string => {
  const t = (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
  return PLACEHOLDERS.has(t.toLowerCase()) ? "" : t;
};
const dupKeyEmail = (e: string | null) => (e ? e.toLowerCase() : "");
const dupKeyName = (company: string | null, contact: string) => `${(company ?? "").toLowerCase()}|${contact.toLowerCase()}`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 200, street: 200, city: 100, email: 200 };

/** Apply the mapping to every row. Nothing is saved here. */
export function buildCustomerRows(
  rows: string[][],
  mapping: CustomerImportMapping,
  options: CustomerImportOptions,
  existing: ExistingCustomerKey[]
): ImportRowResult[] {
  const seenEmail = new Set<string>();
  const seenName = new Set<string>();
  for (const e of existing) {
    if (e.email) seenEmail.add(dupKeyEmail(e.email));
    seenName.add(dupKeyName(e.companyName, e.contactName));
  }

  const get = (row: string[], key: CustomerImportFieldKey): string => {
    const idx = mapping[key];
    return idx === undefined ? "" : clean(row[idx]);
  };

  return rows.map((row, i): ImportRowResult => {
    const rowNumber = i + 1;
    const messages: string[] = [];
    let warn = false;

    const companyName = get(row, "companyName") || null;
    let contactName = get(row, "contactName");
    if (!contactName) contactName = [get(row, "firstName"), get(row, "lastName")].filter(Boolean).join(" ");
    if (!contactName && companyName && options.useCompanyAsContact) contactName = companyName;

    if (!contactName) {
      return { rowNumber, status: "error", messages: ["No contact name (and no company name to use instead)"], customer: null };
    }

    let email: string | null = get(row, "email").toLowerCase() || null;
    if (email && !EMAIL.test(email)) {
      // Lists often hold several addresses in one cell; take the first valid one.
      const first = email.split(/[;, ]+/).find((e) => EMAIL.test(e));
      if (first) {
        messages.push(`Several emails in one cell; kept ${first}`);
      } else {
        messages.push(`Email "${email}" is not valid and was left blank`);
        email = null;
      }
      if (first) email = first;
      warn = true;
    }

    let phone: string | null = null;
    const phoneRaw = get(row, "phone");
    if (phoneRaw) {
      phone = normalizePhone(phoneRaw);
      if (!phone) {
        messages.push(`Phone "${phoneRaw}" is not a 10-digit number and was left blank`);
        warn = true;
      }
    }

    let street1 = get(row, "street1") || null;
    let street2 = get(row, "street2") || null;
    let city = get(row, "city") || null;
    let stateRaw = get(row, "state");
    let zipRaw = get(row, "zip");
    const full = get(row, "fullAddress");
    if (full) {
      const parts = splitFullAddress(full);
      street1 = street1 ?? parts.street1 ?? null;
      street2 = street2 ?? parts.street2 ?? null;
      city = city ?? parts.city ?? null;
      stateRaw = stateRaw || parts.state || "";
      zipRaw = zipRaw || parts.zip || "";
    }

    let state: string | null = null;
    if (stateRaw) {
      state = normalizeState(stateRaw);
      if (!state) {
        messages.push(`State "${stateRaw}" was not recognized and was left blank`);
        warn = true;
      }
    }
    let zip: string | null = null;
    if (zipRaw) {
      zip = normalizeZip(zipRaw);
      if (!zip) {
        messages.push(`ZIP "${zipRaw}" is not valid and was left blank`);
        warn = true;
      }
    }

    let paymentTerms: string | null = null;
    const termsRaw = get(row, "paymentTerms");
    if (termsRaw) {
      paymentTerms = normalizeTerms(termsRaw);
      if (!paymentTerms) {
        messages.push(`Payment terms "${termsRaw}" don't match a BidAxiom option and were left blank`);
        warn = true;
      }
    }

    const cap = (v: string | null, n: number, label: string) => {
      if (v && v.length > n) {
        messages.push(`${label} was longer than ${n} characters and was shortened`);
        warn = true;
        return v.slice(0, n);
      }
      return v;
    };
    const customer: ImportedCustomer = {
      companyName: cap(companyName, LIMITS.name, "Company name"),
      contactName: cap(contactName, LIMITS.name, "Contact name")!,
      email: cap(email, LIMITS.email, "Email"),
      phone,
      street1: cap(street1, LIMITS.street, "Street"),
      street2: cap(street2, LIMITS.street, "Street 2"),
      city: cap(city, LIMITS.city, "City"),
      state,
      zip,
      paymentTerms,
    };

    const byEmail = customer.email && seenEmail.has(dupKeyEmail(customer.email));
    const byName = seenName.has(dupKeyName(customer.companyName, customer.contactName));
    if (byEmail || byName) {
      messages.unshift(byEmail ? "Same email as an existing or earlier customer" : "Same company and contact as an existing or earlier customer");
      return { rowNumber, status: "duplicate", messages, customer };
    }
    if (customer.email) seenEmail.add(dupKeyEmail(customer.email));
    seenName.add(dupKeyName(customer.companyName, customer.contactName));

    return { rowNumber, status: warn ? "warning" : "ready", messages, customer };
  });
}
