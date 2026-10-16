import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDocumentFileName } from "../types/company";

  const v = { jobNumber: "26-014", projectName: "Federal Rd", documentName: "Insulation", number: "26-014" };
test("proposal Rev 0 defaults to the job number", () => {
    assert.equal(resolveDocumentFileName(null, "proposal", { ...v, revision: 0 }), "26-014.pdf");
  });
test("proposal Rev 2 defaults to job number with revision", () => {
    assert.equal(resolveDocumentFileName({}, "proposal", { ...v, revision: 2 }), "26-014-Rev 2.pdf");
  });
test("uses a custom pattern and strips illegal characters", () => {
    const s = { proposal: { template: "{Job Number} - {Project Name}/x", revisionTemplate: "{Job Number} R{Rev #}" } };
    assert.equal(resolveDocumentFileName(s, "proposal", { ...v, revision: 0 }), "26-014 - Federal Rdx.pdf");
    assert.equal(resolveDocumentFileName(s, "proposal", { ...v, revision: 1 }), "26-014 R1.pdf");
  });
test("falls back when the pattern yields nothing", () => {
    assert.equal(resolveDocumentFileName({ proposal: { template: "{Document Name}" } }, "proposal", { ...v, documentName: "", revision: 0 }), "26-014.pdf");
  });
test("invoices ignore revisions", () => {
    assert.equal(resolveDocumentFileName(null, "invoice", { number: "INV-1", revision: 3 }), "INV-1.pdf");
  });
