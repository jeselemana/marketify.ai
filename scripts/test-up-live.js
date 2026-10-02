// Explicit opt-in integration test. Uses GPT-6 Luna, an isolated verified account,
// the real Helmer server/auth routes, and temporary storage; never touches users.json in R2.
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { FileUpRepository } from '../src/repositories/file-up-repository.js';
import { UpService } from '../src/services/up/up-service.js';
import { aiConfig } from '../src/services/ai/config.js';

if (process.argv.includes('--cloud')) {
  const repository = new FileUpRepository('/tmp/helmer-up-cloud-smoke');
  if (!repository.cloud) throw new Error('R2 is not configured');
  const owner = `usr_${randomUUID()}`, service = new UpService(repository);
  try {
    await service.preferences(owner, { dailyGoal: 10, weeklyGoal: 10, interests: ['Finance'], timezone: 'Asia/Baku' }, true);
    const second = new FileUpRepository('/tmp/helmer-up-cloud-smoke');
    await Promise.all([repository.mutate(owner, state => { state.cloudSmokeCount = (state.cloudSmokeCount || 0) + 1; }), second.mutate(owner, state => { state.cloudSmokeCount = (state.cloudSmokeCount || 0) + 1; })]);
    assert.equal((await repository.read(owner)).cloudSmokeCount, 2);
    const challenge = await service.start(owner, 'en');
    const answer = 'I would separate customer cohorts and channels, calculate contribution margin and payback using retention-adjusted cash flows, then compare a small reversible pilot against doing nothing. I would test the main bottleneck with segment-level data before scaling spending, state assumptions, and stop the pilot if payback or retention worsens. The decision should protect cash runway and avoid optimizing growth at the expense of profitable customers.';
    const result = await service.submit(owner, challenge.id, answer, 'en');
    await service.submit(owner, challenge.id, answer, 'en');
    assert.equal((await repository.read(owner)).transactions.length, 1);
    assert.equal((await service.home(owner)).totalPoints, result.result.points);
    console.log(JSON.stringify({ cloud: 'R2', model: aiConfig.upModel, conditionalConcurrency: 'passed', generation: 'passed', evaluation: 'passed', ledgerTransactions: 1, points: result.result.points, replay: 'passed' }));
  } finally { await repository.deleteAllByOwner(owner); }
  process.exit(0);
}

// Disable shared stores before constructing any account repository.
for (const key of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'REDIS_URL']) process.env[key] = '';
const { FileUserRepository } = await import('../src/repositories/file-user-repository.js');
const { hashPassword } = await import('../src/auth/password.js');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'helmer-up-live-'));
const repository = new FileUserRepository(path.join(directory, 'users.json'));
const password = 'UpReviewPass123!';
const user = await repository.create({ fullName: 'UP Review', username: 'up_review', email: 'up_review@example.test', passwordHash: await hashPassword(password), emailVerifiedAt: new Date().toISOString() });
const port = Number(process.env.UP_TEST_PORT || 5068), base = `http://localhost:${port}`;
const output = await fs.open(path.join(directory, 'server.log'), 'w', 0o600);
const child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), APP_URL: base, DATA_DIR: directory, NODE_ENV: 'development' }, stdio: ['ignore', output.fd, output.fd] });
const cleanup = async () => { child.kill('SIGTERM'); await output.close(); await fs.rm(directory, { recursive: true, force: true }); };
process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${await fs.readFile(path.join(directory, 'server.log'), 'utf8')}`);
    try { await fetch(`${base}/api/auth/me`); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, 'Server startup');
  let cookie = '';
  const call = async (url, method = 'GET', body) => {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return { response, data };
  };
  const login = async () => { const result = await call('/api/auth/login', 'POST', { identifier: user.username, password }); assert.equal(result.response.status, 200); cookie = result.response.headers.getSetCookie().filter(value => value.startsWith('helmer_session=')).at(-1).split(';')[0]; };
  assert.equal((await call('/api/up')).response.status, 401);
  await login();
  assert.equal((await call('/api/up/onboarding', 'POST', { dailyGoal: 10, weeklyGoal: 10, interests: ['Finance', 'Strategy'], timezone: 'Asia/Baku' })).response.status, 200);
  console.log('Live auth and onboarding passed; generating with GPT-6 Luna…');
  const generated = await call('/api/up/challenges', 'POST', { language: 'en' });
  assert.equal(generated.response.status, 200, JSON.stringify(generated.data));
  const challenge = generated.data;
  assert.ok(challenge.scenario.length > 20); assert.ok(challenge.expectedDimensions.length >= 2);
  assert.equal((await call('/api/up/challenges', 'POST', { language: 'en' })).data.id, challenge.id);
  const answer = 'I would first identify the largest bottleneck with segment and cohort data, verify the baseline, and calculate contribution margin, payback and cash runway under realistic retention assumptions. I would compare a targeted reversible pilot with the current plan, state the uncertain assumptions, and reserve capacity for downside risk. Before scaling investment I would define a measurable success threshold and stop if retention, payback or operational quality worsened. This protects scarce resources while testing the causal explanation instead of treating all customers and channels alike.';
  const completed = await call(`/api/up/challenges/${challenge.id}/submit`, 'POST', { answer, language: 'en' });
  assert.equal(completed.response.status, 200, JSON.stringify(completed.data));
  const result = completed.data.result;
  assert.ok(result.points >= 0 && result.points <= challenge.maximumPoints);
  assert.equal(result.breakdown.reduce((s, row) => s + row.points, 0), result.points);
  assert.equal((await call(`/api/up/challenges/${challenge.id}/submit`, 'POST', { answer, language: 'en' })).data.result.points, result.points);
  const persisted = (await call('/api/up')).data;
  assert.equal(persisted.totalPoints, result.points); assert.equal(persisted.streak, 1);
  await call('/api/auth/logout', 'POST', {});
  assert.equal((await call('/api/up')).response.status, 401);
  await login(); assert.equal((await call('/api/up')).data.totalPoints, result.points);
  const report = { model: aiConfig.upModel, verifiedAccount: true, auth: 'passed', onboarding: 'passed', generation: 'passed', evaluation: 'passed', points: result.points, replay: 'passed', logoutLoginPersistence: 'passed', challengeId: challenge.id, timestamp: new Date().toISOString() };
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
  if (process.argv.includes('--serve')) {
    console.log(JSON.stringify({ preview: `${base}/workspace?view=up`, username: user.username, password, temporaryData: directory }));
    await new Promise(resolve => child.once('exit', resolve));
  }
} finally { await cleanup(); }
