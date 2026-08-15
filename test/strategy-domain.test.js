import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBriefSignals, validateAssessment } from "../src/domain/strategy.js";

test("a vague growth brief is identified as context-poor", () => {
  const result = analyzeBriefSignals("Help my business grow.");
  assert.equal(result.likelyComplete, false);
  assert.ok(result.missing.includes("business"));
  assert.ok(result.missing.includes("audience"));
});

test("a concrete Baku skincare brief contains the critical intake signals", () => {
  const result = analyzeBriefSignals(
    "I run a premium women's skincare e-commerce brand in Baku targeting women aged 22–35. I want to increase repeat purchases over the next 3 months with a 5,000 AZN monthly marketing budget.",
  );
  assert.equal(result.likelyComplete, true);
  assert.equal(result.signals.market, true);
  assert.equal(result.signals.budget, true);
  assert.equal(result.signals.timeline, true);
});

test("clarification output cannot claim questions are needed without questions", () => {
  assert.throws(
    () =>
      validateAssessment({
        status: "needs_clarification",
        understanding: "The business goal is too broad to make specific decisions.",
        questions: [],
        assumptions: [],
      }),
    /did not include any questions/,
  );
});
