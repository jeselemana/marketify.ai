import { parseResponse } from "openai/lib/ResponsesParser.mjs";
import { executionContext } from './privacy-policy.js';
let policy;
export function configureProviderPolicy(value) { policy = value; }
export function wrapProvider(client, kind) {
  if (client.__helmerProtected) return client;
  function protect(target, method, type) {
    if (typeof target?.[method] !== 'function') return;
    const original = target[method].bind(target);
    target[method] = async (params, options) => {
      if (!policy) return original(params, options);
      const context = executionContext.getStore();
      if (!context?.ownerId) throw Object.assign(new Error('Missing execution identity'), { code: 'EXECUTION_UNAVAILABLE', status: 503 });
      context.signal?.throwIfAborted();
      const release = await policy.reserveProvider(context, params);
      try {
        context.signal?.throwIfAborted();
        const signals = [context.signal, type === 'gemini' ? params.config?.abortSignal : options?.signal].filter(Boolean);
        const signal = signals.length ? AbortSignal.any(signals) : undefined;
        let payload;
        if (type === 'gemini') payload = { ...params, config: { ...params.config, maxOutputTokens: Math.min(params.config?.maxOutputTokens || 16384, 16384), abortSignal: signal } };
        else if (type === 'chat') payload = { ...params, store: false, ...(params.max_completion_tokens ? { max_completion_tokens: Math.min(params.max_completion_tokens, 16384) } : { max_tokens: Math.min(params.max_tokens || 16384, 16384) }) };
        else payload = { ...params, store: false, max_output_tokens: Math.min(params.max_output_tokens || 16384, 16384), ...(context.guest ? { max_tool_calls: 1 } : {}) };
        context.providerStarted = true;
        const value = await original(payload, type === 'gemini' ? undefined : { ...options, signal });
        if (value?.[Symbol.asyncIterator]) return (async function* () {
          try { for await (const event of value) { signal?.throwIfAborted(); yield event; } }
          finally { await release(); }
        })();
        await release(); return value;
      } catch (error) { await release(); throw error; }
    };
  }
  if (kind === 'gemini') {
    protect(client.models, 'generateContent', 'gemini');
    protect(client.models, 'generateContentStream', 'gemini');
    // Explicit caching creates an additional billable operation and persistent
    // provider data. Use bounded local context until it has its own admission.
    if (client.caches?.create) client.caches.create = async () => { throw Object.assign(new Error('Provider context caching disabled'), { code: 'CACHE_DISABLED' }); };
  } else {
    protect(client.responses, 'create', 'responses');
    if (client.responses?.parse) client.responses.parse = async (params, options) => parseResponse(await client.responses.create(params, options), params);
    protect(client.chat?.completions, 'create', 'chat');
  }
  Object.defineProperty(client, '__helmerProtected', { value: true });
  return client;
}
