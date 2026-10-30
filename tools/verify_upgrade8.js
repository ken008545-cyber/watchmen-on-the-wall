#!/usr/bin/env node
// Upgrade 8 verification harness. Stubbed Phaser; exercises the REAL
// Held-Power mastery in js/main.js: charge accrual and tier thresholds
// (battle time only — never on cooldown, never in the shop), multiplier
// application through the real cast paths, the Perfect stun flourish,
// Perfect-loss on heavy-class damage only (direct and through the real
// boss heavy strike), the input buffer (direct and through the real HUD
// buttons, incl. Volley and the order echo), cooldown-sweep state, the
// end-of-run tally, and the scaling-law proof: two competent-play
// simulations of the wave-10 champion fight through the real update()
// loop — one spending every regular move the moment it is ready
// (Ready-only), one entering with moves saved to Perfect (kennin's own
// story) — both must clear, and Perfect must not trivialize the fight.
// The ult is excluded from BOTH styles, as in U7's sim: Five Stones
// against a lone champion is a one-button delete at any tier (5 stones,
// the boss stone at 250x3) — a pre-existing ult truth, not a mastery
// question. No browser is available — button readability at phone size
// needs a human pass at the playtest address.
//
// Upgrade 10 re-point (kennin's reversal, 2026-10-30): the manual
// basic-attack scheme part of this suite was built to prove — LIGHT /
// HEAVY presses, aim priority, the heavy wind-up/cleave/splash, the
// attack press buffer, the sprint opener — was REMOVED at kennin's
// ruling, and those batteries below were re-pointed to the new ruling
// (auto-fire restored, toggleable; proof lives in verify_upgrade10.js).
// Every Held-Power battery (accrual, tiers, multipliers, Perfect loss,
// the skill input buffer, sweeps, the tally) is UNCHANGED, as are the
// dodge/block/sprint/stamina batteries minus the opener. The sims now
// fight by auto-fire, as the approved default plays.
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
ok(/const HELD=\{ temperAt:20, perfectAt:45, mul:\[1,1\.5,2\.25\]/.test(main), 'HELD table: Tempered 20s, Perfect 45s, multipliers 1 / 1.5 / 2.25');
ok(main.includes("names:['Ready','Tempered','Perfect']") && main.includes('perfectStun:0.6'), 'tier names and the 0.6s Perfect stun rider are in the table');
ok(/const INPUT_BUFFER=0\.15;/.test(main), 'input buffer is 150ms');
ok(main.includes('if(b.cd<=INPUT_BUFFER) b.buffered=true;') && main.includes('if(b.buffered){ b.buffered=false; this.useSkill(bi); }'), 'skill presses buffer inside the window and fire from update()');
ok(main.includes("if(this.volleyCd<=INPUT_BUFFER) this._volleyBuf=true;"), 'Volley presses buffer the same way');
ok(main.includes('hurtHero(dmg,true)') && (main.match(/hurtHero\(dmg,true\)/g) || []).length === 2, 'exactly the heavy strike and the slam pass heavy=true to hurtHero');
ok(main.includes("'Perfect lost!'") && main.includes('b.held=HELD.temperAt'), 'a heavy hit knocks Perfect charge down to Tempered, announced');
ok(main.includes('this.heldSpent[tier]++; b.held=0;'), 'a cast tallies its tier and spends the charge');
ok(/shootS\(h\.x,h\.y,t,'stone',\{dmg:250\*\(t\.boss\?3:1\)/.test(main), 'Five Stones flows through the scaling shoot helper (delayed stones keep the cast tier)');
ok(main.includes('drawSkillSweep(b)') && main.includes('b.sweep=this.add.graphics()'), 'skill buttons carry a sweep overlay drawn from live state');
ok(main.includes("label+'!'") && main.includes("this.floatText(this.hero.x,this.hero.y-64,label+'!'"), 'command orders echo as a float above the hero');
ok(main.includes('held:this.heldSpent?this.heldSpent.slice()') && main.includes("'Held Power: '"), 'end-of-run payload and summary line carry the Held tally');
ok(main.includes("c.on('pointerdown'"), 'the shared button helper presses with weight (pointerdown dip)');
// --- combat-controls statics (kennin's two-hands design) ---
ok(!/lightDmg|heavyDmg|lightCd|heavyCd|heavyCleave|heavySplash|openerMul/.test(main), 'Upgrade 10: the manual-strike numbers are GONE from the FIGHT table — auto-fire reads the hero data directly'); // (heavyWindup is not in this list on purpose: BOSS.heavyWindup is the champion's own telegraph and stays)
ok(main.includes('blockMit:0.65, blockHeavyMit:0.45') && main.includes('sprintMul:1.45'), 'FIGHT table: block 65% / heavy-block 45% mitigation, sprint x1.45 (the surviving kit, unchanged)');
ok(main.includes('dodgeDist:150, dodgeTime:0.22, dodgeIframes:0.30, dodgeCd:1.6'), 'FIGHT table: dodge 150px in 0.22s, 0.30s i-frames, 1.6s cooldown');
ok(main.includes('buildFightControls()') && main.includes("mk('autofire',SX,70") && main.includes("mk('dodge',SX,176") && main.includes("mk('block',SX,240") && main.includes("mk('sprint',SX,304"), 'Upgrade 10: the right-thumb stack — AUTO-FIRE toggle over DODGE, BLOCK, SPRINT, top right of the screen');
ok(main.includes('if(this.overFight(p)) return;'), 'onTap refuses taps on the fight stack — the hands stay separate');
ok(main.includes('heroAutoFire(){') && main.includes('this.heroAutoFire();') && !main.includes('pressAttack') && !main.includes('lightStrike') && !main.includes('heavyStrike'), 'Upgrade 10: auto-fire is RESTORED through heroAutoFire(); the manual press path (pressAttack/lightStrike/heavyStrike) is removed entirely');
ok(main.includes('if(h.iframes>0) return;'), 'hurtHero honors dodge i-frames before all damage');
ok(main.includes("this.setBlock(true)") && main.includes("bb.on('pointerdown'"), 'BLOCK is a hold (pointerdown raises, release drops)');

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
const HELD = vm.runInContext('HELD', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const EndProto = vm.runInContext('End.prototype', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
ok(HELD.mul[0] === 1 && HELD.mul[1] === 1.5 && HELD.mul[2] === 2.25, 'HELD multipliers evaluate to 1 / 1.5 / 2.25 (Ready is exactly the old move)');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function fireUp(btn) { btn._handlers.pointerup(null, 0, 0, { stopPropagation() {} }); }

// A battle-ready Game without create(): real init() + the fields create()
// would set, so update(), useSkill(), damage() and boss code run for real.
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

// ---------- charge accrual: thresholds, battle time only ----------
{ const g = bareBattle(); const b = g.skillBtns[0];
  b.held = 19.9; for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(g.heldTierOf(b) === 1 && b._tierShown === 1, 'charge crosses into Tempered at 20s of battle time (held ' + b.held.toFixed(1) + 's)');
  b.held = 44.9; for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(g.heldTierOf(b) === 2 && b._tierShown === 2, 'charge crosses into Perfect at 45s');
  const b2 = g.skillBtns[1]; b2.cd = 5; b2.held = 0;
  for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(b2.held === 0 && b2.cd < 5, 'no charge accrues while the move is on cooldown');
  const g2 = bareBattle(); g2.shopOpen = true; g2.shopEndsAt = Date.now() + 60000;
  g2.update(0, 50);
  ok(g2.skillBtns[0].held === 0, 'no charge accrues in the shop — patience is earned in the fight, not the intermission'); }

// ---------- multipliers through real casts: Psalm buff durations ----------
{ const g = bareBattle(); const s = buySquad(g, 'shepherd_militia'); const b = g.skillBtns[1]; // Psalm
  b.held = 0; g.useSkill(1);
  ok(s.buffRateT === 6 && b.cd === b.def.cd && b.cdMax === b.def.cd, 'Ready Psalm: squad haste exactly 6s (the pre-U8 move), cooldown and sweep max set');
  s.buffRateT = 0; b.cd = 0; b.held = HELD.temperAt; g.useSkill(1);
  ok(s.buffRateT === 9, 'Tempered Psalm: haste 9s (6 x 1.5)');
  s.buffRateT = 0; b.cd = 0; b.held = HELD.perfectAt; g.useSkill(1);
  ok(approx(s.buffRateT, 13.5), 'Perfect Psalm: haste 13.5s (6 x 2.25)');
  ok(g.heldSpent.join() === '1,1,1' && b.held === 0, 'the three casts tallied Ready/Tempered/Perfect and the charge was spent'); }

// ---------- multipliers + flourish through a real shot: Smooth Stone ----------
{ const g = bareBattle(); const e = spawnFoe(g, g.hero.x + 200, g.hero.y); const b = g.skillBtns[0]; // Smooth Stone
  const hp0 = e.hp; b.held = 0; g.useSkill(0);
  ok(stepUntil(g, () => e.hp < hp0), 'Ready stone lands');
  ok(approx(hp0 - e.hp, 120), 'Ready stone deals exactly 120 (the pre-U8 move)');
  ok(approx(e.stun, 1.5), 'Ready stone stuns its own 1.5s, no rider');
  e.hp = e.max; e.stun = 0; b.cd = 0; b.held = HELD.perfectAt; g.useSkill(0);
  const hp1 = e.hp;
  ok(stepUntil(g, () => e.hp < hp1), 'Perfect stone lands');
  ok(approx(hp1 - e.hp, 270), 'Perfect stone deals 270 (120 x 2.25)');
  ok(approx(e.stun, 1.5 * 2.25), 'Perfect stone stun scales to 3.375s'); }

// ---------- the Perfect flourish on a move with no stun of its own: Jawbone ----------
{ const g = bareBattle('samson'); const e = spawnFoe(g, g.hero.x + 60, g.hero.y); const b = g.skillBtns[0]; // Jawbone Cleave
  const hp0 = e.hp; b.held = HELD.perfectAt; g.useSkill(0);
  ok(approx(hp0 - e.hp, 90 * 2.25), 'Perfect Jawbone deals 202.5 (90 x 2.25)');
  ok(approx(e.stun, HELD.perfectStun), '...and the flourish stuns 0.6s on a move that never stunned before');
  const e2 = spawnFoe(g, g.hero.x + 60, g.hero.y); const hp2 = e2.hp; b.cd = 0; b.held = 0; g.useSkill(0);
  ok(approx(hp2 - e2.hp, 90) && !e2.stun, 'Ready Jawbone: exactly 90, no stun — the old move untouched'); }

// ---------- 'No target' consumes nothing ----------
{ const g = bareBattle(); const b = g.skillBtns[0]; b.held = HELD.perfectAt;
  g.useSkill(0); // Smooth Stone with no enemies on the field
  ok(b.held === HELD.perfectAt && b.cd === 0 && g.heldSpent.join() === '0,0,0', 'a No target cast spends no charge, starts no cooldown, tallies nothing'); }

// ---------- Perfect loss: heavy class only ----------
{ const g = bareBattle(); const floats = []; g.floatText = (x, y, s) => floats.push(s);
  g.skillBtns[0].held = 30; g.skillBtns[1].held = 50; g.skillBtns[2].held = 50;
  g.hurtHero(10);
  ok(g.skillBtns[1].held === 50 && g.skillBtns[2].held === 50, 'an ordinary blow (chip damage) leaves Perfect charges untouched');
  g.hurtHero(10, true);
  ok(g.skillBtns[1].held === HELD.temperAt && g.skillBtns[2].held === HELD.temperAt, 'a heavy hit knocks both Perfect charges down to Tempered');
  ok(g.skillBtns[0].held === 30, '...and a merely Tempered charge is NOT knocked down further');
  ok(floats.includes('Perfect lost!'), 'the loss is announced above the hero'); }

// ---------- Perfect loss through the real boss heavy strike ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  g.hero.x = e.x - 40; g.hero.y = e.y; g.hero.tx = g.hero.x; g.hero.ty = g.hero.y;
  g.skillBtns[2].held = HELD.perfectAt; const hp0 = g.hero.hp;
  g.bossHeavyStrike(e);
  ok(approx(hp0 - g.hero.hp, e.dmg * 3, 0.05), 'the champion heavy strike lands on the hero for x3 (' + (hp0 - g.hero.hp).toFixed(1) + ')');
  ok(g.skillBtns[2].held === HELD.temperAt, '...and it knocks the hero\'s Perfect charge out of his hands'); }

// ---------- input buffer + button weight through the REAL HUD buttons ----------
{ const g = bareBattle(); g.buildHUD();
  const floats = []; g.floatText = (x, y, s) => floats.push(s);
  const charge = g.cmdBtns.charge;
  ok(typeof charge._handlers.pointerdown === 'function', 'command buttons register a press (pointerdown) handler');
  charge._handlers.pointerdown(); fireUp(charge);
  ok(g.order === 'charge' && floats.includes('Charge!'), 'pressing Charge sets the order and echoes "Charge!" above the hero');
  const sb = g.skillBtns[0]; sb.cd = 0.1;
  fireUp(sb);
  ok(sb.buffered === true && sb.cd > 0, 'a skill pressed 100ms before ready is buffered, not cast and not lost');
  const e = spawnFoe(g, g.hero.x + 200, g.hero.y);
  for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(sb.cd > 7 && sb.buffered === false, 'the buffered press fires the moment the cooldown ends (cooldown restarted at ' + sb.cd.toFixed(1) + 's)');
  const vb = g.cmdBtns.volley; g.volleyCd = 0.1;
  fireUp(vb);
  ok(g._volleyBuf === true && g.volleyMode === false, 'a Volley pressed 100ms before ready buffers too');
  for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(g.volleyMode === true, '...and arms Volley targeting when the cooldown ends'); }

// ---------- a press OUTSIDE the buffer window is not remembered ----------
{ const g = bareBattle(); g.buildHUD(); const sb = g.skillBtns[0]; sb.cd = 0.3;
  fireUp(sb);
  ok(!sb.buffered, 'a press 300ms early (outside the 150ms window) does not buffer');
  for (let i = 0; i < 8; i++) g.update(0, 50);
  ok(sb.cd === 0 && g.heldSpent.join() === '0,0,0', 'the cooldown ends quietly — no phantom cast'); }

// ---------- cooldown sweep state: drawSkillSweep runs clean at every state ----------
{ const g = bareBattle(); const b = g.skillBtns[0];
  b.sweep = gfxObj(); b.sx = 200; b.sy = 690; b.sw = 175; b.sh = 44;
  let clean = true;
  try { b.cd = 4; g.drawSkillSweep(b);
    b.cd = 0; b.held = 0; g.drawSkillSweep(b);
    b.held = HELD.temperAt; g.drawSkillSweep(b);
    b.held = HELD.perfectAt; g.drawSkillSweep(b); } catch (err) { clean = false; }
  ok(clean, 'the sweep draws without error on cooldown, at Ready, Tempered and Perfect'); }

// ---------- THE FIGHT STACK: auto-fire + the surviving kit (Upgrade 10 re-point) ----------
{ // AUTO-FIRE: this battery asserted the exact opposite under Upgrade 8's
  // manual ruling (zero strikes in the circle). Under kennin's reversal:
  // ON strikes on its own; OFF is silent.
  const g = bareBattle('david'); g.autoFire = true;
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500; const before = e.hp;
  for (let i = 0; i < 60; i++) g.update(0, 50); // 3 seconds inside the range circle
  ok(e.hp < before, 'auto-fire ON: 3s with an enemy inside the range circle, the hero struck on his own (' + Math.round(before - e.hp) + ' damage, no press)');
  const g2 = bareBattle('david'); g2.autoFire = false;
  const e2 = spawnFoe(g2, g2.hero.x + 120, g2.hero.y); e2.hp = 500;
  for (let i = 0; i < 60; i++) g2.update(0, 50);
  ok(e2.hp === 500 && g2.shots.length === 0, 'auto-fire OFF: the same 3 seconds — zero strikes thrown'); }
{ // AUTO-FIRE CLOCK + TARGET (replaces the LIGHT-press and aim batteries):
  // the strike goes to the NEAREST enemy in range, on the hero's rate clock
  const g = bareBattle('david'); g.autoFire = true;
  const near = spawnFoe(g, g.hero.x + 95, g.hero.y); near.hp = 500;
  const far = spawnFoe(g, g.hero.x + 135, g.hero.y - 10); far.hp = 500;
  g.hero.tx = far.x; g.hero.ty = far.y; // the marching hand points at the far one — auto-fire takes no aim orders
  g.update(0, 50);
  ok(g.shots.length === 1 && g.shots[0].target === near && approx(g.hero.cd, g.heroDef.rate - 0.05, 0.06), 'auto-fire targets the NEAREST enemy in range and starts the rate clock (' + g.heroDef.rate + 's)');
  ok(stepUntil(g, () => near.hp < 500), 'the stone lands');
  ok(approx(500 - near.hp, 18), 'a basic hit deals FULL basic damage (18) — no light-strike discount'); }
{ // MELEE auto-fire (replaces the Samson LIGHT/HEAVY battery): instant,
  // full basic, and NO cleave — the heavy's cleave left with the heavy
  const g = bareBattle('samson'); g.autoFire = true;
  const e = spawnFoe(g, g.hero.x + 50, g.hero.y); e.hp = 1000;
  const by = spawnFoe(g, e.x + 30, e.y); by.hp = 1000;
  g.update(0, 50);
  ok(approx(1000 - e.hp, 30) && by.hp === 1000, 'melee auto-fire lands instantly at full basic (30); the bystander is untouched — no cleave without a heavy'); }
{ // DODGE BUFFER (replaces the attack-press buffer battery): a dodge
  // pressed inside its window still fires as the cooldown ends — the
  // skill input buffer battery above covers power moves the same way
  const g = bareBattle('david');
  g.hero.dodgeCd = 0.1;
  ok(g.pressDodge() === 'buffered' && g.hero.dodgeBuf === true, 'dodge press inside the cooldown window buffers');
  for (let i = 0; i < 4; i++) g.update(0, 50);
  ok(g.hero.dodgeT > 0 || g.hero.iframes > 0, 'the buffered dodge fired the moment the dash was ready'); }
{ // DODGE: dash toward the march target; i-frames eat even the champion's heavy — and save Perfect
  const g = bareBattle('david');
  g.hero.tx = g.hero.x + 400; g.hero.ty = g.hero.y;
  const x0 = g.hero.x;
  ok(g.pressDodge() === 'dodged' && g.hero.dodgeT > 0 && g.hero.iframes > 0, 'DODGE starts the dash and its i-frames');
  const hp0 = g.hero.hp; g.hurtHero(60, true);
  ok(g.hero.hp === hp0, 'a heavy landed mid-dodge deals NOTHING — i-frames are invulnerability');
  g.skillBtns[2].held = HELD.perfectAt; g.bossMarkT = 999; g.bossMarkX = g.hero.x; g.bossMarkY = g.hero.y;
  g.bossHeavyStrike(spawnChamp(g, 10));
  ok(g.hero.hp === hp0 && g.skillBtns[2].held === HELD.perfectAt, "the champion's telegraphed heavy, dodged, costs neither blood nor the Perfect charge");
  for (let i = 0; i < 6; i++) g.update(0, 50);
  ok(g.hero.x - x0 > 120 && g.hero.x - x0 < 280, 'the dash carried the hero ~150px toward his march target (' + Math.round(g.hero.x - x0) + 'px)');
  ok(g.hero.dodgeCd > 1.0, 'dodge went on its 1.6s cooldown'); }
{ // BLOCK: ordinary blows mostly stopped; boss heavies land through, reduced — Perfect still breaks
  const g = bareBattle('david');
  ok(g.setBlock(true) === true && g.hero.blocking, 'BLOCK raises while held');
  const hp0 = g.hero.hp; g.hurtHero(100);
  ok(approx(g.hero.hp, hp0 - 35), 'blocked ordinary blow: 65% mitigated (100 -> 35)');
  ok(g.hero.stamina < 90, 'the impact cost stamina (pool now ' + Math.round(g.hero.stamina) + ')');
  g.skillBtns[1].held = HELD.perfectAt; const hp1 = g.hero.hp; g.hurtHero(100, true);
  ok(approx(g.hero.hp, hp1 - 55) && g.skillBtns[1].held === HELD.temperAt, 'blocked BOSS heavy: reduced to 55, NOT erased — and the Perfect charge still breaks');
  const g2 = bareBattle('david'); g2.hero.stamina = 5; g2.setBlock(true);
  for (let i = 0; i < 20 && g2.hero.blocking; i++) g2.update(0, 50);
  ok(g2.hero.blocking === false && g2.hero.guardBreakT > 0 && g2.setBlock(true) === false, 'an emptied guard BREAKS and cannot be re-raised until it recovers'); }
{ // SPRINT: faster feet, one shared pool — never behind a guard
  const g = bareBattle('david');
  g.hero.tx = g.hero.x + 400; g.hero.ty = g.hero.y;
  const x0 = g.hero.x; for (let i = 0; i < 20; i++) g.update(0, 50);
  const walk = g.hero.x - x0;
  const g2 = bareBattle('david');
  g2.hero.tx = g2.hero.x + 400; g2.hero.ty = g2.hero.y;
  g2.toggleSprint();
  const x1 = g2.hero.x; for (let i = 0; i < 20; i++) g2.update(0, 50);
  ok(approx((g2.hero.x - x1) / walk, 1.45, 0.75), 'sprint moves the hero at x1.45 (' + Math.round(g2.hero.x - x1) + 'px vs ' + Math.round(walk) + 'px walked)');
  ok(g2.hero.stamina < 95, 'sprinting drains the shared stamina pool');
  // Upgrade 10: the sprint OPENER (a bonus on a strike pressed out of a
  // sprint) retired with the manual strikes — it was a property of the
  // press, and there is no press anymore. Sprint, its drain and its
  // guard rules are unchanged.
  const g3 = bareBattle('david'); g3.setBlock(true); g3.toggleSprint();
  ok(g3.hero.sprint === false, 'no sprinting behind a raised guard');
  g3.setBlock(false); g3.toggleSprint();
  ok(g3.hero.sprint === true, 'guard down, sprint engages');
  g3.setBlock(true);
  ok(g3.hero.sprint === false && g3.hero.blocking === true, 'raising the guard cancels the sprint — one pool, one posture'); }
{ // THE STACK through the real HUD build: buttons, place, and the tap wall
  const g = bareBattle('david'); g.buildHUD();
  const B = g.fightBtns;
  ok(B && B.autofire && B.dodge && B.block && B.sprint && !B.light && !B.heavy, 'Upgrade 10: the stack exists — AUTO-FIRE, DODGE, BLOCK, SPRINT (LIGHT and HEAVY are gone)');
  ok(B.autofire.sx > 1000 && B.dodge.sx > 1000 && B.block.sx > 1000 && B.sprint.sx > 1000, 'every stack button lives on the right side of the screen');
  ok(g.skillBtns[1].def.name === 'Psalm' && g.skillBtns[2].def.name === 'Five Stones', 'the power buttons in the stack are David\'s moves from the data: PSALM and FIVE STONES');
  ok(g.overFight({ x: 1178, y: 176 }) === true && g.overFight({ x: 400, y: 300 }) === false, 'overFight knows the stack from the field');
  const tx0 = g.hero.tx, ty0 = g.hero.ty;
  g.onTap({ x: 1178, y: 176, worldX: 1178, worldY: 176 });
  ok(g.hero.tx === tx0 && g.hero.ty === ty0, 'a tap ON the stack does not move the hero — the hands stay separate');
  fireUp(B.dodge);
  ok(g.hero.dodgeT > 0 || g.hero.iframes > 0, "the DODGE button's own press dashes");
  fireUp(B.autofire);
  ok(g.autoFire === false, "the AUTO-FIRE button's own press turns auto-fire off"); }

// ---------- the end-of-run summary renders the tally ----------
{ const e8 = Object.create(EndProto);
  const texts = [];
  e8.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; texts.push(str); return o; }, graphics: () => gfxObj(),
    image: () => mkObj(), rectangle: () => mkObj(), circle: () => mkObj(), container: () => mkObj() };
  e8.scene = { start() {} };
  EndProto.create.call(e8, { win: true, eraName: 'Bible', stars: 3, rec: { score: 100 }, earned: 10, perfect: false, xp: 5, hero: 'david', ev: [], held: [1, 2, 3], waves: 10, era: 'bible', endless: false });
  ok(texts.some(t => t === 'Held Power: 3 Perfect, 2 Tempered, 1 Ready'), 'End screen renders "Held Power: 3 Perfect, 2 Tempered, 1 Ready"'); }

// ---------- the scaling-law proof: two play styles vs the wave-10 champion ----------
// U7's competent script (kite the telegraphs, CHARGE between them, FALL
// BACK when a mark appears) and U7's army. Skills: the two regular moves
// only. READY spends each the frame it is ready; PERFECT enters the fight
// with both moves saved to Perfect — kennin's corner story — and after
// that spends only at Perfect again.
function champFight(style) { const g = bareBattle(); g.autoFire = true; // Upgrade 10: the approved default does the hero's basic fighting
  buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']);
  buySquad(g, 'benjamite_archer', ['drill1', 'drill2']);
  buySquad(g, 'mighty_man', ['drill1']);
  buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']);
  buySquad(g, 'spearman_wall');
  buySquad(g, 'slinger_elah', ['swift']);
  buySquad(g, 'levite_healer');
  buySquad(g, 'shepherd_militia', ['veteran']);
  const e = spawnChamp(g, 10); g.waveActive = true;
  if (style === 'perfect') g.skillBtns.forEach(b => { b.held = HELD.perfectAt; });
  let steps = 0;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    const want = tele ? 'fallback' : 'charge';
    if (g.__u9ord !== want) { g.__u9ord = want; g.selSquad = null; g.giveOrder(want); } // Upgrade 9: orders now go through the real command path (squads carry their own orders; the sim drives the army-wide one)
    // Positioning and the dodge are the player's hands; the hero's basic
    // fighting is AUTO-FIRE (Upgrade 10), as the approved default plays.
    if (tele && g.hero.dodgeCd <= 0 && Math.hypot(g.hero.x - e.x, g.hero.y - e.y) < 220) {
      g.hero.tx = Math.max(40, g.hero.x - 260); g.hero.ty = g.hero.y; g.pressDodge(); }
    else { g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
      g.hero.ty = tele ? g.hero.y : e.y; }
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b.cd > 0) continue;
      if (style === 'ready') g.useSkill(i);
      else if (g.heldTierOf(b) === 2) g.useSkill(i); }
    g.update(0, 50); steps++; }
  return { g, e, sec: steps * 0.05 }; }
{ const r = champFight('ready');
  ok(r.e.dead, 'READY-ONLY competent play still clears the wave-10 champion (' + r.sec.toFixed(1) + 's of fighting)');
  ok(r.sec <= 40, 'auto-fire keeps the clear comparable to the manual era (~30s): ' + r.sec.toFixed(1) + 's');
  ok(r.g.campHp > 0, '...with the camp standing (' + Math.round(r.g.campHp) + '/' + r.g.campMax + ') — Upgrade 7\'s reachability is unchanged for a no-mastery player');
  ok(r.g.heldSpent[1] === 0 && r.g.heldSpent[2] === 0 && r.g.heldSpent[0] > 0, 'the Ready style truly spent at Ready only (' + r.g.heldSpent[0] + ' casts)');
  const p = champFight('perfect');
  ok(p.e.dead && p.g.campHp > 0, 'PERFECT-saved play also clears the champion (' + p.sec.toFixed(1) + 's) with the camp standing');
  ok(p.g.heldSpent[2] >= 2, 'the Perfect style opened with its saved Perfect moves (' + p.g.heldSpent[2] + ' Perfect casts)');
  ok(p.sec >= r.sec * 0.45, 'Perfect does NOT trivialize the fight: ' + p.sec.toFixed(1) + 's vs Ready ' + r.sec.toFixed(1) + 's (Perfect >= 45% of Ready time)');
  console.log('  [sim] champion clear — Ready-only: ' + r.sec.toFixed(1) + 's, Perfect-saved: ' + p.sec.toFixed(1) + 's, camp Ready ' + Math.round(r.g.campHp) + '/500, camp Perfect ' + Math.round(p.g.campHp) + '/500'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
