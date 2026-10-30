#!/usr/bin/env node
// Upgrade 6 verification harness. Stubbed Phaser; exercises the REAL shop
// flow in js/main.js (openShop -> renderShop -> update -> closeShop ->
// startWave) against a controllable wall clock (Date.now is patched inside
// the vm context), proving kennin's wave-flow ruling: every between-wave
// shop — first of the run included — counts a visible 60 seconds down and
// starts the next wave on its own; "Next Wave Now" is optional; buying and
// paging never reset the deadline; the goal-wave victory choice is intact
// and endless play keeps the same intermission. No browser is available —
// the on-screen readability of the countdown needs a human pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js');
ok(main.includes('const SHOP_COUNTDOWN=60'), 'intermission constant is 60 seconds');
ok(main.includes('this.shopEndsAt=Date.now()+SHOP_COUNTDOWN*1000'), 'openShop arms a 60s wall-clock deadline');
ok(/'Next Wave Now ▶',\(\)=>this\.closeShop\(\)/.test(main), 'early-start button "Next Wave Now" wired to closeShop');
ok(main.includes('this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000)'), 'update() derives remaining time from the deadline, not from frame deltas');
ok(!main.includes('Auto-start') && !main.includes('take your time'), 'old auto-start / take-your-time text is gone from the game');
ok(!main.includes('shopT=20') && !main.includes("'Next wave ▶'"), 'old 20s timer and old click-to-start label are gone');
ok(/closeShop\(\)\{ this\.shopOpen=false;/.test(main), 'closeShop closes the shop before starting the wave (auto-start can only fire once)');

// ---------- runtime logic checks (stubbed Phaser, real main.js) ----------
const store = {};
const ctx = {
  console, performance, setTimeout, clearInterval, setInterval,
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
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [], track() {}, addXP() {} },
  Tokens: { earn() {}, spend: () => true, milestone: () => true, setMilestone() {}, balance: () => 0 },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const SHOP_COUNTDOWN = vm.runInContext('SHOP_COUNTDOWN', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
ok(SHOP_COUNTDOWN === 60, 'SHOP_COUNTDOWN evaluates to exactly 60');

// Controllable wall clock inside the game context.
const DateObj = vm.runInContext('Date', ctx);
let fakeNow = 1700000000000;
DateObj.now = () => fakeNow;

function mkObj() { const o = { _t: null, _handlers: {}, height: 54, width: 54, scaleX: 1 };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween'].forEach(m => { o[m] = () => o; }); return o; }
function fire(btn) { btn._handlers.pointerup(null, 0, 0, { stopPropagation() {} }); }
function findBtn(g, pred) { return g.__containers.find(c => c.label && pred(c.label._t)); }

function bareShopGame() {
  const g = Object.create(GameProto);
  Object.assign(g, { over: false, shopOpen: false, shopFirst: false, shopT: 0, shopEndsAt: 0, shopPage: 0, shopItems: [],
    squads: [], enemies: [], spawnQ: [], orbs: [], coins: [], shots: [], __containers: [], startCalls: 0,
    roster: UNITS.bible, eraId: 'bible', era: { name: 'Bible' }, wave: 0, wavesCleared: 0, goalWave: 10, endless: false, cleared: false, victoryOpen: false, waveActive: false,
    manna: 1000, squadCap: 8, campHp: 400, campMax: 500, campUp: {}, respawnTime: 8, campFireCd: 0,
    campPos: { x: 150, y: 600 }, campSpr: null, campWarnedWave: 0, campHurtThisWave: false, campHurtTotal: false,
    worldW: 1920, worldH: 1200, lastBonus: 0, nightRect: null, earned: 0, pend: {}, pendXp: 0, banquet: false, order: 'follow', volleyCd: 0,
    time: { delayedCall: () => {} }, tweens: { add: () => {}, killTweensOf: () => {} }, children: { list: [] } });
  g.heroDef = { name: 'David', hp: 200, dmg: 18, range: 140, rate: 0.7, speed: 140, dmgType: 'physical', skills: [], ult: {} };
  g.hero = { def: g.heroDef, x: 210, y: 600, tx: 210, ty: 600, hp: 200, cd: 0, down: 0, spr: mkObj() };
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; return o; }, graphics: () => gfxObj(), image: () => mkObj(),
    rectangle: () => mkObj(), container: () => { const o = mkObj(); g.__containers.push(o); return o; }, circle: () => mkObj() };
  g.textures = { exists: () => true };
  g.msg = mkObj(); g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.refreshHUD = () => {};
  const origStart = GameProto.startWave;
  g.startWave = function () { this.startCalls++; return origStart.call(this); };
  return g;
}

// Label formatting: m:ss, always rounding up so 0:00 means the wave is here
{ const p = Object.create(GameProto);
  p.shopT = 60; ok(p.shopTimerLabel() === 'Next wave in 1:00', 'label at 60s: "Next wave in 1:00"');
  p.shopT = 47.2; ok(p.shopTimerLabel() === 'Next wave in 0:48', 'label at 47.2s: "Next wave in 0:48" (ceil)');
  p.shopT = 9.1; ok(p.shopTimerLabel() === 'Next wave in 0:10', 'label at 9.1s: "Next wave in 0:10"');
  p.shopT = 0; ok(p.shopTimerLabel() === 'Next wave in 0:00', 'label at 0s: "Next wave in 0:00"');
  p.shopT = 125; ok(p.shopTimerLabel() === 'Next wave in 2:05', 'label at 125s: "Next wave in 2:05"'); }

// First shop of a run (the pre-wave-1 shop): same 60s, starts wave 1 alone
{ const g = bareShopGame();
  g.openShop(true);
  ok(g.shopT === 60 && g.shopEndsAt - fakeNow === 60000, 'first shop: deadline armed exactly 60s out');
  ok(g.shopTimerTxt._t === 'Next wave in 1:00', 'first shop: countdown label shows "Next wave in 1:00"');
  fakeNow += 30000; g.update(0, 1000);
  ok(g.shopOpen && g.wave === 0 && g.shopTimerTxt._t === 'Next wave in 0:30', 'first shop: still shopping at 30s, label "Next wave in 0:30"');
  fakeNow += 29000; g.update(0, 1000);
  ok(g.shopOpen && g.shopTimerTxt._t === 'Next wave in 0:01', 'first shop: one second left, label "Next wave in 0:01"');
  fakeNow += 1000; g.update(0, 1000);
  ok(!g.shopOpen && g.wave === 1 && g.waveActive && g.startCalls === 1, 'first shop: at zero the wave starts BY ITSELF — no click handler fired, startWave ran once');
  g.over = true; g.update(0, 1000); g.update(0, 1000);
  ok(g.startCalls === 1, 'first shop: no second auto-start after the wave began'); }

// Later shop: identical behavior — and the old 20s mark no longer starts it
{ const g = bareShopGame(); g.wave = 1;
  g.openShop(false);
  ok(g.shopEndsAt - fakeNow === 60000 && g.shopTimerTxt._t === 'Next wave in 1:00', 'later shop: same 60s deadline and label as the first shop');
  fakeNow += 20000; g.update(0, 1000);
  ok(g.shopOpen && g.shopTimerTxt._t === 'Next wave in 0:40', 'later shop: still open at the old 20s mark, "Next wave in 0:40"');
  fakeNow += 40000; g.update(0, 1000);
  ok(!g.shopOpen && g.wave === 2 && g.startCalls === 1, 'later shop: auto-starts wave 2 at 60s without a click'); }

// Early start: the button is optional and works the moment it is tapped
{ const g = bareShopGame(); g.wave = 2;
  g.openShop(false);
  const btn = findBtn(g, t => t === 'Next Wave Now ▶');
  ok(!!btn, 'early-start button present, labelled "Next Wave Now ▶"');
  fire(btn);
  ok(!g.shopOpen && g.wave === 3 && g.startCalls === 1, 'early start: tapping "Next Wave Now" with the full minute left starts the wave at once'); }

// A purchase (and a page flip) mid-shop: the deadline does not move
{ const g = bareShopGame(); g.wave = 1;
  g.openShop(false);
  fakeNow += 25000; g.update(0, 1000);
  const deadline = g.shopEndsAt;
  ok(g.shopTimerTxt._t === 'Next wave in 0:35', 'purchase setup: 35s remain before buying');
  const militia = UNITS.bible.player[0];
  fire(findBtn(g, t => t === 'Buy ' + militia.cost));
  ok(g.squads.length === 1 && g.manna === 1000 - militia.cost, 'purchase went through (Shepherd Militia bought, Manna charged)');
  ok(g.shopEndsAt === deadline, 'purchase did NOT reset the countdown deadline');
  ok(g.shopTimerTxt._t === 'Next wave in 0:35', 're-rendered shop still shows the true remaining time ("Next wave in 0:35")');
  fire(findBtn(g, t => t === '▶'));
  ok(g.shopPage === 1 && g.shopEndsAt === deadline, 'paging the shop did NOT reset the countdown either');
  fakeNow += 35000; g.update(0, 1000);
  ok(!g.shopOpen && g.wave === 2 && g.startCalls === 1, 'after buying and paging, the wave still auto-starts at the original deadline'); }

// Goal wave: the victory choice still owns the flow — no timer behind it —
// and choosing Endless re-enters the same 60s intermission
{ const g = bareShopGame(); g.wave = 10; g.campHp = 500;
  g.waveClear();
  ok(g.cleared && g.victoryOpen && !g.shopOpen && g.shopEndsAt === 0, 'goal wave cleared: victory choice opens, no shop timer running');
  fakeNow += 120000; g.update(0, 1000);
  ok(g.victoryOpen && g.wave === 10, 'victory choice waits for the player — two minutes pass, nothing auto-starts');
  fire(findBtn(g, t => t === 'Continue Endless'));
  ok(g.endless && g.shopOpen && g.shopEndsAt - fakeNow === 60000 && g.shopTimerTxt._t === 'Next wave in 1:00', 'Continue Endless: the same 60s intermission arms for wave 11');
  fakeNow += 60000; g.update(0, 1000);
  ok(!g.shopOpen && g.wave === 11 && g.startCalls === 1, 'endless: wave 11 auto-starts after the intermission'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
