import { test } from "node:test";
import assert from "node:assert/strict";
import { canRevise, countsAsIssued, statusAfterPayments, insuranceStatus, isEditable, issueBlockers, moveBlockers, nextOrderNumber } from "./orderRules";

test("issue needs a draft, a vendor and lines", () => {
  assert.deepEqual(issueBlockers({ status: "draft", vendorId: "v", lineCount: 2 }), []);
  assert.deepEqual(issueBlockers({ status: "draft", vendorId: null, lineCount: 2 }), ["Assign a vendor first."]);
  assert.equal(issueBlockers({ status: "issued", vendorId: "v", lineCount: 2 }).length, 1);
  assert.equal(issueBlockers({ status: "draft", vendorId: "v", lineCount: 0 }).length, 1);
});

test("only drafts are editable, only issued can be revised", () => {
  assert.ok(isEditable("draft") && !isEditable("issued"));
  assert.ok(canRevise("issued") && canRevise("partially_paid") && !canRevise("draft") && !canRevise("paid"));
});

test("lines move only between drafts of one kind", () => {
  assert.deepEqual(moveBlockers({ status: "draft", kind: "purchase" }, { status: "draft", kind: "purchase" }), []);
  assert.deepEqual(moveBlockers({ status: "draft", kind: "purchase" }, null), []);
  assert.equal(moveBlockers({ status: "issued", kind: "purchase" }, null).length, 1);
  assert.equal(moveBlockers({ status: "draft", kind: "purchase" }, { status: "issued", kind: "purchase" }).length, 1);
  assert.equal(moveBlockers({ status: "draft", kind: "purchase" }, { status: "draft", kind: "work" }).length, 1);
});

test("order numbers continue after the highest used", () => {
  assert.equal(nextOrderNumber([], "PO", "26-014"), "PO26-014-01");
  assert.equal(nextOrderNumber(["PO26-014-01", "PO26-014-03", "WO26-014-09"], "PO", "26-014"), "PO26-014-04");
  assert.equal(nextOrderNumber(["WO26-014-02"], "WO", "26-014"), "WO26-014-03");
  assert.equal(nextOrderNumber(["PO-02"], "PO", null), "PO-03");
});

test("insurance status", () => {
  const now = new Date("2026-10-13T00:00:00Z");
  assert.equal(insuranceStatus(null, now), "missing");
  assert.equal(insuranceStatus("2026-10-01T00:00:00Z", now), "expired");
  assert.equal(insuranceStatus("2026-10-30T00:00:00Z", now), "expiring");
  assert.equal(insuranceStatus("2027-03-01T00:00:00Z", now), "ok");
});

test("status follows payments and drafts are not outstanding", () => {
  assert.equal(statusAfterPayments(0, 100), "issued");
  assert.equal(statusAfterPayments(40, 100), "partially_paid");
  assert.equal(statusAfterPayments(100, 100), "paid");
  assert.equal(statusAfterPayments(100.004, 100), "paid");
  assert.ok(countsAsIssued("partially_paid") && !countsAsIssued("draft"));
});
