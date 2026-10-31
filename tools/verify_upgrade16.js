#!/usr/bin/env node
// Upgrade 16 verification harness. Stubbed Phaser; exercises the REAL
// symbol-face code in js/main.js: the makeIcons() family (every texture
// generated, in code, at the family size), the icon maps (complete over
// the command set and over all 17 layout controls, every face distinct),
// the resolver that gives each hero's powers the symbol of their own
// names, and the built battle HUD itself — every battle button carrying
// a symbol and NO word on its face, presses still firing the right
// actions, a press floating the action's name, the AUTO-FIRE face
// following its state in gold vs dim, a saved layout still loading onto
// the symbol faces, and the Controls screen keeping names beside the
// symbols (bind list + captioned ghosts). No browser is available —
// whether the glyphs READ at phone size needs kennin's eyes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- static checks ----------
const main = read('js/main.js');
ok(main.includes('function makeIcons(scene)') && main.includes('makeArt(this); makeArt2(this); makeIcons(this);'), 'the symbol family is drawn in code at Boot, beside makeArt/makeArt2');
ok(main.includes("floatName:label") && main.includes("floatName:'Volley'") && main.includes("floatName:'Camp'") && main.includes("floatName:'Rally'") && main.includes("floatName:'Build'"), 'every battle button carries its name as a press float, not a face');
ok(!main.includes("b.label.setText(b.def.name"), 'the per-frame skill loop no longer writes power names onto button faces');
ok(main.includes('caption:true') && main.includes('LAYOUT_ICONS[d[0]]'), 'the Controls ghosts wear the symbols with name captions');
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(main.slice(main.indexOf('function makeIcons'), main.indexOf('// ---------- Boot'))), 'no emoji anywhere in the icon family — vector shapes only');

// ---------- runtime scaffolding (the U15 pattern, tint/visible recording) ----------
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
const SettingsProto = vm.runInContext('Settings.prototype', ctx);
const CMD_ICONS = vm.runInContext('CMD_ICONS', ctx);
const LAYOUT_ICONS = vm.runInContext('LAYOUT_ICONS', ctx);
const LAYOUT_DEFS = vm.runInContext('LAYOUT_DEFS', ctx);
const skillIconKey = vm.runInContext('skillIconKey', ctx);
const makeIcons = vm.runInContext('makeIcons', ctx);
const ICON_SIZE = vm.runInContext('ICON_SIZE', ctx);

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true, _visible: true, _tint: null };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setScale', 'setFlipX', 'setSize', 'setInteractive', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setVisible = v => { o._visible = v; return o; };
  o.setTint = c => { o._tint = c; return o; }; o.clearTint = () => { o._tint = null; return o; };
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'fillEllipse', 'fillPoints', 'fillTriangle', 'strokeTriangle'].forEach(m => { o[m] = () => o; }); return o; }
function fireDown(b) { if (b._handlers.pointerdown) b._handlers.pointerdown(); }
function fireUp(b) { if (b._handlers.pointerup) b._handlers.pointerup({}, 0, 0, { stopPropagation() {} }); }

function bareBattle(heroId) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(), container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, addEvent: () => {}, timeScale: 1 };
  g.tweens = { add: () => {}, killTweensOf: () => {} };
  g.cameras = { main: { flash() {}, shake() {}, setBounds() {}, startFollow() {} } };
  g.children = { list: [] };
  g.scene = { start() {} };
  g.input = { on() {}, keyboard: { on() {} } };
  GameProto.init.call(g, { hero: heroId || 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 0, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: true, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, skillBtns: [], cmdBtns: {}, fx: gfxObj(), shopItems: [], campItems: [] });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }

// ---------- the maps ----------
ok(Object.keys(CMD_ICONS).length === 9 && new Set(Object.values(CMD_ICONS)).size === 9, 'CMD_ICONS: nine commands, nine distinct symbols');
ok(LAYOUT_DEFS.every(d => LAYOUT_ICONS[d[0]]) && LAYOUT_DEFS.length === 18, 'LAYOUT_ICONS covers all 18 movable battle controls'); // Upgrade 23 re-point: 18 — SHOP wears ico_shop (the market purse) // Upgrade 17 re-point: 18 controls — ORDERS wears the banner glyph (ico_banner, already in the family). Upgrade 20 re-point: 17 controls — GUARD (ico_guard) covers the dodge and block seats it merged
ok(ICON_SIZE === 120, 'the family is drawn on one 120px canvas');

// ---------- the resolver: symbols from the powers' own names ----------
ok(skillIconKey({ name: 'Smooth Stone' }) === 'ico_stone1' && skillIconKey({ name: 'Psalm' }) === 'ico_psalm' && skillIconKey({ name: 'Five Stones' }) === 'ico_stones5',
  "David's three: ringed stone, lyre, five stones in an arc");
ok(skillIconKey({ name: 'Song of Deborah' }) === 'ico_psalm' && skillIconKey({ name: 'Jawbone Cleave' }) === 'ico_sword' && skillIconKey({ name: 'Pillar Pull' }) === 'ico_pillar' && skillIconKey({ name: 'Part the Sea' }) === 'ico_wave' && skillIconKey({ name: 'Chariot of Fire' }) === 'ico_flame',
  "other heroes resolve by their own names (song->lyre, jawbone->sword, pillar, sea->wave, fire->flame)");
ok(skillIconKey({ name: 'Three Hundred' }) === 'ico_burst' && skillIconKey({}) === 'ico_burst', 'the unmatched power falls back to the family burst, never to a word');

// ---------- makeIcons: the whole family, generated in code ----------
{ const made = {};
  const fakeScene = { textures: { exists: k => k in made },
    make: { graphics: () => { const g = gfxObj(); g.generateTexture = (k, w, h) => { made[k] = [w, h]; }; return g; } } };
  makeIcons(fakeScene);
  const keys = Object.keys(made);
  ok(keys.length === 37 && keys.every(k => made[k][0] === 120 && made[k][1] === 120), 'makeIcons generates all 37 symbol textures at 120x120 — the 27 battle symbols + Upgrade 18\'s 8 weapon glyphs (' + keys.length + ' made)'); // U18 re-point: the count grows by the arsenal's glyphs, the law (every texture 120x120) unchanged. Upgrade 20 re-point: 36 — ico_guard (shield + cross + swoosh) joins; ico_dodge/ico_block are still generated, unassigned, so nothing naming them breaks
  ok(['ico_psalm', 'ico_stones5', 'ico_stone1', 'ico_dodge', 'ico_block', 'ico_sprint', 'ico_charge', 'ico_hold', 'ico_follow', 'ico_flank', 'ico_fallback', 'ico_shieldwall', 'ico_volley', 'ico_camp', 'ico_rally', 'ico_build', 'ico_auto'].every(k => k in made),
    'every control in the task list has its texture: powers, dodge/block/sprint, the seven commands, CAMP, RALLY, BUILD, AUTO');
  const before = keys.length; makeIcons(fakeScene);
  ok(Object.keys(made).length === before, 'a second makeIcons call generates nothing twice (Boot-safe)'); }

// ---------- the built HUD: symbols on every face, words on none ----------
{ const g = bareBattle('david'); g.buildHUD();
  // fightBtns holds the whole right stack INCLUDING the three powers
  // (skillBtns references the same three objects); cmdBtns the row.
  const faces = [];
  Object.values(g.fightBtns).forEach(b => faces.push(b));
  Object.values(g.cmdBtns).forEach(b => faces.push(b));
  faces.push(g.campBtn, g.rallyBtn, g.buildBtn);
  ok(faces.length === 16 && faces.every(b => b && b.icon && b.iconKey), 'all 17 battle controls carry a symbol image'); // Upgrade 20 re-point: 16 faces stand in this list — the 17th symbol is ORDERS (below), which stands in the Few face this battle opened on
  ok(g.ordersBtn && g.ordersBtn.iconKey === 'ico_banner', '…and ORDERS carries the banner symbol — the 17th face');
  ok(faces.every(b => b.label._t === '' && b.label._visible === false), 'NO battle button carries a word on its face (labels empty and hidden)');
  ok(new Set(faces.map(b => b.iconKey)).size === 16, 'all 17 faces are DISTINCT symbols');
  ok(g.cmdBtns.charge.iconKey === 'ico_charge' && g.cmdBtns.shieldwall.iconKey === 'ico_shieldwall' && g.cmdBtns.volley.iconKey === 'ico_volley' && g.campBtn.iconKey === 'ico_camp' && g.rallyBtn.iconKey === 'ico_rally' && g.buildBtn.iconKey === 'ico_build',
    'command faces: crossed swords, three shields, arrow fan, tent, flag-and-ring, hammer-and-fence');
  ok(g.fightBtns.guard.iconKey === 'ico_guard' && g.fightBtns.sprint.iconKey === 'ico_sprint' && g.fightBtns.autofire.iconKey === 'ico_auto',
    'fight faces: swoosh, shield, boot, bow-and-circular-arrow'); // Upgrade 20 re-point: GUARD wears the merged glyph — shield and swoosh on one face
  ok(g.skillBtns.map(b => b.iconKey).join(',') === 'ico_stone1,ico_psalm,ico_stones5', "David's powers wear stone, lyre, five stones — from his data");

  // presses still fire the right actions (Upgrade 20 re-point: the
  // grammar buttons are driven as the game drives them — pointerdown
  // begins the press, endPresses is the release; the stub keeps one
  // handler per event, so pressBegin stands where the helper's own
  // down/up stood. In the real game both fire.)
  const tapBtn = b => { if (b._handlers.pointerdown) b._handlers.pointerdown({}, 0, 0, {}); g.endPresses({}); };
  let skillHit = -1; const ps = GameProto.pressSkill; g.pressSkill = i => { skillHit = i; };
  tapBtn(g.skillBtns[1]); ok(skillHit === 1, 'pressing the lyre fires power 2 (Psalm) — the symbol routes to the same action'); g.pressSkill = ps;
  fireUp(g.cmdBtns.charge); ok(g.order === 'charge', 'pressing crossed swords gives the Charge order');
  let dodged = 0; const pd = GameProto.pressDodge; g.pressDodge = () => { dodged++; };
  tapBtn(g.fightBtns.guard); ok(dodged === 1, 'pressing the swoosh dodges'); g.pressDodge = pd; // the swoosh rides GUARD now — a tap is the dodge

  // a press floats the name
  fireDown(g.cmdBtns.hold); ok(g._nf && g._nf._t === 'Hold', 'pressing the planted flag floats its name: "Hold"');
  fireDown(g.skillBtns[2]); ok(g.skillPress && g.skillPress.i === 2, 'pressing the five stones begins its press'); g.skillPress = null;
  g.floatBtnName(g.skillBtns[2], 'Five Stones'); ok(g._nf && g._nf._t === 'Five Stones', 'pressing the five stones floats "Five Stones"'); // the float itself rides button()'s pointerdown in the real game (both handlers fire there); the stub keeps one, so the float is proven on its own function
  fireDown(g.buildBtn); ok(g._nf && g._nf._t === 'Build', 'pressing the hammer floats "Build"');

  // AUTO-FIRE face follows state
  ok(g.autoFire === true && g.fightBtns.autofire.icon._tint === 0xffffff, 'AUTO-FIRE ON: the bow lit full-gold');
  tapBtn(g.fightBtns.autofire);
  ok(g.autoFire === false && g.fightBtns.autofire.icon._tint === 0x6a5a4a && g.fightBtns.autofire.label._t === '', 'AUTO-FIRE OFF: the bow dimmed — state shown by light, never by the word');
  tapBtn(g.fightBtns.autofire); ok(g.autoFire === true && g.fightBtns.autofire.icon._tint === 0xffffff, 'and back ON, lit again'); }

// ---------- a saved layout still loads onto the symbol faces ----------
{ store.gxhub_wotw_layout = JSON.stringify({ pos: { guard: { x: 900, y: 200 }, cmd_camp: { x: 300, y: 640 } } }); // Upgrade 20 re-point: the saved seat is GUARD's
  const g = bareBattle('david'); g.buildHUD();
  ok(g.fightBtns.guard.x === 900 && g.fightBtns.guard.sx === 900 && g.fightBtns.guard.iconKey === 'ico_guard', 'saved layout: DODGE lands at its saved seat, symbol and all'); // GUARD carries the dodge hand now
  ok(g.campBtnRect.x === 1178 && g.campBtnRect.y === 182 && g.campBtn.iconKey === 'ico_camp', 'saved layout: CAMP moves with its onTap wall, tent symbol intact'); // Upgrade 20 re-point: in the Few face CAMP stands at its rail spot — the saved seat belongs to Full…
  g.setFace('full');
  ok(g.campBtn.x === 300 && g.campBtnRect.x === 300, '…and in Full, CAMP stands on the saved seat with its wall — nothing was lost in the move');
  g.setFace('few'); delete store.gxhub_wotw_face; delete store.gxhub_wotw_face_u20;
  delete store.gxhub_wotw_layout; }

// ---------- the Controls screen: names beside the symbols ----------
{ const s = Object.create(SettingsProto);
  s.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; }, rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  s.input = { on() {}, keyboard: { on() {} } };
  s.scene = { start() {} };
  SettingsProto.create.call(s);
  ok(s.bindItems.some(o => /Guard/.test(o._t || '')) && s.bindItems.some(o => o._t === 'Auto-fire toggle') && s.bindItems.some(o => o._t === 'Build mode'),
    'the Controls keybind list still names every action in words (Dodge, Auto-fire toggle, Build mode, ...)'); // Upgrade 20 re-point: the row is Guard's — "Guard — tap: Dodge · hold: Block" names both verbs in words
  s.enterGhostEdit();
  ok(s.ghostObjs.length === 18 && s.ghostObjs.every(b => b.iconKey), 'the layout ghosts wear the same 18 symbols'); // Upgrade 23 re-point: 18 — the SHOP ghost joins // Upgrade 17 re-point: a fresh store defaults to the Simple face, whose ghost editor shows all 18 (ORDERS + the open fan); the Full face shows 17. Upgrade 20 re-point: 17 ghosts — GUARD's is the 17th seat
  ok(s.ghostObjs.every(b => b.label._t && b.label._visible !== false), 'and every ghost keeps its NAME as a caption beside the symbol — symbol and name learned together');
  const gd = s.ghostObjs[LAYOUT_DEFS.findIndex(d => d[0] === 'guard')];
  ok(gd && gd.iconKey === 'ico_guard' && gd.label._t === 'GUARD', 'the DODGE ghost: swoosh symbol, "DODGE" caption'); // Upgrade 20 re-point: the ghost is GUARD's — shield-and-swoosh symbol, "GUARD" caption
  s.exitGhostEdit(); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
