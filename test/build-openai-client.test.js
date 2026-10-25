import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import { BuildOpenAIClient } from '../src/services/ai/build-openai-client.js';

const completed = () => new Response(JSON.stringify({ id: 'resp_fixture', status: 'completed', output: [] }), {
  headers: { 'Content-Type': 'application/json' },
});

test('Build SDK waits beyond its inherited timeout without advertising a deadline or changing other agents', async () => {
  let request;
  const client = new BuildOpenAIClient({ apiKey: 'test-fixture', timeout: 1, maxRetries: 0, fetch: async (_url, init) => {
    request = init;
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(init.signal.aborted, false);
    return completed();
  } });
  const response = await client.responses.create({ model: 'gpt-6.1-sol', input: 'synthetic' });
  assert.equal(response.status, 'completed');
  assert.equal(new Headers(request.headers).has('x-stainless-timeout'), false);
  assert.equal(request.agent.options.timeout, 0);
});

test('Build caller cancellation still reaches the SDK stream after response headers arrive', async () => {
  const controller = new AbortController(); let requestSignal;
  const client = new BuildOpenAIClient({ apiKey: 'test-fixture', maxRetries: 0, fetch: async (_url, init) => {
    requestSignal = init.signal;
    return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const stream = await client.responses.create({ model: 'gpt-6.1-sol', input: 'synthetic', stream: true }, { signal: controller.signal });
  assert.equal(requestSignal.aborted, false);
  controller.abort();
  assert.equal(requestSignal.aborted, true);
  assert.equal(stream.controller.signal.aborted, true);
});

test('ordinary OpenAI SDK requests retain their existing timeout behavior', async () => {
  const client = new OpenAI({ apiKey: 'test-fixture', timeout: 5, maxRetries: 0, fetch: async (_url, init) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(completed()), 100);
    init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }) });
  await assert.rejects(client.responses.create({ model: 'gpt-6-luna', input: 'synthetic' }), error => error instanceof OpenAI.APIConnectionTimeoutError);
});
