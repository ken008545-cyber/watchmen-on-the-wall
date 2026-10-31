#!/usr/bin/env node
// Upgrade 17 verification harness — CIRCULAR BATTLE UI + SIMPLE BATTLE
// FACE (kennin, 2026-10-31: "I want the ui buttons and the attacks to
// be circles not squares and rectangles" + "simplify the buttons. I
// want the game to be easy to play."). Batteries:
// (1) statics — the circle geometry in the table (powers 76 > thumb
//     cluster/BUILD/ORDERS 64 > command rank 56), the radius gate in
//     the shared button helper, ring sweeps replacing rectangular
//     fills, the face setting + fan tables;
// (2) circular hit-testing — for every battle button: a centre press
//     fires, a bounding-square corner press (outside the radius)
//     neither fires nor dips nor floats a name; overFight's wall is
//     the circle itself;
// (3) glyphs + radii on the built HUD;
// (4) ring feedback — the cooldown ring's arc grows as the cooldown
//     drains, the ready whisper is a ring pulse, the held-charge rim,
//     the dodge veil disc + recovery arc;
// (5) the fan — Simple stands only the core circles + ORDERS; the fan
//     opens at the ORDERS anchor, issuing closes it, a stray tap
//     closes it without marching, every command is reachable in two
//     taps, CAMP needs no fan;
// (6) faces — derivation (new player Simple; any Upgrade-12
//     customization -> Full; an explicit choice always wins),
//     persistence, and a pre-U17 save landing on identical centres;
// (7) editors — the in-battle editor and the Controls ghosts both
//     handle the fan as a group on the ORDERS anchor; seats survive;
// (8) the tutorial teaches the fan inside its army step.
// No browser is available — whether the circles READ at phone size
// (ico_follow / ico_volley flagged in the U16 notes) needs kennin's eyes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- statics ----------
const main = read('js/main.js');
ok(main.includes("FACE_KEY='gxhub_wotw_face'"), 'the face joins the settings family: gxhub_wotw_face');
ok(main.includes('function loadFace()') && main.includes('function hasPriorControls()') && main.includes("hasPriorControls()?'full':'simple'"),
  'face derivation: an explicit choice wins; any prior Upgrade-12 customization defaults Full; a new player defaults Simple');
ok(main.includes("const FAN_MEMBERS=['cmd_charge','cmd_hold','cmd_follow','cmd_flank','cmd_fallback','cmd_shieldwall','cmd_volley','cmd_rally','build']"),
  'the fan holds the whole command rank: six orders, Volley, RALLY, BUILD — nothing removed');
ok(main.includes('Math.hypot(lx||0,ly||0)<=circR') && main.includes('g.fillCircle(0,0,circR)'),
  'the shared button helper draws circles and gates every press by the radius (corner taps never reach the press)');
{ const sweep = main.slice(main.indexOf('drawSkillSweep(b){'), main.indexOf('// --- Upgrade 10: the right-thumb stack'));
  ok(sweep.includes('arcSegs') && sweep.includes('fillCircle') && !sweep.includes('fillRect'), 'the cooldown sweep is a ring + disc now — no rectangular fill remains in drawSkillSweep');
  ok(sweep.includes('strokeCircle(cx,cy,r+3+(1-b.readyPulse)*5)'), 'the power-ready whisper is a ring pulse that swells as it fades'); }
ok((main.match(/'Battle buttons'/g) || []).length >= 2, 'the Buttons: Simple / Full setting stands in BOTH Controls and the battle pause');
ok(main.includes("tutEvent('fanopen')") && main.includes("line3:'Now tap RALLY in the open rank"), 'the tutorial teaches the fan: open ORDERS, then RALLY');

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

// ---------- the table: circles, hierarchy, seats ----------
{ const D = {}; LAYOUT_DEFS.forEach(d => { D[d[0]] = d; });
  ok(LAYOUT_DEFS.length === 18 && LAYOUT_DEFS.every(d => d[2] === d[3]), 'LAYOUT_DEFS: 18 controls, every one a circle (w == h == diameter)');
  ok(D.skill0[2] === 76 && D.skill1[2] === 76 && D.skill2[2] === 76, 'the powers are the biggest circles: 76 across');
  ok(['autofire', 'dodge', 'block', 'sprint', 'build', 'orders'].every(id => D[id][2] === 64), 'the thumb cluster, BUILD and ORDERS: 64 across');
  ok(['cmd_charge', 'cmd_hold', 'cmd_follow', 'cmd_flank', 'cmd_fallback', 'cmd_shieldwall', 'cmd_volley', 'cmd_camp', 'cmd_rally'].every(id => D[id][2] === 56), 'the command rank: 56 across — the fan never shrinks them');
  ok(D.skill2[5] + 38 < 610 && D.autofire[5] - 32 > 0, 'the stack stands clear of the bar (last power rim 594 < 610) and of the top edge');
  ok(FAN_MEMBERS.length === 9, 'FAN_MEMBERS names all nine behind ORDERS'); }

// ---------- circular hit-testing on the built HUD (Full face: all stand) ----------
{ cleanStore(); store.gxhub_wotw_face = 'full';
  const g = hudBattle();
  ok(g.face === 'full' && g.ordersBtn._visible === false, 'Full face: every circle stands, ORDERS put away');
  const all = [];
  Object.values(g.fightBtns).forEach(b => all.push(b));
  Object.values(g.cmdBtns).forEach(b => all.push(b));
  all.push(g.campBtn, g.rallyBtn, g.buildBtn, g.pauseBtn, g.spdBtn);
  ok(all.length === 19 && all.every(b => b.circleR > 0), 'all 19 standing battle buttons are circles (7 stack + 7 row + CAMP, RALLY, BUILD, pause, speed)');
  let centersFire = 0, cornersDead = 0;
  all.forEach(b => { const r = b.circleR;
    if (b === g.fightBtns.block) { cornersDead++; return; } // Block's stub keeps only its hold handler (in the real game both fire); its centre/corner law is proven by the guard checks below
    g._nf = null; b._scale = 1;
    if (b._handlers.pointerdown) b._handlers.pointerdown({}, 0, 0, {});
    if (b._scale === 0.93) centersFire++; // the Upgrade-8 dip: a landed press
    b._scale = 1; g._nf = null;
    if (b._handlers.pointerdown) b._handlers.pointerdown({}, r * 0.8, r * 0.8, {}); // the bounding square's corner: distance 1.13r
    if (b._scale === 1 && !g._nf) cornersDead++; // no dip, no name float — the press never landed
    if (b._handlers.pointerup) b._handlers.pointerup({}, 0, 0, { stopPropagation() {} }); // release cleanly at center
  });
  ok(centersFire === all.length - 1, 'centre presses land on every battle circle (' + centersFire + '/' + (all.length - 1) + ' by the dip; Block by its guard, below)');
  ok(cornersDead === all.length, 'corner presses land on NONE — the bounding square\'s corners are dead ground (' + cornersDead + '/' + all.length + ')');
  // the block hold obeys the circle too (its own extra handler)
  const bb = g.fightBtns.block;
  if (bb._handlers.pointerdown) bb._handlers.pointerdown({}, bb.circleR * 0.8, bb.circleR * 0.8, {});
  ok(!g.hero.blocking, 'BLOCK: a corner hold raises no guard');
  if (bb._handlers.pointerdown) bb._handlers.pointerdown({}, 0, 0, {});
  ok(g.hero.blocking === true, 'BLOCK: a centre hold raises the guard'); g.setBlock(false);
  // overFight: the wall is the circle
  ok(g.overFight({ x: 1178, y: 384 }) === true, 'overFight: a power\'s centre is walled');
  ok(g.overFight({ x: 1178 + 27, y: 384 + 27 }) === false, 'overFight: the power\'s bounding corner is NOT walled — the tap falls through to the field');
  ok(g.overFight({ x: 1178 + 38, y: 384 }) === true, 'overFight: the rim itself is walled (radius inclusive)');
  // glyphs + radii
  ok(g.skillBtns.every(b => b.circleR === 38) && g.fightBtns.dodge.circleR === 32 && g.cmdBtns.charge.circleR === 28 && g.buildBtn.circleR === 32 && g.pauseBtn.circleR === 20 && g.spdBtn.circleR === 22,
    'radii on the built HUD: powers 38, thumb 32, commands 28, BUILD 32, pause 20, speed 22');
  ok(g.ordersBtn.iconKey === 'ico_banner', 'ORDERS wears the banner glyph from the existing family (no new texture)');
  cleanStore(); }

// ---------- ring feedback ----------
{ cleanStore(); const g = hudBattle();
  const b = g.skillBtns[0], cg = gfxObj(true); b.sweep = cg;
  const arcs = cd => { cg.calls = {}; b.cd = cd; g.drawSkillSweep(b); return cg.calls.lineBetween || 0; };
  ok(arcs(b.cdMax) === 0 && (cg.calls.fillCircle || 0) >= 1, 'cooldown full: the disc veils the glyph, the ring stands empty');
  const half = arcs(b.cdMax / 2), near = arcs(b.cdMax / 8);
  ok(half > 0 && near > half, 'the ring GROWS back as the cooldown drains (' + half + ' -> ' + near + ' segments) — the arc\'s length is the time left');
  b.cd = 0; b.held = 0; b.readyPulse = 1; cg.calls = {}; g.drawSkillSweep(b);
  ok((cg.calls.strokeCircle || 0) >= 1, 'the ready whisper draws a ring pulse');
  b.readyPulse = 0; b.held = HELD.perfectAt + 1; cg.calls = {}; g.drawSkillSweep(b);
  ok((cg.calls.strokeCircle || 0) >= 1, 'a Perfect held charge wears the full pulsing rim');
  const dg = gfxObj(true); g.fightBtns.dodge.sweep = dg; g.hero.dodgeCd = FIGHT.dodgeCd / 2;
  const bg = gfxObj(true); g.fightBtns.block.sweep = bg; g.hero.stamina = FIGHT.stamMax / 2;
  g.drawFightUI();
  ok((dg.calls.fillCircle || 0) >= 1 && (dg.calls.lineBetween || 0) > 0, 'the dodge veil is a disc with a recovery arc');
  ok((bg.calls.lineBetween || 0) > 0, 'the block stamina reads as a ring around the Block circle');
  cleanStore(); }

// ---------- the Simple face and the fan ----------
{ cleanStore();
  const g = hudBattle();
  ok(g.face === 'simple', 'a new player\'s battle opens on the Simple face');
  ok(g.ordersBtn._visible === true && g.campBtn._visible === true && g.skillBtns.every(b => b._visible !== false) && g.fightBtns.dodge._visible !== false,
    'Simple stands the core: powers, Dodge/Block/Sprint, auto-fire, CAMP — and ORDERS');
  ok(g.cmdBtns.charge._visible === false && g.cmdBtns.charge._disabled === true && g.buildBtn._visible === false && g.rallyBtn._visible === false,
    '…and the command rank waits behind ORDERS (hidden, not removed)');
  g.toggleFan();
  ok(g.fanOpen === true && g.cmdBtns.charge._visible === true && g.cmdBtns.charge.x === 130 && g.cmdBtns.charge.y === 552 && g.buildBtn.x === 806 && g.buildBtn.y === 552,
    'ORDERS fans the rank open in a row above the bar, anchored on ORDERS\' seat');
  ok(g.rallyBtnRect.x === 718 && g.rallyBtnRect.y === 552 && g.buildBtnRect.x === 806 && g.cmdBtns.volley.sx === 634,
    'the active-position records stand on the fan circles (rally ring target, build wall, volley sweep origin)');
  // issuing from the fan closes it
  press(g.cmdBtns.charge, 0, 0);
  ok(g.order === 'charge' && g.fanOpen === false && g.cmdBtns.charge._visible === false, 'tap a fanned command: the order issues and the fan closes behind it');
  // a stray tap closes without marching
  g.toggleFan(); const tx0 = g.hero.tx, ty0 = g.hero.ty;
  g.onTap({ x: 640, y: 300, worldX: 640, worldY: 300, id: 1 });
  ok(g.fanOpen === false && g.hero.tx === tx0 && g.hero.ty === ty0, 'a tap elsewhere closes the fan — consumed, never a march order');
  // a tap ON a fan circle is the button's own ground
  g.toggleFan();
  g.onTap({ x: 130, y: 552, worldX: 130, worldY: 552, id: 1 });
  ok(g.fanOpen === true, 'a tap on a fan circle belongs to the button (the fan stays for its press)');
  g.closeFan();
  // ORDERS itself toggles shut
  press(g.ordersBtn, 0, 0); ok(g.fanOpen === true, 'tap ORDERS: open');
  press(g.ordersBtn, 0, 0); ok(g.fanOpen === false, 'tap ORDERS again: closed, nothing issued');
  // two-tap reachability of every fan member
  const spies = { order: 0, volley: 0, rally: 0, build: 0 };
  const og = g.giveOrder; g.giveOrder = id => { spies.order++; return og.call(g, id); };
  const ov = g.pressVolley; g.pressVolley = () => { spies.volley++; return ov.call(g); };
  const orr = g.pressRally; g.pressRally = () => { spies.rally++; return orr.call(g); };
  const ob = g.toggleBuildMode; g.toggleBuildMode = () => { spies.build++; return ob.call(g); };
  ['charge', 'hold', 'follow', 'flank', 'fallback', 'shieldwall'].forEach(id => { g.toggleFan(); press(g.cmdBtns[id], 0, 0); });
  ok(spies.order === 6 && g.fanOpen === false, 'all six orders reachable in two taps (ORDERS, then the order)');
  g.toggleFan(); press(g.cmdBtns.volley, 0, 0); ok(spies.volley === 1 && g.fanOpen === false, 'Volley in two taps');
  g.toggleFan(); press(g.rallyBtn, 0, 0); ok(spies.rally === 1 && g.fanOpen === false, 'RALLY in two taps'); g.rallyMode = false;
  g.toggleFan(); press(g.buildBtn, 0, 0); ok(spies.build === 1 && g.fanOpen === false && g.buildMode === true, 'BUILD in two taps'); g.exitBuildMode();
  // CAMP never needs the fan
  press(g.campBtn, 0, 0);
  ok(g.campPanelOpen === true, 'CAMP stands on the Simple face itself — the panel opens in one tap'); g.closeCampPanel();
  // face switching mid-battle
  g.setFace('full');
  ok(store.gxhub_wotw_face === 'full' && g.cmdBtns.charge._visible === true && g.cmdBtns.charge.y === 665 && g.ordersBtn._visible === false,
    'setFace(Full): the rank returns to its seats, ORDERS puts away, the choice persists');
  g.setFace('simple');
  ok(store.gxhub_wotw_face === 'simple' && g.cmdBtns.charge._visible === false && g.ordersBtn._visible === true, 'setFace(Simple): the fan face returns');
  cleanStore(); }

// ---------- derivation + old saves ----------
{ cleanStore(); ok(loadFace() === 'simple', 'derivation: an empty store is a new player — Simple');
  store.gxhub_wotw_layout = '{"pos":{}}'; ok(loadFace() === 'full', 'derivation: a saved layout (an Upgrade-12 customization) means Full');
  delete store.gxhub_wotw_layout; store.gxhub_wotw_binds = '{}'; ok(loadFace() === 'full', 'derivation: saved keybinds mean Full');
  delete store.gxhub_wotw_binds; store.gxhub_wotw_move = 'stick'; ok(loadFace() === 'full', 'derivation: a saved movement scheme means Full');
  store.gxhub_wotw_face = 'simple'; ok(loadFace() === 'simple', 'derivation: an explicit Simple choice beats the customization heuristic');
  cleanStore(); store.gxhub_wotw_layout = '{"pos":{"dodge":{"x":900,"y":200}}}';
  const g = hudBattle();
  ok(g.face === 'full' && g.fightBtns.dodge.x === 900 && g.fightBtns.dodge.y === 200 && g.ordersBtn._visible === false && g.cmdBtns.charge._visible === true,
    'an existing player\'s battle: Full face, their dodge seat kept, nothing taken away');
  cleanStore(); store.gxhub_wotw_layout = '{"pos":{"skill1":{"x":900,"y":200}}}'; // a pre-U17 save, byte shape unchanged
  const g2 = hudBattle();
  ok(g2.skillBtns[1].x === 900 && g2.skillBtns[1].y === 200 && g2.skillBtns[1].sx === 900, 'a pre-U17 save lands on identical centres — positions were always centres');
  cleanStore(); }

// ---------- layout round-trip under circles ----------
{ cleanStore(); store.gxhub_wotw_face = 'full';
  store.gxhub_wotw_layout = JSON.stringify({ pos: { orders: { x: 300, y: 600 }, cmd_charge: { x: 500, y: 665 }, skill0: { x: 1000, y: 300 } } });
  const g = hudBattle();
  ok(g.ordersBtn.x === 300 && g.cmdBtns.charge.x === 500 && g.skillBtns[0].x === 1000, 'saved centres land exactly (ORDERS\' seat is saved even in Full, where it hides)');
  g.saveLayoutFromScene();
  const saved = JSON.parse(store.gxhub_wotw_layout).pos;
  ok(saved.orders.x === 300 && saved.orders.y === 600 && saved.cmd_charge.x === 500 && saved.skill0.x === 1000 && saved.cmd_rally.x === 1066,
    'the round-trip is exact: save under circles, every centre identical');
  cleanStore(); }

// ---------- editors: the fan as a group ----------
{ cleanStore();
  const g = hudBattle(); // Simple
  g.openPause(); g.enterLayoutEdit();
  const ids = g.layoutEd.items.map(i => i.id);
  ok(!ids.includes('cmd_charge') && ids.includes('orders') && FAN_MEMBERS.every(id => !ids.includes(id)),
    'Simple editor: fan members are NOT items — ORDERS is dragged, the group follows');
  ok(g.cmdBtns.charge._visible === true && g.cmdBtns.charge.y === 552, '…and the editor shows the fan open');
  ok(g.layoutEd.down({ x: 130, y: 665 }) === true, 'the editor takes ORDERS by its centre');
  g.layoutEd.move({ x: 300, y: 600 });
  ok(g.ordersBtn.x === 300 && g.cmdBtns.charge.x === 300 && g.cmdBtns.charge.y === 487, 'dragging ORDERS carries the whole fan, live');
  g.layoutEd.up();
  const saved = JSON.parse(store.gxhub_wotw_layout).pos;
  ok(saved.orders.x === 300 && saved.orders.y === 600 && saved.cmd_charge.x === 130 && saved.cmd_charge.y === 665,
    'the save writes ORDERS\' new seat — and the members\' seats untouched (the fan position is never saved as a seat)');
  g.exitLayoutEdit();
  ok(g.cmdBtns.charge._visible === false && g.seatOf('orders').x === 300, 'editor done: the fan folds away, ORDERS keeps its new seat');
  g.closePause();
  cleanStore(); store.gxhub_wotw_face = 'full';
  const g2 = hudBattle(); g2.openPause(); g2.enterLayoutEdit();
  const ids2 = g2.layoutEd.items.map(i => i.id);
  ok(ids2.includes('cmd_charge') && !ids2.includes('orders'), 'Full editor: every command is an item at its own seat; ORDERS is not an item');
  g2.exitLayoutEdit(); g2.closePause();
  cleanStore(); }

// ---------- editors: the Controls ghosts ----------
{ cleanStore();
  const s = Object.create(SettingsProto);
  s.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; }, rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  s.input = { on() {}, keyboard: { on() {} } };
  s.scene = { start() {} };
  SettingsProto.create.call(s);
  ok(s.face === 'simple' && s.faceBtns.simple.label._t.includes('✓'), 'Controls opens on the derived face (new player: Simple ✓)');
  s.faceBtns.full._handlers.pointerup({}, 0, 0, { stopPropagation() {} });
  ok(store.gxhub_wotw_face === 'full' && s.face === 'full', 'the Controls Buttons setting persists the choice');
  s.faceBtns.simple._handlers.pointerup({}, 0, 0, { stopPropagation() {} });
  s.enterGhostEdit();
  const ghost = id => s.ghostObjs[LAYOUT_DEFS.findIndex(d => d[0] === id)];
  ok(s.ghostObjs.length === 18 && ghost('cmd_charge').y === 552 && ghost('orders').y === 665,
    'Simple ghosts: all 18 stand, the fan\'s ghosts OPEN above the bar at group positions');
  const gids = s._ghostEd.items.map(i => i.id);
  ok(gids.includes('orders') && !gids.includes('cmd_charge'), 'ghost editor: ORDERS is the fan\'s one draggable anchor');
  ok(s._ghostEd.down({ x: 130, y: 665 }) === true, 'the ghost editor takes ORDERS by its centre');
  s._ghostEd.move({ x: 300, y: 600 });
  ok(ghost('orders').x === 300 && ghost('cmd_charge').x === 300 && ghost('cmd_charge').y === 487, 'the fan ghosts follow ORDERS live');
  s._ghostEd.up();
  const saved = JSON.parse(store.gxhub_wotw_layout).pos;
  ok(saved.orders.x === 300 && saved.cmd_charge.x === 130 && saved.cmd_charge.y === 665, 'the ghost save writes the anchor\'s seat and leaves the members\' seats alone');
  s.exitGhostEdit();
  cleanStore(); }

// ---------- the tutorial teaches the fan ----------
{ cleanStore(); store.gxhub_wotw_layout = '{"pos":{}}'; // even a customized player…
  const g = tutBattle();
  ok(g.face === 'simple', '…the tutorial always teaches the Simple face');
  for (let i = 0; i < 4; i++) g.tutSkip();
  ok(g.tutStep === 4 && g.squads.length === 1, 'the army step: the granted squad stands');
  const sq = g.squads[0];
  g.onTap({ x: sq.x, y: sq.y, worldX: sq.x, worldY: sq.y });
  g.onTap({ x: 560, y: 460, worldX: 560, worldY: 460 });
  ok(g.tutPhase === 1 && /ORDERS/.test(g.tutLine._t), 'posted — the lesson now points at ORDERS');
  const t1 = g.tutTarget();
  ok(t1 && t1.hl === 'screen' && t1.x === 130 && t1.y === 665, 'the ring circles ORDERS');
  press(g.ordersBtn, 0, 0);
  ok(g.fanOpen === true && g.tutPhase === 2 && /RALLY/.test(g.tutLine._t), 'ORDERS opened: the lesson turns to RALLY');
  const t2 = g.tutTarget();
  ok(t2 && t2.x === 718 && t2.y === 552, 'the ring circles RALLY at its fan place');
  press(g.rallyBtn, 0, 0);
  ok(g.rallyMode === true && g.fanOpen === false, 'RALLY arms — the fan closes behind the order');
  g.onTap({ x: 640, y: 420, worldX: 640, worldY: 420 });
  ok(sq.ord === 'rally' && g.tutStep === 5, 'the banner plants — army step complete, the camp step follows');
  cleanStore(); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
