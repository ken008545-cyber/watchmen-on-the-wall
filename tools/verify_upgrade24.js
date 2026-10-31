#!/usr/bin/env node
// Upgrade 24 verification harness — THE SPEED CONTROL IS REMOVED
// (kennin, chat, 2026-10-31 ~13:02 CDT, answering the flag Upgrade 23
// left open: "I think you should take away control of speed.").
//
// What the control was, from the code as it stood: a 44px gold circle
// at (1221, HUD_Y+80) on the battle HUD — far right of the battle bar,
// directly under the Fullscreen rectangle — labelled 'x1'. One tap
// toggled the battle scene's `speed` between 1 and 2 and relabelled
// the circle 'x2'; at x2 the update loop's dt doubled, so the whole
// battle simulation ran at twice the rate. It lived only on the battle
// HUD: never in the pause menu, Controls, the layout editor (it was
// not a LAYOUT_DEFS seat), the keybinds, the tutorial, or the rooms
// client — and it was never persisted (no localStorage key carried
// it; the value reset to 1 at every battle start).
//
// Batteries:
// (1) statics — the button, the state, and every read of the state are
//     gone from the shipped source; the update loop steps at base
//     rate; pause and fullscreen stand exactly where U22/U23 left
//     them; the rooms client never honored a speed and still does
//     not; no storage key carries a speed, so nothing stored can
//     resurrect one;
// (2) the built HUD — in both faces there is no speed control, and
//     the pause gear and the Fullscreen button stand;
// (3) no resurrection — a battle whose scene object is handed a
//     foreign speed=2 (as any surviving legacy state would arrive)
//     walks its hero EXACTLY as far as a plain battle in the same
//     steps, and its shield timer decays at the base rate: no code
//     path reads a speed anymore, so no value can raise or lower
//     the game's pace. The starter benchmark (Common-sling champion
//     ~32.8s, camp 500/500) stands in U18's suite, green beside this
//     one — it was always measured at base speed, and base speed is
//     now the only speed there is.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 0.01 : tol); }

// ---------- statics ----------
const main = read('js/main.js');
const net = read('js/net.js');
ok(!main.includes('spdBtn'), 'the speed button is gone from the source — no spdBtn anywhere in main.js');
ok(!main.includes('this.speed'), 'the speed STATE is gone — no this.speed is set or read anywhere in main.js');
ok(!main.includes('button(this,1221,HUD_Y+80'), 'the seat itself stands empty: no button is built at the old speed seat (1221, HUD_Y+80)');
ok(main.includes('const dt=Math.min(0.05,delta/1000);'), 'the update loop steps at base rate: dt is the capped frame step, multiplied by nothing');
ok(main.includes("this.pauseBtn=button(this,1246,20,40,40,'⚙'"), 'pause is untouched: the gear stands at its seat (1246,20), exactly as before');
ok(main.includes('button(this,1221,HUD_Y+26,110,36') && main.includes('fsPress(this)'), 'fullscreen is untouched: the rectangle stands at (1221,HUD_Y+26) and still calls fsPress');
ok(!net.includes('spdBtn') && !net.includes('this.speed'), 'the rooms client (net.js) carries no speed control and no speed state — it never honored one, and still does not');
{ const keys = [...new Set(main.match(/gxhub_wotw_[a-z0-9_]+/g) || [])];
  ok(keys.length > 0 && keys.every(k => !k.includes('speed')) && !main.includes('SPEED_KEY'),
    'no persisted setting can resurrect it: none of the ' + keys.length + ' localStorage keys carries a speed, and there is no SPEED_KEY'); }

// ---------- runtime scaffolding (the U20/U23 pattern, hardened) ----------
const store = {};
const RealDate = Date;
const CLOCK = { perf: 100000, now: RealDate.UTC(2026, 9, 31, 17, 0, 0) }; // 2026-10-31 — inside the Hallows window, deterministically
class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [CLOCK.now])); } static now() { return CLOCK.now; } }
let TBAL = 0; const spends = [], earns = [];
const ctx = {
  console, setTimeout, clearInterval, setInterval,
  performance: { now: () => CLOCK.perf },
  Date: FakeDate,
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
  SFX: new Proxy({}, { get: (t, k) => (k === 'toggle' ? () => false : () => null) }),
  Music: { play() {}, toggle: () => true, enabled: () => true },
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [],
    track() {}, addXP() {}, level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
  Tokens: { balance: () => TBAL, earn: (w, a) => { earns.push([w, a]); TBAL += a; return a; },
    spend: (w, a) => { if (TBAL < a) return false; spends.push([w, a]); TBAL -= a; return true; }, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true, _visible: true, _disabled: false, _scale: 1 };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setFlipX', 'setStrokeStyle', 'setColor', 'setDisplaySize', 'setTintFill'].forEach(m => { o[m] = () => o; });
  o.setSize = (w, h) => { o.width = w; o.height = h; return o; };
  o.setVisible = v => { o._visible = v; return o; };
  o.setScale = s => { o._scale = s; return o; };
  o.setInteractive = () => { o._disabled = false; return o; };
  o.disableInteractive = () => { o._disabled = true; return o; };
  o.setTint = c => { o._tint = c; return o; }; o.clearTint = () => { o._tint = null; return o; };
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { (o._handlers[ev] = o._handlers[ev] || []).push(cb); return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj();
  ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'fillEllipse', 'fillPoints', 'fillTriangle', 'strokeTriangle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function capInput() { const h = {}; return { _h: h, on(ev, cb) { (h[ev] = h[ev] || []).push(cb); }, fire(ev, p) { (h[ev] || []).slice().forEach(cb => cb(p)); } }; }
function cleanStore() { Object.keys(store).forEach(k => { delete store[k]; }); CLOCK.perf = 100000; CLOCK.now = RealDate.UTC(2026, 9, 31, 17, 0, 0); TBAL = 0; spends.length = 0; earns.length = 0; }
function campSprStub() { const o = mkObj(); o.setTint = c => { o._tint = c; return o; }; o.setAlpha = a => { o._alpha = a; return o; }; return o; }
function bareBattle(data) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(), tileSprite: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, addEvent: () => ({}), timeScale: 1 };
  g.tweens = { add: () => {}, killTweensOf: () => {} };
  g.cameras = { main: { flash() {}, shake() {}, setBounds() {}, startFollow() {} } };
  g.children = { list: [] };
  g.input = capInput();
  g.scene = { start(k, d) { g.__started = [k, d]; } };
  GameProto.init.call(g, data || { hero: 'david', level: { era: 'bible' } });
  // NOTE: unlike every earlier suite's fixture, this Object.assign
  // carries NO speed field — the game no longer sets one in create(),
  // so the fixture no longer sets one either. Battery (3) then writes
  // one in by hand, as a foreign/legacy value would arrive.
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: campSprStub(), campBar: null, manna: 340,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj(), shopItems: [], waveHpM: 1, waveDmM: 1 });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  g.skillBtns = [...g.heroDef.skills, g.heroDef.ult].map(k => ({ def: k, cd: 0, cdMax: k.cd, held: 0, buffered: false, _tierShown: 0, label: mkObj(), alpha: 1 })); // the U8 fixture pattern: update() reads the skill buttons before any HUD exists
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD();
  g.input.on('pointerdown', p => g.onTap(p));
  g.input.on('pointermove', p => g.onPointerMove(p));
  g.input.on('pointerup', p => g.onPointerUp(p));
  return g; }

// ---------- the built HUD: absent in both faces; neighbours stand ----------
{ cleanStore(); const g = hudBattle(); // the Few face (a new player's default)
  ok(g.spdBtn === undefined, 'built HUD (Few face): there is no speed button — g.spdBtn does not exist');
  ok(!!g.pauseBtn && !!g.fsb, 'built HUD (Few face): the pause gear and the Fullscreen button still stand'); }
{ cleanStore(); store.gxhub_wotw_face = 'full'; store.gxhub_wotw_face_u20 = '1'; // a stamped Full face
  const g = hudBattle();
  ok(g.face === 'full' && g.spdBtn === undefined, 'built HUD (Full face): there is no speed button either');
  ok(!!g.pauseBtn && !!g.fsb, 'built HUD (Full face): the pause gear and the Fullscreen button still stand');
  cleanStore(); }

// ---------- no resurrection: a foreign speed value changes nothing ----------
function walk(g) { g.hero.tx = g.hero.x + 400; g.hero.ty = g.hero.y; const x0 = g.hero.x;
  for (let i = 0; i < 20; i++) g.update(0, 50); return g.hero.x - x0; }
{ cleanStore(); const a = bareBattle(); const walkA = walk(a);
  ok(walkA > 50, 'the plain battle walks at base rate (hero covered ' + Math.round(walkA) + 'px in 20 steps)');
  const b = bareBattle(); b.speed = 2; // a surviving legacy value, written onto the scene as one would arrive
  const walkB = walk(b);
  ok(approx(walkB, walkA, 0.01), 'a foreign speed=2 on the scene changes NOTHING: the hero walks exactly as far (' + Math.round(walkB) + 'px vs ' + Math.round(walkA) + 'px) — no code path reads a speed');
  const c = bareBattle(); c.speed = 2; c.shieldT = 10; c.update(0, 1000);
  ok(c.shieldT === 9, 'the shield timer decays at the base rate even with speed=2 written in (10 -> ' + c.shieldT + ' over one second, not 8)');
  cleanStore(); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
