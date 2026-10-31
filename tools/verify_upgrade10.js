#!/usr/bin/env node
// Upgrade 10 verification harness — THE APPROVED BUTTON UI (kennin's
// ruling, voice 2026-10-30, after playtesting Upgrade 8's manual combat:
// "I would much rather have it auto fire. Instead of have a light and
// heavy attack." — then, over two sketches: auto-fire that can be turned
// on and off, big clear buttons, the command row with CAMP in it).
// Stubbed Phaser; exercises the REAL logic in js/main.js:
// (1) auto-fire restored and toggleable — default ON, the choice persists
// in localStorage, OFF means the hero deals ZERO basic-attack damage
// while his power moves still fire by button; (2) the manual path is
// gone — no LIGHT/HEAVY buttons, no pressAttack/lightStrike/heavyStrike;
// (3) the right-thumb stack — AUTO-FIRE toggle, DODGE, BLOCK, SPRINT and
// the hero's power moves as their own named buttons from the data
// (David: PSALM and FIVE STONES among them), every button >= 56px tall;
// (4) the command row — CHARGE, HOLD, FOLLOW, FLANK, FALL BACK, SHIELD
// WALL, VOLLEY, CAMP, all large; (5) Upgrade 9's tap-to-order untouched;
// (6) the scaling-law proof: competent play with auto-fire ON and
// Ready-only power use clears the wave-10 champion comparably to the
// pre-U8/U9 standard (~30s, camp standing). The flattened enemy curve is
// not touched by this upgrade — no spawn/HP/damage constant changes.
//
// Approved additions (kennin, same call, 2026-10-30): RALLY BANNER — a
// ninth seat on the command row; tap Rally, tap the ground, and the
// selected squad (or the whole army, hero selected, by Upgrade 9's
// scoping) moves to the banner and holds it until another order
// supersedes; and the POWER-READY WHISPER — when Psalm or Five Stones
// (the hero's second skill and his ult) finishes cooling, one soft glow
// pulse on the button and one gentle SFX cue, exactly once per
// completion. Batteries for both live below. (A third idea from the
// same call — a shared stamina well — was NOT approved and is not built.)
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
ok(main.includes("const AUTOFIRE_KEY='gxhub_wotw_autofire'") && /v===null\?true:v==='1'/.test(main), 'auto-fire: persistence key gxhub_wotw_autofire, default ON when no choice is saved');
ok(main.includes('saveAutoFire(this.autoFire)') && main.includes('toggleAutoFire(){'), 'auto-fire: the toggle flips the state and saves the choice');
ok(main.includes('this.autoFire=loadAutoFire();'), 'auto-fire: each run opens with the saved choice');
ok(main.includes('heroAutoFire(){') && main.includes('if(!this.autoFire||!h||h.down>0||h.cd>0) return;'), 'auto-fire: one gated path — OFF, downed, or on-clock means no basic attack');
ok(main.includes('if(h.cd>0) h.cd-=dt;') && main.includes('this.heroAutoFire();'), 'auto-fire: the hero clock runs in update() and strikes through heroAutoFire()');
ok(!main.includes('pressAttack') && !main.includes('lightStrike') && !main.includes('heavyStrike') && !main.includes('attackTarget'), 'the manual basic-attack path is REMOVED (pressAttack / lightStrike / heavyStrike / attackTarget)');
ok(!main.includes("mk('light'") && !main.includes("mk('heavy'") && !/lightDmg|heavyDmg|openerMul/.test(main), 'no LIGHT or HEAVY button, and their numbers (incl. the sprint opener) are gone from the FIGHT table');
ok(main.includes("mk('autofire',SX,70,SW,56") && main.includes("'AUTO-FIRE: ON'") && main.includes("'AUTO-FIRE: OFF'"), 'the AUTO-FIRE toggle: top of the right stack, 56px tall, labeled with its state');
ok(main.includes("mk('dodge',SX,176,SW,56,'DODGE'") && main.includes("mk('block',SX,240,SW,56,'BLOCK'") && main.includes("mk('sprint',SX,304,SW,56,'SPRINT'"), 'DODGE / BLOCK / SPRINT ride the stack at 56px with real text labels');
ok(main.includes('SW,56,k.name,()=>this.pressSkill(i)') && main.includes('[...h.skills,h.ult].forEach'), 'power buttons are driven from the hero data (skill/ult names), never hardcoded');
ok(main.includes('dodgeDist:150, dodgeTime:0.22, dodgeIframes:0.30, dodgeCd:1.6') && main.includes('blockDrain:12') && main.includes('sprintDrain:8'), 'the surviving stamina kit keeps its numbers (dodge dash/i-frames/cooldown, block and sprint drains)');
{ const row = main.slice(main.indexOf('buildHUD(){'), main.indexOf('phaseName(){'));
  ok(/110,56,'CAMP'/.test(row) && row.includes("'Charge'") && row.includes("'Hold'") && row.includes("'Follow Me'") && row.includes("'Flank'") && row.includes("'Fall Back'") && row.includes("'Shield Wall'") && row.includes("'Volley'") && row.includes("'Rally'"), 'the command row carries all nine large labeled buttons: Charge, Hold, Follow Me, Flank, Fall Back, Shield Wall, Volley, CAMP, Rally');
  ok((row.match(/,110,56,/g) || []).length === 4 && (row.match(/\['[a-z]+','/g) || []).length === 6, 'every command-row button is 110x56 (one loop over the six orders, plus Volley, CAMP and Rally call sites)'); }
{ const sfx = read('js/sfx.js');
  ok(/ready\(k\)\{/.test(sfx) && main.includes('SFX.ready(b.def.id)'), 'the whisper has its own quiet SFX cue (throttled per power) and the game calls it by power id');
  ok(main.includes('powerReady(b){ b.readyPulse=1; SFX.ready(b.def.id); }') && main.includes('if(wasCd&&b.cd<=0&&bi>=1) this.powerReady(b);'), 'the whisper fires on the cooldown-crossing tick only, and only for the second skill and the ult (bi>=1)');
  ok(main.includes("button(this,130+8*117,HUD_Y+55,110,56,'Rally'") && main.includes('pressRally(){') && main.includes('plantRally(x,y){'), 'RALLY: a ninth seat on the command row at the full 110x56, with press/plant behind it');
  ok(main.includes("if(eo==='rally'){ const rp=(s.ord==='rally'&&s.rally)?s.rally:this.rallyPoint;"), 'rally composes with the ord model: an effective rally resolves the squad\'s own point, else the army\'s');
  ok(main.includes('rallyPoints(){') && main.includes('drawRallyBanners(){'), 'the banner flies only while someone holds it (rallyPoints / drawRallyBanners)'); }
{ const stack = main.slice(main.indexOf('buildFightControls(){'), main.indexOf('toggleAutoFire(){'));
  ok((stack.match(/,SW,56,/g) || []).length === 5, 'the right stack: every button call site builds at SW x 56 (toggle, dodge, block, sprint, and the power-move loop that builds three)'); }
{ const game = JSON.parse(read('data/game.json')); const david = game.heroes.find(h => h.id === 'david');
  ok(david.skills.some(s => s.name === 'Psalm') && david.ult.name === 'Five Stones', 'the DATA names David\'s skill Psalm and his ult Five Stones — the buttons read PSALM and FIVE STONES from the data'); }

// ---------- runtime: stubbed Phaser, real main.js ----------
const store = {};
let readyN = 0; // counts SFX.ready() calls — the whisper's cue
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
  SFX: new Proxy({}, { get: (t, k) => (k === 'ready' ? () => { readyN++; } : (k === 'toggle' ? () => false : () => null)) }),
  Music: { play() {}, toggle: () => true, enabled: () => true },
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [], track() {}, addXP() {},
    level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
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
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function fireUp(btn) { btn._handlers.pointerup(null, 0, 0, { stopPropagation() {} }); }
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
  g.input = { on() {} };
  g.scene = { start() {} };
  GameProto.init.call(g, { hero: heroId || 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 0, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj() });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  g.skillBtns = [...g.heroDef.skills, g.heroDef.ult].map(k => ({ def: k, cd: 0, cdMax: k.cd, held: 0, buffered: false, _tierShown: 0, label: mkObj(), alpha: 1 }));
  return g; }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function spawnFoe(g, x, y) { g.wave = 1; g.waveHpM = 1; g.waveDmM = 1;
  const e = g.spawn({ def: IDOL, at: 0, boss: false }); e.x = x; e.y = y; if (e.spr.setPosition) e.spr.setPosition(x, y); return e; }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
function stepUntil(g, pred, max) { let n = 0; while (!pred() && n < (max || 40)) { g.update(0, 50); n++; } return pred(); }
function countCalls(g, name) { const orig = GameProto[name]; let n = 0; g[name] = function (...a) { n++; return orig.apply(g, a); }; return () => n; }

// ---------- the toggle: default ON, labeled, persistent ----------
{ delete store.gxhub_wotw_autofire;
  const g = bareBattle(); g.buildHUD();
  ok(g.autoFire === true, 'default: auto-fire is ON when no choice has ever been saved');
  ok(g.autoBtn && g.autoBtn.label._t === 'AUTO-FIRE: ON', 'the toggle reads AUTO-FIRE: ON');
  fireUp(g.autoBtn);
  ok(g.autoFire === false && store.gxhub_wotw_autofire === '0' && g.autoBtn.label._t === 'AUTO-FIRE: OFF', 'one press: OFF, saved as 0, label follows');
  const g2 = bareBattle(); g2.buildHUD();
  ok(g2.autoFire === false && g2.autoBtn.label._t === 'AUTO-FIRE: OFF', 'a fresh scene opens with the SAVED choice — OFF persists across runs');
  fireUp(g2.autoBtn);
  ok(g2.autoFire === true && store.gxhub_wotw_autofire === '1', 'pressing again: ON, saved as 1');
  delete store.gxhub_wotw_autofire; }

// ---------- the stack through the real HUD build ----------
{ const g = bareBattle('david'); g.buildHUD(); const B = g.fightBtns;
  ok(B && B.autofire && B.dodge && B.block && B.sprint && !B.light && !B.heavy, 'the stack exists: AUTO-FIRE, DODGE, BLOCK, SPRINT — and no LIGHT, no HEAVY');
  ok(g.fightRects.length === 7 && g.fightRects.every(r => r.h >= 56), 'every stack rect is at least 56px tall (real press targets)');
  ok(g.fightRects.every(r => r.x - r.w / 2 >= 1000), 'the whole stack lives on the right side of the screen');
  ok(Math.max(...g.fightRects.map(r => r.y + r.h / 2)) < 610, 'the stack clears the command bar (bottom edge ' + Math.max(...g.fightRects.map(r => r.y + r.h / 2)) + ' < 610)');
  ok(g.skillBtns.length === 3 && g.skillBtns[0].def.name === 'Smooth Stone' && g.skillBtns[1].def.name === 'Psalm' && g.skillBtns[2].def.name === 'Five Stones', 'David\'s power buttons come from his data: SMOOTH STONE, PSALM, FIVE STONES');
  ok(g.skillBtns.every(b => b.label._t === b.def.name), 'each power button is labeled with its move\'s own name');
  const gS = bareBattle('samson'); gS.buildHUD();
  ok(gS.skillBtns[2].def.name !== 'Five Stones' && gS.skillBtns.every(b => b.label._t === b.def.name), 'another hero shows HIS OWN names (' + gS.skillBtns.map(b => b.def.name).join(', ') + ') — nothing is hardcoded to David');
  ok(g.overFight({ x: 1178, y: 176 }) === true && g.overFight({ x: 1178, y: 70 }) === true && g.overFight({ x: 400, y: 300 }) === false, 'overFight walls the whole stack (toggle included) off from march orders');
  const tx0 = g.hero.tx; g.onTap({ x: 1178, y: 432, worldX: 1178, worldY: 432 });
  ok(g.hero.tx === tx0, 'a tap ON a power button does not move the hero');
  ok(g.campBtnRect.w === 110 && g.campBtnRect.h === 56 && g.campBtnRect.y === 610 + 55, 'CAMP rides the command row at 110x56 (rect ' + g.campBtnRect.x + ',' + g.campBtnRect.y + ')');
  fireUp(g.campBtn);
  ok(g.campPanelOpen === true, 'the row CAMP button opens the camp panel');
  fireUp(g.campBtn);
  ok(g.campPanelOpen === false, '...and closes it'); }

// ---------- auto-fire ON: the hero fights on his own clock ----------
{ const g = bareBattle('david'); g.autoFire = true;
  const shots = countCalls(g, 'shoot');
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500;
  g.update(0, 50); g.update(0, 50);
  ok(shots() >= 1 && approx(g.hero.cd, g.heroDef.rate - 0.05, 0.06), 'ON: the hero throws on his own — first stone out, clock set to his rate (' + g.heroDef.rate + 's)');
  ok(stepUntil(g, () => e.hp < 500), 'the stone lands');
  ok(approx(500 - e.hp, 18), 'a basic hit deals his FULL basic damage (18) — no manual-scheme discount');
  const n0 = shots(); for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(shots() === n0, 'the clock governs: no second stone until the rate elapses'); }
{ const g = bareBattle('samson'); g.autoFire = true; // melee hero: instant, no projectile
  const shots = countCalls(g, 'shoot');
  const e = spawnFoe(g, g.hero.x + 50, g.hero.y); e.hp = 1000;
  g.update(0, 50);
  ok(shots() === 0 && approx(1000 - e.hp, 45), 'melee auto-fire lands instantly at full basic — Samson alone, so 30 x 1.5 (Upgrade 14) = 45, no shot thrown'); }

// ---------- auto-fire OFF: zero basic damage, skills still fire ----------
{ const g = bareBattle('david'); g.autoFire = false;
  const shots = countCalls(g, 'shoot'); const dmgs = countCalls(g, 'damage');
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500;
  for (let i = 0; i < 60; i++) g.update(0, 50); // 3 seconds inside the range circle
  ok(e.hp === 500 && shots() === 0 && dmgs() === 0, 'OFF: 3s with an enemy in range — ZERO basic attacks, zero hero damage dealt');
  g.useSkill(0); // Smooth Stone, by button
  ok(shots() === 1 && stepUntil(g, () => e.hp < 500), 'OFF: a power move still fires by button and lands'); }

// ---------- the stamina kit on the new stack ----------
{ const g = bareBattle('david'); g.autoFire = false;
  g.hero.tx = g.hero.x + 400; g.hero.ty = g.hero.y;
  ok(g.pressDodge() === 'dodged' && g.hero.dodgeT > 0 && g.hero.iframes > 0, 'DODGE still dashes with i-frames');
  const gB = bareBattle('david'); gB.autoFire = false; // fresh hero: no dodge i-frames over the block test
  ok(gB.setBlock(true) === true && gB.hero.blocking, 'BLOCK still raises while held');
  const hp0 = gB.hero.hp, st0 = gB.hero.stamina; gB.hurtHero(100);
  ok(approx(gB.hero.hp, hp0 - 35) && gB.hero.stamina < st0, 'a blocked blow is mitigated 65% and the impact costs stamina');
  const g2 = bareBattle('david'); g2.autoFire = false;
  g2.hero.tx = g2.hero.x + 600; g2.hero.ty = g2.hero.y; g2.toggleSprint();
  for (let i = 0; i < 20; i++) g2.update(0, 50);
  ok(g2.hero.sprint === true && g2.hero.stamina < 100, 'SPRINT still drains the shared pool while moving (' + Math.round(g2.hero.stamina) + '/100 after 1s)'); }

// ---------- Upgrade 9's tap-to-order, untouched ----------
{ const g = bareBattle(); const s1 = buySquad(g, 'shepherd_militia');
  ok(s1.ord === 'post' && g.selSquad === null, 'tap-to-order stands: squads are born posted, the hero is selected');
  g.hero.tx = 1200; g.hero.ty = 200;
  for (let i = 0; i < 60; i++) g.update(0, 50);
  ok(Math.hypot(s1.x - 210, s1.y - 600) <= 1, 'the squad did NOT follow the marching hero');
  g.selectSquad(s1); g.onTap({ x: 900, y: 300, worldX: 900, worldY: 300 });
  ok(s1.post.x === 900 && s1.post.y === 300, 'a ground tap still posts the selected squad');
  g.onTap({ x: g.hero.x, y: g.hero.y, worldX: g.hero.x, worldY: g.hero.y });
  ok(g.selSquad === null, 'a tap on the hero still reselects the hero'); }

// ---------- ADDITION 1: RALLY BANNER ----------
{ const g = bareBattle(); g.buildHUD(); g.autoFire = false;
  const s1 = buySquad(g, 'shepherd_militia'), s2 = buySquad(g, 'shepherd_slinger');
  ok(g.rallyBtn && g.rallyMode === false, 'the RALLY button exists on the row; no rally is armed at start');
  g.selectSquad(s1);
  fireUp(g.rallyBtn);
  ok(g.rallyMode === true, 'tap RALLY: the planting mode arms');
  g.onTap({ x: 800, y: 300, worldX: 800, worldY: 300 });
  ok(s1.ord === 'rally' && s1.rally.x === 800 && s1.rally.y === 300 && g.rallyMode === false, 'tap the ground: the banner plants there and the SELECTED squad answers (its own order, its own point)');
  ok(g.rallyPoints().length === 1 && g.rallyPoints()[0].x === 800, 'one banner flies');
  ok(stepUntil(g, () => Math.hypot(s1.x - 800, s1.y - 300) <= 10, 400), 'the rallied squad paths to the banner');
  const hx = s1.x, hy = s1.y; for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(Math.hypot(s1.x - hx, s1.y - hy) <= 2, '...and HOLDS there — rally is a hold, not a waypoint');
  ok(Math.hypot(s2.x - 210, s2.y - 600) <= 1, 'the unselected squad never moved');
  fireUp(g.rallyBtn); g.onTap({ x: 500, y: 500, worldX: 500, worldY: 500 });
  ok(s1.rally.x === 500 && s1.rally.y === 500 && g.rallyPoints().length === 1 && g.rallyPoints()[0].x === 500, 'planting again MOVES the banner — the hold point follows');
  ok(stepUntil(g, () => Math.hypot(s1.x - 500, s1.y - 500) <= 10, 400), 'the squad re-paths to the moved banner');
  g.onTap({ x: 650, y: 350, worldX: 650, worldY: 350 });
  ok(s1.ord === 'post' && s1.post.x === 650 && g.rallyPoints().length === 0, 'a direct tap-to-place supersedes the rally — and the banner comes down');
  g.selectHero(); fireUp(g.rallyBtn); g.onTap({ x: 900, y: 400, worldX: 900, worldY: 400 });
  ok(g.order === 'rally' && g.rallyPoint.x === 900 && s1.ord === null && s2.ord === null, 'hero selected: the WHOLE ARMY rallies (one shared point, squads returned to army control)');
  ok(g.rallyPoints().length === 1, 'the army banner flies');
  const s2x = s2.x; for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(s2.x > s2x + 25, 'the army actually answers — squads march on the banner');
  g.giveOrder('charge');
  ok(g.order === 'charge' && g.rallyPoints().length === 0, 'a later command supersedes the army rally — banner down'); }

// ---------- ADDITION 2: POWER-READY WHISPER ----------
{ const g = bareBattle('david'); g.autoFire = false;
  buySquad(g, 'shepherd_militia'); // Psalm needs its flock
  const b0 = g.skillBtns[0], b1 = g.skillBtns[1], b2 = g.skillBtns[2];
  const n0 = readyN;
  b1.cd = 0.1; b2.cd = 30; // Psalm about to complete; Five Stones still cooling
  for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(readyN === n0 + 1 && b1.readyPulse > 0, 'PSALM crossing: exactly ONE whisper, and a glow pulse stands on its button');
  for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(readyN === n0 + 1, 'a second of sitting ready: NO re-fire — and Five Stones, still cooling, stayed silent');
  ok(b1.readyPulse === 0, 'the pulse faded on its own — a whisper, not a beacon');
  b0.cd = 0.1; for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(readyN === n0 + 1, 'Smooth Stone completing does NOT whisper — only the two great powers do');
  g.useSkill(1);
  ok(b1.cd > 17, 'Psalm spent by button: its cooldown restarted (' + b1.cd.toFixed(0) + 's)');
  b1.cd = 0.1; for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(readyN === n0 + 2 && b1.readyPulse > 0, 'used, cooled, completed again: the whisper fires again — once');
  b1.cd = 0.1; g.pressSkill(1); // a press inside the buffer window
  ok(b1.buffered === true, 'setup: a Psalm press is buffered inside its window');
  for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(b1.cd > 1 && readyN === n0 + 2, 'a buffered cast spends the crossing — the move never sat ready, so no whisper'); }

// ---------- the scaling-law proof: auto-fire ON, Ready-only powers ----------
// The standard competent play (the U7/U8/U9 army and script): orders
// through giveOrder, dodge the telegraphs, the two regular moves spent
// the moment they are ready — and the hero's basic fighting done by
// AUTO-FIRE, as kennin's approved default plays it. The ult stays out,
// as in every prior suite.
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
{ const r = champFight();
  ok(r.e.dead, 'auto-fire ON + Ready-only powers clears the wave-10 champion (' + r.sec.toFixed(1) + 's)');
  ok(r.g.campHp > 0, '...with the camp standing (' + Math.round(r.g.campHp) + '/' + r.g.campMax + ')');
  ok(r.sec <= 40, 'comparable to the pre-U8/U9 standard (~30s): ' + r.sec.toFixed(1) + 's <= 40s');
  console.log('  [sim] champion clear, auto-fire ON + Ready powers: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
