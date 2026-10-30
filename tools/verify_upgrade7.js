#!/usr/bin/env node
// Upgrade 7 verification harness. Stubbed Phaser; exercises the REAL boss
// phase logic in js/main.js: phase thresholds and single-fire transitions,
// the escort call (cap, once-only, era defs), telegraph-before-damage for
// both the heavy strike and the ground slam (including the dodge), enrage
// tempo without stat inflation, the champion's camp focus, and a full
// competent-play simulation of the wave-10 champion fight driven through
// the real update() loop (kite the telegraphs, charge between them) —
// the scaling-law check: really hard, skill-only, still reachable.
// No browser is available — telegraph readability on a phone screen and
// the fight's feel need a human pass at the playtest address.
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
const sfx = read('js/sfx.js');
ok(/const BOSS=\{ p2At:2\/3, p3At:1\/3/.test(main), 'BOSS phase table defined (thresholds 2/3 and 1/3 of max HP)');
ok(main.includes('heavyWindup:1.1') && main.includes('slamDelay:1.2') && main.includes('slamRadius:110') && main.includes('escortCount:4'), 'telegraph timings and caps in the table (wind-up 1.1s, slam delay 1.2s, radius 110, escort 4)');
ok(main.includes('if(e.boss&&e.hp>0) this.bossPhaseSync(e);'), 'damage() fires phase sync the instant a threshold is crossed');
ok(main.includes('this.bossTick(dt);'), 'update() passes frame dt to bossTick');
ok(main.includes('bossHeavyStrike(e)') && main.includes('bossSlamImpact(e,s)') && main.includes('bossSummonEscort(e)'), 'heavy strike, slam impact and escort call are real methods');
ok(main.includes('bossAtkRate(e)') && main.includes('bossMoveMul(e)') && /e\.boss\?this\.bossAtkRate\(e\):e\.rate/.test(main), 'enrage tempo flows through helpers at the attack sites (stored stats untouched)');
ok(/bossRoar\(\)\{/.test(sfx) && main.includes('SFX.bossRoar()'), 'phase changes roar through SFX.bossRoar');
ok(main.includes('this.bossFx=this.add.graphics()') && main.includes('bossDrawFx(e)'), 'world-space telegraph layer drawn from live boss state');

// ---------- runtime: stubbed Phaser, real main.js ----------
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
const BOSS = vm.runInContext('BOSS', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
ok(BOSS.heavyMul === 3 && BOSS.slamMul === 2 && BOSS.enrageHeavyMul === 4 && BOSS.enrageSpeedMul === 1.35 && BOSS.enrageRateMul === 0.7, 'BOSS numbers: heavy x3, slam x2, enrage heavy x4 / speed x1.35 / attack period x0.7');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle'].forEach(m => { o[m] = () => o; }); return o; }

// A battle-ready Game without create(): real init() + the fields create()
// would set, so update(), spawn(), damage() and bossTick() all run for real.
function bareBattle() {
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
  GameProto.init.call(g, { hero: 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 0, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: true, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, skillBtns: [], cmdBtns: {}, fx: gfxObj() });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function trackEntries(g) { const entries = []; const orig = GameProto.bossEnterPhase;
  g.bossEnterPhase = function (e, p) { entries.push(p); return orig.call(this, e, p); }; return entries; }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }

// ---------- spawn: phases ride the flattened curve, nothing inflated ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  ok(e.boss && g.boss === e && e.bossPhase === 1 && e.escorted === false && e.heavyWind === 0 && e.slam === null, 'champion spawns in Phase I with clean boss state');
  ok(approx(e.max, IDOL.hp * hpScaleForWave(10) * 5, 0.5), 'champion HP is the curve x5 and nothing more (' + Math.round(e.max) + ')');
  ok(approx(e.dmg, IDOL.dmg * dmgScaleForWave(10) * 1.6, 0.05), 'champion damage is the curve x1.6 and nothing more (' + e.dmg.toFixed(1) + ')');
  ok(approx(e.hp / e.max, 1), 'champion starts at full HP'); }

// ---------- thresholds: single-fire, in order, escort once, monotonic ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10); const entries = trackEntries(g);
  g.damage(e, e.max * 0.33, 'physical');
  ok(e.bossPhase === 1 && entries.length === 0, 'at 67% HP the champion is still Phase I (no early trigger)');
  g.damage(e, e.max * 0.02, 'physical');
  ok(e.bossPhase === 2 && entries.join() === '2', 'crossing 66% enters Phase II exactly once');
  const escorts = g.enemies.filter(x => !x.boss);
  ok(escorts.length === BOSS.escortCount && e.escorted === true, 'Phase II calls exactly ' + BOSS.escortCount + ' escorts');
  ok(escorts.every(x => x.def.id !== 'idol_golem' && !x.def.heals && ['spear', 'infantry', 'ranged'].includes(x.def.role)), 'escorts are era soldiers — no second champion, no healer');
  ok(escorts.every(x => Math.hypot(x.x - e.x, x.y - e.y) < 130), 'escorts arrive at the champion\'s side, not at the map edge');
  g.damage(e, e.max * 0.15, 'physical');
  ok(entries.join() === '2' && g.enemies.filter(x => !x.boss).length === BOSS.escortCount, 'deeper into Phase II: no second call, no extra escorts');
  g.damage(e, e.max * 0.25, 'physical');
  ok(e.bossPhase === 3 && entries.join() === '2,3', 'crossing 33% enters Phase III exactly once');
  e.hp = e.max * 0.95; g.bossPhaseSync(e);
  ok(e.bossPhase === 3 && entries.join() === '2,3' && g.enemies.filter(x => !x.boss).length === BOSS.escortCount, 'a healed champion never un-enrages and never re-calls the escort (monotonic)'); }

// ---------- one huge hit through both lines: lands in Phase III, once each ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10); const entries = trackEntries(g);
  g.damage(e, e.max * 0.8, 'physical');
  ok(e.bossPhase === 3 && entries.join() === '2,3', 'one hit from 100% to 20%: Phase II then III, each exactly once, final phase III');
  ok(g.enemies.filter(x => !x.boss).length === BOSS.escortCount, 'the escort was still called exactly once on the way through'); }

// ---------- enrage: tempo changes, stored stats do not ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  const snap = { dmg: e.dmg, max: e.max, rate: e.rate, speed: e.speed };
  g.damage(e, e.max * 0.8, 'physical');
  ok(g.bossAtkRate(e) === e.rate * BOSS.enrageRateMul && g.bossMoveMul(e) === BOSS.enrageSpeedMul && g.bossHeavyMul(e) === BOSS.enrageHeavyMul, 'Phase III tempo: attack period x0.7, movement x1.35, heavy x4');
  ok(e.dmg === snap.dmg && e.max === snap.max && e.rate === snap.rate && e.speed === snap.speed, 'Phase III inflates NOTHING: dmg/max/rate/speed identical to spawn values'); }

// ---------- heavy strike: telegraph first, dodge works, standing still pays ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  const s = buySquad(g, 'shepherd_militia'); s.x = e.x - 40; s.y = e.y; e.x = 900; e.y = 600; s.x = e.x - 40; s.y = e.y;
  e.heavyT = 0; const hp0 = s.hp;
  g.bossTick(0.05);
  ok(e.heavyWind === BOSS.heavyWindup && s.hp === hp0, 'wind-up begins (1.1s) and NO damage has landed yet');
  for (let i = 0; i < 3; i++) g.bossTick(0.3);
  ok(e.heavyWind > 0 && s.hp === hp0, '0.95s into the wind-up: still telegraphing, still no damage');
  s.x = e.x - 300; // the dodge: out of the ring before it closes
  g.bossTick(0.3);
  ok(e.heavyWind === 0 && s.hp === hp0, 'the strike lands — and the squad that moved takes NOTHING');
  s.x = e.x - 40; e.heavyT = 0; g.bossTick(0.05);
  for (let i = 0; i < 4; i++) g.bossTick(0.3);
  ok(approx(hp0 - s.hp, e.dmg * BOSS.heavyMul, 0.05), 'standing inside the ring pays exactly heavy x3 (' + (hp0 - s.hp).toFixed(1) + ' of ' + hp0 + ' HP)');
  ok(e.heavyT === BOSS.heavyEvery, 'heavy cadence resets to 6s in Phase I'); }

// ---------- slam: the marked circle is safe until it isn't; leaving saves you ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  g.damage(e, e.max * 0.4, 'physical'); // Phase II
  const s = buySquad(g, 'shepherd_militia'); e.x = 900; e.y = 600; s.x = e.x - 100; s.y = e.y;
  e.heavyT = 999; e.slamT = 0; const hp0 = s.hp;
  g.bossTick(0.05);
  ok(!!e.slam && e.slam.t === BOSS.slamDelay && s.hp === hp0, 'slam telegraph drawn at the prey (1.2s) — no damage yet');
  for (let i = 0; i < 3; i++) g.bossTick(0.3);
  ok(!!e.slam && s.hp === hp0, '0.95s into the telegraph: circle marked, squad still untouched');
  s.x = e.x - 400; // out of the circle
  g.bossTick(0.3);
  ok(e.slam === null && s.hp === hp0, 'impact — the squad that left the circle takes NOTHING');
  s.x = e.slam ? s.x : e.x - 100; e.slamT = 0; g.bossTick(0.05);
  const sx = e.slam.x, sy = e.slam.y; s.x = sx; s.y = sy;
  for (let i = 0; i < 4; i++) g.bossTick(0.3);
  ok(e.slam === null && approx(hp0 - s.hp, e.dmg * BOSS.slamMul, 0.05), 'standing in the marked circle at impact pays exactly slam x2 (' + (hp0 - s.hp).toFixed(1) + ')'); }

// ---------- camp focus: the champion marches on the camp, and freezes mid wind-up ----------
{ const g = bareBattle(); const e = spawnChamp(g, 10);
  g.hero.down = 1e9; // no defender on the road: the camp is the prize
  const x0 = e.x; let froze = false, campHurt = false, steps = 0;
  while (steps < 2400 && !g.over && !e.dead && !(froze && campHurt)) { const px = e.x, pw = e.heavyWind; g.update(0, 50); steps++;
    // the freeze invariant: on any frame the wind-up was ALREADY running
    // when the frame began (the ring is on screen), the champion cannot move
    if (pw > 0 && e.heavyWind > 0 && approx(e.x, px, 0.001)) froze = true;
    if (g.campHp < 500) campHurt = true; }
  ok(e.x < x0 - 300, 'undefended, the champion marches on the camp (' + Math.round(x0) + ' -> ' + Math.round(e.x) + ')');
  ok(campHurt, 'the champion reaches and damages the camp (camp ' + Math.round(g.campHp) + '/500)');
  ok(froze, 'during a wind-up the champion stands committed — its position does not move'); }

// ---------- reachability by the numbers (waves 20/30 use the same laws) ----------
{ const heroHp = 200; // David, unperked — the plainest hero on the roster
  [10, 20, 30].forEach(w => { const d = IDOL.dmg * dmgScaleForWave(w) * 1.6;
    ok(d * BOSS.enrageHeavyMul < heroHp, 'wave ' + w + ': even an ENRAGED heavy (' + Math.round(d * BOSS.enrageHeavyMul) + ') cannot one-shot a full hero (' + heroHp + ') — dodge or live, by design'); }); }

// ---------- competent play: the wave-10 champion fight, real update() loop ----------
// A plausible wave-10 army (8 squads, upgraded, ~run earnings) plus David.
// The script plays the skill the design asks for: CHARGE between telegraphs,
// FALL BACK the moment a wind-up or slam mark appears, hero kiting at
// sling range on the camp side. No skills, no orbs, no camp upgrades —
// if this wins, the fight is reachable on mechanics alone.
{ const g = bareBattle();
  buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']);
  buySquad(g, 'benjamite_archer', ['drill1', 'drill2']);
  buySquad(g, 'mighty_man', ['drill1']);
  buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']);
  buySquad(g, 'spearman_wall');
  buySquad(g, 'slinger_elah', ['swift']);
  buySquad(g, 'levite_healer');
  buySquad(g, 'shepherd_militia', ['veteran']);
  const armyDps = g.squads.reduce((a, s) => a + s.dmg / s.rate, 0) + g.heroDef.dmg / g.heroDef.rate;
  const e = spawnChamp(g, 10);
  ok(armyDps > 140 && e.max / armyDps < 25, 'paper check: army DPS ' + Math.round(armyDps) + ' kills the champion in ~' + Math.round(e.max / armyDps) + 's of full contact');
  let steps = 0, maxPhase = 1;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    g.order = tele ? 'fallback' : 'charge';
    g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
    g.hero.ty = tele ? g.hero.y : e.y;
    g.update(0, 50); steps++;
    if (e.bossPhase > maxPhase) maxPhase = e.bossPhase; }
  ok(e.dead, 'competent play KILLS the wave-10 champion (' + (steps / 20).toFixed(0) + 's of fighting)');
  ok(g.campHp > 0, '...and the camp still stands (' + Math.round(g.campHp) + '/' + g.campMax + ' HP)');
  ok(maxPhase === 3, 'the fight passed through all three phases (escort faced, enrage survived)'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
