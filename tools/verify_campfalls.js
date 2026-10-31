#!/usr/bin/env node
// Camp-Falls verification harness — kennin's ruling, given twice and
// restated while he watched the playtest (2026-10-31 ~02:02 CDT):
// "You still have to change it to where when the camp falls you still
// are able to be alive and the game continues." — "The camp is only
// there so the player can respawn. When the camp is not there and or
// if the camp gets destroyed while the player is still alive, the
// player has to die to lose."
// Solo only: js/net.js already lived by this law and is untouched.
//
// Batteries:
// (1) statics — the fall machinery, the two forks written in code, the
//     rider fixes (button-level release, "Wave 0" head, hover names);
// (2) THE FALL — camp destroyed mid-run: rubble read, run continues,
//     waves advance, chests still bank, rubble takes no more blows;
// (3) THE RESPAWN LAW — hero death with the camp standing respawns;
//     with the camp rubble it is the defeat, and ONLY then; a pending
//     respawn is cancelled by the fall itself;
// (4) VICTORY + THE STARS FORK — champion killed after the fall wins;
//     fallen camp caps at one star with its reason on BOTH end
//     surfaces; a standing camp earns exactly the old stars;
// (5) THE REBUILD FORK — Repair raises a fallen camp (panel and shop
//     stay reachable, CAMP-hold quick-repair works on rubble), bought
//     upgrades stay bought, Watch Fire sleeps in rubble and wakes on
//     the rebuild, respawns resume;
// (6) ENDLESS — banking continues while the hero lives after the fall;
//     his death ends the run with the banked waves on the record;
// (7) THE CAMP BUTTON (playtest rider) — driven through a FAITHFUL
//     model of the vendored Phaser's event flow: object handlers
//     first, the helper's stopPropagation cancelling the scene-level
//     'pointerup' (vendor/phaser.min.js processUpEvents emits the
//     scene POINTER_UP only when the shared event data is not
//     cancelled). The tap must open the panel in BOTH faces anyway —
//     via the button-level release wirePress now carries — the hold
//     must quick-repair and never open it, the structure tap must
//     still work, and the Guard tap rides the same repaired channel.
// The champion benchmark (starter ~32.5s, camp whole 500/500) lives in
// U18/U19's suites and stands green beside this one — its script never
// loses its camp, so the law change cannot move it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- statics ----------
const main = read('js/main.js');
const hitCampBody = main.slice(main.indexOf('hitCamp(amt,e){'), main.indexOf('campDown(){'));
ok(hitCampBody.includes('this.campFall(); return;') && !hitCampBody.includes('end(false)'),
  'hitCamp: the crossing calls campFall() — the string end(false) no longer lives in the camp\'s damage path');
ok(main.includes('campDown(){ return this.campHp<=0; }') && main.includes('campFall(){') && main.includes('syncCampRubble(){'),
  'the fall machinery exists: campDown / campFall / syncCampRubble');
ok(main.includes("this.toast('The camp has fallen — no more respawns. Stay alive.',4200)"),
  'the fall is announced in plain words: no more respawns, stay alive');
ok((main.match(/this\.campDown\(\)\?1:/g) || []).length === 2,
  'the stars fork is written at BOTH star desks (victory panel + end()): a fallen camp caps at one star');
ok(main.includes("'The field was held, but the camp was lost — one star.'") && main.includes("'The field was held, but the camp was lost.'"),
  'the one star explains itself on the victory panel and on the end screen');
ok(main.includes("(d.heroFell?'The Hero has Fallen':'The Camp has Fallen')"),
  'the end screen names the defeat that actually happened: the hero\'s fall, not the camp\'s');
ok(main.includes("btn.on('pointerup',p=>this.endPresses(p));"),
  'rider: wirePress carries a BUTTON-LEVEL release — the tap verb no longer depends on the scene pointerup the helper suppresses');
ok(main.includes("const head=this.wavesCleared>0?") && !main.includes("first?'Prepare your squads'"),
  'rider: the shop head reads the run\'s own wave count — a re-rendered opening shop can no longer announce "Wave 0 survived!"');
ok(!main.includes('the run falls') && main.includes('If the camp falls, the fight goes on — but then the hero must not fall.'),
  'the shop\'s first-visit line teaches the NEW law; the old "the run falls" sentence is gone from the game');
ok((main.match(/s\.floatBtnName\(c,opt\.floatName\)/g) || []).length === 2,
  'rider: the name float is wired to BOTH the press and the hover — mouse players can learn the symbols by resting on a circle');
ok(main.includes('bd=this.campHp>0?90:Infinity') && main.includes('rubble does not engage him') && main.includes('the slam is never spent on rubble'),
  'the host stops targeting rubble: the defender scan widens, the champion neither winds up nor slams on a fallen camp');

// ---------- runtime scaffolding (the U20 pattern; handler lists APPEND,
// as the real Phaser EventEmitter appends — the rider battery depends on it)
const store = {};
const ctx = {
  console, performance, setTimeout, clearInterval, setInterval,
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
  Tokens: { earn() {}, spend: () => true, balance: () => 1000, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const Rack = vm.runInContext('Rack', ctx);
const CAMP_REPAIR = vm.runInContext('CAMP_REPAIR', ctx);
const HOLD_MS = vm.runInContext('HOLD_MS', ctx);
const IDOL = JSON.parse(read('data/units.json')).bible.enemy.find(e => e.id === 'idol_golem');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true, _visible: true, _disabled: false, _scale: 1 };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setFlipX', 'setSize', 'setStrokeStyle', 'setColor', 'setDisplaySize', 'setTintFill'].forEach(m => { o[m] = () => o; });
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
function capInput() { const h = {}; return { _h: h, on(ev, cb) { (h[ev] = h[ev] || []).push(cb); }, fire(ev, p) { (h[ev] || []).forEach(cb => cb(p)); } }; }
function cleanStore() { Object.keys(store).forEach(k => { delete store[k]; }); }
function campSprStub() { const s = { active: true, _tint: null, _alpha: 1,
  setTint(c) { this._tint = c; return this; }, clearTint() { this._tint = null; return this; },
  setTintFill() { return this; }, setAlpha(a) { this._alpha = a; return this; } }; return s; }
function bareBattle(data) {
  const g = Object.create(GameProto);
  const texts = [];
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; texts.push(o); return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  g.__texts = texts;
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, addEvent: () => {}, timeScale: 1 };
  g.tweens = { add: () => {}, killTweensOf: () => {} };
  g.cameras = { main: { flash() {}, shake() {}, setBounds() {}, startFollow() {} } };
  g.children = { list: [] };
  g.input = capInput();
  g.scene = { start(k, d) { g.__started = [k, d]; } };
  GameProto.init.call(g, data || { hero: 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: campSprStub(), campBar: null, manna: 340, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj(), shopItems: [] });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD(); return g; }
function holdPast(rec) { rec.t0 -= (HOLD_MS + 20); }

// ---------- (2) THE FALL: the run continues ----------
{ cleanStore(); const g = hudBattle();
  g.hitCamp(120);
  ok(g.campHp === 380 && g.over === false, 'a hard blow lands (500->380) and nothing ends');
  g.hitCamp(1000);
  ok(g.campHp === 0 && g.campDown() === true && g.over === false,
    'the camp is DESTROYED mid-run — and the run is NOT over: the hero still stands, so play continues');
  ok(g.campSpr._tint === 0x6a5a4a && g.campSpr._alpha === 0.55, 'the rubble read: the camp sprite stands dimmed and greyed where it fell');
  ok(g.__texts.some(t => String(t._t || '').includes('THE CAMP HAS FALLEN')), 'the fall is spoken on the field, not just in a toast');
  g.hitCamp(50);
  ok(g.campHp === 0 && g.over === false, 'rubble takes no more blows — further hits change nothing and the fall is not re-spoken as an ending');
  // waves advance across the fall
  g.wave = 5; g.waveActive = true; g.spawnQ = []; g.enemies = [];
  g.update(0, 50);
  // U23 re-point: the intermission no longer opens the shop (kennin:
  // no menu pops up at wave end) — it stands on the FIELD, and the
  // next wave is begun from the field bar's law (beginInterWave).
  ok(g.wavesCleared === 5 && g.shopOpen === false && g.interField === true, 'the wave still clears after the fall — the intermission stands on the field, no menu popped up');
  g.beginInterWave();
  ok(g.wave === 6 && g.waveActive === true, 'the NEXT wave starts on a field whose camp is rubble');
  for (let i = 0; i < 160 && !g.enemies.length; i++) g.update(0, 50);
  ok(g.enemies.length > 0, 'wave 6 spawns and marches — the fight itself never noticed the run "ending"');
  // chests still bank: drop one at the hero's feet and step
  g.shopOpen = false; g.waveActive = true;
  const pend0 = Rack.pending().length;
  g.dropChest('wood', g.hero.x, g.hero.y, false);
  g.update(0, 50);
  ok(Rack.pending().length === pend0 + 1, 'a chest on the field still banks under the hero\'s feet after the fall');
  cleanStore(); }

// ---------- (3) THE RESPAWN LAW ----------
{ cleanStore(); const g = hudBattle();
  g.hurtHero(9999);
  ok(g.hero.down === 8 && g.over === false, 'hero falls with the camp STANDING: down for the respawn count, run alive');
  g.tickHeroDown(8.1);
  ok(g.hero.down === 0 && g.hero.hp === g.hero.def.hp && g.hero.x === 210 && g.hero.y === 600, '...and he returns at the camp, full HP — the camp did its one job');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  g.hitCamp(1000);
  ok(g.over === false && g.hero.down === 0, 'setup: camp rubble, hero alive, run going');
  g.hurtHero(9999);
  ok(g.over === true && g.__started && g.__started[0] === 'End' && g.__started[1].win === false && g.__started[1].heroFell === true,
    'hero falls with the camp RUBBLE: THAT is the defeat — the only one the game has now');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  g.hurtHero(9999);
  ok(g.hero.down === 8 && g.over === false, 'setup: hero down, respawn pending, camp standing, run alive');
  g.hitCamp(1000);
  ok(g.over === true && g.hero.down > 0 && g.__started[1].win === false && g.__started[1].heroFell === true,
    'the camp falls WHILE he waits: the pending respawn is cancelled by the fall — he stays down and the run ends at that moment');
  cleanStore(); }

// ---------- (4) VICTORY + THE STARS FORK ----------
function championKill(g) { g.wave = 10; g.waveHpM = 1; g.waveDmM = 1; g.waveActive = true; g.spawnQ = [];
  const e = g.spawn({ def: IDOL, at: 0, boss: true }); g.damage(e, 1e9, 'physical'); g.update(0, 50); return e; }
{ cleanStore(); const g = hudBattle();
  g.hitCamp(1000); // the camp falls BEFORE the champion does
  championKill(g);
  ok(g.cleared === true && g.victoryOpen === true && g.over === false, 'the champion dies AFTER the fall — and it is a VICTORY: the field was held');
  ok(g.__texts.some(t => String(t._t || '').includes('The field was held, but the camp was lost — one star.')),
    'the victory panel carries the fork\'s reason in plain words');
  g.end(true);
  ok(g.__started[1].win === true && g.__started[1].stars === 1 && g.__started[1].campLost === true,
    'end record: win, ONE star, campLost — the cap and its reason travel to the end screen');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  championKill(g);
  g.end(true);
  ok(g.__started[1].stars === 3 && g.__started[1].campLost === false, 'a camp standing WHOLE at victory still earns its three stars — the old law, untouched');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  g.hitCamp(200); // camp at 300/500 = 0.60 — hurt, standing
  championKill(g);
  g.end(true);
  ok(g.__started[1].stars === 2 && g.__started[1].campLost === false, 'a camp standing at 60% still earns two stars — the fork bites only on a FALLEN camp');
  cleanStore(); }

// ---------- (5) THE REBUILD FORK ----------
{ cleanStore(); const g = hudBattle();
  g.manna = 2000;
  const wf = vm.runInContext('CAMP_UPGRADES', ctx).find(u => u.id === 'watchfire');
  ok(g.buyCampUpgrade(wf) === true && g.campUp.watchfire === true, 'setup: Watch Fire bought while the camp stands');
  g.hitCamp(1000);
  ok(g.campDown() === true, 'the camp falls with its upgrades bought');
  const foe = g.spawn({ def: IDOL, at: 0, boss: false }); foe.x = g.campPos.x + 120; foe.y = g.campPos.y;
  g.waveActive = true; // the fire's other gates are open, so ONLY the rubble can be what silences it
  g.campFireCd = 0; const shots0 = g.shots.length;
  g.campFireTick(0.1);
  ok(g.shots.length === shots0, 'Watch Fire is QUIET in the rubble — the camp\'s systems sleep with it');
  g.toggleCampPanel();
  ok(g.campPanelOpen === true, 'the camp panel still opens on the rubble — the rebuild\'s door stays reachable mid-wave');
  g.closeCampPanel();
  ok(g.buyCampRepair() === true && g.campHp === CAMP_REPAIR.heal && g.campDown() === false,
    'REPAIR RAISES THE CAMP: the standard Repair, paid at rubble, stands it back up at the repair amount');
  g.syncCampRubble();
  ok(g.campSpr._tint === null && g.campSpr._alpha === 1, 'the rubble read clears — the camp stands in its own colors again');
  ok(g.campUp.watchfire === true, 'upgrades bought before the fall stay bought across the rebuild');
  g.campFireCd = 0; const shots1 = g.shots.length;
  g.campFireTick(0.1);
  ok(g.shots.length === shots1 + 1, 'Watch Fire wakes with the rebuilt camp');
  g.hurtHero(9999);
  ok(g.hero.down === 8 && g.over === false, 'after the rebuild, a hero fall is a respawn again — not a defeat');
  g.tickHeroDown(8.1);
  ok(g.hero.down === 0 && g.hero.hp === g.hero.def.hp, '...and the rebuilt camp brings him back');
  cleanStore(); }

// ---------- (6) ENDLESS: banking continues, death ends it ----------
{ cleanStore(); const g = hudBattle();
  g.endless = true; g.cleared = true; g.wave = 15; g.wavesCleared = 15; g.waveActive = true;
  g.hitCamp(1000);
  ok(g.over === false && g.wavesCleared === 15, 'endless, camp rubble at wave 15: the run — and its banked waves — live on while the hero does');
  g.hurtHero(9999);
  ok(g.over === true && g.__started[1].win === false && g.__started[1].endless === true && g.__started[1].waves === 15,
    'his death ends the endless run — and the record submitted carries the 15 banked waves');
  cleanStore(); }

// ---------- (7) THE CAMP BUTTON — the playtest rider, through Phaser's real flow ----------
// Object handlers run first, in registration order; the helper's own
// pointerup stopPropagation()s, which in the vendored engine cancels
// the shared event data and suppresses the scene-level 'pointerup'
// entirely (processUpEvents emits POINTER_UP only when !cancelled).
// This driver reproduces exactly that — it is the flow the watched
// playtest ran, which no earlier suite modeled.
function fireObj(btn, ev, p, lx, ly, evt) { (btn._handlers[ev] || []).forEach(cb => cb(p, lx, ly, evt)); }
function phaserTap(g, btn) { const p = { id: 1 };
  fireObj(btn, 'pointerdown', p, 0, 0, {});
  let cancelled = false; const evt = { stopPropagation() { cancelled = true; } };
  fireObj(btn, 'pointerup', p, 0, 0, evt);
  if (!cancelled) g.input.fire('pointerup', p);
  return cancelled; }
{ cleanStore(); const g = hudBattle();
  ok(g.face === 'few', 'setup: the Few face (the default his brother played)');
  const cancelled = phaserTap(g, g.campBtn);
  ok(cancelled === true, 'the mechanism, proven: the helper\'s release DID suppress the scene pointerup — the old tap channel was truly cut');
  ok(g.campPanelOpen === true, '...and the CAMP tap STILL opens the camp panel — the button-level release carries it now');
  phaserTap(g, g.campBtn);
  ok(g.campPanelOpen === false, 'a second CAMP tap closes the panel — the toggle is whole');
  g.setFace('full');
  phaserTap(g, g.campBtn);
  ok(g.campPanelOpen === true, 'FULL face: the CAMP tap opens the panel there too');
  g.closeCampPanel(); g.setFace('few');
  // the hold: repairs, never opens
  g.campHp = 300; g.manna = 500;
  fireObj(g.campBtn, 'pointerdown', { id: 1 }, 0, 0, {});
  holdPast(g.campPress); g.tickPresses();
  ok(g.campHp === 300 + CAMP_REPAIR.heal && g.campPanelOpen === false, 'CAMP hold: the quick Repair lands (+100) while the press is still down');
  let cancelled2 = false; const evt2 = { stopPropagation() { cancelled2 = true; } };
  fireObj(g.campBtn, 'pointerup', { id: 1 }, 0, 0, evt2);
  if (!cancelled2) g.input.fire('pointerup', { id: 1 });
  ok(g.campPanelOpen === false, '...and its release does NOT open the panel behind the repair');
  // the structure tap — the path that worked in the playtest — still works
  g.fieldTap({ x: 150, y: 600, worldX: 150, worldY: 600 });
  ok(g.campPanelOpen === true, 'tapping the camp STRUCTURE still opens the panel, as it did in the playtest');
  g.closeCampPanel();
  // the same repaired channel carries the whole grammar: a Guard tap dodges
  const cancelled3 = phaserTap(g, g.fightBtns.guard);
  ok(cancelled3 === true && g.hero.dodgeCd > 0 && g.hero.blocking === false,
    'the Guard tap rides the same repaired release: a tap over the circle DODGES (it silently lingered before, CAMP was only the visible symptom)');
  cleanStore(); }

// ---------- the opening shop's head (rider 2), live ----------
{ cleanStore(); const g = hudBattle();
  g.openShop(true);
  g.renderShop(false); // the re-render a camp purchase or page turn causes — the playtest's "Wave 0" moment
  ok(g.__texts.some(t => t._t === 'Prepare your squads') && !g.__texts.some(t => String(t._t || '').includes('Wave 0 survived')),
    'the OPENING shop, re-rendered, still says "Prepare your squads" — "Wave 0 survived!" is gone');
  cleanStore(); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
