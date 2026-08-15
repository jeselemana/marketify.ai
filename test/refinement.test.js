import test from "node:test";
import assert from "node:assert/strict";
import { buildRefinementInput, getRefinementInstruction } from "../src/services/ai/prompts.js";

test("custom refinement carries the original context and complete strategy", () => {
  const existingStrategy = {
    title: "Baku launch",
    sections: [{ id: "channels", title: "Channels", content: "Use influencers and paid social." }],
  };
  const input = JSON.parse(
    buildRefinementInput({
      brief: "Launch a brand in Baku",
      answers: [{ questionId: "budget", question: "Budget?", answer: "2,000 AZN" }],
      strategy: existingStrategy,
      action: "custom",
      request: "Remove influencer marketing and move that budget to paid social.",
    }),
  );

  assert.deepEqual(input.existingStrategy, existingStrategy);
  assert.match(input.userRequest, /Remove influencer marketing/);
  assert.match(input.actionInstruction, /custom change request/i);
});

test("think deeper is explicitly user-facing and does not request chain-of-thought", () => {
  const instruction = getRefinementInstruction("think_deeper");
  assert.match(instruction, /tradeoffs/);
  assert.match(instruction, /without revealing private reasoning/);
});
