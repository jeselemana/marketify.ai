import { parseResponse } from "openai/lib/ResponsesParser.mjs";
import { executionContext } from './privacy-policy.js';
import { providerUsage } from './provider-usage.js';
let policy;
export function configureProviderPolicy(value) { policy = value; }
export async function assertPlatformEnabled() { await policy?.assertEnabled?.(); }
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
      await assertPlatformEnabled();
      await context.assertAuthorized?.();
      const release = await policy.reserveProvider(context, params);
      let checking = false;
      const authorizationTimer = setInterval(async () => {
        if (checking) return;
        checking = true;
        try { await assertPlatformEnabled(); await context.assertAuthorized?.(); }
        catch (error) { context.controller?.abort(error); }
        finally { checking = false; }
      }, 1000);
      authorizationTimer?.unref();
      let lastUsage, released = false;
      const observe = value => { lastUsage = providerUsage(value) || lastUsage; };
      const finish = async () => {
        if (released) return;
        released = true;
        clearInterval(authorizationTimer);
        try {
          if (lastUsage) {
            await release.recordUsage?.({ ...lastUsage, searchUsageKnown: type !== 'gemini' });
            await context.onProviderUsage?.({ provider: kind, model: params.model, ...lastUsage });
          }
        } catch (error) {
          const failure = /^EXECUTION_/.test(error.code || '') ? error : Object.assign(new Error('Usage settlement unavailable'), { code: 'EXECUTION_UNAVAILABLE', status: 503 });
          context.controller?.abort(failure);
          throw failure;
        } finally { await release(); }
      };
      try {
        context.signal?.throwIfAborted();
        await assertPlatformEnabled();
        await context.assertAuthorized?.();
        const signals = [context.signal, type === 'gemini' ? params.config?.abortSignal : options?.signal].filter(Boolean);
        const signal = signals.length ? AbortSignal.any(signals) : undefined;
        let payload;
        if (type === 'gemini') payload = { ...params, config: { ...params.config, maxOutputTokens: Math.min(params.config?.maxOutputTokens || 16384, 16384), abortSignal: signal } };
        else if (type === 'chat') payload = { ...params, store: false, ...(params.max_completion_tokens ? { max_completion_tokens: Math.min(params.max_completion_tokens, 16384) } : { max_tokens: Math.min(params.max_tokens || 16384, 16384) }) };
        else payload = { ...params, store: false, max_output_tokens: Math.min(params.max_output_tokens || 16384, 16384), ...(context.guest ? { max_tool_calls: 1 } : {}) };
        context.providerStarted = true;
        const value = await original(payload, type === 'gemini' ? undefined : { ...options, signal });
        observe(value);
        if (value?.[Symbol.asyncIterator]) return (async function* () {
          try {
            for await (const event of value) {
              observe(event);
              signal?.throwIfAborted();
              await assertPlatformEnabled();
              await context.assertAuthorized?.();
              yield event;
            }
          }
          finally { await finish(); }
        })();
        await assertPlatformEnabled();
        await context.assertAuthorized?.();
        await finish(); return value;
      } catch (error) {
        if (/^EXECUTION_/.test(error.code || '')) context.controller?.abort(error);
        try { await finish(); } catch {}
        throw error;
      }
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
