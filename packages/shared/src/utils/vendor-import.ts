import { PAYMENT_TERMS } from "../types/bidding";
import { SIMPLE_TRADES } from "../constants/trades";
import { normalizePhone, normalizeState, splitFullAddress } from "./customer-import";

/**
 * Subs & Vendors import: turns rows from any spreadsheet (QuickBooks vendor exports in particular) into directory entries,
 * given the column mapping the user set on screen. Pure functions, used by the browser for the live preview and by the API
 * as the authoritative check on import.
 */

export const VENDOR_IMPORT_FIELDS = [
  { key: "companyName", label: "Company name", hint: "Required. QuickBooks: Vendor, Company or Display name" },
  { key: "contactName", label: "Contact name", hint: "Full name of the person at the company" },
  { key: "firstName", label: "First name", hint: "Used with Last name when there is no single Contact name column" },
  { key: "lastName", label: "Last name", hint: "" },
  { key: "email", label: "Email", hint: "" },
  { key: "phone", label: "Phone", hint: "Reformatted to (555) 123-4567" },
  { key: "fullAddress", label: "Full address (one column)", hint: "Split into street, city, state and ZIP as well as possible" },
  { key: "street1", label: "Street", hint: "QuickBooks: Bill from Street1" },
  { key: "street2", label: "Street 2 / suite", hint: "" },
  { key: "city", label: "City", hint: "" },
  { key: "state", label: "State", hint: "Full names are converted to 2 letters" },
  { key: "zip", label: "ZIP", hint: "" },
  { key: "kind", label: "Subcontractor or supplier", hint: "Words like Subcontractor, Sub, Supplier, Vendor or Material" },
  { key: "vendorType", label: "Vendor type / trade", hint: "QuickBooks: Vendor Type. A trade (Electrical, Roofing…) makes it a subcontractor; anything else is kept as a category" },
  { key: "paymentTerms", label: "Payment terms", hint: "Due on receipt, Net 15, Net 30, Net 45, Net 60" },
  { key: "creditLimit", label: "Credit limit", hint: "Dollars" },
  { key: "taxId", label: "Tax ID (EIN/SSN)", hint: "Only the last 4 digits are kept; the rest is discarded" },
  { key: "is1099", label: "1099 vendor", hint: "Yes/No. QuickBooks: Eligible for 1099" },
  { key: "status", label: "Status", hint: "Active or Inactive. Rows marked inactive are imported as inactive" },
  { key: "notes", label: "Notes", hint: "" },
] as const;

export type VendorImportFieldKey = (typeof VENDOR_IMPORT_FIELDS)[number]["key"];
/** Field → index of the source column (undefined = not imported). */
export type VendorImportMapping = Partial<Record<VendorImportFieldKey, number>>;

export type VendorKindValue = "subcontractor" | "supplier";

export interface VendorImportOptions {
  /** Kind to use when neither the kind column nor the vendor type says. */
  defaultKind: VendorKindValue;
}

export interface ImportedVendor {
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  kind: VendorKindValue;
  /** One of the BidAxiom trades (subcontractors only). */
  trade: string | null;
  /** Free-text trade when it is not one of the BidAxiom trades (stored under "Other"). */
  tradeOther: string | null;
  /** Supplier category. */
  category: string | null;
  paymentTerms: string | null;
  creditLimit: number | null;
  taxIdLast4: string | null;
  is1099: boolean;
  status: "active" | "inactive";
  notes: string | null;
}

export type VendorRowStatus = "ready" | "warning" | "duplicate" | "error";

export interface VendorImportRowResult {
  /** 1-based row number in the source file, not counting the header. */
  rowNumber: number;
  status: VendorRowStatus;
  messages: string[];
  vendor: ImportedVendor | null;
}

/** What already exists, for spotting duplicates. */
export interface ExistingVendorKey {
  email: string | null;
  companyName: string;
}

const SYNONYMS: Record<VendorImportFieldKey, string[]> = {
  companyName: ["vendor", "vendor name", "company", "company name", "display name", "display name as", "business", "business name", "supplier", "supplier name", "subcontractor", "subcontractor name", "name"],
  contactName: ["contact", "contact name", "full name", "primary contact", "contact person", "print on check as"],
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address", "e-mail address", "main email", "mail"],
  phone: ["phone", "phone number", "main phone", "telephone", "tel", "mobile", "cell", "work phone", "business phone", "phone numbers"],
  fullAddress: ["address", "full address", "mailing address", "business address", "billing address", "bill from", "vendor address", "bill from address"],
  street1: ["street", "street address", "address 1", "address1", "address line 1", "street 1", "street1", "addr1", "bill from street1", "billing street", "billing address line 1", "bill from street 1"],
  street2: ["address 2", "address2", "address line 2", "street 2", "street2", "suite", "unit", "addr2", "bill from street2", "billing address line 2", "bill from street 2"],
  city: ["city", "town", "bill from city", "billing city"],
  state: ["state", "st", "province", "state/province", "region", "bill from state", "billing state"],
  zip: ["zip", "zip code", "zipcode", "postal code", "postal", "postcode", "bill from zip", "billing zip", "billing postal code"],
  kind: ["kind", "subcontractor or supplier", "sub or vendor", "sub or supplier", "category type"],
  vendorType: ["vendor type", "type", "trade", "trades", "category", "vendor category", "specialty"],
  paymentTerms: ["payment terms", "terms", "payment term", "net terms"],
  creditLimit: ["credit limit", "creditlimit"],
  taxId: ["tax id", "taxid", "tax id no", "tax id number", "business id no", "business id", "ein", "ssn", "tin", "ein/ssn", "tax identification number", "federal tax id"],
  is1099: ["1099", "is 1099", "1099 vendor", "eligible for 1099", "track payments for 1099", "vendor eligible for 1099", "track payments for 1099"],
  status: ["status", "active status", "active"],
  notes: ["notes", "note", "memo", "comments", "comment", "vendor notes"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();
}

/** Best-guess mapping from the file's header names. The user reviews and corrects it on screen. */
export function suggestVendorMapping(headers: string[]): VendorImportMapping {
  const mapping: VendorImportMapping = {};
  const used = new Set<number>();
  const normalized = headers.map(norm);
  for (const f of VENDOR_IMPORT_FIELDS) {
    // Earlier synonyms win, so "Vendor" is preferred over a looser "Name".
    let idx = -1;
    for (const syn of SYNONYMS[f.key]) {
      idx = normalized.findIndex((h, i) => !used.has(i) && h === norm(syn));
      if (idx >= 0) break;
    }
    if (idx >= 0) {
      mapping[f.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

function normalizeZip(v: string): string | null {
  let t = v.trim();
  if (!t) return null;
  if (/^\d{4}$/.test(t)) t = "0" + t;
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
  if (t === "cod" || t === "receipt" || t === "immediate" || t === "dueuponreceipt") return "Due on receipt";
  return null;
}

const TRADE_ALIASES: Record<string, string> = {
  plumber: "Plumbing", plumbing: "Plumbing", electrician: "Electrical", electric: "Electrical", electrical: "Electrical",
  hvac: "HVAC", mechanical: "HVAC", "heating and cooling": "HVAC", concrete: "Concrete", "metal building": "Metal Buildings",
  "metal buildings": "Metal Buildings", framing: "Framing", framer: "Framing", roofing: "Roofing", roofer: "Roofing",
  painting: "Painting", painter: "Painting", flooring: "Flooring", drywall: "Drywall", "general contractor": "General", general: "General",
  other: "Other",
};

function matchTrade(v: string): string | null {
  const t = v.toLowerCase().replace(/\s+/g, " ").trim();
  if (TRADE_ALIASES[t]) return TRADE_ALIASES[t];
  return SIMPLE_TRADES.find((x) => x.toLowerCase() === t) ?? null;
}

function parseKind(v: string): VendorKindValue | null {
  const t = v.toLowerCase();
  if (!t) return null;
  if (/\bsub(s|contractors?)?\b/.test(t) || t.startsWith("subcontract")) return "subcontractor";
  if (/supplier|supply|vendor|material|retail|rental|equipment|dealer|distributor/.test(t)) return "supplier";
  return null;
}

function parseYesNo(v: string): boolean | null {
  const t = v.toLowerCase().trim();
  if (!t) return null;
  if (["yes", "y", "true", "1", "x", "t", "checked"].includes(t)) return true;
  if (["no", "n", "false", "0", "f"].includes(t)) return false;
  return null;
}

const PLACEHOLDERS = new Set(["no address", "n/a", "na", "none", "null", "unknown", "tbd", "tba", "-", "--", "no email", "no phone", "not provided"]);
const clean = (v: unknown): string => {
  const t = (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
  return PLACEHOLDERS.has(t.toLowerCase()) ? "" : t;
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 200, street: 200, city: 100, email: 200, other: 200, notes: 2000 };
const dupName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Apply the mapping to every row. Nothing is saved here. */
export function buildVendorRows(
  rows: string[][],
  mapping: VendorImportMapping,
  options: VendorImportOptions,
  existing: ExistingVendorKey[]
): VendorImportRowResult[] {
  const seenEmail = new Set<string>();
  const seenName = new Set<string>();
  for (const e of existing) {
    if (e.email) seenEmail.add(e.email.toLowerCase());
    seenName.add(dupName(e.companyName));
  }

  const get = (row: string[], key: VendorImportFieldKey): string => {
    const idx = mapping[key];
    return idx === undefined ? "" : clean(row[idx]);
  };

  return rows.map((row, i): VendorImportRowResult => {
    const rowNumber = i + 1;
    const messages: string[] = [];
    let warn = false;

    let contactName: string | null = get(row, "contactName") || [get(row, "firstName"), get(row, "lastName")].filter(Boolean).join(" ") || null;
    let companyName = get(row, "companyName");
    if (!companyName && contactName) {
      companyName = contactName; // sole proprietors are often listed by person only
      messages.push("No company name; used the contact name");
      warn = true;
    }
    if (!companyName) return { rowNumber, status: "error", messages: ["No company name"], vendor: null };
    if (contactName && dupName(contactName) === dupName(companyName)) contactName = null;

    let email: string | null = get(row, "email").toLowerCase() || null;
    if (email && !EMAIL.test(email)) {
      const first = email.split(/[;, ]+/).find((e) => EMAIL.test(e));
      if (first) {
        messages.push(`Several emails in one cell; kept ${first}`);
        email = first;
      } else {
        messages.push(`Email "${email}" is not valid and was left blank`);
        email = null;
      }
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

    // Kind, trade and category.
    const kindRaw = get(row, "kind");
    const typeRaw = get(row, "vendorType");
    let kind: VendorKindValue | null = parseKind(kindRaw);
    if (kindRaw && !kind) {
      messages.push(`Type "${kindRaw}" is not Subcontractor or Supplier; used ${typeRaw ? "the vendor type" : "the default"} instead`);
      warn = true;
    }
    let trade: string | null = null;
    let tradeOther: string | null = null;
    let category: string | null = null;
    if (typeRaw) {
      const tradeMatch = matchTrade(typeRaw);
      if (tradeMatch && kind !== "supplier") {
        kind = "subcontractor";
        trade = tradeMatch;
      } else if (tradeMatch) {
        category = tradeMatch;
      } else {
        const typeKind = parseKind(typeRaw);
        if (!kind) kind = typeKind ?? options.defaultKind;
        if (kind === "supplier") category = typeRaw;
        else {
          trade = "Other";
          tradeOther = typeRaw;
        }
      }
    }
    if (!kind) kind = options.defaultKind;
    if (kind === "subcontractor" && !trade) {
      trade = "Other";
    }
    if (kind === "supplier") {
      trade = null;
      tradeOther = null;
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

    let creditLimit: number | null = null;
    const creditRaw = get(row, "creditLimit");
    if (creditRaw) {
      const n = Number(creditRaw.replace(/[$,\s]/g, ""));
      if (Number.isFinite(n) && n >= 0 && n <= 1_000_000_000) creditLimit = Math.round(n * 100) / 100;
      else {
        messages.push(`Credit limit "${creditRaw}" is not a number and was left blank`);
        warn = true;
      }
    }

    let taxIdLast4: string | null = null;
    const taxRaw = get(row, "taxId");
    if (taxRaw) {
      const digits = taxRaw.replace(/\D/g, "");
      if (digits.length >= 4) taxIdLast4 = digits.slice(-4);
      else {
        messages.push("Tax ID has fewer than 4 digits and was left blank");
        warn = true;
      }
    }

    let is1099 = false;
    const flagRaw = get(row, "is1099");
    if (flagRaw) {
      const b = parseYesNo(flagRaw);
      if (b === null) {
        messages.push(`1099 value "${flagRaw}" is not Yes or No; left as No`);
        warn = true;
      } else is1099 = b;
    }

    const statusRaw = get(row, "status").toLowerCase();
    const status: "active" | "inactive" = /inactive|not.?active|closed|disabled|archived/.test(statusRaw) ? "inactive" : "active";

    const cap = (v: string | null, n: number, label: string) => {
      if (v && v.length > n) {
        messages.push(`${label} was longer than ${n} characters and was shortened`);
        warn = true;
        return v.slice(0, n);
      }
      return v;
    };
    const vendor: ImportedVendor = {
      companyName: cap(companyName, LIMITS.name, "Company name")!,
      contactName: cap(contactName, LIMITS.name, "Contact name"),
      email: cap(email, LIMITS.email, "Email"),
      phone,
      street1: cap(street1, LIMITS.street, "Street"),
      street2: cap(street2, LIMITS.street, "Street 2"),
      city: cap(city, LIMITS.city, "City"),
      state,
      zip,
      kind,
      trade,
      tradeOther: cap(tradeOther, LIMITS.other, "Trade"),
      category: cap(category, LIMITS.other, "Category"),
      paymentTerms,
      creditLimit,
      taxIdLast4,
      is1099,
      status,
      notes: cap(get(row, "notes") || null, LIMITS.notes, "Notes"),
    };

    const byEmail = vendor.email && seenEmail.has(vendor.email);
    const byName = seenName.has(dupName(vendor.companyName));
    if (byEmail || byName) {
      messages.unshift(byName ? "Same company name as an existing or earlier entry" : "Same email as an existing or earlier entry");
      return { rowNumber, status: "duplicate", messages, vendor };
    }
    if (vendor.email) seenEmail.add(vendor.email);
    seenName.add(dupName(vendor.companyName));

    return { rowNumber, status: warn ? "warning" : "ready", messages, vendor };
  });
}

/** Layout of a normalized row (same order as the template): used by the server to re-check imports and to normalize QuickBooks vendors. */
export const VENDOR_ROW_MAPPING: VendorImportMapping = {
  companyName: 0, contactName: 1, email: 2, phone: 3, street1: 4, street2: 5, city: 6, state: 7, zip: 8,
  kind: 9, vendorType: 10, paymentTerms: 11, creditLimit: 12, taxId: 13, is1099: 14, status: 15, notes: 16,
};

/** Column order of the template and of the rows the browser sends to the server (server re-checks with this layout). */
export const VENDOR_TEMPLATE_HEADERS = [
  "Company Name", "Contact Name", "Email", "Phone", "Street", "Street 2", "City", "State", "ZIP",
  "Type", "Trade or Category", "Payment Terms", "Credit Limit", "Tax ID", "1099 Vendor", "Status", "Notes",
] as const;
