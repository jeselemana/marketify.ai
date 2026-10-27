import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const renderer = source.slice(source.indexOf('function renderPlannerView()'), source.indexOf('/* ===== USAGE LIMITS'));
const tick = () => new Promise(resolve => setImmediate(resolve));

// Isolated DOM fixtures; no HTTP, account data, or persistent storage is touched.
function setup(t, tasks = [], { user = { id: 'fixture-owner', fullName: 'Aylin Məmmədova' }, language = 'en', now = Date.now(), filter = 'active' } = {}) {
  const dom = new JSDOM('<main id="workspace"></main>', { runScripts: 'outside-only', url: 'http://localhost' });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Date.now = () => now;
  w.fixtureFilter = filter;
  w.fixtureTasks = tasks;
  w.fixtureUser = user;
  w.fixtureLanguage = language;
  w.eval(`
    const workspace = document.querySelector('#workspace');
    const state = { currentUser: window.fixtureUser, identityEpoch: 1, plannerTasks: window.fixtureTasks,
      plannerFilter: window.fixtureFilter, plannerCollapsedGroups: new Set(), plannerSelectedTaskIds: new Set() };
    function element(tag, cls = '', text) { const el = document.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; }
    function button(text, cls, handler) { const el = element('button', cls, text); el.type = 'button'; if (handler) el.addEventListener('click', handler); return el; }
    const getLanguage = () => window.fixtureLanguage, t = () => '', getUrgentPlannerTasks = () => [];
    const renderArchivePlannerSwitch = () => element('div');
    const formatDate = date => date;
    const updatePlannerBadge = () => {}, showToast = () => {};
    const isIdentityStale = (epoch, userId) => epoch !== state.identityEpoch || userId !== state.currentUser?.id;
    window.requests = [];
    const authRequest = (path, options) => new Promise((resolve, reject) => window.requests.push({path, options, resolve, reject}));
    const executePlannerTask = task => { window.executed = task.id; };
    const generateExecutionRoadmapForTasks = tasks => { window.roadmap = tasks.map(task => task.id); };
    const prioritizePlannerTasksWithLuna = async () => {};
    ${source.slice(source.indexOf('function getUserFirstName()'), source.indexOf('const BUILD_CTA_LIST_AZ'))}
    ${renderer}
    window.planner = { state, render: renderPlannerView };
  `);
  w.planner.render();
  return { w, doc: w.document, state: w.planner.state };
}
const task = (id, options = {}) => ({ id, text: `Step ${id}`, groupLabel: 'Today', completed: false, ...options });

test('Planner isolates active priorities without duplicate cards and derives real progress', t => {
  const { doc } = setup(t, [task('focus', { isPriority: true }), task('normal'), task('done', { completed: true, priority: 'high' })], { filter: 'archive' });
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 3);
  assert.equal(doc.querySelectorAll('.planner-spotlight .planner-task-card').length, 1);
  assert.match(doc.querySelector('.planner-spotlight').textContent, /Step focus/);
  assert.equal(doc.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '33');
  assert.deepEqual([...doc.querySelectorAll('.planner-metric-value')].map(el => el.textContent), ['2', '1', '1']);
});

test('Planner omits Spotlight when no active priority exists and filters/searches without changing totals', t => {
  const { doc } = setup(t, [task('active'), task('done', { completed: true, isPriority: true })]);
  assert.equal(doc.querySelector('.planner-spotlight'), null);
  doc.querySelectorAll('.planner-filter-pill')[0].click();
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 1);
  const search = doc.querySelector('input[type=search]');
  search.value = 'no match';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 0);
  assert.equal(doc.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '50');
  assert.equal(doc.querySelector('.planner-filter-pill.is-active').getAttribute('aria-pressed'), 'true');
});

test('Planner cards safely render content and preserve Execute, keyboard selection, and bulk roadmap', t => {
  const { doc, w, state } = setup(t, [task('focus', { isPriority: true, text: '<img src=x onerror=alert(1)>', strategyTitle: '<b>Strategy</b>' }), task('done', { completed: true })], { filter: 'archive' });
  assert.equal(doc.querySelector('.planner-task-card img'), null);
  assert.equal(doc.querySelector('.planner-task-source b'), null);
  doc.querySelector('.planner-spotlight .planner-execute-btn').click();
  assert.equal(w.executed, 'focus');
  assert.equal(state.plannerSelectedTaskIds.size, 0);
  const card = doc.querySelector('.planner-spotlight .planner-task-card');
  card.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(state.plannerSelectedTaskIds.has('focus'), true);
  doc.querySelector('.planner-floating-roadmap-btn').click();
  assert.deepEqual(Array.from(w.roadmap), ['focus']);
  assert.equal(doc.querySelector('.is-done .planner-execute-btn').hidden, true);
});

test('Planner completion moves priority out of Spotlight and refreshes progress after persistence', async t => {
  const { doc, w } = setup(t, [task('focus', { priority: 'high' })]);
  doc.querySelector('input[type=checkbox]').click();
  assert.equal(JSON.parse(w.requests[0].options.body).completed, true);
  w.requests[0].resolve({ ok: true });
  await tick();
  assert.equal(doc.querySelector('.planner-spotlight'), null);
  assert.equal(doc.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '100');
});

test('Planner ignores completion responses from an obsolete identity', async t => {
  const { doc, w, state } = setup(t, [task('focus', { priority: 'high' })]);
  doc.querySelector('input[type=checkbox]').click();
  state.identityEpoch++;
  state.currentUser = { id: 'different-owner' };
  state.plannerTasks = [];
  doc.querySelector('#workspace').replaceChildren();
  w.requests[0].reject(new Error('late failure'));
  await tick();
  assert.equal(doc.querySelector('#workspace').childElementCount, 0);
  assert.equal(state.plannerTasks.length, 0);
});

test('Planner CTA uses deterministic task states and the existing profile first name in both languages', t => {
  const cases = [
    { tasks: [], en: 'Aylin, ready to bring a new idea to life?', az: 'Aylin, yeni bir ideyanı həyata keçirməyə hazırsan?' },
    { tasks: [task('active')], en: 'Aylin, what’s on your plan today?', az: 'Aylin, bu gün planında nə var?' },
    { tasks: [task('priority', { priority: 'high' }), task('done', { completed: true })], en: 'Aylin, what are we focusing on today?', az: 'Aylin, bu gün nəyə fokuslanırıq?' },
    { tasks: [task('done', { completed: true, isPriority: true })], en: 'Aylin, what’s your next goal?', az: 'Aylin, növbəti hədəfin nədir?' },
  ];
  for (const scenario of cases) {
    for (const language of ['en', 'az']) {
      const { doc } = setup(t, scenario.tasks, { language });
      assert.equal(doc.querySelector('.planner-capture-title').textContent, scenario[language]);
      assert.equal(doc.querySelector('.planner-capture form input[type=text]').required, true);
      assert.equal(doc.querySelector('.planner-composer-input').placeholder, language === 'en' ? 'Ask Helmer to add anything' : 'Helmer-dən istədiyini əlavə etməsini istə');
      assert.equal(doc.querySelector('.planner-header-row').nextElementSibling.className, 'planner-capture');
      assert.equal(doc.querySelector('.planner-capture').nextElementSibling.className, 'planner-toolbar');
      assert.ok(doc.querySelector('.planner-capture .planner-overview'));
      assert.equal(doc.querySelectorAll('.planner-overview').length, 1);
    }
  }
});

test('Planner CTA safely renders profile names, has a nameless fallback, and ignores search/filter state', t => {
  const { doc } = setup(t, [task('priority', { isPriority: true })], { user: { id: 'fixture-owner', fullName: '<img/src=x> Person' } });
  const title = doc.querySelector('.planner-capture-title').textContent;
  assert.match(title, /^<img\/src=x>,/);
  assert.equal(doc.querySelector('.planner-capture img'), null);
  doc.querySelectorAll('.planner-filter-pill')[1].click();
  const search = doc.querySelector('input[type=search]');
  search.value = 'unmatched';
  search.dispatchEvent(new doc.defaultView.Event('input'));
  assert.equal(doc.querySelector('.planner-capture-title').textContent, title);
  assert.match(doc.querySelector('.planner-capture-context').textContent, /^1 high-priority step/);
  const fallback = setup(t, [], { user: { id: 'fixture-owner' } });
  assert.equal(fallback.doc.querySelector('.planner-capture-title').textContent, 'Ready to bring a new idea to life?');
  const username = setup(t, [], { user: { id: 'fixture-owner', username: 'aylin' } });
  assert.match(username.doc.querySelector('.planner-capture-title').textContent, /^Aylin,/);
});

test('Planner capture retains timeframe submission and updates the CTA after a task is saved', async t => {
  const { w, doc } = setup(t);
  const input = doc.querySelector('.planner-composer-input');
  assert.equal(input.placeholder, 'Ask Helmer to add anything');
  input.value = 'A concrete next step';
  doc.querySelector('.planner-select-native').value = 'Next 7 Days';
  doc.querySelector('.planner-composer-card').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(w.requests[0].path, '/api/planner');
  assert.equal(JSON.parse(w.requests[0].options.body).groupLabel, 'Next 7 Days');
  w.requests[0].resolve({ task: task('saved', { text: input.value, groupLabel: 'Next 7 Days' }) });
  await tick();
  assert.equal(input.value, '');
  assert.equal(doc.querySelector('.planner-capture-title').textContent, 'Aylin, what’s on your plan today?');
  assert.match(doc.querySelector('.planner-capture-context').textContent, /^1 active step/);
});

test('Planner separates completed and overdue tasks while leaving unknown deadlines unguessed', t => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const { doc } = setup(t, [
    task('expired', { groupLabel: 'Next 48 Hours', createdAt: '2026-10-24T12:00:00Z' }),
    task('done', { groupLabel: 'Today', completed: true, createdAt: '2026-10-24T12:00:00Z' }),
    task('future', { groupLabel: 'Next 7 Days', createdAt: '2026-10-26T12:00:00Z' }),
    task('general', { groupLabel: 'General Tasks', createdAt: '2020-01-01T00:00:00Z' }),
    task('invalid', { groupLabel: 'Today', createdAt: 'not a date' }),
  ], { now, filter: 'archive' });
  const group = label => [...doc.querySelectorAll('.planner-group')].find(el => el.querySelector('.planner-group-name').textContent === label);
  assert.match(group('Overdue').textContent, /Step expired/);
  assert.equal(group('Overdue').querySelectorAll('.planner-task-card').length, 1);
  assert.match(group('Completed').textContent, /Step done/);
  assert.equal(group('Completed').querySelector('.planner-group-badge').textContent, '1 completed');
  assert.match(group('Next 7 days').textContent, /Step future/);
  assert.match(group('General').textContent, /Step general/);
  assert.match(group('Today').textContent, /Step invalid/);
  doc.querySelectorAll('.planner-filter-pill')[1].click();
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 1);
  assert.equal(doc.querySelector('.planner-group-name').textContent, 'Completed');
  doc.querySelectorAll('.planner-filter-pill')[0].click();
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 4);
  assert.equal(doc.querySelector('.is-done'), null);
});

test('Planner overdue boundary is fixed to creation and priority retains an overdue status in Spotlight', t => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const { doc } = setup(t, [
    task('boundary', { groupLabel: 'Next 48 Hours', createdAt: '2026-10-25T12:00:00Z' }),
    task('priority', { isPriority: true, groupLabel: 'Növbəti 7 gün', createdAt: '2026-10-01T12:00:00Z' }),
  ], { now });
  assert.equal(doc.querySelector('.planner-spotlight .planner-task-status').textContent, 'Overdue');
  const other = [...doc.querySelectorAll('.planner-group')].find(el => !el.classList.contains('planner-spotlight'));
  assert.equal(other.querySelector('.planner-group-name').textContent, 'Next 48 hours');
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 2);
});


test('Planner defaults to Active and places Archive last with all owner-scoped tasks', t => {
  const { doc, state } = setup(t, [task('active'), task('done', { completed: true })]);
  const pills = [...doc.querySelectorAll('.planner-filter-pill')];
  assert.deepEqual(pills.map(el => el.textContent), ['Active', 'Completed', 'Priority', 'Archive']);
  assert.equal(pills[0].getAttribute('aria-pressed'), 'true');
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 1);
  assert.equal(doc.querySelector('.is-done'), null);
  pills[3].click();
  assert.equal(state.plannerFilter, 'archive');
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 2);
  assert.equal(doc.querySelectorAll('.is-done').length, 1);
  assert.match(source, /plannerFilter: "active"/);
  assert.match(source, /state\.plannerFilter = "active"/);
});

test('Planner search starts collapsed, opens accessibly, and Escape clears the hidden query', t => {
  const { doc, w } = setup(t, [task('one'), task('two')]);
  const input = doc.querySelector('.planner-search-input');
  const toggle = doc.querySelector('.planner-search-toggle');
  assert.equal(input.hidden, true);
  assert.equal(doc.querySelector('.planner-search-bar').hidden, true);
  assert.ok(toggle.parentElement.classList.contains('planner-header-actions'));
  assert.ok(toggle.previousElementSibling.classList.contains('planner-notif-btn'));
  assert.equal(doc.querySelector('.planner-search-bar').parentElement, toggle.parentElement);
  assert.equal(doc.querySelector('.planner-toolbar .planner-search-bar'), null);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), input.id);
  toggle.click();
  assert.equal(input.hidden, false);
  assert.equal(doc.activeElement, input);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.querySelector('path').getAttribute('d'), 'M6 6l12 12M18 6 6 18');
  input.value = 'Step one';
  input.dispatchEvent(new w.Event('input'));
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 1);
  input.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(input.hidden, true);
  assert.equal(input.value, '');
  assert.equal(doc.activeElement, toggle);
  assert.ok(toggle.querySelector('circle'));
  assert.equal(toggle.querySelector('path'), null);
  assert.equal(doc.querySelectorAll('.planner-task-card').length, 2);
  toggle.click();
  toggle.click();
  assert.equal(input.hidden, true);
});

test('Planner capture does not update state or its detached submit control after an identity change', async t => {
  const { doc, w, state } = setup(t);
  const input = doc.querySelector('.planner-composer-input');
  const submit = doc.querySelector('.planner-submit-btn');
  input.value = 'Private owner task';
  doc.querySelector('.planner-composer-card').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(submit.disabled, true);
  state.identityEpoch++;
  state.currentUser = { id: 'new-owner' };
  state.plannerTasks = [];
  doc.querySelector('#workspace').replaceChildren();
  w.requests[0].resolve({ task: task('obsolete') });
  await tick();
  assert.equal(state.plannerTasks.length, 0);
  assert.equal(doc.querySelector('#workspace').childElementCount, 0);
  assert.equal(submit.disabled, true);
});
