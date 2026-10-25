import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { preparationEstimateForRoute, BuildEstimateRequestSchema, buildRoutingInput } from '../src/services/ai/build-estimate.js';
const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('let buildEstimateTimer ='), source.indexOf('function renderIntake('));
function harness(t) {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only', url: 'https://helmer.local' });
  t.after(() => dom.window.close());
  dom.window.eval(`
    const state = {brief:'Prepare a secure technical strategy',mode:'build',status:'draft',currentUser:{id:'a'}};
    function element(tag, cls, text) { const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n; }
    function getLanguage() { return 'az'; }
    window.timers=[]; window.setTimeout=fn=>{window.timers.push(fn);return window.timers.length;};window.clearTimeout=()=>{};
    window.requests=[];
    async function api(path,opts) { return new Promise(resolve=>window.requests.push({path,opts,resolve})); }
    ${helpers}
    window.h={state,createBuildEstimateCard,refreshBuildEstimateCards,updateBuildEstimate,scheduleBuildEstimate,cancelBuildEstimate};
  `);
  return dom.window;
}
test('range uses Luna complexity and adds exactly two or three conservative upper minutes', () => {
  assert.deepEqual(preparationEstimateForRoute({complexity:'small',reasoning:'low'}), {minMinutes:1,maxMinutes:4,bufferMinutes:2});
  assert.deepEqual(preparationEstimateForRoute({complexity:'medium',reasoning:'medium'}), {minMinutes:2,maxMinutes:7,bufferMinutes:3});
  assert.deepEqual(preparationEstimateForRoute({complexity:'complex',reasoning:'high',googleSearch:true}), {minMinutes:5,maxMinutes:13,bufferMinutes:3});
  assert.equal(BuildEstimateRequestSchema.safeParse({brief:'Valid brief',model:'other'}).success,false);
  assert.equal(buildRoutingInput({brief:' A prompt '}),buildRoutingInput({brief:'A prompt',answers:[],assumptions:[]}));
});
test('card renders safe validated numeric data and never renders supplied markup', t => {
  const w=harness(t),h=w.h,card=h.createBuildEstimateCard();w.document.body.append(card);
  h.updateBuildEstimate({minMinutes:4,maxMinutes:11,bufferMinutes:3});
  assert.match(card.textContent,/Təxmini hazırlanma vaxtı:4–11 dəqiqə/);
  h.updateBuildEstimate({minMinutes:'<img src=x onerror=alert(1)>',maxMinutes:11,bufferMinutes:3});
  assert.equal(card.querySelector('img'),null);assert.match(card.textContent,/4–11/);
  h.state.brief='';h.refreshBuildEstimateCards();assert.equal(card.hidden,true);
});
test('typing debounce cancels stale requests and editing prevents obsolete estimates overwriting the card', async t => {
  const w=harness(t),h=w.h;w.document.body.append(h.createBuildEstimateCard());
  h.scheduleBuildEstimate();w.timers.at(-1)();assert.equal(w.requests.length,1);
  const old=w.requests[0];h.state.brief='An entirely different application';h.scheduleBuildEstimate();
  assert.equal(old.opts.signal.aborted,true);
  old.resolve({preparationEstimate:{minMinutes:4,maxMinutes:11,bufferMinutes:3}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.state.buildPreparationEstimate,undefined);
  w.timers.at(-1)();w.requests[1].resolve({preparationEstimate:{minMinutes:1,maxMinutes:4,bufferMinutes:2}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.state.buildPreparationEstimate.maxMinutes,4);
  h.scheduleBuildEstimate();assert.equal(w.requests.length,2);
});
