#!/usr/bin/env node
// Upgrade 18 verification harness — WEAPONS & LOOT (kennin, 2026-10-31:
// guns, weapon families and powers, the Bible as a weapon, RPG chest
// drops). Batteries:
// (1) statics — the arsenal tables, the Rack, the reveal's intermission
//     law, the Bible's no-purchase law (no shop path, no Grokonian
//     path: Rack.grant is called from the reveal alone), rooms clean;
// (2) family patterns, measured in the real scene — projectile counts
//     and kinds, cooldowns (rates), acquisition ranges, the sword's
//     arc, the spear's pierce, the rifle's piercing flight;
// (3) rarity — monotonic within every family, trait steps as named;
// (4) the balance bound — the U13 competent-play champion sim run with
//     the starter (must reproduce ~32.5s, camp whole), a Rare rifle
//     (must stay >= 60% of baseline time), a Mythic rifle (documented),
//     and the Bible (kills, all three phases);
// (5) chests — seeded RNG over the real roll functions (ordinary ~2%,
//     elite ~35%, champion guaranteed, Gold-only Bible at ~3%, the
//     Bible unobtainable at hasBible and from Wood/Iron), the kill ->
//     drop -> bank -> persist chain in the real scene;
// (6) the Rack — persistence round-trip through storage, starter
//     invariants, corruption guard; duplicate conversion to Manna at
//     reveal; equip at reveal changing the hero's real attack; the
//     reveal refusing to open outside the intermission;
// (7) the Bible's Word — verse-blast damage and the squad aura, in the
//     real scene; the tutorial still teaching the starter.
// No browser is available — glyph readability and gun feel need
// kennin's ears and eyes at the playtest address.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 0.01);

// ---------- statics ----------
const main = read('js/main.js');
const net = read('js/net.js');
ok(main.includes("const WEAPON_FAMILIES={") && main.includes("const WEAPON_TIERS=[") && main.includes("const BIBLE_WEAPON={"),
  'the arsenal stands in main.js: families, kennin\'s six tiers, the Bible apart');
ok(main.includes("gxhub_wotw_rack_v1") && main.includes("const Rack={"), 'the Rack persists under its own guarded key');
ok(main.includes("normal:  { chance:0.02") && main.includes("elite:   { chance:0.35") && main.includes("champion:{ chance:1"),
  'drop chances as commissioned: ordinary 2%, elite 35%, champion guaranteed');
ok(main.includes("const BIBLE_ODDS=0.03") && main.includes("if(grade==='gold'&&!hasBible&&R()<BIBLE_ODDS) return { bible:true };"),
  'the Bible: Gold chests alone, 3%, and only while the Rack lacks it');
{ const grants = main.match(/Rack\.grant\(/g) || [];
  // Upgrade 19 re-point (reason recorded): the seasonal reveal is a
  // third grant site — a branch OF the reveal (revealOpenSeasonal),
  // under the same intermission gate. The law this check guards is
  // unchanged: every grant lives inside the reveal system (the slice
  // from revealOpenChest to waveClear holds all three), and no shop
  // or purchase path grants a weapon.
  const revealBody = main.slice(main.indexOf('revealOpenChest(){'), main.indexOf('waveClear(){'));
  ok(grants.length === 3 && revealBody.includes("Rack.grant('bible')") && (revealBody.match(/Rack\.grant\(w\.key\)/g) || []).length === 2,
    'Rack.grant has exactly three call sites and all live in the reveal (the U18 chest and the seasonal chest) — no shop path, no other road to a weapon');
  ok(!/Tokens\.spend\('(weapon|bible)/.test(main) && !main.slice(main.indexOf('renderShop(first)'), main.indexOf('updateShopHead()')).includes('resolveWeapon'),
    'no Grokonian path: the shop never sells a weapon and nothing spends tokens on one');
  ok(main.includes("if(!this.shopOpen||!this.revealPanel) return false; // intermission only"),
    'the reveal\'s law is written at its gate: it opens only while the shop stands');
  ok(!/weapon|Rack\.|chest/i.test(net), 'rooms stay clean: js/net.js carries no weapon, Rack or chest code — the fixed loadout stands');
  // Re-pointed at Upgrade 21 (comment, not deletion): the GXAccount scene
  // now stands between Armory and BattlePass in the registration list.
  ok(main.includes("super('Armory')") && main.includes('Unlocks,Armory,GXAccount,BattlePass') && main.includes("'Armory'"),
    'the Armory scene exists, is registered, and is reachable'); }

// ---------- runtime scaffolding (the U17 pattern) ----------
// Upgrade 19 re-point (reason recorded): seasons are date-driven now,
// and this suite was written in a seasonless world — its chest chain
// counts the U18 chest alone. The harness therefore pins the game's
// clock to 2026-11-14: outside every season's window (Hallows ends
// Nov 7, Tidings opens Dec 18) and at the SAME weekly-twist parity as
// the suite's first green run (2026-10-31: weekIndex 2965, odd —
// Nov 14 is 2967, odd), so the benchmark's world is unchanged.
// In-season behavior is proven by tools/verify_upgrade19.js.
const PIN_MS = new Date(2026, 10, 14, 12, 0, 0).getTime();
class PinnedDate extends Date { constructor(...a) { super(...(a.length ? a : [PIN_MS])); } static now() { return PIN_MS; } }
const store = {};
const ctx = {
  console, performance, setTimeout, clearInterval, setInterval, Date: PinnedDate,
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  Phaser: {
    Scene: class {}, AUTO: 1,
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Game: class { constructor(cfg) { ctx.__cfg = cfg; } },
    Math: { Distance: { Between: (a, b, c, d) => Math.hypot(c - a, d - b) }, Between: (a, b) => a, Angle: { Between: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) } },
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
const Rack = vm.runInContext('Rack', ctx);
const resolveWeapon = vm.runInContext('resolveWeapon', ctx);
const rollChestDrop = vm.runInContext('rollChestDrop', ctx);
const rollLoot = vm.runInContext('rollLoot', ctx);
const WEAPON_TIERS = vm.runInContext('WEAPON_TIERS', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');

function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, height: 54, width: 54, scaleX: 1, active: true, _visible: true, _disabled: false, _scale: 1 };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setFlipX', 'setSize', 'setStrokeStyle', 'setColor', 'setDisplaySize', 'setTintFill', 'setRadius'].forEach(m => { o[m] = () => o; });
  o.setVisible = v => { o._visible = v; return o; };
  o.setScale = s => { o._scale = s; return o; };
  o.setInteractive = () => { o._disabled = false; return o; };
  o.disableInteractive = () => { o._disabled = true; return o; };
  o.setTint = c => { o._tint = c; return o; }; o.clearTint = () => { o._tint = null; return o; };
  o.setTexture = k => { o._key = k; return o; };
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'fillEllipse', 'fillPoints', 'fillTriangle', 'strokeTriangle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function capInput() { const h = {}; return { _h: h, on(ev, cb) { (h[ev] = h[ev] || []).push(cb); }, fire(ev, p) { (h[ev] || []).forEach(cb => cb(p)); } }; }
function cleanStore() { Object.keys(store).forEach(k => { delete store[k]; }); Rack._s = null; }
function bareBattle(data) {
  const g = Object.create(GameProto);
  g.add = { text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; return o; }, graphics: () => gfxObj(),
    image: (x, y, key) => { const o = mkObj(); o.x = x; o.y = y; o._key = key; return o; },
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
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, skillBtns: [], fx: gfxObj(), shopItems: [] });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  return g; }
function hudBattle(data) { const g = bareBattle(data); g.buildHUD(); return g; }
function foe(g, x, y, hp) { const e = { def: UNITS.bible.enemy.find(d => d.id === 'philistine_spearman'), x: x, y: y,
    hp: hp || 1000, max: hp || 1000, dmg: 0, range: 40, rate: 1, speed: 0, cd: 0, dead: false, boss: false,
    armorType: 'flesh', spr: mkObj(), bar: gfxObj() }; g.enemies.push(e); return e; }
function equip(family, tier) { Rack.grant(family + ':' + tier); Rack.equip(family + ':' + tier); }
function fireOnce(g) { g.hero.cd = 0; g.shots.length = 0; g.heroAutoFire(); return g.shots.slice(); }

// ---------- rarity: monotonic, traits as named ----------
{ WEAPON_FAMILY_ORDER_ALL: {
  const order = ['sling', 'bow', 'sword', 'spear', 'pistol', 'rifle', 'scattergun'];
  let mono = true, traits = true;
  order.forEach(f => { let prev = null;
    for (let t = 0; t < 6; t++) { const w = resolveWeapon(f, t);
      if (prev && !(w.dmg > prev.dmg && w.rate < prev.rate && w.range >= prev.range && w.crit > prev.crit)) mono = false;
      prev = w; } });
  ok(mono, 'rarity scaling is monotonic in every family: damage up, rate down (faster), range and crit never down, tier over tier');
  const sw = t => resolveWeapon('sword', t).arc, sp = t => resolveWeapon('spear', t).pierce,
        sc = t => resolveWeapon('scattergun', t).pellets, bw = t => resolveWeapon('bow', t).critMul;
  ok(sw(0) === 110 && sw(5) === 200 && sp(0) === 1 && sp(2) === 1 && sp(3) === 2 && sp(5) === 3 &&
     [0, 1, 2, 3, 4, 5].map(sc).join() === '5,5,6,6,7,7' && bw(0) === 1 && bw(5) > bw(0),
    'traits strengthen as named: sword arc 110->200, spear pierce steps at Epic and Mythic, scatter 5,5,6,6,7,7 pellets, bow crits harder');
  const c = resolveWeapon('sling', 0);
  ok(c.dmg === 18 && c.rate === 0.7 && c.range === 140 && c.crit === 0.10,
    'the Common sling IS the baseline, number for number (dmg 18, rate 0.7, range 140, crit 0.10)');
  ok(resolveWeapon('bible', -1).name === 'The Bible' && resolveWeapon('bible', -1).type === 'holy', 'the Bible resolves singular, holy, off the ladder'); } }

// ---------- the Rack: persistence and invariants ----------
{ cleanStore();
  ok(Rack.owns('sling:0') && Rack.equippedKey() === 'sling:0' && Rack.list().length === 1, 'a fresh Rack holds exactly the starter, equipped');
  Rack.grant('rifle:2'); Rack.equip('rifle:2'); Rack.setPending(['wood', 'gold']);
  const raw = store['gxhub_wotw_rack_v1']; Rack._s = null; // a cold load, as a new page would
  ok(Rack.owns('rifle:2') && Rack.equippedKey() === 'rifle:2' && Rack.pending().join() === 'wood,gold',
    'persistence round-trip: owned, equipped and waiting chests all survive a cold reload (' + (raw ? 'stored' : 'MISSING') + ')');
  ok(Rack.grant('rifle:2') === 'dup' && Rack.grant('bow:4') === 'new', 'grant reports new vs duplicate honestly');
  ok(Rack.equip('mythic:5') === false && Rack.equippedKey() === 'rifle:2', 'an unowned weapon cannot be equipped');
  store['gxhub_wotw_rack_v1'] = '{corrupt'; Rack._s = null;
  ok(Rack.owns('sling:0') && Rack.equippedKey() === 'sling:0', 'a corrupt store falls back to the starter, guarded — the Rack can never strand a player weaponless');
  cleanStore(); }

// ---------- family patterns, measured ----------
{ cleanStore(); ctx.Math.random = () => 0.99;
  const results = {};
  const measure = (family, tier, setup) => { cleanStore(); ctx.Math.random = () => 0.99;
    if (family === 'bible') { Rack.grant('bible'); Rack.equip('bible'); } else equip(family, tier);
    const g = bareBattle(); const ctxSetup = setup(g); const shots = fireOnce(g);
    results[family] = { g, shots, cd: g.hero.cd, setup: ctxSetup }; return results[family]; };
  // sling (a FOUND sling — Uncommon — so the family pattern, not the innate hand, is what speaks)
  { const r = measure('sling', 1, g => foe(g, g.hero.x + 100, g.hero.y));
    ok(r.shots.length === 1 && r.shots[0].s._key === 'stone' && approx(r.shots[0].opt.dmg, 20.7, 0.01),
      'sling: one stone, at the tier\'s damage (Uncommon 18 x 1.15 = ' + r.shots[0].opt.dmg + ')'); }
  { const r = measure('bow', 2, g => foe(g, g.hero.x + 150, g.hero.y));
    ok(r.shots.length === 1 && r.shots[0].s._key === 'arrow' && r.shots[0].opt.critMul > 1, 'bow: one arrow, its crits already heavier at Rare'); }
  { const r = measure('pistol', 2, g => foe(g, g.hero.x + 120, g.hero.y));
    ok(r.shots.length === 1 && r.shots[0].s._key === 'bullet' && r.shots[0].opt.crit === 0.26, 'pistol: one fast bullet, Deadeye crit 0.26 at Rare'); }
  { const r = measure('rifle', 2, g => foe(g, g.hero.x + 240, g.hero.y));
    ok(r.shots.length === 1 && r.shots[0].opt.pierce === 99, 'rifle: reaches 240 (past every other family\'s Rare range) and its shot pierces the line'); }
  { const r = measure('scattergun', 2, g => { foe(g, g.hero.x + 60, g.hero.y); foe(g, g.hero.x + 80, g.hero.y + 20); });
    ok(r.shots.length === 6, 'scattergun: six pellets at Rare (5,5,6,6,7,7), spread across the foes in reach'); }
  { const r = measure('sword', 2, g => { const a = foe(g, g.hero.x + 45, g.hero.y); // clearly the nearest — the hero faces IT
      const side = foe(g, g.hero.x + 55 * Math.cos(1.75), g.hero.y + 55 * Math.sin(1.75));
      const back = foe(g, g.hero.x - 50, g.hero.y); return { a, side, back }; });
    ok(r.shots.length === 0 && r.setup.a.hp < 1000 && r.setup.side.hp === 1000 && r.setup.back.hp === 1000,
      'sword: no projectile — the foe in the 146° arc is cut, the foe at 100° off-facing and the foe behind are untouched'); }
  { const r = measure('spear', 2, g => { const a = foe(g, g.hero.x + 40, g.hero.y), b = foe(g, g.hero.x + 70, g.hero.y),
      c = foe(g, g.hero.x + 100, g.hero.y), off = foe(g, g.hero.x + 40, g.hero.y + 45); return { a, b, c, off }; });
    ok(r.shots.length === 0 && r.setup.a.hp < 1000 && r.setup.b.hp < 1000 && r.setup.c.hp === 1000 && r.setup.off.hp === 1000,
      'spear: the thrust strikes through its mark to ONE more (Rare pierce 1) — the third in line and the foe off the line stand'); }
  { const r = measure('bible', -1, g => foe(g, g.hero.x + 150, g.hero.y));
    ok(r.shots.length === 1 && r.shots[0].s._key === 'light' && r.shots[0].opt.type === 'holy', 'the Bible: one bolt of light, holy'); }
  const cds = ['sling', 'bow', 'sword', 'spear', 'pistol', 'rifle', 'scattergun', 'bible'].map(f => results[f].cd);
  ok(new Set(cds.map(v => Math.round(v * 1000))).size === 8, 'every family keeps its own tempo — eight distinct attack clocks (' + cds.map(v => v.toFixed(2)).join(', ') + ')');
  // acquisition range: at 200 the rifle fires and the pistol stands silent
  { cleanStore(); equip('pistol', 2); const g = bareBattle(); foe(g, g.hero.x + 200, g.hero.y);
    ok(fireOnce(g).length === 0 && g.hero.cd === 0, 'range is law: a foe at 200 is beyond the Rare pistol (162) — no shot, no cooldown spent'); }
  // the rifle's flight really pierces, through the real update loop
  { cleanStore(); equip('rifle', 2); const g = bareBattle(); g.autoFire = false;
    const a = foe(g, g.hero.x + 60, g.hero.y), b = foe(g, g.hero.x + 120, g.hero.y), c = foe(g, g.hero.x + 180, g.hero.y);
    g.autoFire = true; fireOnce(g); g.autoFire = false;
    for (let i = 0; i < 10; i++) g.update(0, 50);
    ok(a.hp < 1000 && b.hp < 1000 && c.hp < 1000, 'the rifle shot flies THROUGH the line: all three foes on its path are struck by one bullet'); }
  cleanStore(); ctx.Math.random = () => 0.99; }

// ---------- the starter is the hero's own hand ----------
{ cleanStore(); ctx.Math.random = () => 0.99;
  const sam = bareBattle({ hero: 'samson', level: { era: 'bible' } });
  const e = foe(sam, sam.hero.x + 40, sam.hero.y); sam.autoFire = true;
  const shots = fireOnce(sam);
  ok(sam.weapon.family === 'innate' && shots.length === 0 && approx(1000 - e.hp, 45),
    'with the starter, Samson fights as he always has: an instant 30 x 1.5 (alone) melee blow, no projectile — today\'s behavior, preserved');
  const dav = bareBattle({ hero: 'david', level: { era: 'bible' } });
  foe(dav, dav.hero.x + 100, dav.hero.y); dav.autoFire = true;
  const ds = fireOnce(dav);
  ok(ds.length === 1 && ds[0].opt.dmg === 18 && dav.hero.cd === 0.7, 'with the starter, David\'s stone is the baseline itself (dmg 18, clock 0.7)');
  cleanStore(); }

// ---------- chests: the seeded mathematics ----------
{ function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  let rng = mulberry32(1234); let hits = 0; const N = 200000;
  for (let i = 0; i < N; i++) if (rollChestDrop('normal', rng)) hits++;
  ok(hits / N > 0.016 && hits / N < 0.024, 'ordinary drop rate over ' + N + ' seeded kills: ' + (hits / N * 100).toFixed(2) + '% (law: ~2%)');
  rng = mulberry32(99); hits = 0; for (let i = 0; i < 20000; i++) if (rollChestDrop('elite', rng)) hits++;
  ok(hits / 20000 > 0.32 && hits / 20000 < 0.38, 'elite drop rate: ' + (hits / 20000 * 100).toFixed(1) + '% (law: ~35%)');
  rng = mulberry32(5); let golds = 0, allDropped = true, onlyIG = true;
  for (let i = 0; i < 5000; i++) { const gr = rollChestDrop('champion', rng); if (!gr) allDropped = false; if (gr === 'gold') golds++; if (gr !== 'iron' && gr !== 'gold') onlyIG = false; }
  ok(allDropped && onlyIG && golds / 5000 > 0.40 && golds / 5000 < 0.50, 'champions ALWAYS drop, Iron or Gold only, Gold at ' + (golds / 5000 * 100).toFixed(1) + '% (law: 45%)');
  rng = mulberry32(42); let bibles = 0, mythics = 0;
  for (let i = 0; i < 100000; i++) { const l = rollLoot('gold', rng, false); if (l.bible) bibles++; else if (l.tier === 5) mythics++; }
  ok(bibles / 100000 > 0.024 && bibles / 100000 < 0.036, 'the Bible in Gold chests: ' + (bibles / 100000 * 100).toFixed(2) + '% (law: 3%)');
  ok(mythics / 100000 > 0.032 && mythics / 100000 < 0.046, 'Gold Mythic rate beside it: ' + (mythics / 100000 * 100).toFixed(2) + '% (law: 4% of the remainder)');
  let bad = 0; rng = mulberry32(3);
  for (let i = 0; i < 50000; i++) { if (rollLoot('wood', rng, false).bible) bad++; if (rollLoot('iron', rng, false).bible) bad++; if (rollLoot('gold', rng, true).bible) bad++; }
  ok(bad === 0, 'the Bible is unobtainable from Wood, from Iron, and from Gold once carried — 150,000 rolls, zero');
  rng = mulberry32(11); let woodMythic = 0;
  for (let i = 0; i < 100000; i++) { const l = rollLoot('wood', rng, false); if (!l.bible && l.tier === 5) woodMythic++; }
  ok(woodMythic === 0, 'Wood never holds a Mythic (its ladder stops at Legendary, at half a percent)'); }

// ---------- the chain: kill -> drop -> bank -> persist -> reveal ----------
{ cleanStore();
  const seq = [0.5, 0.9]; ctx.Math.random = () => (seq.length ? seq.shift() : 0.99);
  const g = hudBattle(); g.wave = 10; g.waveHpM = hpScaleForWave(10); g.waveDmM = dmgScaleForWave(10);
  const champ = g.spawn({ def: IDOL, at: 0, boss: true });
  g.damage(champ, 1e9, 'physical');
  ok(g.fieldChests.length === 1 && g.fieldChests[0].grade === 'gold', 'a champion\'s fall drops its guaranteed chest (seeded roll: Gold)');
  const ch = g.fieldChests[0]; g.hero.x = ch.x; g.hero.y = ch.y; g.collectChests();
  ok(g.pendingChests.join() === 'gold' && Rack.pending().join() === 'gold' && g.fieldChests.length === 0,
    'walking over it banks it — into the scene\'s hand and the Rack\'s keeping at once');
  g.end(false);
  ok(Rack.pending().join() === 'gold', 'the run ends with the chest unopened — it does NOT vanish; it waits in the Rack');
  const g2 = hudBattle();
  ok(g2.pendingChests.join() === 'gold', 'the next run\'s intermission inherits the waiting chest');
  // reveal: a duplicate converts to Manna
  cleanStore(); ctx.Math.random = () => 0.99;
  Rack.grant('sling:1');
  const g3 = hudBattle(); g3.manna = 100; g3.pendingChests = ['wood'];
  g3.openShop(false);
  ok(g3.revealPanel === true && g3.revealQueue.join() === 'wood', 'the intermission opens the reveal over the shop');
  const rseq = [0.0, 0.7]; ctx.Math.random = () => (rseq.length ? rseq.shift() : 0.99); // family: sling; tier roll 0.7 -> Uncommon
  ok(g3.revealOpenChest() === true, 'the chest opens');
  ok(g3.manna === 140 && g3.lootFound.length === 1 && /already held/.test(g3.lootFound[0]),
    'a duplicate (Uncommon sling, already on the Rack) converts to +40 Manna at reveal — manna ' + g3.manna + ', the chest never wasted');
  ok(g3.revealQueue.length === 0 && Rack.pending().length === 0, 'the queue drains and the Rack\'s waiting list empties with it');
  // reveal: a new weapon, equipped on the spot, changes the real attack
  cleanStore(); ctx.Math.random = () => 0.99;
  const g4 = hudBattle(); g4.pendingChests = ['wood']; g4.openShop(false);
  const rseq2 = [0.5, 0.95]; ctx.Math.random = () => (rseq2.length ? rseq2.shift() : 0.99); // family idx 3 = spear; tier roll -> Rare
  g4.revealOpenChest();
  ok(Rack.owns('spear:2'), 'a new weapon lands on the Rack (Rare spear, as rolled)');
  g4.revealEquip('spear:2');
  ok(g4.weapon.family === 'spear' && Rack.equippedKey() === 'spear:2', 'Equip it now: the hero carries the spear and the Rack agrees');
  g4.closeShop(); // (shop closes, wave 1 starts — the reveal is done, so this is the plain path)
  const t1 = foe(g4, g4.hero.x + 40, g4.hero.y), t2 = foe(g4, g4.hero.x + 70, g4.hero.y);
  g4.autoFire = true; const sh = fireOnce(g4);
  ok(sh.length === 0 && t1.hp < 1000 && t2.hp < 1000, 'and the equipped spear is the attack now: a thrust through two foes, no projectile');
  // the reveal refuses battle
  cleanStore(); ctx.Math.random = () => 0.99;
  const g5 = hudBattle(); g5.shopOpen = false; g5.revealPanel = true; g5.revealQueue = ['wood'];
  ok(g5.revealOpenChest() === false && !Rack.owns('spear:2') && Rack.list().length === 1,
    'reveal only in intermission: with the shop down, the same call is refused and nothing is granted');
  cleanStore(); ctx.Math.random = () => 0.99; }

// ---------- the Bible's Word: blast and aura ----------
{ cleanStore(); ctx.Math.random = () => 0.99;
  Rack.grant('bible'); Rack.equip('bible');
  const g = bareBattle(); g.waveActive = true;
  const near = foe(g, g.hero.x + 100, g.hero.y), far = foe(g, g.hero.x + 200, g.hero.y);
  for (let i = 0; i < 61; i++) g.bibleTick(0.1);
  ok(approx(1000 - near.hp, 45) && far.hp === 1000, 'the Word speaks on its clock (6s): foes within 130 take the 45 holy blast; a foe at 200 is outside it');
  const sqNear = { x: g.hero.x + 60, y: g.hero.y }, sqFar = { x: g.hero.x + 400, y: g.hero.y };
  ok(g.bibleAuraMul(sqNear) === 1.25 && g.bibleAuraMul(sqFar) === 1, 'the aura strengthens squads standing near the bearer (x1.25 within 175), and no one else\'s');
  cleanStore(); }

// ---------- the tutorial keeps the starter ----------
{ cleanStore(); ctx.Math.random = () => 0.99;
  equip('rifle', 5);
  const g = bareBattle({ hero: 'david', level: { era: 'bible' }, tutorial: true });
  ok(g.weaponKey === 'sling:0' && g.weapon.family === 'innate' && g.pendingChests.length === 0,
    'the tutorial teaches the starter whatever the Rack holds — its weapon, its sealed economy, unchanged');
  cleanStore(); }

// ---------- the balance bound: the champion sim, four ways ----------
// The U13 competent-play script, unaltered: the same army, the same
// kite-and-charge play, skills on cooldown. Only the carried weapon
// changes between runs.
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function champFight(setup) { cleanStore();
  // The U13 benchmark's own conditions, deliberately: Math.random held
  // at 0.99 (no crit ever fires) and Angle.Between stubbed flat, so the
  // baseline number is THE standing benchmark and the weapon runs are
  // measured against it like for like.
  ctx.Math.random = () => 0.99; ctx.Phaser.Math.Angle.Between = () => 0;
  if (setup) setup();
  const g = hudBattle(); g.autoFire = true;
  buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']);
  buySquad(g, 'benjamite_archer', ['drill1', 'drill2']);
  buySquad(g, 'mighty_man', ['drill1']);
  buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']);
  buySquad(g, 'spearman_wall');
  buySquad(g, 'slinger_elah', ['swift']);
  buySquad(g, 'levite_healer');
  buySquad(g, 'shepherd_militia', ['veteran']);
  const e = spawnChamp(g, 10); g.waveActive = true;
  let steps = 0, maxPhase = 1;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    const want = tele ? 'fallback' : 'charge';
    if (g.__u9ord !== want) { g.__u9ord = want; g.selSquad = null; g.giveOrder(want); }
    if (tele && g.hero.dodgeCd <= 0 && Math.hypot(g.hero.x - e.x, g.hero.y - e.y) < 220) {
      g.hero.tx = Math.max(40, g.hero.x - 260); g.hero.ty = g.hero.y; g.pressDodge(); }
    else { g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
      g.hero.ty = tele ? g.hero.y : e.y; }
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b && b.cd <= 0) g.useSkill(i); }
    g.update(0, 50); steps++;
    if (e.bossPhase > maxPhase) maxPhase = e.bossPhase; }
  return { g, e, sec: steps * 0.05, maxPhase }; }
{ const base = champFight(null);
  ok(base.e.dead && base.g.campHp === 500 && approx(base.sec, 32.5, 2.5),
    'BASELINE (starter = his own hand): the champion falls in ' + base.sec.toFixed(1) + 's with the camp whole at 500/500 — the standing benchmark, reproduced');
  const rare = champFight(() => equip('rifle', 2));
  ok(rare.e.dead && rare.maxPhase === 3 && rare.sec >= base.sec * 0.60 && rare.sec < base.sec,
    'RARE rifle: ' + rare.sec.toFixed(1) + 's — inside the bound (>= 60% of baseline ' + (base.sec * 0.6).toFixed(1) + 's), all three phases faced');
  const mythic = champFight(() => equip('rifle', 5));
  ok(mythic.e.dead && mythic.maxPhase === 3 && mythic.sec < rare.sec && mythic.sec >= 10,
    'MYTHIC rifle: ' + mythic.sec.toFixed(1) + 's — earned strength, documented; still a real fight, never a walkover');
  const bible = champFight(() => { Rack.grant('bible'); Rack.equip('bible'); });
  ok(bible.e.dead && bible.maxPhase === 3 && bible.g.campHp > 0,
    'THE BIBLE: the champion falls in ' + bible.sec.toFixed(1) + 's, all three phases, the camp standing — bolts, blast and aura together');
  console.log('  [sim] starter ' + base.sec.toFixed(1) + 's | Rare rifle ' + rare.sec.toFixed(1) + 's | Mythic rifle ' + mythic.sec.toFixed(1) + 's | Bible ' + bible.sec.toFixed(1) + 's');
  cleanStore(); ctx.Math.random = () => 0.99;
  ctx.Phaser.Math.Angle.Between = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
