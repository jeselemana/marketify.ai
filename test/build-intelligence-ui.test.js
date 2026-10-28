import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('let buildIntelligenceCleanup'), source.indexOf('function cancelCurrentAnalysis'));
function harness(t, reduced = false) {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.arcs = [];
  w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_, key) => key === 'arc' ? (...args) => w.arcs.push(args) : key === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {}, set: () => true });
  w.eval(`
    const workspace=document.querySelector('main');
    const state={status:'analyzing',identityEpoch:1,currentUser:{id:'a'},answers:[]};
    function element(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
    function getLanguage(){return 'en'}
    function isIdentityStale(e,id){return e!==state.identityEpoch||id!==state.currentUser.id}
    function createBuildEstimateCard(){return element('div','build-estimate-card')}
    function refreshBuildEstimateCards(){}
    function startBuildCountdown(){}
    window.frames=new Map();let next=0;window.disconnected=0;
    window.requestAnimationFrame=fn=>{frames.set(++next,fn);return next};window.cancelAnimationFrame=id=>frames.delete(id);
    window.matchMedia=()=>({matches:${reduced},addEventListener(){},removeEventListener(){}});
    window.ResizeObserver=class{observe(){} disconnect(){window.disconnected++}};
    ${helpers}
    window.h={state,renderLoading,stopBuildIntelligence,workspace,syncBuildMenuActions};
  `);
  return w;
}
function tick(w) { const entries=[...w.frames];w.frames.clear();for(const [,fn] of entries)fn(1000); }
test('Build workflow follows actual lifecycle and never advances with animation frames', t => {
  const w=harness(t);w.h.renderLoading();tick(w);tick(w);
  assert.equal(w.document.querySelector('[aria-current]').textContent,'Brief analysis');
  assert.equal(w.document.querySelectorAll('.build-rail-action').length,2);
  assert.equal(w.document.querySelector('.build-rail-action[aria-label="Continue in background"]'),null);
  w.document.querySelector('.build-rail-actions').remove();
  w.h.stopBuildIntelligence();w.h.workspace.replaceChildren();w.h.state.status='generating';w.h.renderLoading();
  assert.equal(w.document.querySelector('[aria-current]').textContent,'Strategy');
  assert.equal(w.document.querySelectorAll('.build-rail-action').length,1);
  assert.equal(w.document.querySelector('.build-rail-action').getAttribute('aria-label'),'Continue in background');
  assert.equal(w.document.querySelectorAll('.intelligence-workflow .is-complete').length,1);
  w.h.stopBuildIntelligence();assert.equal(w.frames.size,0);
});
test('Build reduced motion draws once; detached and stale identity views release animation resources', async t => {
  const reduced=harness(t,true);reduced.h.renderLoading();tick(reduced);assert.equal(reduced.frames.size,0);reduced.h.stopBuildIntelligence();
  const w=harness(t);w.h.renderLoading();w.h.state.identityEpoch++;tick(w);assert.equal(w.frames.size,0);assert.equal(w.disconnected,1);
  const detached=harness(t);detached.h.renderLoading();detached.h.workspace.replaceChildren();await new Promise(resolve=>setImmediate(resolve));assert.equal(detached.frames.size,0);assert.equal(detached.disconnected,1);
});

function pointer(w, canvas, type, x, y, id = 1, pointerType = 'mouse') {
  const event = new w.Event(type, { cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, pointerType, button: 0, isPrimary: true });
  canvas.dispatchEvent(event);
  return event;
}
function interactiveCanvas(w) {
  w.h.renderLoading();
  const canvas = w.document.querySelector('canvas');
  Object.defineProperties(canvas, { clientWidth: {value:720}, clientHeight: {value:370} });
  canvas.getBoundingClientRect = () => ({ left:0, top:0, width:720, height:370 });
  let captured = null;
  canvas.setPointerCapture = id => { captured = id; };
  canvas.hasPointerCapture = id => captured === id;
  canvas.releasePointerCapture = () => { captured = null; };
  return canvas;
}
test('Core supports direct reduced-motion rotation without inertia and releases pointer capture on cleanup', t => {
  const w=harness(t,true), canvas=interactiveCanvas(w);
  tick(w); const before=w.arcs.at(-1);
  pointer(w,canvas,'pointerdown',360,185);
  assert.equal(canvas.hasPointerCapture(1),true);
  pointer(w,canvas,'pointermove',400,210);tick(w);
  assert.notDeepEqual(w.arcs.at(-1),before);
  assert.equal(w.frames.size,0);
  pointer(w,canvas,'pointerup',400,210);tick(w);
  const released=w.arcs.at(-1);assert.equal(w.frames.size,0);
  pointer(w,canvas,'pointermove',380,185);tick(w);
  assert.deepEqual(w.arcs.at(-1),released,'reduced motion ignores hover tilt');
  pointer(w,canvas,'pointerdown',360,185);
  w.h.stopBuildIntelligence();assert.equal(canvas.hasPointerCapture(1),false);
  pointer(w,canvas,'pointermove',420,200);assert.equal(w.frames.size,0);
});
test('Core only captures inside the sphere, ignores other pointers, and leaves touch scrolling to the browser', t => {
  const w=harness(t), canvas=interactiveCanvas(w);
  pointer(w,canvas,'pointerdown',10,10);assert.equal(canvas.hasPointerCapture(1),false);
  const down=pointer(w,canvas,'pointerdown',360,185,1,'touch');assert.equal(down.defaultPrevented,false);
  pointer(w,canvas,'pointerup',360,185,2,'touch');assert.equal(canvas.hasPointerCapture(1),true);
  const move=pointer(w,canvas,'pointermove',390,185,1,'touch');assert.equal(move.defaultPrevented,false);
  pointer(w,canvas,'pointercancel',390,185,1,'touch');assert.equal(canvas.hasPointerCapture(1),false);
  assert.equal(canvas.classList.contains('is-dragging'),false);
  w.h.stopBuildIntelligence();
});
test('Release retains inertia while pointer cancellation stops it without changing workflow', t => {
  const released=harness(t), cancelled=harness(t);
  for (const [w,end] of [[released,'pointerup'],[cancelled,'pointercancel']]) {
    const canvas=interactiveCanvas(w);tick(w);
    pointer(w,canvas,'pointerdown',360,185);
    pointer(w,canvas,'pointermove',400,205);
    pointer(w,canvas,end,400,205);
    const pending=[...w.frames];w.frames.clear();for(const [,fn] of pending)fn(1050);
    assert.equal(w.document.querySelector('[aria-current]').textContent,'Brief analysis');
  }
  assert.notDeepEqual(released.arcs.at(-1),cancelled.arcs.at(-1));
  released.h.stopBuildIntelligence();cancelled.h.stopBuildIntelligence();
});

test('Menu mirrors Build stage actions, preserves navigation and delegates to the same rail handlers', t => {
  const w=harness(t);
  const sidebar=w.document.createElement('aside');sidebar.className='sidebar';
  const nav=w.document.createElement('nav');nav.className='primary-nav';
  const home=w.document.createElement('button');home.textContent='Home';nav.append(home);sidebar.append(nav);w.document.body.append(sidebar);
  let closed=0,stopped=0,history=0,background=0;
  w.closeSidebar=()=>closed++;
  w.cancelCurrentAnalysis=()=>stopped++;
  w.showAnalysisHistoryModal=assessment=>{assert.equal(assessment,true);history++};
  w.minimizeToBackground=()=>background++;
  w.confirm=()=>true;
  w.h.renderLoading();
  let buttons=sidebar.querySelectorAll('.build-menu-actions button');
  assert.deepEqual([...buttons].map(b=>b.textContent.trim()),['Stop','History']);
  buttons[0].click();buttons[1].click();
  assert.equal(stopped,1);assert.equal(history,1);assert.equal(closed,2);
  assert.equal(nav.contains(home),true);
  const oldButton=buttons[0];
  w.h.stopBuildIntelligence();w.h.workspace.replaceChildren();w.document.querySelector('.build-rail-actions').remove();
  w.h.state.status='generating';w.h.renderLoading();
  buttons=sidebar.querySelectorAll('.build-menu-actions button');
  assert.equal(buttons.length,1);assert.equal(buttons[0].textContent.trim(),'Continue in background');
  buttons[0].click();assert.equal(background,1);
  oldButton.click();assert.equal(stopped,1,'detached rail handlers cannot be invoked by stale Menu items');
  assert.equal(sidebar.querySelectorAll('.build-menu-actions').length,1);
  assert.equal(nav.contains(home),true);
  w.h.stopBuildIntelligence();
});
