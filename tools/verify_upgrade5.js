#!/usr/bin/env node
// Upgrade 5 verification harness. Stubbed Phaser; exercises the REAL orb
// logic in js/main.js (Grokonian spends via a Tokens stub with a real
// balance, the 90px distance gate, Strength entering the hero damage path,
// Mending caps, Thunder with the boss at half, orb cooldown, buff ticking)
// plus static wiring checks. No browser is available in this environment —
// orb readability on the live field is NOT covered here and needs a human pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js');
const art = read('js/art.js');
const sfx = read('js/sfx.js');
ok(main.includes('const ORBS=[') && main.includes("id:'strength'") && main.includes("id:'swiftness'") && main.includes("id:'mending'") && main.includes("id:'iron'") && main.includes("id:'thunder'"), 'orb table defined (all five powers)');
ok(main.includes('this.buildOrbs();') && main.includes('buildOrbs(){'), 'orbs built in create()');
ok(/find\(o=>Math\.hypot\(wx-o\.x,wy-o\.y\)<=42\)/.test(main) && main.includes('this.tryBuyOrb(orb)'), 'onTap routes orb taps (world coords) to tryBuyOrb');
ok(main.includes("Tokens.spend('orb:'+o.def.id,o.def.cost)"), 'purchases spend through Tokens.spend');
ok(/dmg\*this\.orbDmgMul\(\)/.test(main), 'hero damage (melee + projectile) passes through orbDmgMul()'); // Upgrade 8: strikes are manual now — the multiplier rides lightStrike/heavyStrike's dmg
ok(/hd\.speed\*this\.orbSpdMul\(\)/.test(main), 'hero movement passes through orbSpdMul()'); // Upgrade 8: movement speed is composed (orb x sprint x block) before *dt
ok(/\(this\.order==='shieldwall'\?0\.6:1\)\*this\.orbSpdMul\(\)/.test(main), 'squad movement passes through orbSpdMul()');
ok(main.includes('this.orbTick(dt)'), 'update() ticks orb buffs/cooldowns');
ok(main.includes('this.buffTxt=') && main.includes("'STR '") && main.includes("'SPD '") && main.includes("'IRON '"), 'HUD buff-timer line (STR/SPD/IRON) wired');
ok(main.includes('SFX.orbBuy()'), 'purchase plays SFX.orbBuy');
['orb_strength', 'orb_swiftness', 'orb_mending', 'orb_iron', 'orb_thunder'].forEach(k => ok(art.includes("'" + k + "'"), 'art.js generates the ' + k + ' texture'));
ok(/orbBuy\(\)\{/.test(sfx), 'SFX.orbBuy defined');

// ---------- runtime logic checks (stubbed Phaser, real main.js) ----------
const store = {};
const TokensStub = { _bal: 0, _spent: [],
  balance() { return this._bal; },
  earn() {},
  spend(item, cost) { if (this._bal < cost) return false; this._bal -= cost; this._spent.push([item, cost]); return true; },
  milestone: () => true, setMilestone() {} };
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
  Tokens: TokensStub,
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const ORBS = vm.runInContext('ORBS', ctx);
const O = Object.fromEntries(ORBS.map(o => [o.id, o]));
ok(O.strength.cost === 15 && O.swiftness.cost === 12 && O.mending.cost === 20 && O.iron.cost === 18 && O.thunder.cost === 25, 'orb costs match the spec (15/12/20/18/25 G)');
ok(O.strength.dur === 60 && O.swiftness.dur === 60 && O.iron.dur === 30 && O.mending.dur === 0 && O.thunder.dur === 0, 'orb durations (Str 60s, Spd 60s, Iron 30s, Mending/Thunder instant)');
const GameProto = vm.runInContext('Game.prototype', ctx);
function mkObj() { const o = { _t: null };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  return o; }
function enemy(x, y, hp, boss) { return { x, y, hp, max: hp, dmg: 5, dead: false, boss: !!boss, armorType: 'flesh',
  spr: { active: true, setTint() {}, setTintFill() {}, clearTint() {}, setFlipX() {}, setOrigin() { return this; }, setPosition() { return this; }, setDepth() { return this; } },
  bar: { clear() {}, fillStyle() { return this; }, fillRect() { return this; }, lineStyle() { return this; }, strokeRect() { return this; }, destroy() {} } }; }
function bareGame() {
  const g = Object.create(GameProto);
  Object.assign(g, { over: false, shieldT: 0, wave: 3, waveActive: true, manna: 0,
    campHp: 500, campMax: 500, campPos: { x: 150, y: 600 }, campSpr: null, campWarnedWave: 0, campHurtThisWave: false, campHurtTotal: false,
    squads: [], enemies: [], orbs: [], buffStrT: 0, buffSpdT: 0, buffIronT: 0,
    worldW: 1920, worldH: 1200, pend: {}, pendXp: 0, runXp: 0, kills: 0, earned: 0,
    time: { delayedCall: () => {} }, tweens: { add: () => {} },
    cameras: { main: { flash() {}, shake() {} } }, endCalls: [], lastToast: null });
  g.heroDef = { name: 'David', hp: 200, dmg: 50, range: 220, rate: 0.55, speed: 170, dmgType: 'physical', skills: [], ult: {} };
  g.hero = { def: g.heroDef, x: 210, y: 600, tx: 210, ty: 600, cd: 0, hp: 200, down: 0,
    spr: { active: true, setTint() {}, clearTint() {}, setAlpha() {}, setFlipX() {} } };
  g.toast = m => { g.lastToast = m; };
  g.spark = () => {}; g.floatText = () => {};
  g.end = function (w) { this.endCalls.push(w); this.over = true; };
  // real refreshHUD against text stubs, so the buff line is genuinely exercised
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.cmdBtns = {}; g.endless = false; g.goalWave = 10; g.squadCap = 8; g.order = 'follow'; g.volleyCd = 0;
  // buildOrbs collaborators
  g.add = { circle: () => mkObj(), image: () => mkObj(), text: (x, y, str) => { const o = mkObj(); o._t = str; return o; } };
  return g;
}
function resetWallet(n) { TokensStub._bal = n; TokensStub._spent = []; }
// Placement: buildOrbs puts the five stations at the spec's Bible-world posts
{ const g = bareGame(); g.buildOrbs();
  const want = [[620, 300], [620, 900], [360, 600], [1050, 600], [1500, 600]];
  ok(g.orbs.length === 5 && g.orbs.every((o, i) => o.x === want[i][0] && o.y === want[i][1] && o.def === ORBS[i]), 'five stations at (620,300) (620,900) (360,600) (1050,600) (1500,600) in the Bible world');
  ok(g.orbs[0].label._t === 'Strength · 15 G' && g.orbs[4].label._t === 'Thunder · 25 G', 'labels read "<power> · <cost> G"'); }
// Spend success: deducts through Tokens and applies the buff
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[0]; g.hero.x = o.x; g.hero.y = o.y;
  ok(g.tryBuyOrb(o) === 'bought' && TokensStub._bal === 85 && TokensStub._spent.length === 1 && TokensStub._spent[0][0] === 'orb:strength' && TokensStub._spent[0][1] === 15, 'Strength buy: 15 G spent via Tokens (100 -> 85), logged as orb:strength');
  ok(g.buffStrT === 60 && o.cd === 15, 'Strength buff live (60s) and the orb sleeps (15s cooldown)');
  ok(g.buffTxt._t.includes('STR 60s'), 'HUD buff line shows "STR 60s" after refreshHUD'); }
// Insufficient funds refuses and changes nothing
{ const g = bareGame(); g.buildOrbs(); resetWallet(10);
  const o = g.orbs[1]; g.hero.x = o.x; g.hero.y = o.y;
  ok(g.tryBuyOrb(o) === 'funds' && TokensStub._bal === 10 && TokensStub._spent.length === 0 && g.buffSpdT === 0 && o.cd === 0, 'Swiftness at 10 G refused: no spend, no buff, no cooldown');
  ok(/Not enough Grokonians \(have 10\)/.test(g.lastToast), 'refusal toast names the balance'); }
// Distance gate: beyond 90px refuses, sets the approach target, spends nothing
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[3]; g.hero.x = o.x - 200; g.hero.y = o.y;
  ok(g.tryBuyOrb(o) === 'far' && TokensStub._bal === 100 && g.shieldT === 0 && g.buffIronT === 0, 'Iron at 200px refused: no spend, no shield');
  ok(Math.hypot(g.hero.tx - o.x, g.hero.ty - o.y) <= 90 && g.lastToast === 'Move closer to the orb', 'hero is sent to a spot beside the orb; one more tap will buy'); }
// Strength enters the real damage path (hero damage call shape: hd.dmg * orbDmgMul())
{ const g = bareGame();
  const e = enemy(600, 600, 10000); g.enemies = [e];
  g.damage(e, g.heroDef.dmg * g.orbDmgMul(), 'physical'); ok(e.hp === 9950, 'no buff: hero hit deals base 50');
  g.buffStrT = 60;
  g.damage(e, g.heroDef.dmg * g.orbDmgMul(), 'physical'); ok(e.hp === 9875, 'Strength live: the same hit deals 75 (x1.5)');
  ok(g.orbDmgMul() === 1.5 && g.orbSpdMul() === 1, 'orbDmgMul 1.5 under Strength; orbSpdMul still 1');
  g.buffSpdT = 30; ok(g.orbSpdMul() === 1.3, 'orbSpdMul 1.3 under Swiftness'); }
// Mending caps hero, squads and camp at their maxima
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[2]; g.hero.x = o.x; g.hero.y = o.y;
  g.hero.hp = 30;
  const s1 = { def: { name: 'A' }, hp: 10, max: 100, dead: false }, s2 = { def: { name: 'B' }, hp: 100, max: 100, dead: false }, s3 = { def: { name: 'C' }, hp: 0, max: 100, dead: true };
  g.squads = [s1, s2, s3]; g.campHp = 480;
  ok(g.tryBuyOrb(o) === 'bought' && g.hero.hp === 200 && s1.hp === 60 && s2.hp === 100 && s3.hp === 0 && g.campHp === 500, 'Mending: hero 30->200, wounded squad +50% (10->60), full squad unchanged, dead squad untouched, camp 480->500 (capped, +75 would overshoot)'); }
// Thunder: every living enemy takes 150, the boss takes half
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[4]; g.hero.x = o.x; g.hero.y = o.y;
  const a = enemy(900, 400, 1000), b = enemy(1200, 700, 1000), boss = enemy(1500, 600, 5000, true), dead = enemy(800, 600, 0); dead.dead = true; dead.hp = 0;
  g.enemies = [a, b, boss, dead];
  ok(g.tryBuyOrb(o) === 'bought' && a.hp === 850 && b.hp === 850 && boss.hp === 4925 && dead.hp === 0, 'Thunder: both soldiers -150, goal-wave boss -75 (half), the dead untouched'); }
// Iron: the camp turns blows aside through the real hitCamp path
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[3]; g.hero.x = o.x; g.hero.y = o.y;
  ok(g.tryBuyOrb(o) === 'bought' && g.shieldT === 30 && g.buffIronT === 30, 'Iron buy: shieldT raised to 30, HUD timer armed');
  g.hitCamp(120, null); ok(g.campHp === 500, 'hitCamp deals nothing while Iron holds'); }
// Cooldown blocks an immediate second buy
{ const g = bareGame(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[0]; g.hero.x = o.x; g.hero.y = o.y;
  g.tryBuyOrb(o);
  ok(g.tryBuyOrb(o) === 'cooldown' && TokensStub._bal === 85 && TokensStub._spent.length === 1, 'second tap during the 15s sleep: refused, no double spend'); }
// Buffs refresh, never stack; timers tick down and the orb wakes labelled
{ const g = bareGame(); g.buildOrbs(); resetWallet(200);
  const o = g.orbs[0]; g.hero.x = o.x; g.hero.y = o.y;
  g.tryBuyOrb(o); g.orbTick(40); // 40s pass: buff 60->20, cooldown long over
  ok(g.buffStrT === 20 && o.cd === 0 && o.label._t === 'Strength · 15 G', 'after 40s: buff at 20s, orb awake with its price label back');
  g.tryBuyOrb(o); ok(g.buffStrT === 60 && g.orbDmgMul() === 1.5, 're-buy refreshes Strength to 60s — magnitude still x1.5, never x2.25');
  g.orbTick(61); ok(g.buffStrT === 0 && g.orbDmgMul() === 1, 'buff expires on schedule'); }
// First approach earns one hint toast per orb per run
{ const g = bareGame(); g.buildOrbs(); resetWallet(0);
  const o = g.orbs[0]; g.hero.x = o.x - 120; g.hero.y = o.y; // inside the 140px approach ring, outside buy range
  g.orbTick(0.1); const hint = g.lastToast;
  g.lastToast = null; g.orbTick(0.1);
  ok(/Orb of Strength — 15 Grokonians/.test(hint) && g.lastToast === null && o.hinted === true, 'approach hint fires once, then never again'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
