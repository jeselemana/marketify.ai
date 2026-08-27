import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INTENT_KEY, INTENT_TTL, saveWorkspaceIntent, readWorkspaceIntent, takeWorkspaceIntent, startWorkspaceIntent } from '../public/workspace-intent.js';
import { bindPromptComposer } from '../public/prompt-composer.js';
import { StrategySchema } from '../src/domain/strategy.js';
import { strategy } from '../dev/homepage-fixture.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('workspace intent preserves exact Unicode, whitespace, line breaks, and selected mode', () => {
  const storage = memoryStorage();
  const prompt = '  Bakı bazarı — “araşdır”\nİkinci sətir.  ';
  for (const mode of ['ask', 'build']) {
    const intent = saveWorkspaceIntent(storage, { prompt, mode });
    assert.equal(readWorkspaceIntent(storage, intent.id).prompt, prompt);
    assert.equal(takeWorkspaceIntent(storage, intent.id).mode, mode);
    assert.equal(takeWorkspaceIntent(storage, intent.id), null);
  }
});

test('invalid, expired, malformed, and unrelated intents cannot auto-submit', () => {
  const storage = memoryStorage();
  const intent = saveWorkspaceIntent(storage, { prompt: 'Test sualı', mode: 'ask' }, 100);
  assert.equal(readWorkspaceIntent(storage, intent.id, 99), null);
  assert.equal(readWorkspaceIntent(storage, intent.id, 100 + INTENT_TTL + 1), null);
  assert.equal(readWorkspaceIntent(storage, 'another-id', 101), null);
  assert.equal(readWorkspaceIntent(storage, null), null);
  storage.setItem(INTENT_KEY, '{broken');
  assert.equal(readWorkspaceIntent(storage, intent.id), null);
  for (const value of [{ prompt: ' ', mode: 'ask' }, { prompt: 'short', mode: 'build' }, { prompt: 'a'.repeat(8001), mode: 'ask' }, { prompt: 'Valid question', mode: 'unknown' }]) {
    assert.throws(() => saveWorkspaceIntent(storage, value));
  }
});

for (const [status, destination] of [[200, '/workspace'], [401, '/login']]) {
  test(`homepage routes auth status ${status} without putting the prompt in a URL`, async () => {
    const storage = memoryStorage();
    let next;
    await startWorkspaceIntent({ storage, prompt: 'Məxfi biznes brifi', mode: 'build', request: async () => ({ ok: status === 200, status }), navigate: path => { next = path; } });
    const url = new URL(next, 'https://marketify.test');
    assert.equal(url.pathname, destination);
    assert.ok(!decodeURIComponent(next).includes('Məxfi'));
    const target = status === 401 ? new URL(url.searchParams.get('returnTo'), url.origin) : url;
    assert.equal(readWorkspaceIntent(storage, target.searchParams.get('start')).prompt, 'Məxfi biznes brifi');
  });
}

test('network errors keep the intent, and storage errors never navigate', async () => {
  const storage = memoryStorage();
  let navigated = false;
  await assert.rejects(startWorkspaceIntent({ storage, prompt: 'Test sualı', mode: 'ask', request: async () => ({ ok: false, status: 503 }), navigate: () => { navigated = true; } }));
  assert.ok(storage.getItem(INTENT_KEY));
  assert.equal(navigated, false);
  await assert.rejects(startWorkspaceIntent({ storage: { setItem: () => { throw Error('quota'); } }, prompt: 'Test sualı', mode: 'ask', navigate: () => { navigated = true; } }));
  assert.equal(navigated, false);
});

test('shared composer validates, preserves text, prevents duplicate submissions, and respects IME', async (t) => {
  globalThis.window = { innerWidth: 1200 };
  t.after(() => { delete globalThis.window; });
  const handlers = {};
  const textarea = { value: '', style: {}, scrollHeight: 50, addEventListener: (type, fn) => { handlers[type] = fn; } };
  const submit = {};
  let formHandler;
  let requests = 0;
  let resolve;
  const form = { addEventListener: (_, fn) => { formHandler = fn; }, requestSubmit: () => { requests++; } };
  const texts = [];
  const binding = bindPromptComposer({ form, textarea, submit, onSubmit: value => { texts.push(value); return new Promise(done => { resolve = done; }); } });
  assert.equal(submit.disabled, true);
  textarea.value = '  Exact input.\n  ';
  binding.refresh();
  assert.equal(submit.disabled, false);
  handlers.keydown({ key: 'Enter', isComposing: true });
  handlers.keydown({ key: 'Enter', shiftKey: true });
  assert.equal(requests, 0);
  handlers.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(requests, 1);
  const first = formHandler({ preventDefault() {} });
  await formHandler({ preventDefault() {} });
  assert.deepEqual(texts, ['  Exact input.\n  ']);
  assert.equal(submit.disabled, true);
  resolve();
  await first;
  assert.equal(submit.disabled, false);
  globalThis.window.innerWidth = 390;
  handlers.keydown({ key: 'Enter' });
  assert.equal(requests, 1);
});

test('homepage contains all sections, accessible paired composers, and no fake claims', async () => {
  const html = await readFile(new URL('../public/home.html', import.meta.url), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/class="home-composer"/g) || []).length, 2);
  assert.equal((html.match(/<details name="faq">/g) || []).length, 6);
  for (const id of ['product', 'capabilities', 'pricing', 'faq', 'about', 'heroPrompt', 'finalPrompt']) assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /lang="az"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /nümunə məzmun/);
  assert.doesNotMatch(html, /10,000|10x|Trusted by|testimonial/);
  assert.equal(StrategySchema.safeParse(strategy).success, true);
});
