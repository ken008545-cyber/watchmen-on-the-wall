#!/usr/bin/env node
// Upgrade 23 verification harness — THE BUTTONS ANSWER (kennin's
// commission, live call 2026-10-31 ~12:21 CDT, from his own play on
// his Samsung: "You need to fix the attack buttons in the game. None
// of them work. There's no build button. You actually need to build
// the build mechanic inside of the game so like when you press it
// you can place it, or if you don't have enough resources it tells
// you. Also when a wave ends I don't want a menu to pop up. But I
// want there to be a menu where you can buy soldiers." Amendments on
// the same call: at wave end the player must still be able to walk
// around; the menu opens from a sidebar the player taps; and the
// placement law — no battle button on the very bottom, very left or
// very right of the screen.)
//
// THE DIAGNOSIS this suite exists to prove, from the vendored engine
// (vendor/phaser.min.js, read line by line): the engine delivers a
// container press in LOCAL coordinates — InputPlugin.hitTest ->
// pointWithinHitArea hands handlers localX = inverseTransform(pointer)
// + displayOrigin, and a Container's displayOriginX is 0.5 * width
// (the getter in the source). A CENTRE tap on a 76px power circle
// therefore arrives as lx=ly=38, and the old gates — button()'s inCirc
// and wirePress's pointerdown gate, both Math.hypot(lx,ly) <= radius —
// read hypot(38,38)=53.7 > 38 and REFUSED: no press record opened, no
// release could resolve, the button was dead. Only a quarter-disc
// near each circle's top-left corner ever passed the gate. Rectangle
// buttons (menus, shop, fullscreen) carry no radius gate and worked —
// exactly kennin's field report. Every legacy stub fed handlers
// CENTRED coords (the assumed frame), so 1,229 checks proved a law
// the engine never spoke.
//
// THE ENGINE MODEL below is the heart of this suite: it delivers
// presses the way the vendored engine does — local coords computed
// from the pointer's game position plus half the button's size, the
// object's own handlers first (registration order: the helper's, then
// the grammar's), and the SCENE pointerup SUPPRESSED whenever a
// release lands over any helper button (its pointerup always calls
// stopPropagation, and processUpEvents then never emits the scene
// POINTER_UP — the camp-falls suppression). Releases over the field
// reach the scene handlers create() registered (copied verbatim
// below; buildHUD's own pointerup registration arrives with the real
// buildHUD). A thumb is modelled honestly: centre taps, 15ms fast
// taps, holds past 280ms with a drag, releases drifted a breath past
// the rim, releases drifted onto a NEIGHBOURING button, releases
// drifted out to the field, and corner taps outside the circle.
//
// Batteries:
// (1) statics — the frame law in both gates, the placement law on
//     every seat, BUILD out of the fan and standing first-class, the
//     SHOP sidebar control + bind, waveClear -> enterIntermission
//     (openShop nowhere near a wave end), the field-market branch in
//     closeShop/update, the chest entry and the Rack page in the menu;
// (2) THE ENGINE BATTERY — every power/guard/sprint/camp/orders/shop/
//     build control fires under the model above, in BOTH faces;
// (3) BUILD — the first-class button, the shortage spoken in plain
//     words with no charge and no placement, the gather loop, the
//     placement debit exact, and a placed fence standing in a real
//     enemy's road under real update() ticks;
// (4) WAVE END — nothing opens: no shop state, no reveal, banked
//     chests untouched, the mend rides the wave's end, the hero walks
//     the intermission, the deadline still starts the next wave;
// (5) THE MENU — opens only by the player's tap (SHOP sidebar tab,
//     CAMP panel's Market button, the intermission bar), keeps the standing
//     deadline between waves, fights on behind itself mid-wave, sells
//     at the standing prices, closes without starting a wave; chests
//     open only from inside it, between waves; the season's chest
//     buys through the same spend; the Rack page equips a found
//     weapon. The starter benchmark (Common-sling champion ~32.8s,
//     camp 500/500) stands in U18's suite, green beside this one.
//
// AMENDMENTS (kennin, same call, minutes later, ~12:22 CDT — recorded
// in BUILD-NOTES with his words): (A) wave end leaves the field fully
// alive — walk, gather, build through the whole intermission
// (battery 4b: the audit found update()'s intermission branch falls
// through into the full simulation; the checks now hold it);
// (B) the menu and the build palette hang on a SIDEBAR — slim tabs
// down the left side, inset, not circles in the command cluster;
// (C) the PLACEMENT LAW stands: every battle-face control's bounds
// keep at least 24px from every screen edge, on the table and on the
// live positions in both faces (asserted above); the standing U20
// seats were audited and already obey — the law's bite fell on the
// new furniture. Job 1 (battery 2) covers attack buttons AND power
// moves, as he repeated in the amendment turn.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- statics ----------
const main = read('js/main.js');
ok(main.includes("(p&&typeof p.x==='number')?p.x-c.x") && main.includes('Math.hypot(dx,dy)<=circR+(slop||0)'),
  'button(): the press gate measures the POINTER against the button centre (the frame law), with the 12px release grace');
ok(main.includes("(p&&typeof p.x==='number')?p.x-btn.x") && main.includes('if(Math.hypot(dx,dy)>(btn.circleR||32)) return;'),
  'wirePress: the grammar gate speaks the same frame law — a centre press opens a record again');
ok(main.includes('rec.ptr&&rec.ptr.isDown===false') && main.includes("['guardPress','skillPress','ordersPress','campPress','afPress']"),
  'tickPresses sweeps records whose pointer already lifted — an eaten release resolves as itself, never late on a stranger\'s release');
ok(main.includes("const FAN_MEMBERS=['cmd_charge','cmd_hold','cmd_follow','cmd_flank','cmd_fallback','cmd_shieldwall','cmd_volley','cmd_rally']") && !main.includes("'cmd_rally','build']"),
  'BUILD has left the ORDERS fan — the fan is the command rank alone');
ok(main.includes("['build','BUILD',56,120,52,344]") && main.includes("['shop','SHOP',56,120,52,212]") && main.includes('sidebarTab'),
  'the SIDEBAR (Amendment, kennin ~12:22): BUILD and SHOP are slim tabs on the left rail — SHOP (52,212) above BUILD (52,344), 56x120 plates, glyph over word, left edges at the placement law inset of 24px; the command cluster keeps combat controls only');
ok(main.includes("['shop','Shop — the market menu']") && main.includes("shop:'KeyM'") && main.includes("case 'shop': this.toggleShopMenu(); break;"),
  'the market has a key of its own (M), listed with the binds');
ok(main.includes('enterIntermission(first){') && main.includes('this.enterIntermission(false); }') && main.includes('this.enterIntermission(true); }'),
  'wave ends and run starts alike enter the intermission — on the field');
{ const wc = main.slice(main.indexOf('waveClear(){'), main.indexOf('showVictory(){'));
  ok(wc.includes('enterIntermission') && !wc.includes('openShop'), 'waveClear never opens the shop — the popup is gone at the source'); }
{ const os = main.slice(main.indexOf('openShop(first,keepT,mode){'), main.indexOf('shopAdd(o){'));
  ok(!os.includes('openRevealIfAny'), 'openShop no longer ambushes a chest reveal — the reveal waits for the menu\'s chest entry'); }
ok(main.includes("if(this.shopOpen&&this.shopMode!=='field')") && main.includes("if(this.shopMode==='field'){ this.shopOpen=false; this.shopMode=null;"),
  'the field market neither holds the battle (update falls through) nor starts a wave when it closes');
ok(main.includes('menuChestEntry(){') && main.includes('renderRackPage(){') && main.includes("'Chests'+(pendN?' · '+pendN+' waiting':'')"),
  'the menu carries the chest entry (with its waiting count) and the Rack page');
ok(main.includes("'Market — soldiers & gear'") && main.includes('this.closeCampPanel(); this.toggleShopMenu();'),
  'the CAMP panel carries the way into the market');
ok(main.includes("'Not enough '+def.res+' — a '+(id==='fence'?'Fence':'Wall')+' needs '") && main.includes("this.toast('Not enough '+def.res+' — gather more from '"),
  'a short purse speaks in plain words — at the choosing and at the placing both');
ok(main.includes('no menu pops up on its own') && main.includes('open it from the menu between waves'),
  'the loading tip and the chest-bank float teach the new law in the game\'s own voice');

// ---------- runtime scaffolding (the U20/camp-falls pattern, hardened) ----------
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
const LAYOUT_DEFS = vm.runInContext('LAYOUT_DEFS', ctx);
const Rack = vm.runInContext('Rack', ctx);
const SEASON_BY_ID = vm.runInContext('SEASON_BY_ID', ctx);
const GATHER = vm.runInContext('GATHER', ctx);
const W = 1280, H = 720;

// mkObj with APPEND handler lists (the vendored engine keeps every
// listener: the helper's handlers and the grammar's coexist on one
// container, and fire in registration order).
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
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: campSprStub(), campBar: null, manna: 340, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj(), shopItems: [], waveHpM: 1, waveDmM: 1 });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD();
  // create()'s own scene registrations, copied verbatim (js/main.js,
  // create()): the battle's scene-level ears. buildHUD's pointerup
  // registration (endPresses) already arrived with the real buildHUD.
  g.input.on('pointerdown', p => g.onTap(p));
  g.input.on('pointermove', p => g.onPointerMove(p));
  g.input.on('pointerup', p => g.onPointerUp(p));
  g.__toasts = []; const ot = GameProto.toast; g.toast = (m, d) => { g.__toasts.push(String(m)); return ot.call(g, m, d); };
  return g; }
function faceGame(face) { cleanStore(); if (face === 'full') { store.gxhub_wotw_face = 'full'; store.gxhub_wotw_face_u20 = '1'; } return hudBattle(); }
function verbs(g) { const V = { dodge: 0, rally: 0, camp: 0, skills: [] };
  const oD = GameProto.pressDodge; g.pressDodge = (...a) => { V.dodge++; return oD.apply(g, a); };
  const oR = GameProto.pressRally; g.pressRally = (...a) => { V.rally++; return oR.apply(g, a); };
  const oU = GameProto.useSkill; g.useSkill = (a, b) => { V.skills.push([typeof a === 'number' ? a : g.skillBtns.indexOf(a), b || null]); return oU.call(g, a, b); };
  return V; }
function spawnFoe(g, x, y, hp) { const def = vm.runInContext('UNITS', ctx).bible.enemy.find(e => e.id === 'pebble_golem');
  const e = g.spawn({ def, at: 0, boss: false }); e.hp = e.max = hp; e.x = x; e.y = y;
  if (e.spr && e.spr.setPosition) e.spr.setPosition(x, y); return e; }
function findBtn(items, label) { return (items || []).find(o => o && o.label && o.label._t === label); }
function fireBtn(b) { (b._handlers.pointerup || []).slice().forEach(f => f({ x: b.x, y: b.y }, 0, 0, { stopPropagation() {} })); }

// ---------- THE ENGINE MODEL ----------
// Delivered local coords, as the vendored engine computes them for a
// container: local = (pointer - position) + size/2 (displayOrigin).
function localFor(btn, pt) { return [(pt.x - btn.x) + (btn.width || 0) / 2, (pt.y - btn.y) + (btn.height || 0) / 2]; }
let PTR_ID = 1;
function fireObj(btn, ev, ptr, lx, ly) { (btn._handlers[ev] || []).slice().forEach(f => f(ptr, lx, ly, { stopPropagation() {} })); }
function engineDown(g, btn, pt) { const ptr = { id: PTR_ID++, x: pt.x, y: pt.y, worldX: pt.x, worldY: pt.y, isDown: true };
  if (btn) { const [lx, ly] = localFor(btn, pt); fireObj(btn, 'pointerdown', ptr, lx, ly); }
  g.input.fire('pointerdown', ptr); // a press on a button ALSO reaches the scene's ears (no stopPropagation on the way down)
  return ptr; }
function engineMove(g, ptr, pt) { ptr.x = pt.x; ptr.y = pt.y; ptr.worldX = pt.x; ptr.worldY = pt.y; g.input.fire('pointermove', ptr); }
function engineUp(g, btn, ptr, pt) { if (pt) { ptr.x = pt.x; ptr.y = pt.y; ptr.worldX = pt.x; ptr.worldY = pt.y; } ptr.isDown = false;
  if (btn) { const [lx, ly] = localFor(btn, ptr); fireObj(btn, 'pointerup', ptr, lx, ly); /* the scene pointerup is SUPPRESSED — the helper's stopPropagation (the camp-falls law) */ }
  else g.input.fire('pointerup', ptr); }
function centre(btn) { return { x: btn.x, y: btn.y }; }

// ---------- the placement law, on the table itself ----------
// The law's scope, stated as kennin stated it: the battle-face
// controls — everything in the layout table, sidebar included. (The
// top-corner system chrome — pause, speed, fullscreen — is Menu-row
// furniture that predates the law and is not in the table; it is
// named as out of scope in BUILD-NOTES, not silently swept in.)
{ const bad = LAYOUT_DEFS.filter(d => { const hw = d[2] / 2, hh = d[3] / 2; return d[4] - hw < 24 || d[4] + hw > W - 24 || d[5] - hh < 24 || d[5] + hh > H - 24; });
  ok(bad.length === 0, 'the placement law holds on every seat in the table: no control within 24px of any screen edge (offenders: ' + bad.map(d => d[0]).join(',') + ')'); }
// …and on the LIVE positions, in both faces, after applyFace has had
// its say (rail spots, fan seats and all):
for (const face of ['few', 'full']) { const g = faceGame(face);
  const bad = (g.layoutReg || []).filter(en => { const hw = en.w / 2, hh = en.h / 2, x = en.obj.x, y = en.obj.y; return x - hw < 24 || x + hw > W - 24 || y - hh < 24 || y + hh > H - 24; });
  ok(bad.length === 0, face + ': every standing control\'s live bounds sit inside the 24px margins (offenders: ' + bad.map(e => e.id).join(',') + ')'); }

// ---------- (2) THE ENGINE BATTERY: every control answers a real thumb ----------
for (const face of ['few', 'full']) {
  // centre taps on all three powers — THE headline case: before the
  // fix, the engine delivered lx=ly=38 to a 38-radius gate and the
  // record never opened. The model delivers exactly those coords.
  for (let i = 0; i < 3; i++) {
    const g = faceGame(face); const V = verbs(g);
    spawnFoe(g, g.hero.x + 80, g.hero.y, 500);
    const b = g.skillBtns[i], c = centre(b);
    const ptr = engineDown(g, b, c);
    ok(!!g.skillPress && g.skillPress.i === i, face + ': CENTRE tap on power ' + i + ' opens its press record (the delivered local coords are ' + localFor(b, c).join(',') + ' — the old gate read their length, 53.7, against the radius and refused)');
    CLOCK.perf += 40; engineUp(g, b, ptr, c);
    ok(V.skills.length === 1 && V.skills[0][0] === i && !g.skillPress, face + ': power ' + i + ' CASTS on the centre tap\'s release, exactly once');
  }
  // a fast tap (15ms) is a tap, not a swallowed nothing
  { const g = faceGame(face); const V = verbs(g);
    const b = g.skillBtns[1], c = centre(b);
    const ptr = engineDown(g, b, c); CLOCK.perf += 15; engineUp(g, b, ptr, c);
    ok(V.skills.length === 1 && V.skills[0][0] === 1, face + ': a 15ms fast tap on Psalm still casts — the hold threshold never eats a quick thumb'); }
  // hold -> drag -> release on the field: the aimed cast
  { const g = faceGame(face); const V = verbs(g);
    const foe = spawnFoe(g, g.hero.x + 150, g.hero.y, 500);
    const b = g.skillBtns[0], c = centre(b);
    const ptr = engineDown(g, b, c); CLOCK.perf += 300; g.tickPresses();
    ok(!!g.skillPress && g.skillPress.held === true, face + ': holding a power past 280ms raises the reticle (the record crosses into held)');
    engineMove(g, ptr, { x: foe.x, y: foe.y });
    engineUp(g, null, ptr, { x: foe.x, y: foe.y }); // released over the FIELD — the scene path
    ok(V.skills.length === 1 && V.skills[0][0] === 0 && V.skills[0][1] && Math.hypot(V.skills[0][1].x - foe.x, V.skills[0][1].y - foe.y) < 2 && g.shots.length > 0,
      face + ': the dragged release casts AT the reticle point — the aimed cast survives the full engine path'); }
  // drift a breath past the rim, released over the button: the grace answers
  { const g = faceGame(face); const V = verbs(g);
    const b = g.skillBtns[1], c = centre(b);
    const ptr = engineDown(g, b, c); CLOCK.perf += 40; engineUp(g, b, ptr, { x: c.x + 24, y: c.y });
    ok(V.skills.length === 1, face + ': a release drifted 24px past centre (inside radius+grace) still casts — thumb drift is not a dead button'); }
  // drift out to the field: the scene release resolves the tap
  { const g = faceGame(face); const V = verbs(g);
    const b = g.skillBtns[1], c = centre(b);
    const ptr = engineDown(g, b, c); CLOCK.perf += 40; engineUp(g, null, ptr, { x: 640, y: 300 });
    ok(V.skills.length === 1 && !g.skillPress, face + ': a release drifted OFF the button onto the field still resolves the tap through the scene path'); }
  // drift onto a NEIGHBOUR: its release is eaten by the suppression —
  // the first power resolves as its own tap; the neighbour never casts;
  // and the sweep leaves nothing standing to fire late
  { const g = faceGame(face); const V = verbs(g);
    spawnFoe(g, g.hero.x + 80, g.hero.y, 500);
    const b0 = g.skillBtns[0], b1 = g.skillBtns[1];
    const ptr = engineDown(g, b0, centre(b0)); CLOCK.perf += 40;
    engineUp(g, b1, ptr, centre(b1)); // released over the neighbour — scene pointerup suppressed
    ok(V.skills.length === 1 && V.skills[0][0] === 0, face + ': a release over the NEIGHBOURING power resolves the FIRST power\'s tap (its own button-release path), and the neighbour does NOT cast');
    g.tickPresses(); // the sweep runs every frame: nothing may fire late
    ok(V.skills.length === 1 && !g.skillPress, face + ': after the eaten release the record is gone — the sweep finds nothing to fire late'); }
  // the corner: outside the circle, no press begins (the U17 law stands)
  { const g = faceGame(face); const V = verbs(g);
    const b = g.skillBtns[0], c = centre(b), corner = { x: c.x + 30, y: c.y + 30 };
    const ptr = engineDown(g, b, corner);
    ok(!g.skillPress, face + ': a corner tap (30,30 off centre on a 76 circle — inside its square, outside its radius) opens NO record');
    engineUp(g, b, ptr, corner);
    ok(V.skills.length === 0, face + ': and casts nothing — the circle is still the law'); }
  // GUARD: tap dodges, hold blocks, release drops — through the model
  { const g = faceGame(face); const V = verbs(g);
    const gb = g.fightBtns.guard, c = centre(gb);
    let ptr = engineDown(g, gb, c); CLOCK.perf += 40; engineUp(g, gb, ptr, c);
    ok(V.dodge === 1 && !g.hero.blocking, face + ': GUARD centre tap DODGES through the engine path');
    ptr = engineDown(g, gb, c); CLOCK.perf += 300; g.tickPresses();
    ok(g.hero.blocking === true, face + ': GUARD hold blocks');
    engineUp(g, gb, ptr, c);
    ok(g.hero.blocking === false && V.dodge === 1, face + ': GUARD release drops the block — and no dodge fires off its back'); }
  // SPRINT (a plain helper-callback button): centre fires, the grace
  // fires, beyond the grace does not
  { const g = faceGame(face);
    const sb = g.fightBtns.sprint, c = centre(sb), before = !!g.hero.sprint;
    let ptr = engineDown(g, sb, c); engineUp(g, sb, ptr, c);
    ok(!!g.hero.sprint !== before, face + ': SPRINT centre tap toggles through the engine path');
    const mid = !!g.hero.sprint;
    ptr = engineDown(g, sb, c); engineUp(g, sb, ptr, { x: c.x + 36, y: c.y });
    ok(!!g.hero.sprint !== mid, face + ': SPRINT release drifted 36px (radius 32 + 12 grace) still fires');
    const mid2 = !!g.hero.sprint;
    ptr = engineDown(g, sb, c); engineUp(g, sb, ptr, { x: c.x + 48, y: c.y });
    ok(!!g.hero.sprint === mid2, face + ': SPRINT release drifted 48px — beyond the grace — does not fire (a drifted-off press is a cancelled press, spoken by its silence being the player\'s own)'); }
  // CAMP: the tap opens the panel, in both faces
  { const g = faceGame(face);
    const cb = g.campBtn, c = centre(cb);
    const ptr = engineDown(g, cb, c); CLOCK.perf += 40; engineUp(g, cb, ptr, c);
    ok(g.campPanelOpen === true, face + ': CAMP centre tap opens the camp panel through the engine path'); }
  // SHOP: the sidebar circle opens the market (mid-wave state -> field mode)
  { const g = faceGame(face);
    const sb = g.shopBtn, c = centre(sb);
    let ptr = engineDown(g, sb, c); engineUp(g, sb, ptr, c);
    ok(g.shopOpen === true && g.shopMode === 'field', face + ': SHOP centre tap opens the market from the battle face');
    ptr = engineDown(g, sb, c); engineUp(g, sb, ptr, c);
    ok(g.shopOpen === false && g.shopMode === null, face + ': SHOP tapped again closes it — no wave started, nothing else moved'); }
  // BUILD: visible without the fan, and its tap opens build mode
  { const g = faceGame(face);
    ok(g.buildBtn._visible !== false && g.buildBtnRect.x === 52 && g.buildBtnRect.y === 344 && g.buildBtnRect.w === 56 && g.buildBtnRect.h === 120, face + ': the BUILD tab stands visible on the sidebar with the fan shut — a player meets it without opening anything');
    const bb = g.buildBtn, c = centre(bb);
    const ptr = engineDown(g, bb, c); engineUp(g, bb, ptr, c);
    ok(g.buildMode === true, face + ': BUILD centre tap opens build mode through the engine path'); }
}
// ---------- the SIDEBAR as a sidebar (Amendment B) ----------
{ const g = faceGame('few');
  ok(g.shopBtn.label._t === 'SHOP' && g.buildBtn.label._t === 'BUILD', 'the tabs carry their words on their faces — menu furniture, read at a glance (SHOP above BUILD)');
  ok(g.buildBtnRect.y + g.buildBtnRect.h / 2 < 448 - 32, 'the sidebar pair clears the combat cluster beneath it: BUILD\'s plate ends at y ' + (g.buildBtnRect.y + g.buildBtnRect.h / 2) + ', GUARD\'s circle begins at 416 — no overlap, no shared ground');
  // the plate is a plate along its whole length: a press at its far
  // end (52,399) — far outside any circle the tab could be mistaken
  // for — opens build mode, and the scene tap is walled by the whole
  // rectangle, so the hero does NOT march from a tab press.
  g.hero.tx = g.hero.x; g.hero.ty = g.hero.y;
  const end = { x: 52, y: 399 };
  const ptr = engineDown(g, g.buildBtn, end);
  ok(g.hero.tx === g.hero.x && g.hero.ty === g.hero.y, 'a press on the BUILD tab\'s far end is walled as a button press — no march order leaks under the plate');
  engineUp(g, g.buildBtn, ptr, end);
  ok(g.buildMode === true, 'and the far-end press OPENS build mode — the whole plate answers, not a circle hiding inside it'); }

// ORDERS in the Few face (its grammar is Few-only by U20's law)
{ const g = faceGame('few');
  const ob = g.ordersBtn, c = centre(ob);
  let ptr = engineDown(g, ob, c); CLOCK.perf += 40; engineUp(g, ob, ptr, c);
  ok(g.fanOpen === true, 'few: ORDERS centre tap fans the command rank open through the engine path');
  const g2 = faceGame('few'); const V2 = verbs(g2);
  ptr = engineDown(g2, g2.ordersBtn, centre(g2.ordersBtn)); CLOCK.perf += 300; g2.tickPresses();
  ok(V2.rally === 1 && g2.fanOpen === false, 'few: ORDERS hold rallies at once — the fan never opens');
  engineUp(g2, g2.ordersBtn, ptr, centre(g2.ordersBtn));
  ok(g2.fanOpen === false, 'few: and the held release does not fan it open behind the rally'); }

// ---------- (3) BUILD: the loop, whole ----------
{ cleanStore(); const g = hudBattle(); g.buildNodes();
  g.toggleBuildMode();
  ok(g.buildMode === true && findBtn(g.buildItems, 'Fence · 6 wood') && findBtn(g.buildItems, 'Wall · 6 stone'), 'the build bar stands with both pieces and their costs written on them');
  // the shortage, spoken plainly — at the choosing
  fireBtn(findBtn(g.buildItems, 'Fence · 6 wood'));
  ok(g.buildTool === 'fence' && g.__toasts.some(t => t.includes('Not enough wood — a Fence needs 6 wood, you have 0')), 'choosing a Fence with an empty purse SPEAKS the shortage in plain words (kennin: "if you don\'t have enough resources it tells you")');
  // and at the placing: nothing placed, nothing charged
  let cell = null;
  for (let cx = 256; cx <= 1152 && !cell; cx += 64) for (let cy = 192; cy <= 576 && !cell; cy += 64) if (!g.canPlace(cx, cy)) cell = { x: cx, y: cy };
  ok(!!cell, 'setup: a lawful cell exists on the field');
  const r = g.buildTap(cell.x, cell.y);
  ok(r === 'funds' && g.builds.length === 0 && g.wood === 0 && g.__toasts.some(t => t.includes('Not enough wood')), 'placing with a short purse: refused as \'funds\', NO piece placed, NO wood charged, the reason spoken');
  // gather: stand at a tree, still, and swing
  const tree = g.nodes.find(n => n.kind === 'tree');
  g.hero.x = tree.x; g.hero.y = tree.y; g.hero.tx = tree.x; g.hero.ty = tree.y;
  g.gatherTick(0.1); // the first still-frame primes the channel
  g.gatherTick(GATHER.tick); g.gatherTick(GATHER.tick); g.gatherTick(GATHER.tick);
  ok(g.wood === 6, 'the gather loop pays: three swings at a tree, +2 wood each — the purse holds exactly 6');
  // place: the debit is exact and the piece stands at full strength
  const r2 = g.buildTap(cell.x, cell.y);
  ok(r2 === 'placed' && g.builds.length === 1 && g.wood === 0 && g.builds[0].hp === 120 && g.builds[0].max === 120, 'placing the Fence: placed, purse debited exactly 6, the piece stands at its full 120 HP');
  g.exitBuildMode();
  // the piece FUNCTIONS: a foe marching the camp road meets it and chews
  const g2 = hudBattle(); g2.buildNodes();
  let road = null;
  for (let cx = 320; cx <= 1152 && !road; cx += 64) if (!g2.canPlace(cx, 576)) road = { x: cx, y: 576 };
  g2.wood = 6; g2.toggleBuildMode(); fireBtn(findBtn(g2.buildItems, 'Fence · 6 wood'));
  ok(g2.buildTap(road.x, road.y) === 'placed', 'setup: a fence placed on the camp road');
  g2.exitBuildMode();
  g2.hero.x = 200; g2.hero.y = 150; g2.hero.tx = 200; g2.hero.ty = 150; // the hero stands far off — the foe wants the camp
  const foe = spawnFoe(g2, road.x + 46, road.y, 5000);
  g2.waveActive = true;
  for (let i = 0; i < 160; i++) g2.update(0, 50);
  ok(g2.builds[0].hp < 120, 'the placed fence FUNCTIONS under real update() ticks: the marching foe is held at it and chews (fence HP ' + g2.builds[0].hp + ' of 120)');
  ok(foe.x > road.x, 'and the foe never passed through it — it stands where U15 built it to stand'); }

// ---------- (4) WAVE END: nothing opens ----------
{ cleanStore(); Rack.setPending(['wood']);
  const g = hudBattle();
  ok(g.pendingChests.join() === 'wood', 'setup: a banked chest waits in the Rack from an earlier wave');
  let startCalls = 0; const oSW = GameProto.startWave; g.startWave = (...a) => { startCalls++; return oSW.apply(g, a); };
  g.wave = 3; g.waveActive = true; g.manna = 500;
  g.hero.hp = 10; const sq = g.addSquad(vm.runInContext('UNITS', ctx).bible.player[0], 300, 300); sq.hp = 5;
  g.waveClear();
  ok(g.shopOpen === false && g.shopItems.length === 0 && g.shopMode === null, 'WAVE END: no menu pops up — no shop state, no shop items, nothing rendered over the field');
  ok(g.revealPanel === false && (!g.revealQueue || g.revealQueue.length === 0) && g.pendingChests.join() === 'wood', 'WAVE END: no reveal ambushes either — the banked chest waits untouched for the menu');
  ok(g.interField === true && g.interItems.length > 0 && g.shopEndsAt - CLOCK.now === 60000, 'WAVE END: the intermission stands ON THE FIELD under its bar, the same honest 60s armed');
  ok(g.hero.hp === g.hero.def.hp && sq.hp === sq.max, 'the between-wave mend rides the wave\'s end itself now (hero and squads to full) — it never waited for a menu to open');
  ok(startCalls === 0, 'and no wave started itself in the clearing');
  // the player walks the intermission (kennin's amendment: still able to walk around)
  const hx = g.hero.x;
  engineDown(g, null, { x: hx + 150, y: g.hero.y });
  for (let i = 0; i < 6; i++) g.update(0, 100);
  ok(g.hero.x > hx + 10, 'the intermission never seizes control: a field tap marches the hero, and update() walks him there');
  ok(startCalls === 0 && g.interField === true, 'the clock has not run out — the field is still his');
  CLOCK.now += 60001; g.update(0, 16);
  ok(startCalls === 1 && g.waveActive === true && g.interField === false, 'at the deadline the next wave begins — once, as it always has'); }

// ---------- (4b) AMENDMENT A: the field stays ALIVE all intermission ----------
// Kennin's refinement: removing the popup is not enough — "I want you
// to still be able to walk around when the wave ends." The audit
// (BUILD-NOTES) found no seizure to remove: update()'s intermission
// branch ticks the clock and falls through into the full simulation.
// These checks hold the whole of it: walk (above), GATHER, and BUILD,
// all between waves, all through the real update() loop.
{ cleanStore(); const g = hudBattle(); g.buildNodes();
  g.wave = 2; g.waveActive = true; g.waveClear();
  ok(g.interField === true && !g.campPanelOpen && !g.fanOpen && g.buildMode === false, 'after the clear: the field, the bar, and nothing else — no panel of any kind stands open');
  const tree = g.nodes.find(n => n.kind === 'tree');
  g.hero.x = tree.x; g.hero.y = tree.y; g.hero.tx = tree.x; g.hero.ty = tree.y;
  for (let i = 0; i < 60; i++) g.update(0, 100);
  ok(g.wood >= 6, 'GATHER lives between waves: a full minute of update() ticks at a tree fills the purse (' + g.wood + ' wood) — the intermission branch reaches gatherTick, it does not seize it');
  ok(g.interField === true, 'and the intermission still stands — gathering spent none of its welcome (the clock is wall-time, not frames)');
  const ptr = engineDown(g, g.buildBtn, centre(g.buildBtn)); engineUp(g, g.buildBtn, ptr, centre(g.buildBtn));
  ok(g.buildMode === true, 'BUILD opens between waves, from the sidebar tab, through the engine path');
  fireBtn(findBtn(g.buildItems, 'Fence · 6 wood'));
  let cell = null;
  for (let cx = 256; cx <= 1152 && !cell; cx += 64) for (let cy = 192; cy <= 576 && !cell; cy += 64) if (!g.canPlace(cx, cy)) cell = { x: cx, y: cy };
  const w0 = g.wood;
  ok(g.buildTap(cell.x, cell.y) === 'placed' && g.builds.length === 1 && g.wood === w0 - 6, 'a fence is PLACED between waves at the exact debit — the whole build loop runs inside the intermission');
  g.exitBuildMode(); }

// ---------- (5) THE MENU: his to open, his to close ----------
{ // between waves: the deadline is KEPT, the chest opens from inside
  cleanStore(); Rack.setPending(['wood']);
  const g = hudBattle(); g.enterIntermission(false);
  const armed = g.shopEndsAt;
  g.toggleShopMenu();
  ok(g.shopOpen === true && g.shopMode === 'inter' && g.shopEndsAt === armed && g.menuSeen === true, 'the SHOP tab opens the market between waves — and the standing deadline does not move');
  g.menuChestEntry();
  ok(g.revealPanel === true && g.revealQueue.join() === 'wood', 'the chest entry INSIDE the menu opens the reveal — the only door it has now');
  ok(g.revealOpenChest() === true, 'the chest opens from inside the menu');
  g.revealNext();
  ok(g.revealPanel === false, 'the reveal closes back into the menu when its queue is spent');
  g.leaveShopToField();
  ok(g.shopOpen === false && g.interField === true, 'To the Field returns him to the field intermission he never left');
  // mid-wave: the fight goes on behind it; it sells; it closes clean
  const g3 = hudBattle(); let sw3 = 0; const oSW3 = GameProto.startWave; g3.startWave = (...a) => { sw3++; return oSW3.apply(g3, a); };
  g3.wave = 2; g3.waveActive = true;
  const foe = spawnFoe(g3, 900, 300, 5000); const fx = foe.x;
  g3.toggleShopMenu();
  ok(g3.shopOpen === true && g3.shopMode === 'field', 'mid-wave, the SHOP tab opens the market in field mode');
  for (let i = 0; i < 3; i++) g3.update(0, 100);
  ok(foe.x < fx, 'the fight goes ON behind the field market — the foe kept marching while the menu stood (the camp panel\'s Upgrade 9 rule, scaled)');
  g3.manna = 1000;
  const militia = vm.runInContext('UNITS', ctx).bible.player[0];
  const buyBtn = findBtn(g3.shopItems, 'Buy ' + militia.cost);
  ok(!!buyBtn, 'the market sells squads at the standing prices (Shepherd Militia, Buy ' + militia.cost + ')');
  fireBtn(buyBtn);
  ok(g3.squads.length === 1 && g3.manna === 1000 - militia.cost, 'the purchase lands mid-wave: one squad, exactly ' + militia.cost + ' Manna charged — every economy path untouched');
  g3.pendingChests = ['wood']; g3.menuChestEntry();
  ok(g3.revealPanel === false && g3.__toasts.some(t => t.includes('Chests open between waves')), 'mid-wave the chest entry speaks the U18 law instead of opening: loot never interrupts a battle');
  g3.closeShop();
  ok(g3.shopOpen === false && g3.shopMode === null && g3.wave === 2 && g3.waveActive === true && sw3 === 0, 'closing the field market starts NO wave — the fight simply continues');
  // an empty Rack speaks its nothing
  const g4 = hudBattle(); g4.enterIntermission(false); g4.toggleShopMenu(); g4.menuChestEntry();
  ok(g4.__toasts.some(t => t.includes('No chests waiting')), 'with nothing banked, the chest entry says so plainly');
  // the season's chest, bought inside the menu through the same spend
  TBAL = 100;
  const g5 = hudBattle(); g5.enterIntermission(false); g5.toggleShopMenu();
  const pendBefore = Rack.pending().length;
  g5.buySeasonalFromMenu(SEASON_BY_ID.hallows);
  ok(spends.length === 1 && spends[0][0] === 'chest:hallows' && spends[0][1] === 60 && Rack.pending().length === pendBefore + 1 && g5.pendingChests.includes('hallows'),
    'the Hallows Chest buys inside the menu: 60 Grokonians through Tokens.spend(\'chest:hallows\'), the chest waiting in the Rack');
  // the Rack page equips what the field gave up
  Rack.grant('rifle:2'); g5.shopPage = 3; g5.renderShop(false);
  const eq = findBtn(g5.shopItems, 'Equip');
  ok(!!eq, 'the menu\'s Rack page offers Equip for a found weapon');
  fireBtn(eq);
  ok(g5.weaponKey === 'rifle:2', 'equipping from the menu\'s Rack page puts the rifle in the hero\'s hand — the Armory, reachable without leaving the run');
  // the CAMP panel's Market button walks the same road
  const g6 = hudBattle(); g6.openCampPanel();
  const mb = findBtn(g6.campItems, 'Market — soldiers & gear');
  ok(!!mb, 'the CAMP panel carries its Market button');
  fireBtn(mb);
  ok(g6.campPanelOpen === false && g6.shopOpen === true && g6.shopMode === 'field', 'the Market button closes the camp panel and opens the menu — one overlay at a time'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED (' + total + ')' : '\n' + fails + ' CHECK(S) FAILED of ' + total);
process.exit(fails ? 1 : 0);
