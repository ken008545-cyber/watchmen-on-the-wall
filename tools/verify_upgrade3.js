#!/usr/bin/env node
// Upgrade 3 verification harness. Stubbed Phaser; exercises the REAL logic in
// js/main.js (camp defeat, respawn gating, coin collection, upgrade req
// gating) plus static checks on the loading screen, scale config, music
// slots and data. No browser is available in this environment — camera/HUD
// behaviour in a live page is NOT covered here and needs a human pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js'), index = read('index.html'), music = read('js/music.js'),
      art = read('js/art.js'), sfx = read('js/sfx.js');
ok(/Phaser\.Scale\.FIT/.test(main) && /CENTER_BOTH/.test(main), 'scale config: FIT + CENTER_BOTH present');
ok((main.match(/startFullscreen/g) || []).length >= 2, 'fullscreen buttons (Menu + battle HUD) call startFullscreen');
ok(index.includes('js/music.js'), 'index.html loads js/music.js');
ok(/canvas\{[^}]*max-width:100vw/.test(index) && /max-height:100vh/.test(index), 'index.html CSS caps canvas at the viewport');
ok(main.includes("assets/music/menu.mp3") && main.includes("assets/music/battle.mp3"), 'Boot queues both music slots');
ok(main.includes('LOAD_TIPS') && /progress/.test(main), 'loading screen: tips + progress bar wired');
ok(art.includes("tex('coin'") && art.includes("tex('coing'"), 'coin + Grokonian coin textures drawn in makeArt');
for (const m of ['enemyHit', 'enemyDie', 'enemyAttack', 'campHit', 'campWarning', 'coinPickup'])
  ok(sfx.includes(m + '('), 'SFX has ' + m);
ok(music.includes('gxhub_wotw_music') && music.includes('startPad'), 'music: persisted toggle + generative pad fallback');
const battleMp3 = path.join(ROOT, 'assets/music/battle.mp3');
ok(fs.existsSync(battleMp3) && fs.statSync(battleMp3).size > 1000000, "kennin's battle.mp3 is in the build (" + (fs.existsSync(battleMp3) ? fs.statSync(battleMp3).size : 0) + ' bytes)');
ok(!fs.existsSync(path.join(ROOT, 'assets/music/menu.mp3')), 'menu.mp3 not present yet -> menu uses the pad fallback');
ok(!fs.existsSync(path.join(ROOT, 'assets/music/demon-diss-original.m4a')), 'inbox .m4a is NOT shipped in the build');

// ---------- data checks ----------
const eras = JSON.parse(read('data/eras.json')), units = JSON.parse(read('data/units.json'));
const bible = eras.eras.find(e => e.id === 'bible');
ok(bible.worldW === 1920 && bible.worldH === 1200, 'bible world is 1920x1200');
ok(eras.eras.every(e => e.worldW && e.worldH), 'every era carries worldW/worldH');
const P = Object.fromEntries(units.bible.player.map(u => [u.id, u]));
for (const id of ['levite_healer', 'armor_bearer', 'gate_spearman', 'slinger_elah']) ok(!!P[id], 'new unit exists: ' + id);
ok(P.levite_healer.healsSquads === true && P.levite_healer.role === 'support' && P.levite_healer.cost === 230 && P.levite_healer.hp === 90 && P.levite_healer.dmg === 4, 'Levite Healer fields');
ok(P.armor_bearer.cost === 260 && P.armor_bearer.hp === 380 && P.armor_bearer.dmg === 6 && P.armor_bearer.upgrades[0].cost === 520, 'Armor Bearer fields + Bulwark 520');
ok(P.gate_spearman.cost === 210 && P.gate_spearman.hp === 170 && P.gate_spearman.dmg === 15 && P.gate_spearman.upgrades[0].cost === 230, 'Gate Spearman fields + Drill t1 230');
ok(P.slinger_elah.cost === 120 && P.slinger_elah.hp === 70 && P.slinger_elah.dmg === 7 && P.slinger_elah.rate < P.shepherd_slinger.rate, 'Slinger of Elah fields (faster rate)');
const upg = (u, id) => (P[u].upgrades || []).find(x => x.id === id);
ok(upg('swordsman_gideon', 'drill2').cost === 420 && upg('swordsman_gideon', 'drill2').req === 'drill1', 'Gideon Drill t2 420 req drill1');
ok(upg('benjamite_archer', 'drill2').cost === 380 && upg('benjamite_archer', 'drill2').req === 'drill1', 'Archer Drill t2 380 req drill1');
ok(upg('shepherd_militia', 'veteran').cost === 400 && upg('shepherd_militia', 'veteran').req === 'branch' && upg('shepherd_militia', 'veteran').hpAdd === 40 && upg('shepherd_militia', 'veteran').dmgAdd === 4, 'Militia Veteran 400 req branch (+40hp +4dmg)');
ok(upg('shieldman_judah', 'bulwark2').cost === 640 && upg('shieldman_judah', 'bulwark2').req === 'bulwark' && upg('shieldman_judah', 'bulwark2').hpAdd === 120, 'Shieldman Bulwark t2 640 req bulwark (+120hp)');

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
ok(ctx.__cfg && ctx.__cfg.scale.mode === 'FIT' && ctx.__cfg.scale.autoCenter === 'CENTER_BOTH', 'live game config uses FIT + CENTER_BOTH');
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(eras) + '; UNITS = ' + JSON.stringify(units) + ';', ctx);
const CAMP_MAX = vm.runInContext('CAMP_MAX', ctx);
ok(CAMP_MAX === 500, 'CAMP_MAX is 500');
const GameProto = vm.runInContext('Game.prototype', ctx);
function bareGame() {
  const g = Object.create(GameProto);
  Object.assign(g, { over: false, shieldT: 0, wave: 3, campHp: CAMP_MAX, campPos: { x: 150, y: 600 }, campSpr: null,
    campWarnedWave: 0, campHurtThisWave: false, campHurtTotal: false, squads: [], coins: [], manna: 0, coinCount: 0, coinSeq: 0,
    time: { delayedCall: () => {} }, endCalls: [] });
  g.toast = () => {}; g.refreshHUD = () => {}; g.floatText = () => {};
  g.end = function (w) { this.endCalls.push(w); this.over = true; };
  return g;
}
// camp defeat
{ const g = bareGame(); g.hitCamp(120); ok(g.campHp === 380 && g.endCalls.length === 0 && g.campHurtTotal === true, 'hitCamp: 120 damage lands, run continues');
  g.hitCamp(1000); ok(g.campHp === 0 && g.endCalls.length === 1 && g.endCalls[0] === false, 'camp HP 0 -> defeat (end(false))'); }
// union shield + boss multiplier
{ const g = bareGame(); g.shieldT = 5; g.hitCamp(100); ok(g.campHp === CAMP_MAX, 'Union Shield: camp takes no damage');
  const g2 = bareGame(); g2.hitCamp(50, { boss: true }); ok(g2.campHp === CAMP_MAX - 150, 'boss deals x3 camp damage'); }
// hero respawn gating
{ const g = bareGame();
  g.hero = { def: { name: 'David', hp: 200 }, hp: 30, down: 0, x: 900, y: 300, spr: { active: true, setTint() {}, clearTint() {}, setAlpha() {} } };
  g.hurtHero(50); ok(g.hero.down === 8 && g.hero.hp === 0, 'hero death: down for 8s');
  g.tickHeroDown(8.1); ok(g.hero.hp === 200 && g.hero.down === 0 && g.hero.x === 210 && g.hero.y === 600, 'respawn at camp, full HP, while camp stands');
  g.campHp = 0; g.hero.hp = 0; g.hero.down = 1; g.tickHeroDown(2);
  ok(g.hero.hp === 0, 'no respawn when the camp has fallen'); }
// coins
{ const g = bareGame(); g.hero = { x: 500, y: 500, down: 0, def: {} }; g.tweens = { killTweensOf() {} };
  const spr = () => ({ destroy() { this.dead = true; } });
  g.coins = [{ x: 510, y: 505, grok: false, spr: spr() }, { x: 900, y: 900, grok: true, spr: spr() }];
  const earned = []; g.earn = (r, n) => earned.push([r, n]);
  g.collectCoins(); ok(g.manna === 8 && g.coinCount === 1 && g.coins.length === 1, 'coin pickup: +8 Manna within 28px');
  g.hero.x = 900; g.hero.y = 900; g.collectCoins();
  ok(earned.length === 1 && earned[0][0] === 'coin' && earned[0][1] === 1 && g.coins.length === 0, 'Grokonian coin: +1 via earn()'); }
// upgrade req gating
{ const g = bareGame();
  ok(g.upgradeLocked({ upgrades: {} }, { req: 'drill1' }) === true, 'Drill t2 locked before t1');
  ok(g.upgradeLocked({ upgrades: { drill1: true } }, { req: 'drill1' }) === false, 'Drill t2 opens after t1');
  ok(g.upgradeLocked({ upgrades: { branch: 'Stout' } }, { req: 'branch' }) === false, 'Veteran opens after a branch pick');
  ok(g.upgradeLocked({ upgrades: {} }, { req: 'branch' }) === true, 'Veteran locked before any branch pick');
  ok(g.upgradeLocked({ upgrades: {} }, { id: 'drill1' }) === false, 'no req -> never locked'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
