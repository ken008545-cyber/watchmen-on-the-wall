#!/usr/bin/env node
// Upgrade 22 verification — FULLSCREEN, RESTORED (kennin, voice call
// 2026-10-31: "You need to put full screen back on the game.").
// Diagnosis (BUILD-NOTES): the buttons never left their seats — every
// press vanished into Phaser's scale.startFullscreen() inside a bare
// try/catch (a refused request rejects unhandled; an unsupported one
// only emits an event nothing hears), the button could never EXIT,
// and the hotfix's standalone hide read the HOST window's display
// mode, so framed inside a standalone host the button hid while the
// game stood in a part-page frame. Batteries:
// (1) statics — both buttons (and the rooms') stand at their seats,
//     route through fsPress, are never hidden, and nothing calls
//     Phaser's startFullscreen anymore; displayMode knows embedded;
// (2) the standalone law, kept and bounded — top-level standalone is
//     still standalone; standalone + EMBEDDED is a browser (or the
//     iOS install route): the framed game is not fullscreen just
//     because its host is an installed app window;
// (3) the machinery over fake documents — the request lands on the
//     #game container, options-then-bare retry, the webkit fallback,
//     a rejection answered by the visible blocked float (never
//     silence, never an unhandled rejection), the exit on the next
//     press, and the labels keeping the truth off the live state.
// A real thumb on a real Samsung still closes what no harness can:
// the press itself, on kennin's phone.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

// ---------- statics ----------
const main = read('js/main.js'), net = read('js/net.js');
ok((main.match(/fsPress\(this\)/g) || []).length >= 2 && (net.match(/fsPress\(this\)/g) || []).length >= 1,
  'three fullscreen buttons route through fsPress: Menu, the battle bar, and the rooms bar');
ok(main.includes("button(this,1150,42,220,46,fsActive()?'Exit full':'Fullscreen',()=>fsPress(this)") &&
   main.includes("button(this,1221,HUD_Y+26,110,36,fsActive()?'Exit full':'Fullscreen',()=>fsPress(this)") &&
   net.includes("button(this,1221,HUD_Y+26,110,36,fsActive()?'Exit full':'Fullscreen',()=>fsPress(this)"),
  'the buttons stand at their seats with the truth-telling label (Fullscreen / Exit full by live state)');
ok(!main.includes('fsMenuBtn.setVisible(false)') && !main.includes('fsb.setVisible(false)') && !net.includes('nfsb.setVisible(false)'),
  'no fullscreen button is ever hidden again — standalone included');
ok(!main.includes('this.scale.startFullscreen('), 'Phaser\'s silent startFullscreen is called nowhere in main.js — fsToggle owns the request');
ok(main.includes('function fsToggle') && main.includes('function fsRequest') && main.includes('function fsExit') &&
   main.includes('function fsFloat') && main.includes('function fsSyncLabels') && main.includes("addEventListener(ev,()=>fsSyncLabels())"),
  'the fs machinery stands in main.js, with the labels synced on the real fullscreenchange events');
ok(main.includes('win.self!==win.top') && main.includes('standalone&&!embedded'),
  'displayMode separates embedded from standalone: the host\'s display mode no longer speaks for a framed game');

// ---------- runtime scaffolding (the house pattern) ----------
const store = {};
const ctx = {
  console, performance, setTimeout, clearTimeout, clearInterval, setInterval,
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  Phaser: {
    Scene: class {}, AUTO: 1,
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Game: class { constructor(cfg) { ctx.__cfg = cfg; } },
    Math: { Distance: { Between: (a, b, c, d) => Math.hypot(c - a, d - b) }, Between: (a, b) => a, Angle: { Between: () => 0 } },
    Geom: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } },
    Utils: { Array: { GetRandom: a => a[0] } }
  },
  SFX: new Proxy({}, { get: () => () => null }),
  Music: { play() {}, toggle: () => true, enabled: () => true },
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [],
    track() {}, addXP() {}, level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
  Tokens: { earn() {}, spend: () => true, balance: () => 1000, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
const displayMode = vm.runInContext('displayMode', ctx);
const fsActive = vm.runInContext('fsActive', ctx);
const fsTarget = vm.runInContext('fsTarget', ctx);
const fsToggle = vm.runInContext('fsToggle', ctx);
const fsPress = vm.runInContext('fsPress', ctx);
const fsSyncLabels = vm.runInContext('fsSyncLabels', ctx);
const FS_BLOCKED_MSG = vm.runInContext('FS_BLOCKED_MSG', ctx);
const FS_ALREADY_MSG = vm.runInContext('FS_ALREADY_MSG', ctx);

// ---------- scene + DOM doubles ----------
function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, active: true, _visible: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setSize', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setVisible = v => { o._visible = v; return o; };
  o.setScale = () => o; o.setInteractive = () => o;
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o; o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle'].forEach(m => { o[m] = () => o; }); return o; }
function floatScene() { const texts = [];
  return { _fsFloat: null, _texts: texts, time: { delayedCall: () => ({}) },
    add: { graphics: () => gfxObj(),
      text: (x, y, str) => { const o = mkObj(); o._t = str; texts.push(o); return o; },
      image: () => mkObj(), container: () => mkObj() } }; }
function fakeDoc(el, rootEl) { return { fullscreenElement: null, getElementById: id => (id === 'game' ? el : null), documentElement: rootEl || {} }; }

// ---------- the standalone law, kept and bounded ----------
const NO_FS = { documentElement: {} };
const NATIVE_FS = { documentElement: { requestFullscreen() {} } };
const browserWin = { matchMedia: () => ({ matches: false }) };
const standaloneWin = { matchMedia: q => ({ matches: q === '(display-mode: standalone)' }) };
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S176V) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const env = (navigator, window, document, extra) => Object.assign({ navigator, window, document }, extra || {});

{ const st = displayMode(env({ userAgent: ANDROID, platform: 'Linux armv8l' }, standaloneWin, NATIVE_FS));
  ok(st.mode === 'standalone' && st.embedded === false, 'standalone law kept: a TOP-LEVEL standalone launch is standalone — the installed game truly fills the screen'); }
{ const st = displayMode(env({ userAgent: ANDROID, platform: 'Linux armv8l' }, standaloneWin, NATIVE_FS, { embedded: true }));
  ok(st.mode === 'browser' && st.standalone === false && st.embedded === true && st.showButton === true,
  'standalone law bounded: standalone signal + EMBEDDED = a browser — the framed game is not fullscreen on its host\'s say-so, and the button stands'); }
{ const st = displayMode(env({ userAgent: IPHONE, platform: 'iPhone' }, standaloneWin, NO_FS, { embedded: true }));
  ok(st.mode === 'ios-install' && st.installHelp === true, '…and an embedded iPhone keeps the truthful install route, not a false standalone'); }
{ const framedWin = { matchMedia: standaloneWin.matchMedia, self: { framed: true }, top: { framed: false } };
  const st = displayMode(env({ userAgent: ANDROID, platform: 'Linux armv8l' }, framedWin, NATIVE_FS));
  ok(st.embedded === true && st.mode === 'browser', 'embedded is derived, not just injected: self !== top under a standalone host still answers browser'); }
{ const topWin = { matchMedia: standaloneWin.matchMedia, self: null, top: null }; topWin.self = topWin; topWin.top = topWin;
  const st = displayMode(env({ userAgent: ANDROID, platform: 'Linux armv8l' }, topWin, NATIVE_FS));
  ok(st.embedded === false && st.mode === 'standalone', '…while a true top-level window (self === top) keeps the standalone answer'); }

// ---------- the machinery ----------
(async () => {
  { // enter: the request lands on the #game container, with the options
    const gameEl = { calls: [], requestFullscreen(opts) { this.calls.push(opts); return Promise.resolve(); } };
    const rootEl = { calls: [], requestFullscreen() { this.calls.push(1); return Promise.resolve(); } };
    const doc = fakeDoc(gameEl, rootEl);
    ok(fsTarget({ document: doc, window: {} }) === gameEl, 'fsTarget names the game container (#game), not the document root');
    const s = floatScene();
    const r = await fsToggle(s, { document: doc, window: {} });
    ok(r === 'enter' && gameEl.calls.length === 1 && gameEl.calls[0] && gameEl.calls[0].navigationUI === 'hide' && rootEl.calls.length === 0,
      'one press enters: requestFullscreen({navigationUI:\'hide\'}) on the container, once');
    ok(s._fsFloat === null && s._texts.length === 0, '…and success is silent — no float, no fuss'); }
  { // the options object refused synchronously -> the bare call is tried
    const gameEl = { calls: 0, requestFullscreen(opts) { this.calls++; if (opts) throw new TypeError('options refused'); return Promise.resolve(); } };
    const r = await fsToggle(floatScene(), { document: fakeDoc(gameEl), window: {} });
    ok(r === 'enter' && gameEl.calls === 2, 'a synchronous refusal of the options form falls back to the bare request'); }
  { // webkit-only element (the prefixed fallback)
    const gameEl = { calls: 0, webkitRequestFullscreen() { this.calls++; } };
    const r = await fsToggle(floatScene(), { document: fakeDoc(gameEl), window: {} });
    ok(r === 'enter' && gameEl.calls === 1, 'the prefixed fallback carries a webkit-only browser (requestFullscreen absent)'); }
  { // rejection: answered by the visible float, never silence
    const gameEl = { requestFullscreen() { return Promise.reject(new Error('Fullscreen is not allowed')); } };
    const s = floatScene();
    const r = await fsToggle(s, { document: fakeDoc(gameEl), window: {} });
    ok(r === 'blocked' && Array.isArray(s._fsFloat) && s._texts.some(t => t._t === FS_BLOCKED_MSG),
      'a refused request (the frame that does not delegate) answers with the blocked float naming the own-tab remedy'); }
  { // no API at all: the same honest answer, no throw
    const s = floatScene();
    const r = await fsToggle(s, { document: fakeDoc({}), window: {} });
    ok(r === 'blocked' && s._texts.some(t => t._t === FS_BLOCKED_MSG), 'no Fullscreen API at all: blocked float, no exception, no dead button'); }
  { // the second press leaves
    let exits = 0;
    const doc = fakeDoc({}); doc.fullscreenElement = { el: true }; doc.exitFullscreen = () => { exits++; return Promise.resolve(); };
    const r = await fsToggle(floatScene(), { document: doc, window: {} });
    ok(r === 'exit' && exits === 1 && fsActive({ document: doc }) === true, 'already fullscreen, the next press exits — the button is a toggle, not a one-way door'); }
  { // labels keep the truth
    const mkBtn = () => ({ label: { _t: '', setText(t) { this._t = t; } } });
    const sceneA = { fsBtn: mkBtn() }, sceneB = { fsb: mkBtn() };
    ctx.window = { __game: { scene: { getScenes: () => [sceneA, sceneB] } } };
    const doc = fakeDoc({}); ctx.document = doc;
    fsSyncLabels();
    ok(sceneA.fsBtn.label._t === 'Fullscreen' && sceneB.fsb.label._t === 'Fullscreen', 'labels read Fullscreen while windowed, in menu and battle alike');
    doc.fullscreenElement = { el: true }; fsSyncLabels();
    ok(sceneA.fsBtn.label._t === 'Exit full' && sceneB.fsb.label._t === 'Exit full', '…and Exit full the moment the game is fullscreen — state reflected, not guessed');
    delete ctx.document; ctx.window = ctx; }
  { // fsPress in true standalone: the already-fullscreen float, no request
    ctx.window = { matchMedia: q => ({ matches: q === '(display-mode: standalone)' }) };
    ctx.navigator = { userAgent: ANDROID, platform: 'Linux armv8l' }; ctx.document = NATIVE_FS;
    const s = floatScene();
    const r = await fsPress(s);
    ok(r === 'standalone' && s._texts.some(t => t._t === FS_ALREADY_MSG), 'a press in true standalone says so — already full screen — instead of hiding or failing');
    delete ctx.navigator; delete ctx.document; ctx.window = ctx; }
  await flush();
  console.log(fails === 0 ? 'ALL PASS (' + total + ' checks)' : fails + ' FAILURES of ' + total);
  process.exit(fails ? 1 : 0);
})();
