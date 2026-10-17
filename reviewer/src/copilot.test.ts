import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReview } from "./copilot.js";

const valid = {
  implementationCorrectness: 8,
  idiomaticity: 8,
  complexity: 8,
  testRiskCoverage: 8,
  documentation: 8,
  securitySafety: 8,
  verdict: "pass",
  summary: "ok",
};

test("parses plain JSON", () => {
  assert.equal(parseReview(JSON.stringify(valid)).verdict, "pass");
});

test("parses JSON wrapped in a code fence", () => {
  assert.equal(parseReview("```json\n" + JSON.stringify(valid) + "\n```").verdict, "pass");
});

test("rejects output without JSON", () => {
  assert.throws(() => parseReview("no json here"));
});

test("rejects scores outside 1-10", () => {
  assert.throws(() => parseReview(JSON.stringify({ ...valid, securitySafety: 11 })));
});
