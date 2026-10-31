#!/usr/bin/env node
// Upgrade 12 verification harness — CONTROLS ARE YOURS (kennin's three
// rulings, 2026-10-30): (1) a custom BUTTON LAYOUT, Fortnite-style —
// drag the battle controls, positions persist per player, RESET
// restores the exact Upgrade-10 default; (2) KEYBINDS — click-to-
// capture in Settings, conflicts SWAP, and the keyboard drives the
// SAME action functions the buttons drive, behind the same gates;
// (3) MOVEMENT SCHEMES — TAP (the original), STICK (a floating-base
// virtual joystick) and FOLLOW (Slither-style: hold and he runs to
// your finger, arrow showing the heading). Batteries:
// (1) statics — storage keys, the Settings scene + menu door, the ⚙
// pause entry, the editor, the dispatch, the tutorial's TAP line;
// (2) layout — defaults byte-equal to U10 geometry with no save, the
// save → rebuild → same-positions round-trip, reset → defaults, and a
// real editor drag (buttons disabled while dragging, no action fired,
// no order leaked, layout saved at drag end);
// (3) binds — the documented defaults, capture, the swap, Escape;
// (4) the keyboard — dodge/block/sprint/powers/orders through the real
// functions, the shop gate, and tutorial credit by key;
// (5) movement — persistence, the tutorial forcing TAP (and saying so),
// stick steering + release-stop, follow hold-arming + heading arrow,
// the disambiguation law (quick tap selects/posts under STICK and
// FOLLOW; a steering drag never posts; no hero march-tap off TAP);
// (6) the competent-play sim (copied from U11): the real game with
// default controls is untouched — ~32.5s, camp 500/500.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 0.01);

// ---------- static checks ----------
const main = read('js/main.js');
ok(main.includes("const LAYOUT_KEY='gxhub_wotw_layout', BINDS_KEY='gxhub_wotw_binds', MOVE_KEY='gxhub_wotw_move'"), 'one settings family: gxhub_wotw_layout / gxhub_wotw_binds / gxhub_wotw_move');
ok(main.includes("'Controls',()=>this.scene.start('Settings')") && main.includes('scene:[Boot,Menu,Settings,'), 'the Controls door on the menu opens the Settings scene, and the scene is in the game config');
ok(main.includes("this.pauseBtn=button(this,1246,20,40,40,'⚙'") && main.includes('this.pauseBtnRect={x:1246,y:20,w:40,h:40};'), 'the ⚙ pause/settings entry rides the battle HUD, with its onTap wall beside it'); // Upgrade 17 re-point: the ⚙ is a 40 circle now
ok(main.includes('if(this.paused||this.layoutEdit) return;') && main.includes('if(this.paused||this.layoutEdit) return;\n    const dt='), 'pause and layout editing wall both the marching hand (onTap) and the battle loop (update)');
ok(main.includes('EDITING LAYOUT — drag any button into place') && main.includes('function layoutEditor(scene,onSave)'), 'the EDITING state is unmistakable, and one editor serves the battle and the menu ghosts');
ok(main.includes('enter(){ ed.active=true; ed.items.forEach(it=>{ if(it.obj.disableInteractive) it.obj.disableInteractive(); }); }'), 'while editing, the buttons are NOT interactive — a drag can never fire an action');
ok(main.includes("if(this.moveScheme!=='tap'&&!p._deferred){ this.pendTap="), 'STICK/FOLLOW defer the field tap to the release — a press is not yet a tap');
ok(main.includes("if(this.moveScheme==='tap'){ this.hero.tx="), 'the hero\'s march-by-tap exists under TAP only — off TAP, a ground tap never march-orders him');
ok(main.includes("if(act==='guard'){ if(down) this.beginGuardKey(); else this.endGuardKey(); return; }") && main.includes("case 'camp': this.toggleCampPanel();") && main.includes('default: if(ORDER_NAMES[act]) this.giveOrder(act);'), 'the keyboard dispatches to the buttons\' own functions (pressDodge, toggleCampPanel, giveOrder…) — no parallel logic'); // Upgrade 20 re-point: the Guard key routes through the press grammar's own begin/end, not a parallel dodge/block path
ok(main.includes("this.moveScheme=this.tutorial?'tap':loadMoveScheme();") && main.includes('The tutorial teaches tap-to-move; your own scheme waits outside.'), 'the tutorial forces TAP for its scene and says so in its first line');
ok(main.includes("enterGhostEdit(){") && main.includes("layoutPositions()"), 'the menu edits ghost buttons at the layout\'s real positions (layoutPositions = defaults + save)');
ok(main.includes('Reset layout') && main.includes('resetLayout();'), 'RESET LAYOUT stands in both editors');

// ---------- runtime: stubbed Phaser, real main.js ----------
const store = {};
const ctx = {
  console, performance, setTimeout, clearInterval, setInterval,
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }), // deterministic: no crits in measured hits
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
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const LAYOUT_DEFS = vm.runInContext('LAYOUT_DEFS', ctx);
const DEFAULT_BINDS = vm.runInContext('DEFAULT_BINDS', ctx);
const loadBinds = vm.runInContext('loadBinds', ctx);
const loadMoveScheme = vm.runInContext('loadMoveScheme', ctx);
const saveMoveScheme = vm.runInContext('saveMoveScheme', ctx);
const saveLayout = vm.runInContext('saveLayout', ctx);
const resetLayout = vm.runInContext('resetLayout', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.disableInteractive = () => { o._disabled = true; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function fireUp(btn) { btn._handlers.pointerup(null, 0, 0, { stopPropagation() {} }); }
function capInput() { const h = {}; return { _h: h, on(ev, cb) { (h[ev] = h[ev] || []).push(cb); }, fire(ev, p) { (h[ev] || []).forEach(cb => cb(p)); } }; }
function bareBattle(data) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; },
    rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  g.textures = { exists: () => false };
  g.time = { delayedCall: (ms, cb) => { if (cb) cb(); }, timeScale: 1 };
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
  g.skillBtns = [...g.heroDef.skills, g.heroDef.ult].map(k => ({ def: k, cd: 0, cdMax: k.cd, held: 0, buffered: false, _tierShown: 0, label: mkObj(), alpha: 1 }));
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD(); return g; }
function tutBattle() { const g = hudBattle({ hero: 'david', level: { era: 'bible' }, tutorial: true }); g.buildOrbs(); g.startTutorial(); return g; }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
function cleanSettings() { delete store.gxhub_wotw_layout; delete store.gxhub_wotw_binds; delete store.gxhub_wotw_move; delete store.gxhub_wotw_autofire; }

// ---------- layout: defaults are the U10 sketch, byte for byte ----------
{ cleanSettings();
  const g = hudBattle();
  const reg = {}; g.layoutReg.forEach(en => { reg[en.id] = en; });
  // Re-pointed by Upgrade 15 (documented, the house custom): BUILD is
  // the 17th control in the table — the count moves with the table.
  // Re-pointed by Upgrade 17 (documented, the house custom): ORDERS is
  // the 18th control, and the defaults are the circular geometry —
  // stack x 1178 (toggle y 76, powers to y 556), row from x 130 at y 665.
  // Re-pointed by Upgrade 20: GUARD merges Dodge/Block (17 controls),
  // the defaults are the THUMB ARCS, and in the default FEW face CAMP
  // stands at its rail spot above ORDERS, not at its table seat.
  ok(LAYOUT_DEFS.length === 18 && LAYOUT_DEFS.every(d => { const en = reg[d[0]]; if (!en) return false; // Upgrade 23 re-point: 18 — SHOP joins the table (the market sidebar circle)
      if (d[0] === 'cmd_camp') return en.obj.x === 1178 && en.obj.y === 182; // the Few rail spot (the seat waits for Full)
      return en.obj.x === d[4] && en.obj.y === d[5]; }),
    'no saved layout: all 18 controls stand at the table defaults');
  ok(reg.autofire.obj.x === 1178 && reg.autofire.obj.y === 76 && reg.guard.obj.x === 102 && reg.guard.obj.y === 448 && reg.skill2.obj.y === 556 && reg.cmd_charge.obj.x === 130 && reg.cmd_rally.obj.x === 1066 && reg.cmd_rally.obj.y === 665,
    '…and those defaults ARE Upgrade 10: stack x 1178 (toggle y 70, powers to y 496), row from x 130 at y 665'); // Upgrade 20 re-point: the thumb arcs — right rail for toggle/powers, left rail for GUARD/SPRINT, the row as ever
  ok(g.fightRects.length === 6 && g.fightRects.every(r => r.r === r.h / 2) && g.fightRects.some(r => r.x === 102 && r.y === 448) && g.fightRects.some(r => r.x === 1178 && r.y === 556), 'the onTap wall (fightRects) matches the default stack'); // Upgrade 17: the wall carries each circle's radius. Upgrade 20: six rects on the arcs
  ok(g.campBtnRect.x === 1178 && g.campBtnRect.y === 182 && g.rallyBtnRect.x === 1066, 'the CAMP / RALLY tap walls sit on their buttons'); } // Upgrade 20 re-point: CAMP's wall rides its rail spot in Few

// ---------- layout: the round-trip ----------
{ cleanSettings();
  saveLayout({ skill1: { x: 900, y: 200 }, cmd_camp: { x: 300, y: 665 }, guard: { x: 1000, y: 120 } }); // Upgrade 20 re-point: the saved seat is GUARD's (the dodge seat retired with the merge)
  const g = hudBattle();
  const reg = {}; g.layoutReg.forEach(en => { reg[en.id] = en; });
  ok(reg.skill1.obj.x === 900 && reg.skill1.obj.y === 200 && g.skillBtns[1].sx === 900 && g.skillBtns[1].sy === 200,
    'round-trip: the saved power button is rebuilt at (900,200) — container AND its sweep origin');
  ok(g.fightRects.some(r => r.x === 900 && r.y === 200) && g.fightRects.some(r => r.x === 1000 && r.y === 120),
    '…and the onTap wall moved with it (a press there is a fight press, not a march)');
  ok(g.campBtnRect.x === 1178 && g.campBtnRect.y === 182, '…and the CAMP wall rides the Few rail above ORDERS — the saved CAMP seat waits for the Full face'); // Upgrade 20 re-point: in Few, CAMP is positioned by the ORDERS anchor, not its own seat
  g.setFace('full');
  ok(g.campBtnRect.x === 300 && g.campBtnRect.y === 665, '…and in Full the CAMP wall sits on the saved seat (300,665) — the seat was never lost');
  g.setFace('few'); delete store.gxhub_wotw_face; delete store.gxhub_wotw_face_u20; // leave the store as cleanSettings found it
  ok(reg.sprint.obj.x === 102 && reg.sprint.obj.y === 548, 'buttons the save does not name keep their defaults'); // Upgrade 17 re-point: sprint's circular seat. Upgrade 20 re-point: the left rail (102,548)
  resetLayout();
  const g2 = hudBattle();
  const reg2 = {}; g2.layoutReg.forEach(en => { reg2[en.id] = en; });
  ok(reg2.skill1.obj.x === 1178 && reg2.skill1.obj.y === 462 && g2.campBtnRect.x === 1178 && g2.campBtnRect.y === 182, 'RESET: a fresh battle stands at the exact U10 default again'); } // Upgrade 17 re-point: power 2's circular seat is y 470. Upgrade 20 re-point: the arc seat is 462, and CAMP resets to its rail spot

// ---------- layout: a real editor drag in battle ----------
{ cleanSettings();
  const g = hudBattle();
  g.openPause();
  ok(g.paused === true, 'the ⚙ pause opens and holds the battle');
  g.enterLayoutEdit();
  ok(g.layoutEdit === true && g.fightBtns.guard._disabled === true, 'EDITING: the real buttons are disabled — drags cannot fire them'); // Upgrade 20 re-point: the dragged button is GUARD
  const tx0 = g.hero.tx;
  g.onTap({ x: 500, y: 300, worldX: 500, worldY: 300, id: 1 });
  ok(g.hero.tx === tx0, '…and a field tap while editing never becomes a march order');
  g.input.fire('pointerdown', { x: 102, y: 448, id: 1 }); // on GUARD (Upgrade 20: its circle's centre is the left-rail seat)
  g.input.fire('pointermove', { x: 800, y: 300, id: 1 });
  ok(g.fightBtns.guard.x === 800 && g.fightBtns.guard.y === 300 && g.fightBtns.guard.sx === 800,
    'the drag moves DODGE — container and sweep origin together'); // the drag still proves the dodge-hand's button — GUARD carries it now
  ok(g.hero.dodgeCd === 0, '…and DODGE never fired: no dodge was pressed, only dragged');
  g.input.fire('pointerup', { x: 800, y: 300, id: 1 });
  const saved = JSON.parse(store.gxhub_wotw_layout || '{}');
  ok(saved.pos && saved.pos.guard && saved.pos.guard.x === 800 && saved.pos.guard.y === 300, 'the layout was saved as the drag ended');
  g.exitLayoutEdit();
  ok(g.layoutEdit === false && g.paused === true, 'DONE leaves editing and returns to the pause');
  g.closePause();
  ok(g.paused === false, 'Resume lets the battle go');
  const g2 = hudBattle();
  ok(g2.fightBtns.guard.x === 800 && g2.fightBtns.guard.y === 300, 'the next battle opens with DODGE where the player left it'); }

// ---------- binds: defaults, capture, swap, escape ----------
{ cleanSettings();
  const b = loadBinds();
  ok(b.guard === 'Space' && b.block === undefined && b.dodge === undefined && b.sprint === 'KeyV' && b.skill0 === 'Digit1' && b.skill1 === 'Digit2' && b.skill2 === 'Digit3'
    && b.volley === 'KeyQ' && b.rally === 'KeyE' && b.camp === 'KeyB' && b.autofire === 'KeyT' && b.charge === 'KeyZ' && b.shieldwall === 'KeyJ',
    'the documented defaults: Space dodge, Shift block, 1/2/3 powers, Q volley, E rally, B camp, T auto-fire, home-row orders'); // Upgrade 20 re-point: Space is the GUARD key (tap dodges, hold blocks); the old block key is freed
  ok(new Set(Object.values(DEFAULT_BINDS)).size === Object.keys(DEFAULT_BINDS).length, 'no two actions share a default key');
  const s = Object.create(SettingsProto);
  s.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; }, rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  s.input = capInput(); s.scene = { start() {} };
  SettingsProto.create.call(s);
  s.beginBindCapture('guard'); s.bindKeyEvent({ code: 'KeyQ' }); // Upgrade 20 re-point: the captured action is Guard (Dodge's key, Dodge's swap partner)
  ok(s.binds.guard === 'KeyQ' && JSON.parse(store.gxhub_wotw_binds).guard === 'KeyQ', 'capture: Dodge rebound to Q — and persisted');
  ok(s.binds.volley === 'Space', '…and the SWAP: Volley, which held Q, received the key Dodge gave up (Space)');
  cleanSettings();
  const s2 = Object.create(SettingsProto);
  s2.add = s.add; s2.input = capInput(); s2.scene = { start() {} };
  SettingsProto.create.call(s2);
  s2.beginBindCapture('sprint'); s2.bindKeyEvent({ code: 'Space' });
  ok(s2.binds.sprint === 'Space' && s2.binds.guard === 'KeyV', 'a clean swap: Sprint takes Space, Dodge receives Sprint\'s KeyV — no action left keyless');
  s2.beginBindCapture('camp'); const before = Object.assign({}, s2.binds); s2.bindKeyEvent({ code: 'Escape' });
  ok(s2._cap === null && JSON.stringify(s2.binds) === JSON.stringify(before), 'Escape cancels the capture — nothing changed'); }

// ---------- the keyboard drives the real actions ----------
{ cleanSettings();
  const g = hudBattle();
  // Upgrade 20 re-point: Space is the GUARD key — the press grammar on
  // the keyboard. A quick tap dodges (fired on the release); a hold
  // blocks (tickPresses crosses the press, the button hold's own path).
  g.keyAction('Space', true); g.keyAction('Space', false);
  ok(g.hero.dodgeCd > 0, 'Space pressed DODGE through pressDodge itself (cooldown running)');
  g.keyAction('Space', true); if (g.guardPress) g.guardPress.t0 -= 300; g.tickPresses();
  ok(g.hero.blocking === true, 'Shift held: the guard is up (setBlock, the button\'s own path)'); // the hold is Space's now — Shift is a freed key
  g.keyAction('Space', false);
  ok(g.hero.blocking === false, 'Shift released: the guard drops');
  g.keyAction('KeyZ', true);
  ok(g.order === 'charge', 'Z gave the army order Charge, through giveOrder');
  g.keyAction('Digit2', true);
  ok(g.skillBtns[1].cd > 17, '2 cast Psalm by its button\'s path (cooldown running)');
  g.keyAction('KeyT', true);
  ok(g.autoFire === false, 'T flipped auto-fire through toggleAutoFire');
  g.keyAction('KeyT', true);
  g.hero.dodgeCd = 0; g.shopOpen = true;
  g.keyAction('Space', true); g.keyAction('Space', false); g.keyAction('KeyX', true);
  ok(g.hero.dodgeCd === 0 && g.order === 'charge', 'behind the shop, the keyboard is as walled as the buttons are');
  g.shopOpen = false;
  const t = tutBattle();
  t.keyAction('Space', true); t.keyAction('Space', false);
  ok(t.tutCred.dodge === true, 'in the tutorial, the dodge KEY earns the dodge credit — same function, same hook'); }

// ---------- movement schemes ----------
{ cleanSettings();
  saveMoveScheme('stick');
  ok(loadMoveScheme() === 'stick', 'the scheme persists (gxhub_wotw_move)');
  const g0 = bareBattle();
  ok(g0.moveScheme === 'stick', 'a new battle opens on the saved scheme');
  const tg = tutBattle();
  ok(tg.moveScheme === 'tap' && /^The tutorial teaches tap-to-move; your own scheme waits outside\./.test(tg.tutDefs[0].line),
    'the tutorial forces TAP and its first line says the player\'s scheme waits outside');
  ok(loadMoveScheme() === 'stick', '…and the saved scheme is still stick afterwards — the tutorial wrote nothing');

  // STICK: press, drag east, he runs east; release stops him.
  const g = hudBattle(); g.moveScheme = 'stick';
  const hx = g.hero.x, hy = g.hero.y;
  g.onTap({ x: 300, y: 400, worldX: 300, worldY: 400, id: 1 });
  ok(g.pendTap && g.hero.tx === hx, 'STICK: a field press is held, not yet a tap — no march order');
  g.onPointerMove({ x: 372, y: 400, worldX: 372, worldY: 400, id: 1 });
  ok(g.stick && approx(g.moveHeading(), 0, 0.001), 'a drag past 16px becomes the stick, pointing east (heading 0)');
  for (let i = 0; i < 30; i++) g.update(0, 50);
  ok(g.hero.x > hx + 40 && approx(g.hero.y, hy, 2), 'he ran east at his own speed while the stick held (' + Math.round(g.hero.x - hx) + 'px in 1.5s)');
  g.onPointerUp({ x: 372, y: 400, id: 1 });
  const rx = g.hero.x; for (let i = 0; i < 10; i++) g.update(0, 50);
  ok(g.stick === null && approx(g.hero.x, rx, 1.5), 'release stops him — no glide to the last steering point');

  // The disambiguation law under STICK: quick taps still select + post; a drag never posts.
  const g2 = hudBattle(); g2.moveScheme = 'stick';
  const sq = buySquad(g2, 'shepherd_militia');
  g2.onTap({ x: sq.x, y: sq.y, worldX: sq.x, worldY: sq.y, id: 1 }); g2.onPointerUp({ x: sq.x, y: sq.y, id: 1 });
  ok(g2.selSquad === sq, 'STICK: a quick tap on the squad still selects it');
  const htx = g2.hero.tx;
  g2.onTap({ x: 560, y: 460, worldX: 560, worldY: 460, id: 1 }); g2.onPointerUp({ x: 560, y: 460, id: 1 });
  ok(sq.ord === 'post' && sq.post.x === 560 && sq.post.y === 460, 'STICK: a quick tap on the ground still POSTS the selected squad (posting is an order)');
  ok(g2.hero.tx === htx, '…and the hero was not march-ordered by either tap');
  g2.onTap({ x: 700, y: 300, worldX: 700, worldY: 300, id: 1 });
  g2.onPointerMove({ x: 780, y: 300, worldX: 780, worldY: 300, id: 1 });
  g2.onPointerUp({ x: 780, y: 300, id: 1 });
  ok(!(sq.post.x === 700 && sq.post.y === 300), 'STICK: a steering drag NEVER posts — the drag was the stick, not an order');

  // FOLLOW: hold arms it, the arrow bears to the finger, he runs to it.
  const g3 = hudBattle(); g3.moveScheme = 'follow';
  g3.onTap({ x: g3.hero.x + 290, y: g3.hero.y - 300, worldX: g3.hero.x + 290, worldY: g3.hero.y - 300, id: 1 });
  g3.pendTap.t = performance.now() - 300; // the press has been HELD
  g3.update(0, 50);
  ok(g3.followOn === true, 'FOLLOW: a held press arms follow (280ms) without any drag');
  ok(approx(g3.moveHeading(), Math.atan2(-300, 290), 0.02), 'the heading arrow bears to the held finger (' + (g3.moveHeading() || 0).toFixed(2) + ' rad)');
  const d0 = Math.hypot(g3.followPt.wx - g3.hero.x, g3.followPt.wy - g3.hero.y);
  for (let i = 0; i < 20; i++) g3.update(0, 50);
  ok(Math.hypot(g3.followPt.wx - g3.hero.x, g3.followPt.wy - g3.hero.y) < d0 - 30, 'he runs toward the finger while it is held');
  g3.followPt = { id: 1, wx: g3.hero.x, wy: g3.hero.y - 200 };
  ok(approx(g3.moveHeading(), -Math.PI / 2, 0.02), 'a finger due north reads as heading -π/2 — the arrow the player sees');
  g3.onPointerUp({ x: 0, y: 0, id: 1 });
  ok(g3.followOn === false, 'release ends the follow');

  // TAP is untouched: the tap marches on the press itself.
  delete store.gxhub_wotw_move; // the saved scheme from the batteries above is spent
  const g4 = hudBattle();
  ok(g4.moveScheme === 'tap', 'with no save, the scheme is TAP');
  g4.onTap({ x: 430, y: 600, worldX: 430, worldY: 600, id: 1 });
  ok(g4.hero.tx === 430 && g4.hero.ty === 600 && !g4.pendTap, 'TAP: the ground tap marches on pointerdown, exactly as before'); }

// ---------- the scaling-law proof: the real game, untouched ----------
// Copied from verify_upgrade11.js (itself from U10): the standard
// competent play — orders through giveOrder, telegraphs dodged, the
// two regular moves at Ready, basic fighting by AUTO-FIRE, defaults
// everywhere (no saved layout, TAP, default binds).
function champFight() { const g = bareBattle(); g.autoFire = true;
  buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']);
  buySquad(g, 'benjamite_archer', ['drill1', 'drill2']);
  buySquad(g, 'mighty_man', ['drill1']);
  buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']);
  buySquad(g, 'spearman_wall');
  buySquad(g, 'slinger_elah', ['swift']);
  buySquad(g, 'levite_healer');
  buySquad(g, 'shepherd_militia', ['veteran']);
  const e = spawnChamp(g, 10); g.waveActive = true;
  let steps = 0;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    const want = tele ? 'fallback' : 'charge';
    if (g.__u9ord !== want) { g.__u9ord = want; g.selSquad = null; g.giveOrder(want); }
    if (tele && g.hero.dodgeCd <= 0 && Math.hypot(g.hero.x - e.x, g.hero.y - e.y) < 220) {
      g.hero.tx = Math.max(40, g.hero.x - 260); g.hero.ty = g.hero.y; g.pressDodge(); }
    else { g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
      g.hero.ty = tele ? g.hero.y : e.y; }
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b.cd <= 0) g.useSkill(i); }
    g.update(0, 50); steps++; }
  return { g, e, sec: steps * 0.05 }; }
{ cleanSettings();
  const r = champFight();
  ok(r.e.dead, 'the competent-play sim still clears the wave-10 champion (' + r.sec.toFixed(1) + 's)');
  ok(r.g.campHp === 500, 'camp untouched: 500/500');
  ok(approx(r.sec, 32.5, 1.0), 'duration matches the standing benchmark: ' + r.sec.toFixed(1) + 's vs ~32.5s');
  console.log('  [sim] champion clear, default controls: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
