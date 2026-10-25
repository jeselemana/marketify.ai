import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createAskTransport } from '../src/http/ask-transport.js';

const source = await fs.readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const start = source.indexOf('async function consumeAskEventStream(');
const end = source.indexOf('async function submitAskMessage(', start);
const consume = vm.runInNewContext(`(${source.slice(start, end).trim()})`, { TextDecoder, setTimeout, clearTimeout, getLanguage: () => 'en' });
const frame = value => `data: ${JSON.stringify(value)}\r\n\r\n`;
function readerFor(parts) {
  let index = 0, cancelled = false, released = false;
  return {
    read: async () => index < parts.length ? { value: parts[index++], done: false } : { done: true },
    cancel: async () => { cancelled = true; }, releaseLock: () => { released = true; },
    get disposed() { return cancelled && released; },
  };
}

test('Ask parser handles every UTF-8 byte boundary, CRLF, heartbeat and a final unterminated frame', async () => {
  const encoded = new TextEncoder().encode(': keepalive\r\n\r\n' + frame({ chunk: 'Əla 🙂' }) + 'data: {"done":true,"reply":"Əla 🙂"}');
  const reader = readerFor([...encoded].map(byte => new Uint8Array([byte])));
  const events = [];
  await consume(reader, value => events.push(value));
  assert.equal(events[0].chunk, 'Əla 🙂'); assert.equal(events[1].reply, 'Əla 🙂'); assert.equal(reader.disposed, true);
});

test('done returns without waiting for EOF and no later chunk is accepted', async () => {
  const reader = readerFor([new TextEncoder().encode(frame({ done: true, reply: 'OK' }) + frame({ chunk: 'injected after done' }))]);
  const events = [];
  await consume(reader, value => events.push(value));
  assert.equal(events.length, 1); assert.equal(reader.disposed, true);
});

for (const [name, text] of [
  ['truncated', frame({ chunk: 'Partial' })],
  ['malformed JSON', 'data: {broken}\n\n'],
  ['invalid chunk type', frame({ chunk: { html: '<script>' } })],
  ['error with JSON in its text', frame({ error: 'JSON provider unavailable' })],
]) test(`Ask parser fails closed on ${name} and releases its reader`, async () => {
  const reader = readerFor([new TextEncoder().encode(text)]);
  await assert.rejects(consume(reader, () => {})); assert.equal(reader.disposed, true);
});

test('Ask parser caps incomplete frames and times out stalled reads', async () => {
  const reader = readerFor([new TextEncoder().encode('data: ' + 'x'.repeat(100))]);
  await assert.rejects(consume(reader, () => {}, { maxFrameChars: 20 })); assert.equal(reader.disposed, true);
  reader.read = () => new Promise(() => {});
  await assert.rejects(consume(reader, () => {}, { idleTimeoutMs: 10 }));
});

class Response extends EventEmitter {
  constructor() { super(); this.headers = {}; this.frames = []; this.writableEnded = false; this.destroyed = false; this.writableLength = 0; }
  setHeader(key, value) { this.headers[key] = value; }
  flushHeaders() {}
  write(value) { this.frames.push(value); }
  end(value) { if (value) this.frames.push(value); this.writableEnded = true; this.emit('finish'); }
  status(code) { this.statusCode = code; return this; }
  json(value) { this.frames.push(value); this.end(); }
}
function transportFixture(t, limits) {
  const req = new EventEmitter(), res = new Response(); req.complete = true;
  const transport = createAskTransport(req, res, limits);
  t.after(() => transport.dispose());
  return { req, res, transport };
}

test('normal request-body close does not cancel; response disconnect always cancels', t => {
  const { req, res, transport } = transportFixture(t);
  req.emit('close'); assert.equal(transport.signal.aborted, false);
  res.emit('close'); assert.equal(transport.signal.aborted, true);
  transport.dispose();
  assert.equal(req.listenerCount('close'), 0); assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('close'), 0);
});

test('backpressure waits for drain, bounds buffering and aborts on disconnect', async t => {
  const { res, transport } = transportFixture(t, { maxBufferedBytes: 10 });
  transport.start(); res.writableNeedDrain = true;
  let settled = false;
  const waiting = transport.drain().then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
  res.writableNeedDrain = false; res.emit('drain'); await waiting;
  res.writableLength = 11;
  assert.throws(() => transport.send({ chunk: 'text' }), { code: 'ASK_SLOW_CONSUMER' });
  const other = transportFixture(t);
  other.res.writableNeedDrain = true;
  const pending = other.transport.drain(); other.res.emit('close');
  await assert.rejects(pending, { name: 'AbortError' });
});

test('request deadline ends a stalled context load, and streamed failures never expose raw provider fields', async t => {
  const { res, transport } = transportFixture(t, { requestTimeoutMs: 10 });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(transport.signal.aborted, true); assert.equal(res.statusCode, 504); assert.equal(res.writableEnded, true);
  const other = transportFixture(t); other.transport.start();
  other.transport.fail({ code: 'SECRET_PROVIDER_TOKEN', message: 'raw key', stack: 'private path' });
  const text = other.res.frames.join('');
  assert.ok(!text.includes('SECRET')); assert.ok(!text.includes('raw key')); assert.match(text, /ASK_ERROR/);
});

test('Ask retries freeze the payload and idempotency key; revision changes create a new operation', async () => {
  const calls = [];
  let keys = 0;
  const start = source.indexOf('function createAskRequestOperation(');
  const end = source.indexOf('// Shared by Ask send', start);
  const create = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
    window: { helmerSecurity: { idempotencyKey: () => `fixture-operation-${++keys}` } },
    isModelImprovementActive: () => false,
    fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true }; },
  });
  const payload = { messages: [{ role: 'user', content: 'Original question' }], chatRevision: 1 };
  const operation = create(payload);
  payload.messages[0].content = 'Later mutation';
  await operation.send(); await operation.send();
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  assert.ok(!calls[0].body.includes('Later mutation'));
  await operation.withRevision(2).send();
  assert.notEqual(calls[2].headers['Idempotency-Key'], calls[0].headers['Idempotency-Key']);
  assert.equal(JSON.parse(calls[2].body).chatRevision, 2);
  assert.equal(JSON.parse(calls[0].body).chatRevision, 1);
});
