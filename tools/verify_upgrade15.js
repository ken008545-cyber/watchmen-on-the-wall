#!/usr/bin/env node
// Upgrade 15 verification harness. Stubbed Phaser; exercises the REAL
// gather & build code in js/main.js: the node field and its clearances,
// stand-to-gather channeling (exact purse math, depletion, regrow,
// out-of-range), placement (exact cost, table HP, and every refusal —
// camp footprint, spawn-mouth band, occupied cell, node, orb, empty
// purse), combat truth (a fence on the camp road is attacked and
// destroyed by the game's own targeting before the enemy passes; an
// unblocked road is unchanged), mend and demolish at their table
// numbers, and the intermission's field room (leaving the shop keeps
// its deadline; the wave auto-starts exactly once from the field;
// returning to the shop never re-arms the minute). No browser is
// available — the on-screen readability of the build bar, the ghost
// and the wear tints needs a human pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js');
const art = read('js/art.js');
ok(main.includes('const GATHER='), 'GATHER table named in main.js');
ok(main.includes('const BUILD='), 'BUILD table named in main.js');
ok(main.includes('const NODE_SPOTS='), 'NODE_SPOTS named in main.js');
ok(main.includes("['build','BUILD',64,64,1062,556]"), 'BUILD joins LAYOUT_DEFS at its standing seat'); // Upgrade 17 re-point: BUILD is a 64 circle at the command row's right end. Upgrade 23 re-point: BUILD is first-class now — it leaves the fan and stands at (1062,556), beside the powers arc foot, inside the placement law's margins
ok(main.includes("build:'KeyC'"), 'build keybind defaults to KeyC');
ok(/[Gg]ather wood from trees and stone from rocks/.test(main), 'a loading tip teaches gather & build'); // Upgrade 23 re-point: the tip was rewritten to teach the on-demand doors (no popup; SHOP opens the market) — the gather & build teaching it guards stands inside it
ok(art.includes("tex('tree'") && art.includes("tex('rock'") && art.includes("tex('fence'") && art.includes("tex('stonewall'"), 'art.js draws the tree, rock, fence and stonewall textures');
ok(main.includes("kind:'build'") && main.includes('this.damageBuild(def.pc,e.dmg)'), 'pieces join the enemy blocker scan and take its blows');
ok(main.includes('leaveShopToField') && main.includes('openShop(first,keepT,mode)'), 'the field door and the keep-deadline shop path exist'); // Upgrade 23 re-point: openShop gained its mode (inter/field) — the keep-deadline path is the same call
ok(!main.includes('friends-only') && read('js/net.js').length > 0, 'netcode file present (untouched by this suite — verified by git at ship)');

// ---------- runtime scaffolding (the U14 pattern) ----------
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
  Tokens: { earn() {}, spend: () => true, balance: () => 0, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const GATHER = vm.runInContext('GATHER', ctx);
const BUILD = vm.runInContext('BUILD', ctx);
const LAYOUT_DEFS = vm.runInContext('LAYOUT_DEFS', ctx);
const BIND_ACTIONS = vm.runInContext('BIND_ACTIONS', ctx);
const DEFAULT_BINDS = vm.runInContext('DEFAULT_BINDS', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const LOCUST = UNITS.bible.enemy.find(e => e.id === 'locust_swarm');

// Controllable wall clock inside the game context (the U6 pattern).
const DateObj = vm.runInContext('Date', ctx);
let fakeNow = 1700000000000;
DateObj.now = () => fakeNow;

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle'].forEach(m => { o[m] = () => o; }); return o; }

function bareBattle(heroId) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(), container: () => mkObj() };
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, timeScale: 1 };
  g.tweens = { add: () => {}, killTweensOf: () => {} };
  g.cameras = { main: { flash() {}, shake() {}, setBounds() {}, startFollow() {} } };
  g.children = { list: [] };
  g.scene = { start() {} };
  GameProto.init.call(g, { hero: heroId || 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 0, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: true, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, skillBtns: [], cmdBtns: {}, fx: gfxObj(), shopItems: [], campItems: [] });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }

// ---------- the tables ----------
ok(GATHER.range === 80 && GATHER.tick === 0.55 && GATHER.woodYield === 2 && GATHER.stoneYield === 2 && GATHER.gathers === 5 && GATHER.regrow === 45,
  'GATHER: stand within 80px, a swing every 0.55s, +2 per swing, 5 swings a node, 45s regrow');
ok(BUILD.pieces.fence.cost === 6 && BUILD.pieces.fence.hp === 120 && BUILD.pieces.wall.cost === 6 && BUILD.pieces.wall.hp === 320,
  'BUILD pieces: Wooden Fence 6 wood / 120 HP, Stone Wall 6 stone / 320 HP');
ok(BUILD.grid === 64 && BUILD.campClear === 118 && BUILD.spawnBand === 150, 'BUILD placement: 64px grid, 118 camp clearance, 150 spawn-mouth band');
ok(LAYOUT_DEFS.length === 18 && LAYOUT_DEFS.some(d => d[0] === 'build'), 'LAYOUT_DEFS carries 18 controls, BUILD among them'); // Upgrade 17 re-point: 18 — ORDERS joins the table. Upgrade 20 re-point: 17 — Dodge and Block merge into GUARD. Upgrade 23 re-point: 18 — SHOP joins
ok(BIND_ACTIONS.length === 17 && DEFAULT_BINDS.build === 'KeyC' && new Set(Object.values(DEFAULT_BINDS)).size === Object.keys(DEFAULT_BINDS).length,
  '17 bindable actions; KeyC is build\'s default and no two defaults collide'); // Upgrade 20 re-point: 16 — the dodge/block binds merge into the Guard key. Upgrade 23 re-point: 17 — the Shop key (KeyM) joins

// ---------- the node field ----------
{
  const g = bareBattle(); g.buildNodes(); g.buildOrbs();
  ok(g.nodes.length === 11 && g.nodes.filter(n => n.kind === 'tree').length === 6 && g.nodes.filter(n => n.kind === 'rock').length === 5,
    'the field stands 6 trees and 5 rocks');
  const t0 = g.nodes[0], r0 = g.nodes.find(n => n.kind === 'rock');
  ok(t0.x === 480 && t0.y === 240 && r0.x === 518 && r0.y === 1020, 'Bible posts land where NODE_SPOTS says: first tree (480,240), first rock (518,1020)');
  ok(g.nodes.every(n => Math.hypot(n.x - 150, n.y - 600) >= 200), 'every node stands at least 200px from the camp');
  ok(g.nodes.every(n => g.orbs.every(o => Math.hypot(n.x - o.x, n.y - o.y) >= 110)), 'every node stands at least 110px from every orb station');
  const g2 = bareBattle(); g2.buildNodes();
  ok(g2.nodes.every((n, i) => n.x === g.nodes[i].x && n.y === g.nodes[i].y), 'node placement is deterministic — the same field every run');
}

// ---------- gathering ----------
{
  const g = bareBattle(); g.waveActive = false; g.buildNodes();
  const tree = g.nodes[0];
  g.hero.x = g.hero.tx = tree.x; g.hero.y = g.hero.ty = tree.y;
  for (let i = 0; i < 80; i++) g.update(0, 50);
  ok(g.wood === 10 && tree.hp === 0, 'standing at a tree: 5 swings x +2 wood = exactly 10, and the node is gathered out');
  ok(tree.regrowT > 40 && tree.regrowT <= 45, 'a gathered-out node starts its 45s regrow (at ' + tree.regrowT.toFixed(1) + 's after ~1.2s)');
  g.hero.x = g.hero.tx = tree.x + 420; g.hero.y = g.hero.ty = tree.y;
  for (let i = 0; i < 40; i++) g.update(0, 50);
  ok(g.wood === 10, 'out of range, gathering stops — the purse does not move');
  tree.regrowT = 0.05;
  g.update(0, 50); g.update(0, 50);
  ok(tree.hp === tree.max, 'when the regrow timer runs out the node stands full again');
  const g2 = bareBattle(); g2.waveActive = false; g2.buildNodes();
  const rock = g2.nodes.find(n => n.kind === 'rock');
  g2.hero.x = g2.hero.tx = rock.x; g2.hero.y = g2.hero.ty = rock.y;
  for (let i = 0; i < 14; i++) g2.update(0, 50);
  ok(g2.stone === 2 && g2.wood === 0, 'standing at a rock yields stone, not wood — one swing in 14 frames, exactly +2');
}

// ---------- building: placement, costs, refusals ----------
{
  const g = bareBattle(); g.buildNodes(); g.buildOrbs();
  g.wood = 12; g.stone = 12;
  ok(g.tryPlace('fence', 928, 600) === 'placed', 'a fence places on open road');
  const pc = g.builds[0];
  ok(g.wood === 6 && pc.hp === 120 && pc.max === 120 && pc.cx === 928 && pc.cy === 608, 'placement deducts exactly 6 wood and registers the piece at table HP on its grid cell (928,608)');
  ok(g.tryPlace('fence', 930, 605) === 'occupied' && g.wood === 6, 'the same cell refuses a second piece — no charge');
  ok(g.tryPlace('fence', 210, 600) === 'camp' && g.wood === 6, 'inside the camp\'s ground (118px) refuses — no charge');
  ok(g.tryPlace('wall', 1820, 600) === 'spawn' && g.stone === 12, 'the spawn-mouth band refuses — the road in can never be sealed, no charge');
  ok(g.tryPlace('fence', 480, 240) === 'node' && g.wood === 6, 'a node\'s cell refuses — no charge');
  ok(g.tryPlace('fence', 1050, 600) === 'orb' && g.wood === 6, 'an orb station\'s cell refuses — no charge');
  g.wood = 0;
  ok(g.tryPlace('fence', 760, 200) === 'funds' && g.builds.length === 1, 'an empty purse refuses — nothing built, nothing charged');
  // build mode routes field taps to the tools
  g.tutorial = true; g.toggleBuildMode();
  ok(g.buildMode === false, 'the tutorial refuses build mode — its seven steps stand unchanged');
  g.tutorial = false; g.toggleBuildMode();
  ok(g.buildMode === true && g.buildItems.length > 0, 'BUILD opens the build bar');
  g.wood = 6; g.buildTool = 'fence';
  g.fieldTap({ x: 928, y: 300, worldX: 928, worldY: 300 });
  ok(g.builds.length === 2 && g.wood === 0, 'a field tap in build mode places with the tool in hand');
  g.buildTool = 'demolish';
  ok(g.buildTap(928, 300) === 'demolished' && g.builds.length === 1 && g.wood === 3, 'buildTap with Demolish takes the piece down and refunds half (3 of 6)');
}

// ---------- mend & demolish ----------
{
  const g = bareBattle(); g.buildNodes();
  g.wood = 20; g.stone = 12;
  g.tryPlace('fence', 928, 600);
  const pc = g.builds[0];
  g.damageBuild(pc, 70);
  ok(pc.hp === 50, 'a piece takes damage honestly (120 - 70 = 50)');
  ok(g.mendBuild(pc) === 'mended' && g.wood === 12 && pc.hp === 110, 'mend: +50% of max (50 -> 110) for a third of the cost (6 -> 2 wood)');
  ok(g.mendBuild(pc) === 'mended' && pc.hp === 120 && g.wood === 10, 'a second mend tops the piece off at max, never past it');
  ok(g.mendBuild(pc) === 'full' && g.wood === 10, 'mending a whole piece refuses — no charge');
  g.tryPlace('wall', 1200, 900);
  const wp = g.builds.find(b => b.def.id === 'wall');
  ok(wp && wp.hp === 320 && g.stone === 6, 'a stone wall registers at 320 HP for 6 stone');
  ok(g.demolishBuild(wp) === 'demolished' && g.stone === 9 && !g.builds.includes(wp), 'demolish refunds half its cost (3 of 6 stone) and the piece is gone');
}

// ---------- combat truth: the fence on the road ----------
{
  const g = bareBattle(); g.buildNodes();
  g.hero.x = g.hero.tx = 210; g.hero.y = g.hero.ty = 150; // the hero watches from off the road
  g.wood = 6; g.tryPlace('fence', 928, 600);
  const pc = g.builds[0];
  g.waveHpM = 1; g.waveDmM = 1;
  const e = g.spawn({ def: LOCUST, at: 0, boss: false }); e.x = 1080; e.y = 604;
  for (let i = 0; i < 200; i++) g.update(0, 50);
  ok(pc.hp < 120 && g.campHp === 500 && e.x > 950, 'the march stops at the fence and chews it — camp untouched, enemy held east of the piece (fence at ' + Math.max(0, Math.ceil(pc.hp)) + ' HP, enemy x ' + Math.round(e.x) + ')');
  for (let i = 0; i < 650; i++) g.update(0, 50);
  ok(g.builds.length === 0, 'the fence is destroyed by the game\'s own targeting — the road reopens');
  ok(g.campHp < 500 || e.x < 400, 'only once the fence falls does the enemy reach the camp road\'s end (camp ' + Math.ceil(g.campHp) + ', enemy x ' + Math.round(e.x) + ')');
  // control: the same march with no fence built
  const c = bareBattle();
  c.hero.x = c.hero.tx = 210; c.hero.y = c.hero.ty = 150;
  c.waveHpM = 1; c.waveDmM = 1;
  const e2 = c.spawn({ def: LOCUST, at: 0, boss: false }); e2.x = 500; e2.y = 604;
  for (let i = 0; i < 160; i++) c.update(0, 50);
  ok(c.campHp < 500 && c.campHp > 400, 'control: unblocked, the same enemy is on the camp within seconds (camp ' + Math.ceil(c.campHp) + ') — the fence, not the code path, made the difference');
}

// ---------- the intermission's field room ----------
{
  const g = bareBattle(); g.waveActive = false;
  g.startWave = () => { g.startCalls = (g.startCalls || 0) + 1; };
  fakeNow = 1700000000000;
  g.openShop(true);
  const deadline = g.shopEndsAt;
  ok(g.shopOpen === true && deadline === fakeNow + 60000, 'the shop opens on a fresh 60s deadline');
  g.leaveShopToField();
  ok(g.interField === true && g.shopOpen === false && g.shopEndsAt === deadline, 'stepping to the field keeps the SAME deadline — no time is farmed by leaving');
  fakeNow += 30000; g.update(0, 16);
  ok(Math.abs(g.shopT - 30) < 1.5 && g.interTxt && g.interTxt._t === 'Next wave in 0:30' && !g.startCalls, 'half the minute gone on the field, the countdown reads 0:30, no wave yet');
  g.openShop(false, true);
  ok(g.shopOpen === true && g.shopEndsAt === deadline, 'returning to the shop keeps the deadline too — the minute is the intermission\'s, not the room\'s');
  g.leaveShopToField();
  fakeNow += 31000; g.update(0, 16);
  ok(g.startCalls === 1 && g.interField === false, 'at zero the wave starts from the field — exactly once');
  g.update(0, 16);
  ok(g.startCalls === 1, 'and it does not start twice');
}

console.log('\nUpgrade 15: ' + (total - fails) + '/' + total + ' checks passed' + (fails ? ' — ' + fails + ' FAILING' : ''));
process.exit(fails ? 1 : 0);
