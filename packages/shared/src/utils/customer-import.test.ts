import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCustomerRows, suggestCustomerMapping, splitFullAddress, normalizePhone, normalizeState } from "./customer-import";

test("suggests a mapping from common header names", () => {
  const m = suggestCustomerMapping(["Company Name", "Contact", "E-mail", "Phone Number", "Address", "Zip Code", "Terms", "Notes"]);
  assert.deepEqual(m, { companyName: 0, contactName: 1, email: 2, phone: 3, fullAddress: 4, zip: 5, paymentTerms: 6 });
});

test("phone, state and address normalization", () => {
  assert.equal(normalizePhone("555.123.4567 x22"), "(555) 123-4567");
  assert.equal(normalizePhone("1-555-123-4567"), "(555) 123-4567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizeState("texas"), "TX");
  assert.equal(normalizeState("tx."), "TX");
  assert.equal(normalizeState("Narnia"), null);
  assert.deepEqual(splitFullAddress("123 Main St, Suite 4, Springfield, IL 62704"), { state: "IL", zip: "62704", city: "Springfield", street1: "123 Main St", street2: "Suite 4" });
  assert.deepEqual(splitFullAddress("500 Oak Ave\nDallas, Texas 75001"), { state: "TX", zip: "75001", city: "Dallas", street1: "500 Oak Ave" });
});

test("real-world address quirks", () => {
  assert.deepEqual(splitFullAddress("190 T C Jester Blvd., Suite 200 Houston, TX 77007"), { state: "TX", zip: "77007", city: "Houston", street1: "190 T C Jester Blvd.", street2: "Suite 200" });
  const r = buildCustomerRows([["No Address", "n/a"]], { fullAddress: 0, companyName: 1 }, { useCompanyAsContact: true }, []);
  assert.equal(r[0].status, "error");
});

test("rows: names, company fallback, warnings, errors", () => {
  const rows = [
    ["Acme Builders", "", "ACME@Example.com", "(555) 123-4567", "texas", "7501", "net30"],
    ["", "Pat Lee", "not-an-email", "12", "", "", ""],
    ["", "", "", "", "", "", ""],
  ];
  const map = { companyName: 0, contactName: 1, email: 2, phone: 3, state: 4, zip: 5, paymentTerms: 6 };
  const r = buildCustomerRows(rows, map, { useCompanyAsContact: true }, []);
  assert.equal(r[0].status, "ready");
  assert.deepEqual(r[0].customer, { companyName: "Acme Builders", contactName: "Acme Builders", email: "acme@example.com", phone: "(555) 123-4567", street1: null, street2: null, city: null, state: "TX", zip: "07501", paymentTerms: "Net 30" });
  assert.equal(r[1].status, "warning");
  assert.equal(r[1].customer?.email, null);
  assert.equal(r[1].customer?.phone, null);
  assert.equal(r[2].status, "error");
  const strict = buildCustomerRows(rows.slice(0, 1), map, { useCompanyAsContact: false }, []);
  assert.equal(strict[0].status, "error");
});

test("duplicates against existing customers and within the file", () => {
  const rows = [["A Co", "Al", "al@a.com"], ["A Co", "Al", "other@a.com"], ["B Co", "Bo", "AL@a.com"], ["B Co", "Bo", "bo@b.com"]];
  const r = buildCustomerRows(rows, { companyName: 0, contactName: 1, email: 2 }, { useCompanyAsContact: true }, [{ email: null, companyName: "B Co", contactName: "Bo" }]);
  assert.deepEqual(r.map((x) => x.status), ["ready", "duplicate", "duplicate", "duplicate"]);
});

test("first name + last name build the contact", () => {
  const r = buildCustomerRows([["Ann", "Ng"]], { firstName: 0, lastName: 1 }, { useCompanyAsContact: true }, []);
  assert.equal(r[0].customer?.contactName, "Ann Ng");
});
