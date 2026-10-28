import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const generation = source.slice(source.indexOf('async function startGeneration()'), source.indexOf('function calcReadingTime('));

function harness(parts, beforeRead = () => {}) {
  const state = { identityEpoch: 1, currentUser: { id: 'a' }, clientSaveId: 'stable-generation-key', brief: 'Launch', answers: [], assumptions: [], questions: [] };
  const errors = [], requests = [];
  let index = 0;
  const context = {
    state, errors, AbortController, TextDecoder, currentAbortController: null, backgroundJobs: [],
    clearError() {}, render() {}, showToast() {}, trackEvent() {},
    setStatus(status) { state.status = status; },
    setError(error) { errors.push(error); },
    isIdentityStale: (epoch, id) => epoch !== state.identityEpoch || id !== state.currentUser?.id,
    isAutoSaveStrategiesEnabled: () => false, isModelImprovementActive: () => false, getLanguage: () => 'en',
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, headers: new Headers({ 'content-type': 'text/event-stream' }), body: { getReader: () => ({
        async read() {
          beforeRead(context, index);
          return index < parts.length ? { value: parts[index++], done: false } : { done: true };
        },
      }) } };
    },
    api: async () => { throw new Error('Unexpected second generation'); },
  };
  vm.createContext(context);
  vm.runInContext(generation, context);
  return { context, state, errors, requests, run: () => context.startGeneration() };
}

test('Build stream: clean EOF without a final result reports interruption without another generation', async () => {
  const h = harness([Buffer.from(': keepalive\n\ndata: {"chunk":"partial"}\n\n')]);
  await h.run();
  assert.equal(h.errors[0].code, 'BUILD_STREAM_INCOMPLETE');
  assert.match(h.errors[0].message, /connection ended/);
  assert.equal(h.requests.length, 1);
  assert.equal(h.state.strategy, undefined);
  assert.equal(h.state.clientSaveId, 'stable-generation-key');
});

test('Build stream: fragmented UTF-8 terminal event without a trailing newline completes', async () => {
  const bytes = Buffer.from('data: ' + JSON.stringify({ done: true, strategy: { title: 'İnkişaf' }, savedId: 'saved-id' }));
  const split = bytes.indexOf(Buffer.from('İ')) + 1;
  const h = harness([bytes.subarray(0, split), bytes.subarray(split)]);
  await h.run();
  assert.equal(h.errors.length, 0);
  assert.equal(h.state.strategy.title, 'İnkişaf');
  assert.equal(h.state.status, 'ready');
});

test('Build stream: identity change or cancellation at EOF cannot publish data or an error', async () => {
  for (const cancel of [c => { c.state.identityEpoch++; }, c => c.currentAbortController.abort()]) {
    const h = harness([Buffer.from('data: {"done":true,"strategy":{"title":"Private"}}')], (c, index) => { if (index === 1) cancel(c); });
    await h.run();
    assert.equal(h.errors.length, 0);
    assert.equal(h.state.strategy, undefined);
  }
});

test('Build stream: explicit policy failure remains terminal and keeps its code', async () => {
  const h = harness([Buffer.from('data: {"error":"Request blocked","code":"EXECUTION_BUSY","status":429}\n\n')]);
  await h.run();
  assert.equal(h.errors[0].code, 'EXECUTION_BUSY');
  assert.equal(h.errors[0].status, 429);
  assert.equal(h.state.strategy, undefined);
});
