import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { strategyFixture } from './helpers/build-fixtures.js';
import { createStrategyRouter, strategyErrorHandler } from '../src/http/strategy-router.js';
import { FileStrategyRepository } from '../src/repositories/file-strategy-repository.js';
import { AiPolicy } from '../src/services/security/ai-policy.js';
import { PrivacyPolicy } from '../src/services/security/privacy-policy.js';
import { configureProviderPolicy, wrapProvider } from '../src/services/security/provider-policy.js';
import { getGeminiClient } from '../src/services/ai/client.js';
import { getBuildOpenAIClient } from '../src/services/ai/build-openai-client.js';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'helmer-build-http-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  process.env.OPENAI_API_KEY ||= 'test-build-openai'; process.env.GEMINI_API_KEY ||= 'test-build-google';
  const ownerA = randomUUID(), ownerB = randomUUID();
  const users = new Map([ownerA, ownerB].map(id => [id, { id, status: 'active', emailVerifiedAt: 'now', authVersion: 1, privacyEpoch: 0,
    settings: { modelImprovement: false, personalIntelligence: true, strategyPersonalization: true, industry: 'Software', brandName: 'UnneededSecretBrand' } }]));
  const f = { ownerA, ownerB, users, calls: [], learning: [], route: { complexity: 'complex', reasoning: 'high', googleSearch: true, solWebSearch: false, profileFields: ['industry'] }, hold: null, background: null, failure: null };
  const policy = new AiPolicy({ redis: null, env: { NODE_ENV: 'test' } });
  f.policy = policy;
  configureProviderPolicy(policy); t.after(() => configureProviderPolicy(undefined));
  const finalResponse = () => ({ status: 'completed', output_text: JSON.stringify(strategyFixture()), usage: { input_tokens: 20, output_tokens: 20 } });
  const openai = wrapProvider({ responses: { create: async (params, options) => {
    f.calls.push({ params, options });
    if (params.model === 'gpt-6-luna') return { status: 'completed', output_text: JSON.stringify(f.route), usage: { input_tokens: 20, output_tokens: 20 } };
    if (f.failure) throw f.failure;
    if (f.hold) await f.hold;
    if (!params.stream) return finalResponse();
    return (async function* () {
      const text = JSON.stringify(strategyFixture());
      yield { type: 'response.output_text.delta', delta: text.slice(0, 50) };
      yield { type: 'response.output_text.delta', delta: text.slice(50) };
      yield { type: 'response.completed', response: finalResponse() };
    })();
  } } }, 'openai');
  const googleResponse = params => {
    if (f.googleFailure) throw f.googleFailure;
    return { text: JSON.stringify(params.config.responseSchema.properties.title ? strategyFixture() : {
      objective: 'Launch', context: ['Existing user context'], plan: ['Pilot'], constraints: ['Budget'], acceptanceCriteria: ['10 teams'],
      findings: [{ fact: 'Reported evidence', sourceUrl: 'https://reuters.com/report' }], uncertainties: [] }),
      candidates: [{ finishReason: 'STOP', groundingMetadata: { groundingChunks: [{ web: { uri: 'https://reuters.com/report', title: 'Report' } }] } }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 20 } };
  };
  const gemini = wrapProvider({ models: {
    generateContent: async params => { f.calls.push({ params }); return googleResponse(params); },
    generateContentStream: async params => {
      f.calls.push({ params });
      return (async function* () { yield googleResponse(params); })();
    },
  } }, 'gemini');
  t.mock.method(getBuildOpenAIClient().responses, 'create', openai.responses.create);
  t.mock.method(getGeminiClient().models, 'generateContent', gemini.models.generateContent);
  t.mock.method(getGeminiClient().models, 'generateContentStream', gemini.models.generateContentStream);
  const repository = new FileStrategyRepository(path.join(directory, 'strategies.json'), null, { cloud: false });
  f.repository = repository;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.ownerId = req.get('X-Test-Owner') || ownerA; req.user = users.get(req.ownerId); req.auth = { user: req.user }; next(); });
  app.use(new PrivacyPolicy({ findById: async id => users.get(id) }).middleware());
  app.use(policy.middleware());
  const learning = { createInteractionId: randomUUID, recordInteraction: async data => f.learning.push(data) };
  app.use('/api/strategy', createStrategyRouter(repository, learning, { hasActiveJobForOwner: owner => f.background === owner }));
  app.use(strategyErrorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api/strategy`;
  f.post = (url, body, options = {}) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': body.idempotencyKey || randomUUID(), ...options.headers }, body: JSON.stringify(body), signal: options.signal });
  f.get = (url, owner = ownerA) => fetch(`${base}${url}`, { headers: { 'X-Test-Owner': owner } });
  f.payload = () => ({ brief: 'Prepare a secure technical launch strategy', answers: [], assumptions: ['Limited budget'], idempotencyKey: randomUUID(), language: 'en' });
  return f;
}

test('Build HTTP: complex SSE ends at Sol, saves one tenant record, preserves sources and redacts private logs', async t => {
  const f = await fixture(t), payload = f.payload();
  const response = await f.post('/generate-stream', payload);
  assert.equal(response.status, 200);
  const body = await response.text();
  const events = body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
  const done = events.find(event => event.done);
  assert.equal(done.strategy.title, 'Launch brief'); assert.ok(done.savedId);
  assert.equal(done.strategy.orchestration.sources[0].url, 'https://reuters.com/report');
  assert.deepEqual(f.calls.map(call => call.params.model), ['gpt-6-luna', 'gemini-3.8-flash', 'gpt-6.1-sol']);
  assert.equal(f.calls[2].params.reasoning.effort, 'high');
  assert.equal(JSON.parse(f.calls[1].params.contents).untrustedBusinessProfile, 'Industry: Software');
  assert.equal(events.filter(event => event.chunk).map(event => event.chunk).join(''), JSON.stringify(strategyFixture()));
  assert.equal((await f.repository.list(f.ownerA)).length, 1);
  assert.equal((await f.get(`/${done.savedId}`, f.ownerB)).status, 404);
  const replay = await f.post('/generate', payload); assert.equal(replay.status, 200); assert.equal(f.calls.length, 3);
  const conflict = await f.post('/generate', { ...payload, brief: 'A completely different requirement' }); assert.equal(conflict.status, 409);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.learning[0].onlyNecessaryData, true);
  assert.equal(f.learning[0].modelResponse, '[Zəruri əməliyyat qeydi - Məzmun ötürülmür]');
  assert.doesNotMatch(JSON.stringify(f.learning), /Prepare a secure|Launch brief/);
});

test('Build HTTP: disabled profile consent sends no profile; Google Search requires router authorization', async t => {
  const f = await fixture(t); f.users.get(f.ownerA).settings.strategyPersonalization = false; f.route.googleSearch = false;
  const response = await f.post('/generate', f.payload()); assert.equal(response.status, 200);
  assert.equal(JSON.parse(f.calls[1].params.contents).untrustedBusinessProfile, undefined);
  assert.equal(f.calls[1].params.config.tools, undefined);
  assert.equal(f.calls[2].params.tools, undefined);
  const result = await response.json(); assert.equal(result.strategy.orchestration.searchGrounded, false);
});

test('Build HTTP: strict fields, missing idempotency header, unverified users and active Research block before model calls', async t => {
  const f = await fixture(t);
  const invalid = await f.post('/generate', { ...f.payload(), googleSearch: true }); assert.equal(invalid.status, 400);
  const noKey = await f.post('/generate', f.payload(), { headers: { 'Idempotency-Key': '' } }); assert.equal(noKey.status, 400);
  f.background = f.ownerA;
  const busy = await f.post('/generate', f.payload()); assert.equal(busy.status, 429); assert.equal((await busy.json()).code, 'EXECUTION_BUSY');
  f.background = null; f.users.get(f.ownerA).emailVerifiedAt = null;
  const denied = await f.post('/generate', f.payload()); assert.equal(denied.status, 403);
  assert.equal(f.calls.length, 0);
});

test('Build HTTP: concurrent generation returns EXECUTION_BUSY; provider failures cannot leak internals or save output', async t => {
  const f = await fixture(t); let release;
  f.hold = new Promise(resolve => { release = resolve; });
  const pending = f.post('/generate', f.payload());
  for (let i = 0; i < 100 && f.calls.length < 3; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls.length, 3);
  const second = await f.post('/generate', f.payload()); assert.equal(second.status, 429);
  release(); assert.equal((await pending).status, 200); f.hold = null;
  const before = (await f.repository.list(f.ownerA)).length;
  f.failure = Object.assign(new Error('private stack sk-test-secret /database/path'), { status: 503 });
  f.googleFailure = Object.assign(new Error('private Google failure'), { status: 503 });
  const failed = await f.post('/generate', f.payload()); assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /sk-test-secret|database|stack|gpt-|gemini-/);
  assert.equal((await f.repository.list(f.ownerA)).length, before);
});

test('Build HTTP: consent revocation during generation prevents saving or publishing the result', async t => {
  const f = await fixture(t); let release;
  f.hold = new Promise(resolve => { release = resolve; });
  const pending = f.post('/generate', f.payload());
  for (let i = 0; i < 100 && f.calls.length < 3; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls.length, 3);
  const user = f.users.get(f.ownerA); user.settings.strategyPersonalization = false; user.privacyEpoch++;
  release();
  const response = await pending;
  assert.equal(response.status, 403);
  const body = await response.json(); assert.equal(body.code, 'EXECUTION_REVOKED');
  assert.doesNotMatch(JSON.stringify(body), /Launch brief|authorization revoked|gpt-|gemini-/);
  assert.equal((await f.repository.list(f.ownerA)).length, 0);
});


test('Build HTTP: Gemini 429 recovers through Sol and persists exactly one successful strategy', async t => {
  const f = await fixture(t), payload = f.payload();
  f.googleFailure = Object.assign(new Error('private account capacity'), { status: 429 });
  const response = await f.post('/generate-stream', payload);
  assert.equal(response.status, 200);
  const body = await response.text();
  const events = body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
  const done = events.find(event => event.done);
  assert.equal(done.strategy.title, 'Launch brief');
  assert.equal(events.some(event => event.error), false);
  assert.deepEqual(f.calls.map(call => call.params.model), ['gpt-6-luna', 'gemini-3.8-flash', 'gpt-6.1-sol']);
  assert.equal((await f.repository.list(f.ownerA)).length, 1);
  assert.equal((await f.post('/generate', payload)).status, 200);
  assert.equal(f.calls.length, 3);
});

test('Build HTTP: Sol 503 recovers through Gemini without publishing an error or duplicate record', async t => {
  const f = await fixture(t);
  f.failure = Object.assign(new Error('provider unavailable'), { status: 503 });
  const response = await f.post('/generate-stream', f.payload());
  const text = await response.text();
  const events = text.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
  assert.equal(events.some(event => event.error), false);
  assert.equal(events.find(event => event.done).strategy.title, 'Launch brief');
  assert.deepEqual(f.calls.map(call => call.params.model), ['gpt-6-luna', 'gemini-3.8-flash', 'gpt-6.1-sol', 'gemini-3.8-flash']);
  assert.equal((await f.repository.list(f.ownerA)).length, 1);
});

test('Build HTTP: exhaustion of both providers returns a safe, correlated SSE error without saving', async t => {
  const f = await fixture(t);
  f.googleFailure = Object.assign(new Error('secret Google error'), { status: 429 });
  f.failure = Object.assign(new Error('secret OpenAI error'), { status: 429 });
  const response = await f.post('/generate-stream', f.payload());
  const text = await response.text();
  const events = text.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
  const error = events.find(event => event.error);
  assert.equal(error.code, 'AI_RATE_LIMITED'); assert.equal(error.retryable, true);
  assert.match(error.requestId, /^[a-f0-9-]{36}$/i);
  assert.doesNotMatch(text, /secret Google|secret OpenAI/);
  assert.equal(events.some(event => event.done), false);
  assert.equal((await f.repository.list(f.ownerA)).length, 0);
});

test('Build estimate endpoint is strict, private, Luna-only and shares a tenant-scoped route with assessment input', async t => {
  const f = await fixture(t), brief = 'Prepare a secure technical launch strategy';
  const response = await f.post('/estimate', { brief });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { preparationEstimate: { minMinutes: 5, maxMinutes: 13, bufferMinutes: 3 } });
  assert.deepEqual(f.calls.map(call => call.params.model), ['gpt-6-luna']);
  assert.doesNotMatch(JSON.stringify(f.calls), /Software|UnneededSecretBrand/);
  const again = await f.post('/estimate', { brief });
  assert.equal(again.status, 200); assert.equal(f.calls.length, 1);
  const other = await f.post('/estimate', { brief }, { headers: { 'X-Test-Owner': f.ownerB } });
  assert.equal(other.status, 200); assert.equal(f.calls.length, 2);
  assert.equal((await f.post('/estimate', { brief, googleSearch: true })).status, 400);
  assert.equal((await f.post('/estimate', { brief: 'tiny' })).status, 400);
  const unkeyed = await f.post('/estimate', { brief }, { headers: { 'Idempotency-Key': '' } });
  assert.equal(unkeyed.status, 400);
  f.background = f.ownerA;
  assert.equal((await f.post('/estimate', { brief })).status, 429);
  assert.equal(f.learning.length, 0);
});


test('Build estimate rejects idempotency mismatches and does not spend guest message or brief allowance', async t => {
  const f = await fixture(t), guest = `guest_${randomUUID()}`, key = randomUUID();
  const headers = { 'X-Test-Owner': guest, 'Idempotency-Key': key };
  const response = await f.post('/estimate', { brief: 'Prepare a safe business launch plan' }, { headers });
  assert.equal(response.status, 200);
  const conflict = await f.post('/estimate', { brief: 'Prepare an entirely different safe launch plan' }, { headers });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(f.calls.length, 1);
  const again = await f.post('/estimate', { brief: 'Prepare a safe business launch plan' }, { headers });
  assert.equal(again.status, 200);
  assert.equal(f.calls.length, 1);
  assert.equal(f.policy.inMemoryGuestUsage?.size || 0, 0);
});
