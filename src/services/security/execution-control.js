import { executionContext } from './privacy-policy.js';

// These failures terminate the entire operation, including caller-side fallbacks.
export function assertExecutionActive(error, signal) {
  signal?.throwIfAborted();
  executionContext.getStore()?.signal?.throwIfAborted();
  if (error && (error.name === 'AbortError' || /^(EXECUTION_|RESEARCH_RESTART|GROUNDING_|PROVENANCE_|DAILY_BUDGET_EXCEEDED|MODEL_PRICING_UNAVAILABLE|TOOL_PRICING_UNAVAILABLE)/.test(error.code || ''))) throw error;
}

export async function assertExecutionAuthorized(signal) {
  assertExecutionActive(undefined, signal);
  const context = executionContext.getStore();
  try { await context?.assertAuthorized?.(); }
  catch (error) { context?.controller?.abort(error); throw error; }
  assertExecutionActive(undefined, signal);
}

export function createExecutionController() {
  const controller = new AbortController();
  const context = executionContext.getStore();
  const parent = context?.signal;
  if (parent?.aborted) controller.abort(parent.reason);
  else parent?.addEventListener('abort', () => controller.abort(parent.reason), { once: true, signal: controller.signal });
  controller.signal.addEventListener('abort', () => context?.controller?.abort(controller.signal.reason), { once: true });
  return controller;
}
