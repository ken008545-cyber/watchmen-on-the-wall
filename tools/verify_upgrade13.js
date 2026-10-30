#!/usr/bin/env node
// Upgrade 13 verification harness — THE SOUND PASS. kennin's ruling:
// "oomph the sound up" — distinct, layered attack sounds per weapon,
// signature sounds for the named powers, voices for the field (golems,
// the priest, the fallen), camp threshold drums, and ONE master volume
// the player owns in Controls.
// (1) statics — the new SFX surface exists, every legacy voice survives,
//     music.js is untouched by the pass, and main.js wires every family;
// (2) sfx runtime — a recording AudioContext stub: each family schedules
//     the expected oscillators/noise, hero > squad in the mix, impacts
//     scale with damage, the polyphony gate caps bursts and drops the
//     quietest first, the boss warning is scheduled BEFORE the boom,
//     volume persists and reaches the master gain, and nothing throws
//     with audio locked, absent, or broken;
// (3) main integration — the real battle calls the real SFX: hero melee,
//     a golem's groan and crumble, camp drums at first/half/quarter,
//     Psalm's chord and the Five Stones' five strikes;
// (4) the competent-play sim (copied from U12): the sound pass changed
//     no number in the game — ~32.5s, camp 500/500.
// No browser exists here: how it FEELS in the ear is kennin's pass.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0;
function ok(cond, label) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 0.01);

// ---------- recording AudioContext stub ----------
class FakeParam { constructor(v) { this.value = v; this.events = []; }
  setValueAtTime(v, t) { this.events.push(['set', v, t]); this.value = v; }
  exponentialRampToValueAtTime(v, t) { this.events.push(['exp', v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.events.push(['lin', v, t]); this.value = v; }
  setTargetAtTime(v, t) { this.events.push(['tgt', v, t]); this.value = v; } }
class FakeCtx { constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running';
    this.destination = { kind: 'dest' }; this.oscs = []; this.noises = []; this.gains = []; this.filters = [];
    FakeCtx.instances.push(this); }
  createGain() { const g = { kind: 'gain', gain: new FakeParam(1), connectedTo: null, connect(n) { this.connectedTo = n; return n; }, disconnect() {} }; this.gains.push(g); return g; }
  createOscillator() { const o = { kind: 'osc', type: 'sine', frequency: new FakeParam(440), detune: new FakeParam(0), startedAt: null, connect(n) { this.connectedTo = n; return n; }, start(t) { this.startedAt = t; }, stop(t) { this.stoppedAt = t; } }; this.oscs.push(o); return o; }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(Math.max(1, len | 0)) }; }
  createBufferSource() { const s = { kind: 'src', buffer: null, startedAt: null, connect(n) { this.connectedTo = n; return n; }, start(t) { this.startedAt = t; } }; this.noises.push(s); return s; }
  createBiquadFilter() { const f = { kind: 'filter', type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1), connect(n) { this.connectedTo = n; return n; } }; this.filters.push(f); return f; }
  resume() { this.state = 'running'; } }
FakeCtx.instances = [];
function snap(inst) { return { o: inst.oscs.length, n: inst.noises.length, g: inst.gains.length, f: inst.filters.length }; }
function peakSince(inst, s) { let p = 0; for (let i = s.g; i < inst.gains.length; i++) for (const e of inst.gains[i].gain.events) if (e[0] === 'exp') p = Math.max(p, e[1]); return p; }

// ---------- statics ----------
const main = read('js/main.js'), sfx = read('js/sfx.js'), music = read('js/music.js');
['atkMelee', 'atkBlunt', 'atkSling', 'atkBow', 'atkSpear', 'impact', 'exert', 'golemSpawn', 'golemGroan', 'golemDie',
 'priestChant', 'allyDie', 'heroDown', 'psalm', 'fiveStones', 'smoothStone', 'bossWarn', 'bossBoom', 'campAlarm',
 'setVolume', 'volume'].forEach(m => ok(new RegExp(m + '\\(').test(sfx), 'SFX has ' + m + ' (Upgrade 13)'));
['unlock', 'toggle', 'sling', 'fire', 'trumpet', 'cloud', 'hit', 'die', 'enemyHit', 'enemyDie', 'enemyAttack',
 'campHit', 'campWarning', 'coinPickup', 'orbBuy', 'orbDrink', 'ready', 'build', 'leak', 'stomp', 'bossRoar',
 'skill', 'ult', 'wave', 'win', 'lose'].forEach(m => ok(sfx.includes(m + '(') || sfx.includes(m + ':'), 'legacy voice kept: SFX.' + m));
ok(sfx.includes("VOL_KEY='gxhub_wotw_sound'") && sfx.includes('createGain') && sfx.includes('master.connect'), 'one master gain, fed by the persisted gxhub_wotw_sound setting');
ok(music.includes("KEY='gxhub_wotw_music'") && music.includes('startPad') && !music.includes('gxhub_wotw_sound'), "music.js untouched by the pass — the pad and its own key stand");
ok(main.includes('SFX.atkMelee(true)') && main.includes('SFX.atkSling(true)') && main.includes('SFX.atkBow(true)'), 'hero auto-fire speaks with his own heavier weapons');
ok(main.includes('squadAtkSfx(s)') && main.includes("if(/archer|bowman/.test(d.id)) SFX.atkBow(false); else SFX.atkSling(false);"), 'squads attack by weapon: bows for archers, slings for the rest, spears and swings by role');
ok(main.includes('SFX.enemyHit(amt)') && main.includes('SFX.golemGroan()'), 'damage() passes its amount to the impact, and golems groan');
ok(main.includes('SFX.golemDie()') && main.includes('SFX.allyDie()') && main.includes('SFX.heroDown()'), 'the fallen fall per side: golem crumble, ally fall, hero down');
ok(main.includes('SFX.golemSpawn()') && main.includes('SFX.priestChant()') && main.includes('SFX.enemyAttack(e)'), 'the field has voices: golem rumble at spawn, the priest chanting his heals, attackers passed to their sound');
ok(main.includes('SFX.bossWarn(BOSS.heavyWindup)') && main.includes('SFX.bossWarn(BOSS.slamDelay)'), 'both telegraphs get the rising warning, timed to the telegraph itself');
ok(main.includes('SFX.bossBoom(1)') && main.includes('SFX.bossBoom(1.2)'), 'heavy strike and slam land with the boom, the slam scaled up');
ok(main.includes('SFX.campAlarm(1)') && main.includes('SFX.campAlarm(2)') && main.includes('SFX.campAlarm(3)') && main.includes('campSndFirst'), 'camp threshold drums: first blood, half, quarter — each once per run');
ok(main.includes('SFX.psalm()') && main.includes('SFX.fiveStones()') && main.includes('SFX.smoothStone()'), 'the named powers carry their signatures (Psalm, Five Stones, Smooth Stone)');
ok(main.includes("k.id!=='five'&&k.id!=='psalm'&&k.id!=='stone'") && main.includes("if(k.id!=='five') SFX.ult()"), 'the generic skill chirp steps aside for the signatures; other ults keep the ult sound');
ok(main.includes('refreshSnd()') && main.includes('SFX.setVolume((SFX.volume()||0)-25)') && main.includes('SFX.setVolume((SFX.volume()||0)+25)'), 'Controls carries the sound setting: Quieter/Louder steps and a live readout');

// ---------- sfx runtime: a recording studio ----------
function sfxContext(store, AC) { let nowMs = 0;
  const c = { console, setTimeout, clearInterval, setInterval, performance: { now: () => nowMs },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  if (AC) c.AudioContext = AC;
  c.window = c; vm.createContext(c);
  vm.runInContext(read('js/sfx.js'), c, { filename: 'sfx.js' });
  return { ctx: c, SFX: c.window.SFX, advance: ms => { nowMs += ms; }, inst: () => FakeCtx.instances[FakeCtx.instances.length - 1] }; }

{ const store = {}; const S = sfxContext(store, FakeCtx); const SFX = S.SFX;
  ok(SFX.volume() === 100, 'a fresh profile starts at full sound (100)');
  SFX.unlock(); const inst = S.inst();
  ok(inst && inst.gains.length >= 1 && inst.gains[0].connectedTo === inst.destination && approx(inst.gains[0].gain.value, 1), 'unlock builds the master gain at full level, wired to the destination');
  // each attack kind schedules its layers; the hero outweighs his squads
  const fam = [['atkMelee', 3], ['atkBlunt', 3], ['atkSling', 3], ['atkBow', 3], ['atkSpear', 2]];
  for (const [m, min] of fam) { S.advance(150); const s0 = snap(inst); SFX[m](false);
    ok((inst.oscs.length - s0.o) + (inst.noises.length - s0.n) >= min, m + ' schedules its layers (' + min + '+ voices)'); }
  S.advance(150); let s0 = snap(inst); SFX.atkMelee(true); const heroPeak = peakSince(inst, s0);
  S.advance(150); s0 = snap(inst); SFX.atkMelee(false); const squadPeak = peakSince(inst, s0);
  ok(heroPeak > squadPeak * 1.8, 'the hero\'s melee outweighs a squad\'s (' + heroPeak.toFixed(2) + ' vs ' + squadPeak.toFixed(2) + ')');
  // impacts scale with the blow
  S.advance(150); s0 = snap(inst); SFX.enemyHit(3); const small = peakSince(inst, s0);
  S.advance(150); s0 = snap(inst); SFX.enemyHit(60); const big = peakSince(inst, s0);
  ok(big > small * 1.8, 'impact scales with damage: a 60-damage thock (' + big.toFixed(2) + ') dwarfs a 3-damage tick (' + small.toFixed(2) + ')');
  // the gate: a burst is capped, and a louder voice evicts a quieter one
  S.advance(150); s0 = snap(inst);
  for (let i = 0; i < 20; i++) SFX.atkMelee(false);
  const passed = (inst.oscs.length - s0.o) / 2;
  ok(passed === 6, 'polyphony gate: 20 simultaneous squad swings admit exactly the family cap of 6 (got ' + passed + ')');
  const s1 = snap(inst); SFX.atkMelee(true);
  ok(inst.oscs.length - s1.o === 2, 'quietest-first: a hero-weight swing still enters a full window, evicting the quietest');
  S.advance(150); const s2 = snap(inst); SFX.atkMelee(false);
  ok(inst.oscs.length - s2.o === 2, 'the window slides: 150ms later the family speaks again');
  // voices of the field
  S.advance(300); s0 = snap(inst); SFX.golemSpawn();
  ok(inst.oscs.length - s0.o === 2 && inst.noises.length - s0.n === 1, 'golemSpawn: two low oscillators and a rumble of noise');
  s0 = snap(inst); SFX.priestChant();
  ok(inst.oscs.length - s0.o === 3 && inst.oscs.slice(s0.o).some(o => approx(o.frequency.value, 196, 1)), 'priestChant: three detuned sines beating against each other (196Hz among them)');
  s0 = snap(inst); SFX.priestChant();
  ok(inst.oscs.length - s0.o === 0, 'the chant is throttled — it breathes between heals, it does not loop');
  S.advance(150); s0 = snap(inst); for (let i = 0; i < 10; i++) SFX.allyDie();
  ok(inst.oscs.length - s0.o === 8, 'voice family cap: ten falls at once sound as four (8 oscillators), never a pile-up');
  s0 = snap(inst); SFX.enemyAttack({ def: { id: 'idol_golem', sprite: 'golem' } });
  ok(inst.oscs.slice(s0.o).some(o => approx(o.frequency.events[0][1], 92, 2)), 'a golem attacker lands with its fist (the 92Hz boom), not the generic grunt');
  // power signatures
  S.advance(300); s0 = snap(inst); SFX.psalm();
  ok(inst.oscs.length - s0.o === 8 && inst.oscs.slice(s0.o).some(o => approx(o.frequency.value, 261.63, 0.5)), 'Psalm: a four-sine chord (C4 among them) plus four climbing plucks');
  s0 = snap(inst); SFX.fiveStones();
  const starts = new Set(inst.oscs.slice(s0.o).map(o => +o.startedAt.toFixed(2)));
  ok(starts.size === 5 && inst.noises.length - s0.n === 5, 'Five Stones: five strikes at five different moments — the ear counts the stones');
  s0 = snap(inst); SFX.smoothStone();
  ok(inst.oscs.slice(s0.o).some(o => o.frequency.events.some(e => e[0] === 'exp' && e[1] === 900)), 'Smooth Stone: a charge that rises to 900Hz before the release');
  s0 = snap(inst); SFX.ready('psalm'); const whisper = peakSince(inst, s0);
  ok(whisper > 0 && whisper <= 0.05, 'the power-ready whisper stays a whisper under the new master (' + whisper.toFixed(3) + ')');
  // the champion: warning first, boom after — and the boom is bigger
  inst.currentTime = 10; s0 = snap(inst); SFX.bossWarn(1.1);
  const warnOsc = inst.oscs[s0.o], warnPeak = peakSince(inst, s0);
  ok(warnOsc && approx(warnOsc.startedAt, 10) && warnOsc.frequency.events.some(e => e[0] === 'exp' && e[1] === 185), 'bossWarn starts at the telegraph and RISES (95→185Hz)');
  inst.currentTime = 11.1; s0 = snap(inst); SFX.bossBoom(1);
  const boomOsc = inst.oscs.slice(s0.o).find(o => o.startedAt != null);
  ok(boomOsc && boomOsc.startedAt >= 11.1 && peakSince(inst, s0) > warnPeak * 2, 'bossBoom lands after the warning, at more than double its weight');
  // the camp: a crack on the thud, and three drums for the quarter call
  S.advance(500); s0 = snap(inst); SFX.campHit();
  ok(inst.filters.slice(s0.f).some(f => f.type === 'bandpass' && approx(f.frequency.value, 850, 5)), 'campHit carries the wooden crack (850Hz bandpass) over the thud');
  s0 = snap(inst); SFX.campAlarm(3);
  const drums = new Set(inst.oscs.slice(s0.o).map(o => +o.startedAt.toFixed(2)));
  ok(drums.size === 3, 'campAlarm(3) strikes three drums in sequence');
  // volume: persisted, applied to the master, and 0 means silence
  SFX.setVolume(40);
  ok(store.gxhub_wotw_sound === '40' && inst.gains[0].gain.events.some(e => e[0] === 'tgt' && approx(e[1], 0.4)), 'setVolume(40) persists gxhub_wotw_sound and reaches the master gain');
  SFX.setVolume(0); s0 = snap(inst); SFX.atkMelee(true); SFX.psalm();
  ok(inst.oscs.length === s0.o && inst.noises.length === s0.n, 'at volume 0 the kit schedules nothing — mute is real');
  ok(SFX.toggle() === false && SFX.volume() === 40, 'toggle from mute restores the level the player had (40), and reports unmuted');
  ok(SFX.toggle() === true && SFX.volume() === 0, 'toggle again mutes, and reports muted');
  SFX.setVolume(40);
  const S2 = sfxContext(store, FakeCtx);
  ok(S2.SFX.volume() === 40, 'the setting survives a reload: a fresh module reads 40 from the store');
  S2.SFX.unlock(); const inst2 = S2.inst();
  ok(inst2 !== inst && approx(inst2.gains[0].gain.value, 0.4), '…and the reloaded master starts at that level'); }

// ---------- silence must never throw ----------
for (const [label, AC] of [['no AudioContext at all', null], ['an AudioContext that throws', class { constructor() { throw new Error('denied'); } }]]) {
  const S = sfxContext({}, AC); let threw = null;
  try { ['atkMelee', 'atkBlunt', 'atkSling', 'atkBow', 'atkSpear', 'psalm', 'fiveStones', 'smoothStone', 'bossWarn', 'bossBoom',
    'golemSpawn', 'golemGroan', 'golemDie', 'priestChant', 'allyDie', 'heroDown', 'campAlarm', 'campHit', 'enemyHit', 'ready', 'win', 'lose']
    .forEach(m => { S.SFX[m](true); S.SFX[m](); }); S.SFX.setVolume(30); S.SFX.toggle(); S.SFX.unlock(); }
  catch (e) { threw = e; }
  ok(!threw, 'with ' + label + ', every voice fails silent — nothing throws' + (threw ? ' (' + threw.message + ')' : '')); }

// ---------- main integration: the real battle, the real SFX ----------
let nowMs = 0;
const store = {};
const ctx = {
  console, setTimeout, clearInterval, setInterval, performance: { now: () => nowMs },
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  AudioContext: FakeCtx,
  Phaser: {
    Scene: class {}, AUTO: 1,
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Game: class { constructor(cfg) { ctx.__cfg = cfg; } },
    Math: { Distance: { Between: (a, b, c, d) => Math.hypot(c - a, d - b) }, Between: (a, b) => a, Angle: { Between: () => 0 } },
    Geom: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } },
    Utils: { Array: { GetRandom: a => a[0] } }
  },
  Music: { play() {}, toggle: () => true, enabled: () => true },
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [],
    track() {}, addXP() {}, level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
  Tokens: { earn() {}, spend: () => true, balance: () => 1000, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(read('js/sfx.js'), ctx, { filename: 'sfx.js' });
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const SettingsProto = vm.runInContext('Settings.prototype', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
const inst = () => FakeCtx.instances[FakeCtx.instances.length - 1];
ctx.SFX.unlock(); // the first user gesture — every battle sound below flows through the real kit

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
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
const drumCount = (instObj, s0) => instObj.oscs.slice(s0.o).filter(o => approx(o.frequency.events[0] ? o.frequency.events[0][1] : o.frequency.value, 74, 2)).length;

{ // the hero's own hand: Samson's melee speaks atkMelee at hero weight
  const g = bareBattle({ hero: 'samson', level: { era: 'bible' } });
  const e = spawnChamp(g, 10); e.x = g.hero.x + 30; e.y = g.hero.y; g.enemies.push(e);
  g.autoFire = true; g.hero.cd = 0; nowMs += 500;
  const s0 = snap(inst()); g.heroAutoFire();
  ok(inst().oscs.slice(s0.o).some(o => approx(o.frequency.events[0][1], 105, 2)), 'hero melee in battle: the 105Hz hero thump sounds through heroAutoFire'); }
{ // a golem is struck, groans; is felled, crumbles
  const g = bareBattle(); const e = spawnChamp(g, 10); g.enemies.push(e);
  nowMs += 500; let s0 = snap(inst()); g.damage(e, 20, 'physical', {});
  ok(inst().oscs.slice(s0.o).some(o => o.type === 'sawtooth' && approx(o.frequency.events[0][1], 68, 2)), 'damage() on a golem: the groan sounds');
  e.hp = 5; nowMs += 500; s0 = snap(inst()); g.damage(e, 50, 'physical', {});
  ok(e.dead && inst().oscs.slice(s0.o).some(o => approx(o.frequency.events[0][1], 85, 2)), 'the golem\'s fall is a crumble (85Hz collapse), not the generic death blip'); }
{ // camp drums: first blood once, then half, then quarter
  const g = bareBattle(); Object.assign(g, { campHp: 500, campMax: 500, wave: 3, campWarnedWave: 0, campSndFirst: false, campSndHalf: false, campSndQuarter: false });
  nowMs += 500; let s0 = snap(inst()); g.hitCamp(10, null);
  ok(drumCount(inst(), s0) === 1, 'first blood on the camp: one drum');
  nowMs += 500; s0 = snap(inst()); g.hitCamp(10, null);
  ok(drumCount(inst(), s0) === 0, 'ordinary camp hits after the first: no drum — thresholds only');
  g.campHp = 260; nowMs += 500; s0 = snap(inst()); g.hitCamp(20, null);
  ok(drumCount(inst(), s0) === 2, 'crossing half camp: two drums');
  g.campHp = 130; nowMs += 500; s0 = snap(inst()); g.hitCamp(20, null);
  ok(drumCount(inst(), s0) === 3, 'crossing quarter camp: three drums'); }
{ // David's signatures, cast through useSkill itself
  const g = bareBattle(); const e = spawnChamp(g, 10); e.x = g.hero.x + 100; e.y = g.hero.y; g.enemies.push(e);
  nowMs += 500; let s0 = snap(inst()); g.useSkill(1);
  ok(inst().oscs.slice(s0.o).some(o => approx(o.frequency.value, 261.63, 0.5)), 'casting Psalm sounds the harp chord — not the generic skill chirp');
  nowMs += 500; s0 = snap(inst()); g.useSkill(2);
  const starts = new Set(inst().oscs.slice(s0.o).map(o => +o.startedAt.toFixed(2)));
  ok(starts.size >= 5, 'casting Five Stones sounds five rising strikes'); }
{ // Controls: the sound row drives the real setting
  const s = Object.create(SettingsProto);
  s.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; return o; }, graphics: () => gfxObj(),
    image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; }, rectangle: () => mkObj(), circle: () => mkObj(),
    container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } };
  s.input = capInput(); s.scene = { start() {} };
  SettingsProto.create.call(s);
  const byLabel = l => s.setItems.find(o => o.label && o.label._t === l);
  ok(s.sndTxt && s.sndTxt._t === 'Sound: 100%', 'Controls opens showing the live level: Sound: 100%');
  fireUp(byLabel('Quieter'));
  ok(store.gxhub_wotw_sound === '75' && s.sndTxt._t === 'Sound: 75%', 'Quieter steps the master down 25 and persists it');
  fireUp(byLabel('Louder')); fireUp(byLabel('Louder'));
  ok(store.gxhub_wotw_sound === '100' && s.sndTxt._t === 'Sound: 100%', 'Louder steps back up and clamps at 100');
  fireUp(byLabel('Mute'));
  ok(ctx.SFX.volume() === 0 && byLabel('Unmute') === s.muteBtn, 'Mute folds into the setting — the button now offers Unmute');
  fireUp(s.muteBtn);
  ok(ctx.SFX.volume() === 100 && s.sndTxt._t === 'Sound: 100%', 'Unmute restores the level the player had'); }

// ---------- the scaling-law proof: the real game, untouched ----------
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
  while (steps < 4800 && !e.dead && g.campHp > 0) { nowMs += 50;
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
  ok(r.e.dead, 'the competent-play sim still clears the wave-10 champion (' + r.sec.toFixed(1) + 's)');
  ok(r.g.campHp === 500, 'camp untouched: 500/500');
  ok(approx(r.sec, 32.5, 1.0), 'duration matches the standing benchmark: ' + r.sec.toFixed(1) + 's vs ~32.5s');
  console.log('  [sim] champion clear, sound pass live: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
