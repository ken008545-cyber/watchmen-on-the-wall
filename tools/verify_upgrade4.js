#!/usr/bin/env node
// Upgrade 4 verification harness. Stubbed Phaser; exercises the REAL camp
// upgrade logic in js/main.js (Fortify chain + heal, Repair cap/cost, Swift
// Return respawn wiring, Watch Fire interval) plus static wiring checks.
// No browser is available in this environment — the camp strip's on-screen
// layout in a live page is NOT covered here and needs a human pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js');
ok(main.includes('CAMP_UPGRADES') && main.includes("id:'fortify1'") && main.includes("id:'fortify2'") && main.includes("id:'fortify3'"), 'camp upgrade track defined (Fortify I/II/III)');
ok(main.includes("id:'swift'") && main.includes("id:'watchfire'"), 'Swift Return + Watch Fire defined');
ok(/CAMP_REPAIR=\{cost:90, heal:100\}/.test(main), 'Repair: 90 Manna per +100 HP');
ok(/CAMP_FIRE=\{range:240, dmg:10, rate:1\.2\}/.test(main), 'Watch Fire: 240px / 10 dmg / 1.2s');
ok(main.includes('renderCampStrip') && /shopPage===0\) this\.renderCampStrip\(\)/.test(main), 'camp strip renders on shop page 1 only');
ok(main.includes('this.campFireTick(dt)'), 'update() ticks Watch Fire');
ok(!/campHp\/CAMP_MAX/.test(main) && !/Math\.min\(CAMP_MAX,this\.campHp/.test(main), 'no current-max read still divides/caps by the base CAMP_MAX');
ok((main.match(/this\.campMax/g) || []).length >= 8, 'campMax is the single source for the current max (HUD/bar/Ark/stars/score/strip)');

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
  Tokens: { earn() {}, milestone: () => true, setMilestone() {}, balance: () => 0 },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const CAMP_MAX = vm.runInContext('CAMP_MAX', ctx);
const CAMP_UPGRADES = vm.runInContext('CAMP_UPGRADES', ctx);
const U = Object.fromEntries(CAMP_UPGRADES.map(u => [u.id, u]));
ok(CAMP_MAX === 500 && U.fortify1.cost === 200 && U.fortify2.cost === 320 && U.fortify3.cost === 450 && U.swift.cost === 300 && U.watchfire.cost === 500, 'camp upgrade costs match the spec');
ok(U.fortify1.hpAdd === 150 && U.fortify2.hpAdd === 200 && U.fortify3.hpAdd === 250 && U.fortify2.req === 'fortify1' && U.fortify3.req === 'fortify2', 'Fortify hpAdds + req chain');
const GameProto = vm.runInContext('Game.prototype', ctx);
function bareGame() {
  const g = Object.create(GameProto);
  Object.assign(g, { over: false, shieldT: 0, wave: 3, waveActive: true, manna: 0,
    campHp: CAMP_MAX, campMax: CAMP_MAX, campUp: {}, respawnTime: 8, campFireCd: 0,
    campPos: { x: 150, y: 600 }, campSpr: null, campWarnedWave: 0, campHurtThisWave: false, campHurtTotal: false,
    squads: [], enemies: [], coins: [], coinCount: 0, coinSeq: 0, shotsMade: [],
    time: { delayedCall: () => {} }, endCalls: [] });
  g.toast = () => {}; g.refreshHUD = () => {}; g.floatText = () => {}; g.renderShop = () => {}; g.spark = () => {};
  g.shoot = function (x, y, t, key, opt, spd) { this.shotsMade.push({ x, y, t, key, opt, spd }); };
  g.end = function (w) { this.endCalls.push(w); this.over = true; };
  return g;
}
// Fortify I: max 500 -> 650 and heals by the same +150 (from full and from damaged)
{ const g = bareGame(); g.manna = 1000;
  ok(g.buyCampUpgrade(U.fortify1) === true && g.campMax === 650 && g.campHp === 650 && g.manna === 800 && g.campUp.fortify1 === true, 'Fortify I: max 500->650, camp healed to 650, 200 charged');
  ok(g.buyCampUpgrade(U.fortify1) === false && g.manna === 800, 'Fortify I is one-time: second buy refused'); }
{ const g = bareGame(); g.manna = 1000; g.campHp = 300;
  g.buyCampUpgrade(U.fortify1); ok(g.campHp === 450 && g.campMax === 650, 'Fortify I heals a damaged camp by +150 (300->450)'); }
// Fortify chain gating
{ const g = bareGame(); g.manna = 5000;
  ok(g.campUpLocked(U.fortify2) === true && g.buyCampUpgrade(U.fortify2) === false && g.campMax === 500 && g.manna === 5000, 'Fortify II locked (and unbuyable) before Fortify I');
  g.buyCampUpgrade(U.fortify1);
  ok(g.buyCampUpgrade(U.fortify3) === false, 'Fortify III locked before Fortify II');
  ok(g.buyCampUpgrade(U.fortify2) === true && g.campMax === 850 && g.campHp === 850, 'Fortify II: max 650->850, healed +200');
  ok(g.buyCampUpgrade(U.fortify3) === true && g.campMax === 1100 && g.campHp === 1100, 'Fortify III: max 850->1100, healed +250'); }
// insufficient Manna
{ const g = bareGame(); g.manna = 199;
  ok(g.buyCampUpgrade(U.fortify1) === false && g.campMax === 500 && g.manna === 199, 'Fortify I refused at 199 Manna'); }
// Repair: caps at max, 90 per use, repeatable, refused at full HP
{ const g = bareGame(); g.campMax = 650; g.campHp = 600; g.manna = 200;
  ok(g.buyCampRepair() === true && g.campHp === 650 && g.manna === 110, 'Repair caps at max (600->650), 90 charged');
  ok(g.buyCampRepair() === false && g.manna === 110, 'Repair refused at full HP');
  g.campHp = 400; ok(g.buyCampRepair() === true && g.campHp === 500 && g.manna === 20, 'Repair repeatable: +100 again, another 90');
  ok(g.buyCampRepair() === false && g.campHp === 500, 'Repair refused when Manna runs short'); }
// Swift Return: halves the respawn timer the respawn logic actually uses
{ const g = bareGame(); g.manna = 1000;
  g.hero = { def: { name: 'David', hp: 200 }, hp: 50, down: 0, spr: { active: true, setTint() {}, clearTint() {}, setAlpha() {} } };
  g.hurtHero(100); ok(g.hero.down === 8, 'before Swift Return: hero down for 8s');
  g.hero.down = 0; g.hero.hp = 50;
  ok(g.buyCampUpgrade(U.swift) === true && g.respawnTime === 4, 'Swift Return bought: respawnTime 8 -> 4');
  g.hurtHero(100); ok(g.hero.down === 4, 'hurtHero now puts the hero down for 4s');
  g.tickHeroDown(4.1); ok(g.hero.hp === 200 && g.hero.down === 0, 'hero returns after the shortened wait'); }
// Watch Fire: fires on its 1.2s interval at an enemy in range, silent otherwise
{ const g = bareGame(); g.manna = 1000;
  ok(g.buyCampUpgrade(U.watchfire) === true && g.campUp.watchfire === true, 'Watch Fire bought');
  g.enemies = [{ x: 300, y: 600, dead: false, hp: 100 }];
  g.campFireTick(0.1); ok(g.shotsMade.length === 1 && g.shotsMade[0].opt.dmg === 10 && g.shotsMade[0].key === 'ember', 'Watch Fire shoots the enemy in 240px (ember, 10 dmg)');
  g.campFireTick(0.5); ok(g.shotsMade.length === 1, 'Watch Fire holds during its 1.2s interval');
  g.campFireTick(0.8); ok(g.shotsMade.length === 2, 'Watch Fire fires again after the interval');
  g.enemies = [{ x: 900, y: 600, dead: false, hp: 100 }]; g.campFireCd = 0;
  g.campFireTick(0.1); ok(g.shotsMade.length === 2, 'Watch Fire silent with no enemy in range');
  g.enemies = [{ x: 300, y: 600, dead: false, hp: 100 }]; g.waveActive = false; g.campFireCd = 0;
  g.campFireTick(0.1); ok(g.shotsMade.length === 2, 'Watch Fire does not fire between waves'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
