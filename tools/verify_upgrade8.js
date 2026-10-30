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
ok(/const FIGHT=\{ lightDmg:0\.75, lightCd:0\.55, heavyDmg:2\.1, heavyCd:1\.9, heavyWindup:0\.28/.test(main), 'FIGHT table: light x0.75 dmg / x0.55 cd, heavy x2.1 dmg / x1.9 cd / 0.28s wind-up');
ok(main.includes('blockMit:0.65, blockHeavyMit:0.45') && main.includes('sprintMul:1.45') && main.includes('openerMul:1.25'), 'FIGHT table: block 65% / heavy-block 45% mitigation, sprint x1.45, opener x1.25');
ok(main.includes('dodgeDist:150, dodgeTime:0.22, dodgeIframes:0.30, dodgeCd:1.6'), 'FIGHT table: dodge 150px in 0.22s, 0.30s i-frames, 1.6s cooldown');
ok(main.includes('buildFightControls()') && main.includes("mk('heavy',1184,296") && main.includes("mk('light',1184,384") && main.includes("mk('block',1184,472"), 'fight cluster is built on the RIGHT side of the screen (x ~1184)');
ok(main.includes('if(this.overFight(p)) return;'), 'onTap refuses taps on the fight cluster — the hands stay separate');
ok(!/h\.cd-=dt; if\(h\.cd<=0\)\{ const t=this\.nearestEnemy\(h\.x,h\.y,hd\.range\)/.test(main), 'the hero auto-fire block is GONE — the range circle triggers nothing');
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

// ---------- THE FIGHT CLUSTER: manual combat (kennin's two-hands design) ----------
{ // NO AUTO-FIRE: an enemy standing in the range circle is a warning, not a trigger
  const g = bareBattle('david');
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500; const before = e.hp;
  for (let i = 0; i < 60; i++) g.update(0, 50); // 3 seconds inside the range circle
  ok(e.hp === before && g.shots.length === 0, 'no auto-fire: 3s with an enemy inside the range circle, zero strikes thrown'); }
{ // LIGHT (ranged): the press throws the stone on the light recovery clock
  const g = bareBattle('david');
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500; const before = e.hp;
  const r = g.pressAttack('light');
  ok(r === 'struck' && g.shots.length === 1 && approx(g.hero.atkCd, 0.7 * 0.55), 'LIGHT press fires one shot and starts the light recovery (rate x 0.55)');
  ok(stepUntil(g, () => e.hp < before), 'the light stone lands');
  ok(approx(before - e.hp, 18 * 0.75), 'LIGHT hit deals lightDmg x basic (18 x 0.75 = 13.5)');
  const g2 = bareBattle('david');
  ok(g2.pressAttack('light') === 'none' && g2.hero.atkCd === 0, 'a press with no target in range is free — no recovery spent on air'); }
{ // AIM: the enemy at the marching hand's tap point is struck before the nearer one
  const g = bareBattle('david');
  spawnFoe(g, g.hero.x + 95, g.hero.y);
  const aimed = spawnFoe(g, g.hero.x + 135, g.hero.y - 10);
  g.hero.tx = aimed.x; g.hero.ty = aimed.y; // the marching hand tapped there
  g.pressAttack('light');
  ok(g.shots.length === 1 && g.shots[0].target === aimed, 'aim priority: the strike goes to the enemy at the tapped point, not the nearest'); }
{ // Samson's hands: LIGHT is instant, HEAVY winds up for real and cleaves
  const g = bareBattle('samson');
  const e = spawnFoe(g, g.hero.x + 50, g.hero.y); e.hp = 1000;
  g.pressAttack('light');
  ok(approx(1000 - e.hp, 30 * 0.75), 'melee LIGHT lands instantly at x0.75 (22.5)');
  const g2 = bareBattle('samson');
  const t = spawnFoe(g2, g2.hero.x + 50, g2.hero.y); t.hp = 1000;
  const by = spawnFoe(g2, t.x + 30, t.y); by.hp = 1000;
  ok(g2.pressAttack('heavy') === 'struck' && t.hp === 1000 && g2.hero.heavyWind > 0, 'HEAVY press starts the wind-up — nothing has landed yet');
  for (let i = 0; i < 4; i++) g2.update(0, 50); // 0.20s < 0.28s wind-up
  ok(t.hp === 1000, 'the heavy has still not landed at 0.20s — the wind-up is real time');
  for (let i = 0; i < 3; i++) g2.update(0, 50); // past 0.28s
  ok(approx(1000 - t.hp, 30 * 2.1) && approx(1000 - by.hp, 30 * 2.1 * 0.5), 'HEAVY lands at x2.1 (63) and CLEAVES the enemy beside the victim at half'); }
{ // HEAVY (ranged): David's heavy stone splashes
  const g = bareBattle('david');
  const t = spawnFoe(g, g.hero.x + 130, g.hero.y); t.hp = 1000;
  const by = spawnFoe(g, t.x + 25, t.y); by.hp = 1000;
  g.pressAttack('heavy');
  ok(stepUntil(g, () => t.hp < 1000), 'the ranged heavy lands after its wind-up and flight');
  ok(approx(1000 - t.hp, 18 * 2.1) && approx(1000 - by.hp, 18 * 2.1), 'ranged HEAVY deals x2.1 and splashes its neighbor in full'); }
{ // ATTACK BUFFER: a press inside the window fires as recovery ends
  const g = bareBattle('david');
  spawnFoe(g, g.hero.x + 120, g.hero.y);
  g.hero.atkCd = 0.1;
  ok(g.pressAttack('light') === 'buffered' && g.hero.atkBuf === 'light', 'attack press inside the recovery window buffers');
  for (let i = 0; i < 3; i++) g.update(0, 50);
  ok(g.shots.length === 1, 'the buffered attack fired the moment the hands were free'); }
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
{ // SPRINT: faster feet, one shared pool, the opener — never behind a guard
  const g = bareBattle('david');
  g.hero.tx = g.hero.x + 400; g.hero.ty = g.hero.y;
  const x0 = g.hero.x; for (let i = 0; i < 20; i++) g.update(0, 50);
  const walk = g.hero.x - x0;
  const g2 = bareBattle('david');
  g2.hero.tx = g2.hero.x + 400; g2.hero.ty = g2.hero.y;
  g2.toggleSprint();
  const x1 = g2.hero.x; for (let i = 0; i < 20; i++) g2.update(0, 50);
  ok(approx((g2.hero.x - x1) / walk, 1.45, 0.75), 'sprint moves the hero at x1.45 (' + Math.round(g2.hero.x - x1) + 'px vs ' + Math.round(walk) + 'px walked)');
  ok(g2.hero.stamina < 95 && g2.hero.sprintT >= 0.2, 'sprinting drains the shared stamina pool and builds opener time');
  const e = spawnFoe(g2, g2.hero.x + 120, g2.hero.y); e.hp = 500; const before = e.hp;
  g2.hero.tx = g2.hero.x; g2.hero.ty = g2.hero.y;
  g2.pressAttack('light');
  ok(stepUntil(g2, () => e.hp < before), 'the opener strike lands');
  ok(approx(before - e.hp, 18 * 0.75 * 1.25) && g2.hero.sprintT === 0, 'the strike out of a sprint is the OPENER (x1.25) and spends the built-up time');
  const g3 = bareBattle('david'); g3.setBlock(true); g3.toggleSprint();
  ok(g3.hero.sprint === false, 'no sprinting behind a raised guard');
  g3.setBlock(false); g3.toggleSprint();
  ok(g3.hero.sprint === true, 'guard down, sprint engages');
  g3.setBlock(true);
  ok(g3.hero.sprint === false && g3.hero.blocking === true, 'raising the guard cancels the sprint — one pool, one posture'); }
{ // THE CLUSTER through the real HUD build: buttons, place, and the tap wall
  const g = bareBattle('david'); g.buildHUD();
  const B = g.fightBtns;
  ok(B && B.light && B.heavy && B.dodge && B.block && B.sprint, 'the fight cluster exists: LIGHT, HEAVY, DODGE, BLOCK, SPRINT');
  ok(B.light.sx > 1000 && B.heavy.sx > 1000 && B.dodge.sx > 1000 && B.block.sx > 1000 && B.sprint.sx > 1000, 'every fight button lives on the right side of the screen');
  ok(g.overFight({ x: 1184, y: 384 }) === true && g.overFight({ x: 400, y: 300 }) === false, 'overFight knows the cluster from the field');
  const tx0 = g.hero.tx, ty0 = g.hero.ty;
  g.onTap({ x: 1184, y: 384, worldX: 1184, worldY: 384 });
  ok(g.hero.tx === tx0 && g.hero.ty === ty0, 'a tap ON the fight cluster does not move the hero — the hands stay separate');
  const e = spawnFoe(g, g.hero.x + 120, g.hero.y); e.hp = 500;
  fireUp(B.light);
  ok(g.shots.length === 1, "the LIGHT button's own press throws the stone");
  fireUp(B.dodge);
  ok(g.hero.dodgeT > 0 || g.hero.iframes > 0, "the DODGE button's own press dashes"); }

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
function champFight(style) { const g = bareBattle();
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
  let steps = 0, pressAt = 0, atkN = 0, strikes = 0;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    g.order = tele ? 'fallback' : 'charge';
    // The fighting hand (Upgrade 8): the hero no longer auto-fires, so the
    // script plays him like a player — a press at most every 0.3s (human
    // cadence), LIGHT LIGHT HEAVY, and a DODGE away when a telegraph
    // appears close and the dash is ready.
    if (tele && g.hero.dodgeCd <= 0 && Math.hypot(g.hero.x - e.x, g.hero.y - e.y) < 220) {
      g.hero.tx = Math.max(40, g.hero.x - 260); g.hero.ty = g.hero.y; g.pressDodge(); }
    else { g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
      g.hero.ty = tele ? g.hero.y : e.y; }
    const tNow = steps * 0.05;
    if (tNow >= pressAt && g.hero.atkCd <= 0) { const kind = (atkN % 3 === 2) ? 'heavy' : 'light';
      if (g.pressAttack(kind) === 'struck') { atkN++; strikes++; pressAt = tNow + 0.3; } }
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b.cd > 0) continue;
      if (style === 'ready') g.useSkill(i);
      else if (g.heldTierOf(b) === 2) g.useSkill(i); }
    g.update(0, 50); steps++; }
  return { g, e, sec: steps * 0.05, strikes }; }
{ const r = champFight('ready');
  ok(r.e.dead, 'READY-ONLY competent play still clears the wave-10 champion (' + r.sec.toFixed(1) + 's of fighting)');
  ok(r.strikes > 10, 'the clear was fought by hand: ' + r.strikes + ' scripted manual strikes (light/heavy presses at 0.3s human cadence)');
  ok(r.g.campHp > 0, '...with the camp standing (' + Math.round(r.g.campHp) + '/' + r.g.campMax + ') — Upgrade 7\'s reachability is unchanged for a no-mastery player');
  ok(r.g.heldSpent[1] === 0 && r.g.heldSpent[2] === 0 && r.g.heldSpent[0] > 0, 'the Ready style truly spent at Ready only (' + r.g.heldSpent[0] + ' casts)');
  const p = champFight('perfect');
  ok(p.e.dead && p.g.campHp > 0, 'PERFECT-saved play also clears the champion (' + p.sec.toFixed(1) + 's) with the camp standing');
  ok(p.g.heldSpent[2] >= 2, 'the Perfect style opened with its saved Perfect moves (' + p.g.heldSpent[2] + ' Perfect casts)');
  ok(p.sec >= r.sec * 0.45, 'Perfect does NOT trivialize the fight: ' + p.sec.toFixed(1) + 's vs Ready ' + r.sec.toFixed(1) + 's (Perfect >= 45% of Ready time)');
  console.log('  [sim] champion clear — Ready-only: ' + r.sec.toFixed(1) + 's, Perfect-saved: ' + p.sec.toFixed(1) + 's, camp Ready ' + Math.round(r.g.campHp) + '/500, camp Perfect ' + Math.round(p.g.campHp) + '/500'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
