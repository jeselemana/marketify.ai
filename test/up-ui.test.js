import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createUpView } from '../public/up.js';
import { dashboard, emptyState } from '../src/services/up/domain.js';
import { randomUUID } from 'node:crypto';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function setup(t, request, user = { id: 'usr_test' }) {
  const dom = new JSDOM('<main id="workspace"></main>');
  globalThis.document = dom.window.document;
  t.after(() => { dom.window.close(); delete globalThis.document; });
  const host = document.querySelector('main');
  const mount = createUpView({ request, getUser: () => user, getLanguage: () => 'en', onLogin: () => {} });
  mount(host);
  return { dom, host };
}

function fullData() {
  const state = emptyState(`usr_${randomUUID()}`);
  state.preferences = { dailyGoal: 50, weeklyGoal: 350, timezone: 'Asia/Baku', interests: ['Finance'] };
  return dashboard(state, Date.now());
}

test('UP onboarding renders goals and semantic skill controls, and sends persisted values without system fields', async t => {
  const calls = [];
  const { dom, host } = setup(t, async (url, options) => {
    calls.push({ url, body: options?.body && JSON.parse(options.body) });
    return url.includes('onboarding') ? fullData() : { onboardingComplete: false, categories: ['Finance', 'Strategy'] };
  });
  await tick();
  assert.equal(host.querySelector('input[name="dailyGoal"]').value, '50');
  host.querySelector('input[name="dailyGoal"]').value = '80';
  host.querySelector('input[name="weeklyGoal"]').value = '600';
  host.querySelector('input[value="Finance"]').checked = true;
  host.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  const onboarding = calls.find(c => c.url.endsWith('onboarding')).body;
  assert.equal(onboarding.dailyGoal, 80);
  assert.equal(onboarding.weeklyGoal, 600);
  assert.ok(onboarding.interests.includes('Finance'));
  assert.equal('points' in onboarding, false);
  assert.match(host.textContent, /Skill Map/);
});

test('UP dashboard uses real response values and start opens an interactive decision test without any textarea', async t => {
  const data = fullData();
  data.totalPoints = 123;
  data.daily.points = 20;
  const c = {
    id: randomUUID(),
    title: '<img src=x onerror=alert(1)> Enterprise Pricing Crisis',
    scenario: '<script>attack()</script> An enterprise client demands 40% discount on renewal.',
    question: 'Which strategic pricing decision would you approve?',
    category: 'Finance',
    difficulty: 2,
    difficultyName: 'Operator',
    maximumPoints: 55,
    options: [
      { id: 'A', text: 'Grant discount in exchange for multi-year lock-in' },
      { id: 'B', text: 'Hold firm on price and offer tiered SLA instead' },
      { id: 'C', text: 'De-scope non-essential modules to meet their budget' },
      { id: 'D', text: 'Walk away to protect gross margin baseline' },
    ],
    status: 'ready',
  };

  const { dom, host } = setup(t, async url => url === '/api/up/challenges' ? c : data);
  await tick();
  assert.match(host.textContent, /123/);
  assert.ok(host.querySelector('.up-beta-chip'), 'Beta chip must be rendered in header');
  assert.equal(host.querySelector('.up-beta-chip').textContent, 'Beta');

  // Verify roadmap card on dashboard
  assert.ok(host.querySelector('.up-roadmap-card'), 'Roadmap card should be rendered on dashboard');
  assert.match(host.querySelector('.up-roadmap-title').textContent, /More updates coming soon|Tezliklə daha çox yenilik/i);
  assert.match(host.querySelector('.up-roadmap-text').textContent, /user tiers|istifadəçi səviyyələri/i);

  [...host.querySelectorAll('button')].find(b => b.textContent === 'Start Challenge').click();
  await tick();

  // Security: No scripts/imgs injected
  assert.equal(host.querySelectorAll('img,script').length, 0);

  // Requirement: ZERO TEXTAREA in UP UI
  const textarea = host.querySelector('textarea');
  assert.equal(textarea, null, 'No textarea should exist in the interactive decision test UI');

  // Requirement: 4 interactive option cards with click-to-select
  const optionCards = host.querySelectorAll('.up-option-card');
  assert.equal(optionCards.length, 4);

  const confirmBtn = host.querySelector('.up-confirm-btn');
  assert.ok(confirmBtn);
  assert.equal(confirmBtn.disabled, true);

  // Click option B
  optionCards[1].click();
  assert.ok(optionCards[1].classList.contains('is-selected'));
  assert.equal(confirmBtn.disabled, false);
});

test('UP interactive decision test evaluates choice, highlights optimal move, trade-off, executive insight and next CTA', async t => {
  const data = fullData();
  const c = {
    id: randomUUID(),
    title: 'Platform Churn Collision',
    scenario: 'Marketplace seller retention dipped 18% after introducing transaction fees.',
    question: 'Which strategic intervention do you execute?',
    category: 'Strategy',
    difficulty: 3,
    difficultyName: 'Strategist',
    maximumPoints: 75,
    options: [
      { id: 'A', text: 'Revert fees entirely and rely on ad monetization' },
      { id: 'B', text: 'Introduce rebate tiers tied to seller volume' },
      { id: 'C', text: 'Bundle analytics software to justify the fee' },
      { id: 'D', text: 'Subsidize top 5% power sellers exclusively' },
    ],
    status: 'ready',
    answer: null,
  };
  data.activeChallenge = c;

  let submittedOption = null;
  const { dom, host } = setup(t, async (url, options) => {
    if (url.endsWith('/submit')) {
      submittedOption = JSON.parse(options.body).selectedOption;
      c.status = 'completed';
      c.answer = submittedOption;
      c.result = {
        points: 40,
        isOptimal: false,
        selectedOptionId: submittedOption,
        optimalOptionId: 'B',
        tradeOff: 'Bundling software increases fixed development cost and delays fee acceptance.',
        insiderInsight: 'Leading marketplaces protect liquidity by tiering take-rates rather than abandoning fees.',
        milestones: ['daily_goal_completed'],
      };
      c.options = [
        { id: 'A', text: 'Revert fees entirely', score: 15, is_optimal: false, trade_off: 'Destroys monetization engine.' },
        { id: 'B', text: 'Introduce rebate tiers', score: 75, is_optimal: true, trade_off: 'Margin compression in high volume cohorts.' },
        { id: 'C', text: 'Bundle analytics software', score: 40, is_optimal: false, trade_off: 'High fixed R&D overhead.' },
        { id: 'D', text: 'Subsidize top 5%', score: 25, is_optimal: false, trade_off: 'Alienates mid-tail sellers.' },
      ];
      data.activeChallenge = null;
      data.history = [c];
      return c;
    }
    return data;
  });

  await tick();
  [...host.querySelectorAll('button')].find(b => b.textContent === 'Continue Decision').click();
  await tick();

  // Select Option C
  const optionCards = host.querySelectorAll('.up-option-card');
  optionCards[2].click();
  assert.ok(optionCards[2].classList.contains('is-selected'));

  // Confirm decision
  const confirmBtn = host.querySelector('.up-confirm-btn');
  confirmBtn.click();
  await tick();
  await tick();

  assert.equal(submittedOption, 'C');

  // Verify Points earned badge
  assert.match(host.textContent, /\+40 Points/);

  // Verify Optimal move highlighted
  assert.ok(host.querySelector('.up-option-card.is-optimal'));

  // Verify Trade-off card rendered
  assert.ok(host.querySelector('.up-tradeoff-card'));
  assert.match(host.querySelector('.up-tradeoff-card').textContent, /Trade-off/);

  // Verify Executive Insight card rendered
  assert.ok(host.querySelector('.up-executive-insight'));
  assert.match(host.querySelector('.up-executive-insight').textContent, /Executive Insight/i);

  // Verify Next Decision button
  assert.ok([...host.querySelectorAll('button')].find(b => b.textContent.includes('Next Decision')));
});

test('UP Next Decision immediately clears stale scenario and result card, displays skeleton loading state, and transitions seamlessly', async t => {
  const data = fullData();
  const c1 = {
    id: randomUUID(),
    title: 'Initial Crisis Dilemma',
    scenario: 'Old dilemma that was already evaluated.',
    question: 'What do you do?',
    category: 'Operations',
    difficulty: 2,
    difficultyName: 'Operator',
    maximumPoints: 40,
    options: [
      { id: 'A', text: 'Option A', score: 40, is_optimal: true, trade_off: 'Trade-off A' },
      { id: 'B', text: 'Option B', score: 20, is_optimal: false, trade_off: 'Trade-off B' },
      { id: 'C', text: 'Option C', score: 25, is_optimal: false, trade_off: 'Trade-off C' },
      { id: 'D', text: 'Option D', score: 10, is_optimal: false, trade_off: 'Trade-off D' },
    ],
    status: 'completed',
    answer: 'A',
    result: {
      points: 40,
      isOptimal: true,
      selectedOptionId: 'A',
      optimalOptionId: 'A',
      tradeOff: 'Trade-off A',
      insiderInsight: 'Insight 1',
      milestones: ['daily_goal_completed'],
    },
  };
  data.history = [c1];

  const c2 = {
    id: randomUUID(),
    title: 'Brand New Strategic Dilemma',
    scenario: 'Freshly generated dilemma from AI.',
    question: 'How do you respond?',
    category: 'Strategy',
    difficulty: 3,
    difficultyName: 'Strategist',
    maximumPoints: 60,
    options: [
      { id: 'A', text: 'New Option A' },
      { id: 'B', text: 'New Option B' },
      { id: 'C', text: 'New Option C' },
      { id: 'D', text: 'New Option D' },
    ],
    status: 'ready',
  };

  let resolveChallenge2;
  const challengePromise = new Promise(resolve => { resolveChallenge2 = resolve; });

  const { dom, host } = setup(t, async (url, options) => {
    if (url === '/api/up/challenges' && options?.method === 'POST') {
      return challengePromise;
    }
    return data;
  });

  await tick();
  // Open completed challenge from history
  const historyBtn = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Initial Crisis Dilemma'));
  historyBtn.click();
  await tick();

  // Confirm old scenario and result card are displayed
  assert.ok(host.querySelector('.up-scenario-title').textContent.includes('Initial Crisis Dilemma'));
  assert.ok(host.querySelector('.up-result-card'));

  const nextBtn = host.querySelector('.up-next-btn');
  assert.ok(nextBtn);

  // Click Next Decision
  nextBtn.click();

  // REQUIREMENT 1: Immediate state clearance (zero stale content)
  assert.equal(host.querySelector('.up-result-card'), null, 'Old result card must be immediately removed from DOM');
  assert.equal(host.querySelector('.up-scenario-title'), null, 'Old scenario title must be immediately removed from DOM');
  assert.equal(host.querySelector('.up-tradeoff-card'), null, 'Old trade-off card must be immediately removed');
  assert.equal(host.querySelector('.up-executive-insight'), null, 'Old insight must be immediately removed');

  // REQUIREMENT 2: Button must be disabled to prevent duplicate submission
  assert.equal(nextBtn.disabled, true, 'Next button must be disabled immediately');

  // REQUIREMENT 3: Premium skeleton UI and minimalist loader
  assert.ok(host.querySelector('.up-generating-card'), 'Generating card skeleton must be rendered');
  assert.ok(host.querySelector('.up-spinner'), 'Spinner must be rendered');
  assert.match(host.querySelector('.up-generating-text').textContent, /Preparing|Hazırlanır/i);
  assert.equal(host.querySelectorAll('.up-skeleton-option-card').length, 4, '4 skeleton option cards must be visible');

  // REQUIREMENT 4: When new dilemma arrives, loading clears and new scenario renders
  resolveChallenge2(c2);
  await tick();
  await tick();

  assert.equal(host.querySelector('.up-generating-card'), null, 'Loading skeleton should be gone');
  assert.equal(host.querySelector('.up-scenario-title').textContent, 'Brand New Strategic Dilemma');
  assert.equal(host.querySelectorAll('.up-option-card').length, 4);
});

test('UP account changes suppress late responses and guests have an actionable sign-in surface', async t => {
  let resolve;
  const response = new Promise(r => resolve = r);
  let user = { id: 'first' };
  const dom = new JSDOM('<main></main>');
  globalThis.document = dom.window.document;
  t.after(() => { dom.window.close(); delete globalThis.document; });
  const host = document.querySelector('main');
  createUpView({ request: () => response, getUser: () => user, getLanguage: () => 'en', onLogin: () => {} })(host);
  user = { id: 'second' };
  resolve(fullData());
  await tick();
  assert.doesNotMatch(host.textContent, /Skill Map/);

  host.replaceChildren();
  let logins = 0;
  createUpView({ request: () => assert.fail('guest request'), getUser: () => null, getLanguage: () => 'en', onLogin: () => logins++ })(host);
  assert.ok(host.querySelector('.up-roadmap-card'), 'Guest surface should also render roadmap card');
  host.querySelector('button').click();
  assert.equal(logins, 1);
});

test('UP is connected to both navigation surfaces, preserves Build/Ask modes and has mobile/focus rules', async () => {
  const [html, js, css] = await Promise.all(['public/index.html', 'public/script.js', 'public/up.css'].map(file => fs.readFile(file, 'utf8')));
  assert.match(html, /id="upNav"/);
  assert.match(html, /id="railUpButton"/);
  assert.match(html, /id="upNav"[^>]*>[\s\S]*?M12 5a3 3 0 1 0/);
  assert.match(html, /id="railUpButton"[^>]*>[\s\S]*?M12 5a3 3 0 1 0/);
  assert.doesNotMatch(html, /id="upNav"[^>]*>[\s\S]*?M4 17l6-6/);
  assert.doesNotMatch(html, /id="railUpButton"[^>]*>[\s\S]*?M4 17l6-6/);
  assert.match(js, /state\.view === "up"\) return renderUpView\(workspace\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /minmax\(0, 1fr\)/);
  assert.match(css, /\.up-roadmap-card/);
});
