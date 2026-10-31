#!/usr/bin/env node
// Upgrade 20 verification harness — FEW BUTTONS, DEEP PRESSES (kennin's
// ruling, voice call 2026-10-31 ~01:24 CDT, three turns: the buttons
// "need to be like easier to press they're on weird and awkward parts
// of the screen" -> "We may need a shortened down to just a few buttons
// and like the way you press them makes them do more things" ->
// "Adjust it for the whole thing." Scope: the WHOLE game.)
// Batteries:
// (1) statics — the press grammar's pieces (HOLD_MS, wirePress kinds,
//     the reticle, the quick Repair, the hold-fill rims), the Guard
//     keybind merge, the placement map in LAYOUT_DEFS;
// (2) GUARD — tap dodges and never blocks; a hold past the threshold
//     blocks and the release drops it clean; a short press never
//     blocks; a corner press begins nothing;
// (3) POWERS — aimed casts land at the reticle for all three of
//     David's powers (Stone picks its mark around the point, Psalm
//     fires from the hold, Five Stones chooses around the point and
//     an empty point consumes NOTHING); tap casts are the pre-U20
//     casts exactly (same targets as a direct useSkill);
// (4) ORDERS — tap fans, hold rallies with the fan shut;
// (5) CAMP — hold repairs when able (and the release never opens the
//     panel), and explains when not (whole camp / thin purse);
// (6) the FACE MIGRATION — fresh -> Few; a U17 Simple -> Few; a
//     pre-U20 Full -> Few; a stamped (re-picked) Full -> Full; a
//     customized player's seats honored in Few; the editor reset
//     restoring the new defaults;
// (7) the TUTORIAL's gesture credits — Guard tap/hold, the aimed
//     cast, the ORDERS hold — each earned through the real press path.
// The full tutorial walkthrough lives in U11's suite; the champion
// benchmark (starter ~32.8s, camp whole) lives in U18's — both suites
// stand green beside this one, unaltered.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- statics ----------
const main = read('js/main.js');
ok(main.includes('const HOLD_MS=280'), 'the hold threshold is 280ms — one number, kennin\'s to bend');
ok(main.includes("wirePress(btn,kind,idx)") && main.includes("kind==='guard'") && main.includes("kind==='skill'") && main.includes("kind==='orders'") && main.includes("kind==='camp'") && main.includes("kind==='autofire'"),
  'the press grammar wires exactly five kinds: guard, skill, orders, camp, autofire');
ok(main.includes('drawAimFx(){') && main.includes('drawPressFx(){'), 'the reticle and the hold-fill rims are drawn — the player SEES the second verb coming');
ok(main.includes('quickRepairCamp(){') && main.includes('explainNoRepair('), 'CAMP\'s hold is the quick Repair, and a Repair that cannot run explains itself — never a silent nothing');
ok(main.includes("FACE_MIG_KEY='gxhub_wotw_face_u20'") && main.includes('function saveFaceChoice(f)'), 'the migration stamp exists, and every deliberate face pick writes it');
ok(main.includes("['guard','Guard — tap: Dodge · hold: Block']") && !main.includes("['dodge','Dodge']") && !main.includes("['block','Block']"),
  'the binds list carries ONE Guard action (tap: Dodge · hold: Block) — the Dodge and Block rows are gone');
ok(main.includes("const CAMP_RAIL={dx:0,dy:-86}"), 'in the Few face CAMP rides the rail directly above ORDERS (its own seat waits for Full)');

// ---------- runtime scaffolding (the U12/U16 pattern, recording stubs) ----------
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
const SettingsProto = vm.runInContext('Settings.prototype', ctx);
const LAYOUT_DEFS = vm.runInContext('LAYOUT_DEFS', ctx);
const FAN_MEMBERS = vm.runInContext('FAN_MEMBERS', ctx);
const loadFace = vm.runInContext('loadFace', ctx);
const FIGHT = vm.runInContext('FIGHT', ctx);
const HELD = vm.runInContext('HELD', ctx);

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
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj(counting) { const o = mkObj(); o.calls = {};
  ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'fillEllipse', 'fillPoints', 'fillTriangle', 'strokeTriangle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => { if (counting) o.calls[m] = (o.calls[m] || 0) + 1; return o; }; }); return o; }
function capInput() { const h = {}; return { _h: h, on(ev, cb) { (h[ev] = h[ev] || []).push(cb); }, fire(ev, p) { (h[ev] || []).forEach(cb => cb(p)); } }; }
function press(b, lx, ly) { if (b._handlers.pointerdown) b._handlers.pointerdown({}, lx, ly, {}); if (b._handlers.pointerup) b._handlers.pointerup({}, lx, ly, { stopPropagation() {} }); }
function cleanStore() { Object.keys(store).forEach(k => { if (k.indexOf('gxhub_wotw') === 0) delete store[k]; }); }
function bareBattle(data) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, addEvent: () => {}, timeScale: 1 };
  g.tweens = { add: () => {}, killTweensOf: () => {} };
  g.cameras = { main: { flash() {}, shake() {}, setBounds() {}, startFollow() {} } };
  g.children = { list: [] };
  g.input = capInput();
  g.scene = { start(k, d) { g.__started = [k, d]; } };
  GameProto.init.call(g, data || { hero: 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 340, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj() });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD(); return g; }
function tutBattle(data) { const g = hudBattle(Object.assign({ hero: 'david', level: { era: 'bible' }, tutorial: true }, data || {})); g.buildOrbs(); g.startTutorial(); return g; }

// ---------- Upgrade 20 extractions ----------
const HOLD_MS = vm.runInContext('HOLD_MS', ctx);
const DEFAULT_BINDS = vm.runInContext('DEFAULT_BINDS', ctx);
const BIND_ACTIONS = vm.runInContext('BIND_ACTIONS', ctx);
const loadBinds = vm.runInContext('loadBinds', ctx);
const resetLayout = vm.runInContext('resetLayout', ctx);
const CAMP_REPAIR = vm.runInContext('CAMP_REPAIR', ctx);
const LAYOUT_ICONS = vm.runInContext('LAYOUT_ICONS', ctx);
const saveFaceChoice = vm.runInContext('saveFaceChoice', ctx);

// ---------- placement + binds (runtime statics) ----------
{ const D = {}; LAYOUT_DEFS.forEach(d => { D[d[0]] = d; });
  ok(HOLD_MS === 280, 'HOLD_MS is 280 in the running code');
  ok(D.autofire[4] === 1178 && D.autofire[5] === 76 && D.skill0[4] === 1178 && D.skill0[5] === 368 && D.skill1[5] === 462 && D.skill2[5] === 556,
    'the right rail: auto-fire top (1178,76), the powers arc beneath it (368 / 462 / 556) — the ult nearest the corner');
  ok(D.guard[4] === 102 && D.guard[5] === 448 && D.sprint[4] === 102 && D.sprint[5] === 548, 'the left rail: GUARD (102,448) over SPRINT (102,548) — the left thumb\'s arc');
  ok(D.orders[4] === 1178 && D.orders[5] === 268, 'ORDERS rides the right rail above the powers arc (1178,268); CAMP\'s Few spot rides above it');
  ok(D.skill0[2] === 76 && D.guard[2] === 64 && D.sprint[2] === 64 && D.orders[2] === 64 && D.cmd_charge[2] === 56 && D.build[2] === 56 && D.build[3] === 120,
    'diameters never shrank: powers 76, thumb circles 64, the command rank 56'); // Amendment re-point: BUILD is a 56x120 sidebar TAB now — a bigger touch plate than the 64 circle it replaces, not a shrunk diameter
  ok(LAYOUT_DEFS.every(d => !(d[4] < 640 && d[5] < 200 && d[0] !== 'autofire')), 'nothing stands top-left or mid-screen — the seats are the two thumb arcs and the bottom row');
  ok(LAYOUT_ICONS.guard === 'ico_guard' && LAYOUT_ICONS.dodge === undefined && LAYOUT_ICONS.block === undefined, 'LAYOUT_ICONS: GUARD wears ico_guard; the dodge/block entries retired with their buttons');
  ok(DEFAULT_BINDS.guard === 'Space' && DEFAULT_BINDS.dodge === undefined && DEFAULT_BINDS.block === undefined && BIND_ACTIONS.length === 17,
    'DEFAULT_BINDS: Space is the Guard key; no dodge/block keys remain; 17 bindable actions'); // Upgrade 23 re-point: 17 — the Shop key (KeyM) joins the binds
  cleanStore(); store.gxhub_wotw_binds = JSON.stringify({ dodge: 'KeyQ', block: 'ShiftRight', sprint: 'KeyV' });
  const lb = loadBinds();
  ok(lb.guard === 'KeyQ' && lb.sprint === 'KeyV', 'a pre-U20 binds save migrates: the old Dodge key becomes the Guard key, the rest untouched');
  cleanStore(); }

// ---------- press drives (the game's real channels) ----------
function down(b) { if (b._handlers.pointerdown) b._handlers.pointerdown({}, 0, 0, {}); }
function downAt(b, lx, ly) { if (b._handlers.pointerdown) b._handlers.pointerdown({}, lx, ly, {}); }
function release(g) { g.input.fire('pointerup', {}); } // presses end on the SCENE pointerup — the game's real release channel
function holdPast(rec) { rec.t0 -= (HOLD_MS + 20); }
function spawnFoe(g, x, y, hp) { const def = vm.runInContext('UNITS', ctx).bible.enemy.find(e => e.id === 'pebble_golem');
  const e = g.spawn({ def, at: 0, boss: false }); e.hp = e.max = hp; e.x = x; e.y = y;
  if (e.spr && e.spr.setPosition) e.spr.setPosition(x, y); return e; }

// ---------- GUARD: tap dodges, hold blocks, short never blocks ----------
{ cleanStore(); const g = hudBattle();
  const gb = g.fightBtns.guard;
  downAt(gb, 26, 26); // the bounding square's corner: outside the circle
  ok(!g.guardPress && g.hero.dodgeCd === 0 && !g.hero.blocking, 'GUARD: a corner press begins nothing — the circle is the law');
  down(gb); release(g); // a plain tap
  ok(g.hero.dodgeCd > 0 && g.hero.blocking === false, 'GUARD tap: David DODGES (cooldown running) and the guard never rose');
  g.hero.dodgeCd = 0;
  down(gb); g.tickPresses(); release(g); // pressed and released inside the threshold — an accidental short press
  ok(g.hero.blocking === false && g.hero.dodgeCd > 0, 'GUARD short press: still just a dodge — it never blocked, not for a frame');
  down(gb); holdPast(g.guardPress); g.tickPresses();
  ok(g.hero.blocking === true, 'GUARD hold (past 280ms): the guard is UP');
  const cdAtHold = g.hero.dodgeCd;
  release(g);
  ok(g.hero.blocking === false && g.hero.dodgeCd === cdAtHold, 'GUARD release: the guard drops clean — and no dodge fires off the back of a block');
  cleanStore(); }

// ---------- POWERS: the aimed cast, and the tap unchanged ----------
{ cleanStore(); const g = hudBattle();
  const hx = g.hero.x, hy = g.hero.y;
  const far = spawnFoe(g, hx + 560, hy, 900);
  ok(Math.hypot(far.x - hx, far.y - hy) > g.hero.def.range * 2, 'setup: the far foe stands beyond Smooth Stone\'s tap reach');
  // TAP Smooth Stone: no mark in reach — 'No target', nothing consumed
  down(g.skillBtns[0]); g.endPresses({});
  ok(g.shots.length === 0 && g.skillBtns[0].cd === 0, 'tap Smooth Stone with no mark near the HERO: no shot, no cooldown — the pre-U20 answer');
  // AIMED Smooth Stone: hold, drag the reticle onto the far foe, release
  down(g.skillBtns[0]); holdPast(g.skillPress); g.tickPresses();
  ok(g.skillPress.held === true, 'holding the power past the threshold raises the aim (the reticle is up)');
  g.skillAim = { x: far.x, y: far.y }; g.endPresses({});
  ok(g.shots.length === 1 && g.shots[0].target === far && g.skillBtns[0].cd > 0, 'aimed Smooth Stone: the stone flies at the foe under the reticle — the cast landed at the point');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  const hx = g.hero.x, hy = g.hero.y;
  const strong = spawnFoe(g, hx + 560, hy, 900);
  const weaks = [0, 1, 2, 3, 4].map(i => spawnFoe(g, hx + 60 + i * 18, hy + 40, 10));
  // TAP Five Stones: the global strongest five — the pre-U20 selection
  down(g.skillBtns[2]); g.endPresses({});
  const tapTargets = g.shots.map(s => s.target);
  ok(tapTargets.length === 5 && tapTargets.includes(strong) && tapTargets.filter(t => weaks.includes(t)).length === 4,
    'tap Five Stones: strongest five on the field (the far strong + four weak) — byte-for-byte the old cast');
  // the same tap, as a direct useSkill on an identical field, agrees
  const g2 = hudBattle(); const hx2 = g2.hero.x, hy2 = g2.hero.y;
  const strong2 = spawnFoe(g2, hx2 + 560, hy2, 900); const weaks2 = [0, 1, 2, 3, 4].map(i => spawnFoe(g2, hx2 + 60 + i * 18, hy2 + 40, 10));
  g2.useSkill(2);
  const sig = ts => ts.map(t => t.max).sort((a, b) => a - b).join(',');
  ok(sig(g2.shots.map(s => s.target)) === sig(tapTargets), '…and a direct useSkill on an identical field picks the identical marks — the tap IS the old path');
  // AIMED Five Stones at the far point: only the foe there is chosen
  g.skillBtns[2].cd = 0; g.shots.length = 0;
  down(g.skillBtns[2]); holdPast(g.skillPress); g.tickPresses(); g.skillAim = { x: strong.x, y: strong.y }; g.endPresses({});
  ok(g.shots.length === 1 && g.shots[0].target === strong, 'aimed Five Stones: the volley gathers around the reticle — one foe there, one stone');
  // AIMED at an empty point: 'No target', nothing consumed
  g.skillBtns[2].cd = 0; g.shots.length = 0;
  down(g.skillBtns[2]); holdPast(g.skillPress); g.tickPresses(); g.skillAim = { x: hx, y: hy - 420 }; g.endPresses({});
  ok(g.shots.length === 0 && g.skillBtns[2].cd === 0, 'aimed Five Stones at empty ground: no stones, no cooldown — an aim refused costs nothing');
  cleanStore(); }
{ cleanStore(); const g = hudBattle();
  const sq = { buffRateT: 0, buffDmgT: 0 }; g.squads.push(sq);
  down(g.skillBtns[1]); holdPast(g.skillPress); g.tickPresses(); g.skillAim = { x: g.hero.x + 300, y: g.hero.y }; g.endPresses({});
  ok(sq.buffRateT === 6 && g.skillBtns[1].cd > 0, 'aimed Psalm: the hold casts it (cooldown running) and the blessing lands — Psalm\'s ring blooms at the reticle, its gift was never local');
  cleanStore(); }

// ---------- ORDERS: tap fans, hold rallies ----------
{ cleanStore(); const g = hudBattle();
  ok(g.face === 'few' && g.fanOpen === false, 'setup: the Few face, the fan shut');
  down(g.ordersBtn); g.endPresses({});
  ok(g.fanOpen === true, 'ORDERS tap: the fan opens');
  down(g.ordersBtn); g.endPresses({});
  ok(g.fanOpen === false, 'ORDERS tap again: the fan closes, nothing issued');
  down(g.ordersBtn); holdPast(g.ordersPress); g.tickPresses();
  ok(g.rallyMode === true && g.fanOpen === false, 'ORDERS hold: RALLY arms at once — and the fan never opened');
  g.endPresses({});
  ok(g.rallyMode === true && g.fanOpen === false, '…and the release changes nothing: Rally stays armed for the planting tap');
  cleanStore(); }

// ---------- CAMP: hold repairs, or explains ----------
{ cleanStore(); const g = hudBattle();
  g.campHp = g.campMax - 250; const manna0 = g.manna;
  down(g.campBtn); holdPast(g.campPress); g.tickPresses();
  ok(g.campHp === g.campMax - 250 + CAMP_REPAIR.heal && g.manna === manna0 - CAMP_REPAIR.cost,
    'CAMP hold: the quick Repair lands at the crossing (+' + CAMP_REPAIR.heal + ' HP for ' + CAMP_REPAIR.cost + ' Manna) — no panel, no menu');
  g.endPresses({});
  ok(g.campPanelOpen === false, '…and the release does NOT open the panel behind the repair');
  // a whole camp: the hold explains itself (a shake at the button)
  g.campHp = g.campMax; const shakes = []; const tw = g.tweens; g.tweens = { add: c => { shakes.push(c); }, killTweensOf: () => {} };
  down(g.campBtn); holdPast(g.campPress); g.tickPresses(); g.tweens = tw;
  ok(g.campHp === g.campMax && g.manna === manna0 - CAMP_REPAIR.cost && shakes.some(c => c.targets === g.campBtn),
    'CAMP hold on a whole camp: nothing spent, nothing mended — and the button shakes its answer (the float says why)');
  g.endPresses({});
  // a thin purse: same law
  g.campHp = g.campMax - 250; g.manna = CAMP_REPAIR.cost - 1; const shakes2 = []; g.tweens = { add: c => { shakes2.push(c); }, killTweensOf: () => {} };
  down(g.campBtn); holdPast(g.campPress); g.tickPresses(); g.tweens = tw;
  ok(g.campHp === g.campMax - 250 && g.manna === CAMP_REPAIR.cost - 1 && shakes2.some(c => c.targets === g.campBtn),
    'CAMP hold with a thin purse: refused with the reason, never a silent nothing');
  g.endPresses({});
  // the tap still opens the panel
  down(g.campBtn); g.endPresses({});
  ok(g.campPanelOpen === true, 'CAMP tap: the panel opens, as ever');
  cleanStore(); }

// ---------- the face migration ----------
{ cleanStore(); ok(loadFace() === 'few', 'migration: a fresh save opens on Few');
  store.gxhub_wotw_face = 'simple'; ok(loadFace() === 'few', 'migration: a U17 Simple choice reads as the Few it became');
  store.gxhub_wotw_face = 'full'; ok(loadFace() === 'few', 'migration: a pre-U20 Full choice is NOT honored — "the whole thing" moved to Few');
  store.gxhub_wotw_face_u20 = '1'; ok(loadFace() === 'full', 'migration: a Full re-picked after U20 (stamped) IS honored');
  cleanStore(); saveFaceChoice('full');
  ok(store.gxhub_wotw_face === 'full' && store.gxhub_wotw_face_u20 === '1' && loadFace() === 'full', 'migration: the re-pick stamps itself — that stamp is what the loader trusts');
  saveFaceChoice('few'); ok(loadFace() === 'few', 'migration: a Few re-pick returns to Few');
  cleanStore();
  store.gxhub_wotw_layout = JSON.stringify({ pos: { guard: { x: 900, y: 200 } } }); // a customized pre-U20 save
  const g = hudBattle();
  ok(g.face === 'few' && g.fightBtns.guard.x === 900 && g.fightBtns.guard.y === 200,
    'migration: a customized player opens on Few — with their saved Guard seat honored exactly (layouts were never the face)');
  cleanStore(); }

// ---------- editor reset restores the NEW defaults ----------
{ cleanStore(); store.gxhub_wotw_layout = JSON.stringify({ pos: { guard: { x: 900, y: 200 }, orders: { x: 300, y: 600 } } });
  const dirty = hudBattle();
  ok(dirty.fightBtns.guard.x === 900 && dirty.ordersBtn.x === 300, 'setup: the saved seats stand');
  resetLayout();
  const g = hudBattle(); const reg = {}; g.layoutReg.forEach(en => { reg[en.id] = en; });
  ok(LAYOUT_DEFS.every(d => { const en = reg[d[0]]; if (!en) return false;
      if (d[0] === 'cmd_camp') return en.obj.x === 1178 && en.obj.y === 182; // CAMP's Few standing spot — the rail above ORDERS
      return en.obj.x === d[4] && en.obj.y === d[5]; }),
    'editor reset: every control stands at the Upgrade 20 defaults — the thumb arcs, not the old stack');
  cleanStore(); }

// ---------- AUTO-FIRE: tap toggles, hold opens the controls ----------
{ cleanStore(); const g = hudBattle();
  down(g.fightBtns.autofire); g.endPresses({});
  ok(g.autoFire === false, 'AUTO-FIRE tap: the toggle flips');
  down(g.fightBtns.autofire); holdPast(g.afPress); g.tickPresses();
  ok(g.paused === true, 'AUTO-FIRE hold: the controls open (the pause — sound, face, layout live there)');
  g.endPresses({}); g.closePause();
  ok(g.autoFire === false, '…and the hold never flipped the toggle on its way');
  cleanStore(); }

// ---------- the tutorial's gesture credits ----------
{ cleanStore(); const g = tutBattle();
  g.tutSkip(); g.tutSkip(); // move, auto-fire -> the kit step
  ok(g.tutStep === 2, 'tutorial: the kit step stands');
  const gb = g.fightBtns.guard;
  down(gb); release(g);
  ok(g.tutCred.dodge === true, 'kit: a Guard TAP earns the dodge credit');
  down(gb); holdPast(g.guardPress); g.tickPresses();
  ok(g.tutCred.block === true, 'kit: a Guard HOLD earns the block credit'); release(g);
  if (g.fightBtns.sprint._handlers.pointerup) g.fightBtns.sprint._handlers.pointerup({}, 0, 0, { stopPropagation() {} });
  ok(g.tutStep === 3, 'kit: Sprint completes the step — all three verbs learned on two circles');
  g.useSkill(1); // the cast half (the walkthrough's own drive)
  ok(g.tutPhase === 1, 'power: the cast turns the step to its aiming half');
  g.skillBtns[1].cd = 0; const dum = g.enemies.find(e => e.tutDummy && e.max === 320);
  down(g.skillBtns[1]); holdPast(g.skillPress); g.tickPresses(); g.skillAim = { x: dum.x, y: dum.y }; g.endPresses({});
  ok(g.tutCred.aimed === true && g.tutStep === 4, 'power: the AIMED cast — hold, drag, release — completes the step');
  const sq = g.squads[0];
  g.onTap({ x: sq.x, y: sq.y, worldX: sq.x, worldY: sq.y });
  g.onTap({ x: 560, y: 460, worldX: 560, worldY: 460 });
  ok(g.tutPhase === 1, 'army: the squad posted — the lesson turns to ORDERS');
  down(g.ordersBtn); holdPast(g.ordersPress); g.tickPresses();
  ok(g.tutPhase === 2 && g.rallyMode === true && g.fanOpen === false, 'army: the ORDERS HOLD earns the rally credit — fan shut, Rally armed');
  g.endPresses({});
  g.onTap({ x: 640, y: 420, worldX: 640, worldY: 420 });
  ok(g.tutStep === 5, 'army: the planting tap completes the step — every credit earned through the new gestures only');
  cleanStore(); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
