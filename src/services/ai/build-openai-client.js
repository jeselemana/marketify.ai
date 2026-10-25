import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import OpenAI from "openai";
import { hasOpenAIConfiguration } from "./config.js";
import { wrapProvider } from "../security/provider-policy.js";

// The installed OpenAI v4 SDK interprets timeout:0 as an immediate timeout.
// Build's dedicated adapter omits only that timer; caller cancellation still
// reaches both the request and the live response stream through the controller.
export class BuildOpenAIClient extends OpenAI {
  constructor(options) {
    const protocol = new URL(options.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").protocol;
    const Agent = protocol === "http:" ? HttpAgent : HttpsAgent;
    super({ ...options, httpAgent: options.httpAgent || new Agent({ keepAlive: true, timeout: 0 }) });
  }

  buildRequest(options, context) {
    const request = super.buildRequest(options, context);
    delete request.req.headers["x-stainless-timeout"];
    if (request.req.agent?.options) request.req.agent.options.timeout = 0;
    return request;
  }

  async fetchWithTimeout(url, init, _milliseconds, controller) {
    const { signal, ...options } = init || {};
    if (signal?.aborted) controller.abort(signal.reason);
    else signal?.addEventListener("abort", () => controller.abort(signal.reason), { once: true, signal: controller.signal });
    controller.signal.throwIfAborted();
    return this.fetch.call(undefined, url, {
      ...options,
      ...(options.method ? { method: options.method.toUpperCase() } : {}),
      signal: controller.signal,
    });
  }
}

let client;
export function getBuildOpenAIClient() {
  if (!hasOpenAIConfiguration()) throw Object.assign(new Error("AI service unavailable"), { code: "AI_NOT_CONFIGURED", status: 503 });
  if (!client) {
    client = wrapProvider(new BuildOpenAIClient({
      apiKey: process.env.OPENAI_API_KEY, maxRetries: 0,
    }), "openai");
  }
  return client;
}
