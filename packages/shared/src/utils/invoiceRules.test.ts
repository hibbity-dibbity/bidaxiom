import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dueDateFor, isOverdue, isSent, rebalanceUnsent, statusAfterReceipts, termsDays } from "./invoiceRules";
import { computeSchedule } from "./proposalCalc";
import { formatDocNumber } from "./proposalOrders";

test("invoices come from the schedule and add up to the contract value", () => {
  const ms = [
    { id: "a", name: "Deposit", percent: 30 },
    { id: "b", name: "Rough-in", percent: 40 },
    { id: "c", name: "Substantial", percent: 25 },
    { id: "d", name: "Final", percent: 5 },
  ];
  const rows = computeSchedule(7910487, ms);
  assert.deepEqual(rows.map((r) => r.amount), [2373146, 3164195, 1977622, 395524]); // 79,104.87 sample
  assert.equal(rows.reduce((a, r) => a + r.amount, 0), 7910487);
  assert.equal(formatDocNumber("INV", "26-014", 1), "INV26-014-01");
});

test("due date follows payment terms", () => {
  assert.equal(termsDays("Net 30"), 30);
  assert.equal(termsDays("Due on receipt"), 0);
  assert.equal(termsDays(null), 0);
  assert.equal(dueDateFor("2026-10-20", "Net 30"), "2026-11-19");
  assert.equal(dueDateFor("2026-12-20", "Net 15"), "2027-01-04");
  assert.equal(addDays("2028-02-27", 3), "2028-03-01");
});

test("status follows receipts; overdue only when money is owed past due", () => {
  assert.equal(statusAfterReceipts(0, 100), "sent");
  assert.equal(statusAfterReceipts(50, 100), "partially_paid");
  assert.equal(statusAfterReceipts(100, 100), "paid");
  assert.ok(isSent("paid") && !isSent("draft"));
  assert.ok(isOverdue("sent", "2026-10-01", "2026-10-13"));
  assert.ok(!isOverdue("paid", "2026-10-01", "2026-10-13"));
  assert.ok(!isOverdue("draft", "2026-10-01", "2026-10-13"));
  assert.ok(!isOverdue("sent", "2026-10-20", "2026-10-13"));
});

test("contract change re-amounts only unsent invoices", () => {
  const inv = [
    { id: "a", percent: 30, amountCents: 3000000, sent: true },
    { id: "b", percent: 40, amountCents: 4000000, sent: false },
    { id: "c", percent: 30, amountCents: 3000000, sent: false },
  ];
  // contract goes from 100,000 to 110,000: the extra 10,000 is shared by b and c by percent
  const r = rebalanceUnsent(11000000, inv);
  assert.deepEqual(r.rows, [{ id: "b", amountCents: 4571429 }, { id: "c", amountCents: 3428571 }]);
  assert.equal(3000000 + r.rows.reduce((a, x) => a + x.amountCents, 0), 11000000);
  assert.equal(r.leftoverCents, 0);
  // everything already sent: nothing to change, difference reported
  const all = rebalanceUnsent(11000000, inv.map((i) => ({ ...i, sent: true })));
  assert.deepEqual(all.rows, []);
  assert.equal(all.leftoverCents, 1000000);
  // contract shrinks below what was already billed: unsent go to 0
  const low = rebalanceUnsent(2500000, inv);
  assert.deepEqual(low.rows.map((x) => x.amountCents), [0, 0]);
  assert.equal(low.leftoverCents, -500000);
});
