import test from "node:test";
import assert from "node:assert/strict";
import { aiConfig, hasOpenAIConfiguration } from "../src/services/ai/config.js";
import { routeAskModel } from "../src/services/ai/ask-routing.js";

test("Ask uses the Marketify Terra model and OpenAI configuration", () => {
  assert.equal(typeof hasOpenAIConfiguration(), "boolean");
  assert.equal(typeof aiConfig.askModel, "string");
  assert.equal(aiConfig.askModel, process.env.OPENAI_ASK_MODEL || "gpt-5.6-terra");
  assert.equal(aiConfig.askMiniModel, process.env.OPENAI_ASK_MINI_MODEL || "gpt-5.6-luna");
});

test("Auto routes small prompts to Mini and complex prompts to Terra", () => {
  assert.equal(routeAskModel({
    requestedModel: "auto",
    messages: [{ role: "user", content: "Salam, necəsən?" }],
  }), "mini");
  assert.equal(routeAskModel({
    requestedModel: "auto",
    messages: [{ role: "user", content: "Bu kampaniyanın ROI və konversiyasını detallı analiz et" }],
  }), "terra");
  assert.equal(routeAskModel({
    requestedModel: "auto",
    messages: [{ role: "user", content: "Qısa cavab ver" }],
    hasStrategyContext: true,
  }), "terra");
});

test("Explicit Mini and deeper-thinking routes override Auto", () => {
  assert.equal(routeAskModel({
    requestedModel: "mini",
    messages: [{ role: "user", content: "Çox detallı strategiya və bazar analizi hazırla" }],
  }), "mini");
  assert.equal(routeAskModel({
    requestedModel: "marketify",
    messages: [{ role: "user", content: "Salam" }],
  }), "terra");
});
