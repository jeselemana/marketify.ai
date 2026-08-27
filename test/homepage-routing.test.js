import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

test('production server serves the public root, existing workspace/auth/legal routes, and preview assets', async (t) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const dataDir = await mkdtemp(path.join(tmpdir(), 'marketify-home-routing-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), APP_URL: `http://127.0.0.1:${port}`, DATA_DIR: dataDir,
      REDIS_URL: '', R2_ENDPOINT: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  t.after(async () => {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    await rm(dataDir, { recursive: true, force: true });
  });
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { response = await fetch(`http://127.0.0.1:${port}/`); break; } catch {}
    if (child.exitCode !== null) throw Error(`Test server exited: ${output}`);
    await delay(100);
  }
  assert.ok(response, `Test server did not start: ${output}`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Marketify v3\.0 — Marketinq üçün iş məkanı/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  for (const route of ['/workspace', '/login', '/signup', '/verify-email', '/privacy', '/terms']) {
    const result = await fetch(`http://127.0.0.1:${port}${route}`);
    assert.equal(result.status, 200);
    assert.match(await result.text(), /id="appShell"/);
  }
  for (const asset of ['/tokens.css', '/home.js', '/prompt-composer.js', '/workspace-intent.js', '/previews/build.webp', '/previews/ask-mobile.webp', '/previews/context.webp']) {
    const result = await fetch(`http://127.0.0.1:${port}${asset}`);
    assert.equal(result.status, 200, asset);
    assert.ok(Number(result.headers.get('content-length')) > 0, asset);
  }
});
