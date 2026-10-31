#!/usr/bin/env node
// Upgrade 14 verification harness — THE LAST PIECES. Stubbed Phaser,
// REAL main.js, in the Upgrade 7 harness pattern:
//  - Endless champions: the cadence (every 10th endless wave, never in
//    a non-endless run past the goal, goal wave unchanged), the endless
//    name plate, spawn stats exactly on the flattened curve, and
//    competent-play kills at endless 30 and 60 with the camp standing.
//  - Hero identities (ERA-IDEAS): Deborah's song over the field — the
//    enemy line advances at 0.92 under her, at 1.0 under David, proved
//    in the movement integrator itself. Samson stands alone — his
//    basic blows land x1.5 with no living squad within 240px, x1.0
//    with one at his side, proved through heroAutoFire's real damage.
//  - Weekly twists: the calendar (deterministic week index, Monday
//    rollover, strict alternation), Night of the Torches (an odd wave
//    is a night wave, spawns march at x1.15, a ranged squad reaches
//    1.25x — and a plain night stays 1.08 / 1.1), and the Seventh Day
//    (wave 7's spawn holds back the full ten seconds while exactly
//    the twist's manna rains; wave 8 waits for nothing).
// No browser is available — telegraph readability, the twists' feel
// and the heroes' presence on a real screen need a human pass.
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
ok(main.includes('const ENDLESS_CHAMP_EVERY=10'), 'endless champion cadence constant (every 10 waves)');
ok(main.includes('ENDLESS CHAMPION'), 'the endless champion is named on its plate');
ok(main.includes('deborahSongAdvance:0.92') && main.includes('samsonAloneRange:240') && main.includes('samsonAloneDmgMul:1.5'), 'HEROISM table: song 0.92, alone range 240, alone damage x1.5');
ok(main.includes('torchRangeMul:1.25') && main.includes('torchEnemySpd:1.15') && main.includes('seventhEvery:7') && main.includes('seventhRest:10') && main.includes('seventhMannaPerSec:15'), 'TWIST table: torches 1.25/1.15, seventh day 7/10s/15 per sec');
ok(main.includes("name:'Night of the Torches'") && main.includes("name:'The Seventh Day'"), 'both decided twists are in the rotation, names played straight');
ok(main.includes('This week in the Bible era:') && /This week\\'s law:/.test(main), 'the twist is named on the era screen and again on the run screen');
ok(main.includes('this.enemySpdMul()') && main.includes('hd.dmg*this.heroDmgMul()'), 'the passives flow through real sites (enemy movement, hero auto-fire) — no parallel systems');

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
const GameProto = vm.runInContext('Game.prototype', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const weekIndex = vm.runInContext('weekIndex', ctx);
const twistForWeek = vm.runInContext('twistForWeek', ctx);
const currentTwist = vm.runInContext('currentTwist', ctx);
const HEROISM = vm.runInContext('HEROISM', ctx);
const TWIST = vm.runInContext('TWIST', ctx);
const ORBS = vm.runInContext('ORBS', ctx);
const DATA = vm.runInContext('DATA', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
const LOCUST = UNITS.bible.enemy.find(e => e.id === 'locust_swarm');
const PEBBLE = UNITS.bible.enemy.find(e => e.id === 'pebble_golem');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true };
  ['setDepth', 'setOrigin', 'setAlpha', 'setVisible', 'setScrollFactor', 'setScale', 'setFlipX', 'setPosition', 'setSize', 'setInteractive', 'setTint', 'clearTint', 'setTintFill', 'setStrokeStyle', 'setColor'].forEach(m => { o[m] = () => o; });
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle'].forEach(m => { o[m] = () => o; }); return o; }

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
  g.scene = { start() {} };
  GameProto.init.call(g, { hero: heroId || 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 0, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: true, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, skillBtns: [], cmdBtns: {}, fx: gfxObj(), shopItems: [], campItems: [] });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
// The deep roster: the strongest eight the shop's own ladder sells,
// fully upgraded, POSTED along the road (Upgrade 9's posted play — a
// prepared run meets its champion where it chooses, it does not march
// out of the camp gate to find him). This replaces the wave-10 eight
// for the deep sims: with the wave-10 kit the endless-30 fight is a
// coin flip and endless 60 is a loss, which says something true about
// the kit, not about the wave (see BUILD-NOTES, Upgrade 14).
const DEEP_POSTS = { gate_shieldbearer: [1000, 520], temple_guard: [1000, 680], swordsman_gideon: [1060, 600], mighty_man: [940, 600], levite_spearman: [1120, 540], benjamite_archer: [1120, 660], watchman_bowman: [880, 560], sling_veteran: [880, 640] };
function deepArmy(g) { [['gate_shieldbearer', ['bulwark2']], ['temple_guard', ['drill1']], ['swordsman_gideon', ['drill1', 'drill2']], ['mighty_man', ['drill1']], ['levite_spearman', ['drill1']], ['benjamite_archer', ['drill1', 'drill2']], ['watchman_bowman', ['drill1']], ['sling_veteran', []]]
  .forEach(([id, ups]) => { const s = buySquad(g, id, ups); const p = DEEP_POSTS[id]; if (p) { s.x = p[0]; s.y = p[1]; s.post = { x: s.x, y: s.y }; } }); }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
// The Upgrade 7 competent-play script: CHARGE between telegraphs, FALL
// BACK the moment a wind-up or slam mark appears, hero kiting at sling
// range. opts.skills casts the hero's powers as they come ready (the
// ult held to opts.ultTier — patience is power, Upgrade 8's own law);
// opts.orbs plays the orb economy a deep run actually holds: Strength
// kept up, Thunder on its cooldown, Mending whenever a squad falls
// below 55% — each buy a real applyOrb at the orb's real price, the
// total reported, not hidden.
function simFight(g, e, maxSteps, opts) { opts = opts || {}; let steps = 0, maxPhase = 1, mendCd = 0, thunCd = 0, orbSpent = 0;
  const orb = id => ({ def: ORBS.find(o => o.id === id) });
  if (opts.orbs) { g.applyOrb(orb('strength')); orbSpent += ORBS[0].cost; }
  while (steps < maxSteps && !e.dead && g.campHp > 0) { mendCd -= 0.05; thunCd -= 0.05;
    const tele = e.heavyWind > 0 || !!e.slam;
    const want = tele ? 'fallback' : 'charge';
    if (g.__u9ord !== want) { g.__u9ord = want; g.selSquad = null; g.giveOrder(want); }
    if (opts.skills) for (let i = 0; i < 3; i++) { const b = g.skillBtns[i]; if (!b || b.cd > 0) continue; if (i < 2 || g.heldTierOf(b) >= (opts.ultTier || 0)) g.useSkill(i); }
    if (opts.orbs) { if (mendCd <= 0 && g.squads.some(s => !s.dead && s.hp < s.max * 0.55)) { g.applyOrb(orb('mending')); mendCd = 15; orbSpent += ORBS[2].cost; }
      if (thunCd <= 0) { g.applyOrb(orb('thunder')); thunCd = 15; orbSpent += ORBS[4].cost; }
      if (g.buffStrT <= 0) { g.applyOrb(orb('strength')); orbSpent += ORBS[0].cost; } }
    g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
    g.hero.ty = tele ? g.hero.y : e.y;
    g.update(0, 50); steps++;
    if (e.bossPhase > maxPhase) maxPhase = e.bossPhase; }
  return { steps, maxPhase, orbSpent }; }
// Real power buttons for a sim hero, in the shape buildFightControls
// makes them (update() and useSkill() read exactly these fields).
function armSkills(g) { g.skillBtns = [...g.heroDef.skills, g.heroDef.ult].map(k => ({ def: k, cd: 0, cdMax: k.cd, held: 0, _tierShown: 0, buffered: false, readyPulse: 0, sx: 0, sy: 0, sw: 100, sh: 50, label: mkObj(), sweep: gfxObj(), alpha: 1 })); }

// ---------- the roster itself: both heroes stand, Bible-themed ----------
{ const deb = DATA.heroes.find(h => h.id === 'deborah'), sam = DATA.heroes.find(h => h.id === 'samson');
  ok(!!deb && deb.theme === 'bible' && !!sam && sam.theme === 'bible', 'Deborah and Samson stand on the roster as Bible heroes (selectable for a Bible run)');
  ok(deb.skills.some(k => k.id === 'palm') && deb.ult.id === 'song', 'Deborah carries Judgment Palm and the Song of Deborah');
  ok(sam.skills.some(k => k.id === 'jaw') && sam.ult.id === 'pillars', 'Samson carries Jawbone Cleave and Pillar Pull'); }

// ---------- the twist calendar: deterministic, weekly, alternating ----------
{ const mon = new Date(2026, 9, 26), sun = new Date(2026, 9, 25), wed = new Date(2026, 9, 28);
  ok(weekIndex(mon) === weekIndex(mon) && weekIndex(mon) === weekIndex(wed), 'one calendar week, one index (Mon and Wed of the same week agree)');
  ok(weekIndex(mon) - weekIndex(sun) === 1, 'the index rolls over on Monday (Sun -> Mon is +1)');
  const a = twistForWeek(100), b = twistForWeek(101), c = twistForWeek(102);
  ok(a.id !== b.id && c.id === a.id && [a.id, b.id].sort().join() === 'seventh,torches', 'the rotation strictly alternates the two decided twists');
  ok(['torches', 'seventh'].includes(currentTwist().id), 'today\'s law is one of the two'); }

// ---------- endless cadence: the queue itself tells the truth ----------
function bossFlagsAt(wave, endless) { const g = bareBattle('david'); g.endless = endless; g.wave = wave - 1; g.spawnQ = []; g.startWave();
  return g.spawnQ.filter(q => q.boss); }
{ ok(bossFlagsAt(10, false).length === 1, 'goal wave 10 (not endless): exactly one champion — the old law intact');
  ok(bossFlagsAt(20, false).length === 0, 'wave 20 reached WITHOUT endless: no champion (endless is a mode, not a wave number)');
  const f20 = bossFlagsAt(20, true);
  ok(f20.length === 1 && f20[0].def.id === 'idol_golem', 'endless wave 20: exactly one champion, the era\'s own golem');
  ok(bossFlagsAt(21, true).length === 0 && bossFlagsAt(25, true).length === 0, 'endless waves 21 and 25: no champion — the heartbeat is every ten, not every wave');
  ok(bossFlagsAt(30, true).length === 1, 'endless wave 30: the champion rises again'); }

// ---------- the endless champion: plate and curve ----------
{ const g = bareBattle('david'); g.endless = true; const e = spawnChamp(g, 30);
  ok(g.bossName._t.includes('ENDLESS CHAMPION') && g.bossName._t.includes('30'), 'endless plate reads ENDLESS CHAMPION · WAVE 30 ("' + g.bossName._t + '")');
  ok(approx(e.max, IDOL.hp * hpScaleForWave(30) * 5, 0.5) && approx(e.dmg, IDOL.dmg * dmgScaleForWave(30) * 1.6, 0.05), 'endless champion stats are the curve x5 / x1.6 and nothing more (' + Math.round(e.max) + ' HP, ' + e.dmg.toFixed(1) + ' dmg)');
  const g2 = bareBattle('david'); const e2 = spawnChamp(g2, 10);
  ok(g2.bossName._t.includes('GOAL-WAVE CHAMPION'), 'the goal-wave plate is unchanged when the run is not endless'); }

// ---------- the numbers stay honest at depth ----------
{ const heroHp = 200;
  const heavyAt = w => IDOL.dmg * dmgScaleForWave(w) * 1.6 * 4; // enraged heavy, worst case
  ok(heavyAt(30) < heroHp, 'endless 30: even the enraged heavy (' + Math.round(heavyAt(30)) + ') cannot one-shot a full unperked hero (' + heroHp + ')');
  ok(heavyAt(60) <= heroHp + 1 && heavyAt(60) * 0.55 < heroHp, 'endless 60: the enraged heavy (' + Math.round(heavyAt(60)) + ') meets a bare hero\'s full HP exactly — and a held block answers it at ' + Math.round(heavyAt(60) * 0.55) + ', before mastery HP and the dodge are counted (the edge is documented, not hidden)'); }

// ---------- competent play at endless 30 and 60 ----------
{ const g = bareBattle('david'); g.endless = true; deepArmy(g);
  const e = spawnChamp(g, 30); e.x = 1300; e.y = 600; // met on the camp road, where the posted line chose to meet him
  const r = simFight(g, e, 7200);
  ok(e.dead, 'competent play KILLS the endless-30 champion (' + (r.steps / 20).toFixed(0) + 's of fighting, no skills, no orbs — orders and steel)');
  ok(g.campHp > 0, '...and the camp still stands at endless 30 (' + Math.round(g.campHp) + '/' + g.campMax + ')');
  ok(r.maxPhase === 3, 'the endless-30 fight passed through all three phases'); }
{ const g = bareBattle('david'); g.endless = true; deepArmy(g);
  // A wave-60 run does not field a wave-10 kit. What it honestly holds:
  // Fortify III (a between-wave purchase), a max-mastery hero (the
  // game's own +2% damage and HP per mastery level, ten levels), powers
  // cast as they come ready with the ult held to Tempered, and the orb
  // economy (Strength kept up, Thunder on cooldown, Mending when the
  // line bleeds) — every orb a real applyOrb at its real price.
  g.campMax = 1100; g.campHp = 1100;
  g.heroDef.dmg *= 1.2; g.heroDef.hp = 240; g.hero.hp = 240;
  armSkills(g);
  const e = spawnChamp(g, 60); e.x = 1300; e.y = 600;
  const r = simFight(g, e, 16000, { skills: true, ultTier: 1, orbs: true });
  ok(e.dead, 'competent deep play KILLS the endless-60 champion (' + (r.steps / 20).toFixed(0) + 's of fighting, ' + r.orbSpent + ' Grokonians of orbs spent)');
  ok(g.campHp > 0, '...and the fortified camp still stands at endless 60 (' + Math.round(g.campHp) + '/' + g.campMax + ')');
  ok(r.maxPhase === 3, 'the endless-60 fight passed through all three phases'); }

// ---------- Samson: strength alone, proved through his own blows ----------
{ vm.runInContext('Math.random = () => 0.99', ctx); // no crits: the multiplier reads clean
  const g = bareBattle('samson'); g.waveHpM = 1; g.waveDmM = 1;
  ok(g.samsonAlone() === true && approx(g.heroDmgMul(), HEROISM.samsonAloneDmgMul), 'no squads at all: Samson stands alone, blows at x1.5');
  const foe = g.spawn({ def: PEBBLE, at: 0, boss: false }); foe.x = g.hero.x + 50; foe.y = g.hero.y;
  const hp0 = foe.hp; g.hero.cd = 0; g.heroAutoFire();
  ok(approx(hp0 - foe.hp, 30 * 1.5, 0.05), 'his blow lands for exactly 30 x 1.5 = ' + (hp0 - foe.hp).toFixed(1) + ' (flesh takes physical whole)');
  const s = buySquad(g, 'shepherd_militia'); s.x = g.hero.x + 40; s.y = g.hero.y;
  ok(g.samsonAlone() === false && approx(g.heroDmgMul(), 1), 'a squad at his side: the standing ends, blows back to x1.0');
  const hp1 = foe.hp; g.hero.cd = 0; g.heroAutoFire();
  ok(approx(hp1 - foe.hp, 30, 0.05), 'the accompanied blow lands for exactly 30 (' + (hp1 - foe.hp).toFixed(1) + ')');
  s.x = g.hero.x + 300;
  ok(g.samsonAlone() === true, 'the squad beyond 240px: he stands alone again');
  s.x = g.hero.x + 40; s.dead = true;
  ok(g.samsonAlone() === true, 'a FALLEN squad at his side does not break the standing — alone is counted among the living');
  const g2 = bareBattle('david');
  ok(g2.samsonAlone() === false && approx(g2.heroDmgMul(), 1), 'the standing is Samson\'s alone: David\'s multiplier is untouched'); }

// ---------- Deborah: the song over the field, in the integrator ----------
function marchDistance(heroId) { const g = bareBattle(heroId); g.waveHpM = 1; g.waveDmM = 1; g.hero.down = 1e9; // no defender on the road
  const e = g.spawn({ def: LOCUST, at: 0, boss: false }); e.x = 1500; e.y = 600;
  const x0 = e.x; for (let i = 0; i < 40; i++) g.update(0, 50); return x0 - e.x; }
{ const g = bareBattle('deborah');
  ok(approx(g.enemySpdMul(), HEROISM.deborahSongAdvance), 'under Deborah, enemySpdMul is the song: 0.92');
  const dD = marchDistance('david'), dB = marchDistance('deborah');
  ok(approx(dD, LOCUST.speed * 2, LOCUST.speed * 0.06), 'under David the line advances at full pace (' + dD.toFixed(1) + 'px in 2s)');
  ok(approx(dB / dD, HEROISM.deborahSongAdvance, 0.03), 'under Deborah the SAME line advances at 0.92 of it (' + dB.toFixed(1) + 'px — the song slows the enemy line)'); }

// ---------- Night of the Torches ----------
{ const g = bareBattle('david'); g.twist = 'torches'; ok(g.isNightWave(1) === true && g.isNightWave(3) === true, 'under the Torches, even odd waves are night waves');
  g.wave = 0; g.startWave();
  ok(g.wave === 1 && g.waveNight === true && !!g.nightRect, 'wave 1 opens as a night wave — shade drawn, state set');
  const e = g.spawn({ def: LOCUST, at: 0, boss: false });
  ok(approx(e.speed, LOCUST.speed * TWIST.torchEnemySpd, 0.05), 'the enemy marches faster under the Torches: x1.15 at spawn (' + e.speed.toFixed(1) + ')');
  const g2 = bareBattle('david'); g2.wave = 1; g2.startWave();
  ok(g2.wave === 2 && g2.waveNight === true, 'a plain night is still a night (wave 2, no twist)');
  const e2 = g2.spawn({ def: LOCUST, at: 0, boss: false });
  ok(approx(e2.speed, LOCUST.speed * 1.08, 0.05), '...and its enemy speed stays the plain night x1.08 — the twist did not leak into nature');
  const g3 = bareBattle('david'); g3.wave = 0; g3.startWave();
  ok(g3.waveNight === false && !g3.nightRect, 'a plain day stays day'); }
{ // ranged reach, proved by a slinger's shot: the enemy stands at 175px —
  // beyond a day slinger's 150, inside the Torches' 187.5.
  function slingerFires(twist) { const g = bareBattle('david'); g.twist = twist; g.wave = 1; g.waveHpM = 1; g.waveDmM = 1;
    const s = buySquad(g, 'shepherd_slinger'); s.x = 500; s.y = 600; s.post = { x: 500, y: 600 };
    const e = g.spawn({ def: LOCUST, at: 0, boss: false }); e.x = 675; e.y = 600;
    g.update(0, 50); return g.shots.length; } // ONE frame: a posted squad guard-approaches intruders, so the first frame is the honest read of her reach
  ok(slingerFires('torches') > 0, 'under the Torches, the slinger reaches the enemy at 175px and looses');
  ok(slingerFires(null) === 0, 'on a plain day, the same enemy at the same distance is beyond her — no shot'); }

// ---------- The Seventh Day ----------
{ const g = bareBattle('david'); g.twist = 'seventh'; g.coinT = 9999; g.wave = 6; g.startWave();
  ok(g.wave === 7 && g.seventhT === TWIST.seventhRest, 'wave 7 opens in rest: the Seventh Day clock is set');
  ok(g.spawnQ.length > 0 && g.spawnQ.every(q => q.at >= TWIST.seventhRest), 'the WHOLE spawn holds back — earliest enemy at ' + Math.min(...g.spawnQ.map(q => q.at)).toFixed(1) + 's, nothing sooner');
  for (let i = 0; i < 200; i++) g.update(0, 50); // ten seconds of rest
  ok(g.enemies.length === 0, 'ten seconds in, the field is still empty — rest is rest');
  ok(g.manna >= 148 && g.manna <= 150, 'manna rained at the twist\'s rate: ' + g.manna + ' across the rest (15/s x 10s = 150, whole-manna steps)');
  ok(g.seventhT === 0, 'the rest is spent — the wave may now come');
  const g2 = bareBattle('david'); g2.twist = 'seventh'; g2.wave = 7; g2.startWave();
  ok(g2.wave === 8 && g2.seventhT === 0 && Math.min(...g2.spawnQ.map(q => q.at)) < 2, 'wave 8 keeps no Sabbath: it spawns on the old clock, first enemy inside 2s'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
