#!/usr/bin/env node
// Upgrade 19 verification harness — SEASONAL CHESTS & GIFT CARDS
// (kennin, 2026-10-31: "a chest system where you can get gifts in like
// the madden player cards... base the chest system off of seasons and
// holidays" + "You gotta make it where you can buy them with the
// grokonians"). Batteries:
// (1) statics — the seasons are DATA (windows, prices, pools), the
//     scenes stand and are reachable, rooms stay clean, and the HARD
//     LAW: no seasonal table or roll names the Bible at all;
// (2) the calendar — seasonState over a date matrix (edges inclusive,
//     Hallows live on 2026-10-31, Tidings dormant then, year-wrap
//     correctness on a synthetic season), liveSeason / nextSeason;
// (3) buying — the Tokens spend called with the exact item and price,
//     refusal when short (nothing spent, nothing queued), out-of-
//     season purchase impossible, a bought chest opening at the next
//     intermission through the shared reveal;
// (4) the pools — seeded rolls over the real rollSeasonalGift: kind
//     rates inside their envelopes, card tiers weighted to the chase,
//     Hallows weapons Torchlit and fire, and the Bible's rate EXACTLY
//     zero across every seasonal pool over a large sample;
// (5) the Album — persistence round-trip, corruption guard, duplicate
//     conversion to Manna at reveal, set completion paying ONCE
//     (Manna in the scene, Grokonians on the recorded earn path);
// (6) drops in play — in season, a champion leaves the seasonal chest
//     BESIDE its U18 chest and an elite can; out of season, none;
//     an orb treat from a bundle paying for a real orb touch;
// (7) the balance bound — the U13/U18 champion sim, starter in hand,
//     reproduced (pin date: 2026-11-14, out of season, same weekly
//     twist parity as the standing benchmark's world).
// The harness clock is a mutable PinnedDate: window tests pass their
// dates explicitly; scene tests move the pin.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const approx = (a, b, eps) => Math.abs(a - b) <= (eps || 0.01);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- statics ----------
const main = read('js/main.js');
const net = read('js/net.js');
ok(main.includes('const SEASONS=[') && main.includes("id:'hallows'") && main.includes("id:'tidings'"),
  'the seasons stand as data: Hallows and Tidings rows in one table');
ok(main.includes('window:{ sm:10, sd:25, em:11, ed:7 }') && main.includes('window:{ sm:12, sd:18, em:12, ed:27 }'),
  'windows as commissioned: Hallows Oct 25 – Nov 7, Tidings Dec 18 – 27, every year');
ok((main.match(/price:60/g) || []).length === 2 && main.includes("Tokens.spend('chest:'+sv.id,sv.price)"),
  'both seasonal chests priced at 60 Grokonians, spent through the Tokens path (the orb path)');
{ const seasonsData = main.slice(main.indexOf('const SEASONS=['), main.indexOf('const SEASON_BY_ID'));
  const setsData = main.slice(main.indexOf('const CARD_SETS={'), main.indexOf('const CARD_SET_ORDER'));
  ok(!/bible/i.test(seasonsData) && !/bible/i.test(setsData),
    'HARD LAW in the data itself: no seasonal pool row and no card names the Bible — it is not an outcome, at any weight');
  const giftFn = main.slice(main.indexOf('function rollSeasonalGift'), main.indexOf('function purchaseSeasonalChest'));
  ok(!/bible/i.test(giftFn), 'the seasonal roll has no Bible branch — absence, not odds');
  ok(!/SEASON|Album|CARD_SET|purchaseSeasonalChest/.test(net), 'rooms stay clean: js/net.js carries no seasonal, Album or card code — solo-side this pass'); }
ok(main.includes("super('Chests')") && main.includes("super('Album')") && main.includes('BattlePass,Chests,CardAlbum,Profile'),
  'the Chests panel and the Card Album scenes exist and are registered');
ok(main.includes("scene.start('Chests',{from:'Menu'}") && main.includes("scene.start('Album',{from:'Armory'") && main.includes("scene.start('Chests',{from:'Armory'"),
  'both are reachable: Chests from the Menu and the Armory, the Album from the Armory');
ok(main.includes("const Album={") && main.includes('gxhub_wotw_album_v1') && main.includes('const CARD_DUP_MANNA=[25,40,70,120,200,325]'),
  'the Album persists under its own guarded key; duplicate cards melt on the weapon ladder (25/40/70/120/200/325)');

// ---------- runtime scaffolding (the U18 pattern, recording Tokens) ----------
let PIN_MS = new Date(2026, 10, 14, 12, 0, 0).getTime(); // Nov 14 2026: out of season, benchmark twist parity
class PinnedDate extends Date { constructor(...a) { super(...(a.length ? a : [PIN_MS])); } static now() { return PIN_MS; } }
function setPin(y, m, d) { PIN_MS = new Date(y, m, d, 12, 0, 0).getTime(); }
const store = {};
const wallet = { bal: 1000, spends: [], earns: [] };
function resetWallet(bal) { wallet.bal = bal == null ? 1000 : bal; wallet.spends = []; wallet.earns = []; }
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
  Tokens: { balance: () => wallet.bal,
    spend(item, cost) { wallet.spends.push([item, cost]); if (wallet.bal < cost) return false; wallet.bal -= cost; return true; },
    earn(reason, n) { wallet.earns.push([reason, n]); wallet.bal += n; return wallet.bal; },
    milestone: () => true, setMilestone() {} },
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
const Album = vm.runInContext('Album', ctx);
const SEASON_BY_ID = vm.runInContext('SEASON_BY_ID', ctx);
const seasonState = vm.runInContext('seasonState', ctx);
const liveSeason = vm.runInContext('liveSeason', ctx);
const nextSeason = vm.runInContext('nextSeason', ctx);
const rollSeasonalDrop = vm.runInContext('rollSeasonalDrop', ctx);
const rollSeasonalGift = vm.runInContext('rollSeasonalGift', ctx);
const purchaseSeasonalChest = vm.runInContext('purchaseSeasonalChest', ctx);
const resolveWeapon = vm.runInContext('resolveWeapon', ctx);
const chestDisplay = vm.runInContext('chestDisplay', ctx);
const CARD_SETS = vm.runInContext('CARD_SETS', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
const D = (y, m, d) => new Date(y, m, d, 12, 0, 0);
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
function cleanStore() { Object.keys(store).forEach(k => { delete store[k]; }); Rack._s = null; Album._s = null; resetWallet(); }
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

// ---------- the calendar ----------
{ const H = SEASON_BY_ID.hallows, T = SEASON_BY_ID.tidings;
  ok(seasonState(H, D(2026, 9, 24)).live === false && sameDay(seasonState(H, D(2026, 9, 24)).nextStart, D(2026, 9, 25)),
    'Oct 24: Hallows sleeps, opening tomorrow (Oct 25)');
  const s25 = seasonState(H, D(2026, 9, 25)); ok(s25.live && s25.daysLeft === 14, 'Oct 25: the season opens — 14 days stand (Oct 25 – Nov 7, both days whole)');
  const s31 = seasonState(H, D(2026, 9, 31)); ok(s31.live && s31.daysLeft === 8, 'Oct 31, 2026 — SHIP DAY: Hallows is LIVE with 8 days left');
  const s07 = seasonState(H, D(2026, 10, 7)); ok(s07.live && s07.daysLeft === 1, 'Nov 7: the last day of the season, counted whole');
  const s08 = seasonState(H, D(2026, 10, 8)); ok(!s08.live && s08.nextStart.getFullYear() === 2027 && s08.nextStart.getMonth() === 9 && s08.nextStart.getDate() === 25,
    'Nov 8: the chest is gone until Oct 25, 2027 — not purchasable, not droppable');
  ok(seasonState(T, D(2026, 9, 31)).live === false && sameDay(seasonState(T, D(2026, 9, 31)).nextStart, D(2026, 11, 18)),
    'Oct 31: Tidings is DORMANT — it opens Dec 18 (the framework proven by a sleeping season)');
  const sd = seasonState(T, D(2026, 11, 18)); ok(sd.live && sd.daysLeft === 10, 'Dec 18: Tidings opens with 10 days');
  ok(seasonState(T, D(2026, 11, 27)).live && seasonState(T, D(2026, 11, 27)).daysLeft === 1 && !seasonState(T, D(2026, 11, 28)).live,
    'Dec 27 is its last day; Dec 28 it sleeps again');
  ok(liveSeason(D(2026, 9, 31)) === H && liveSeason(D(2026, 11, 20)) === T && liveSeason(D(2026, 5, 15)) === null,
    'liveSeason names the standing season — Hallows at Halloween, Tidings at Christmas, none in June');
  const nx = nextSeason(D(2026, 9, 31)); ok(nx && nx.season === T, 'from Halloween, the next chest to open is Tidings');
  const nx2 = nextSeason(D(2026, 11, 20)); ok(nx2 && nx2.season === H && nx2.state.nextStart.getFullYear() === 2027, 'from inside Christmas, the next opening is next year\'s Hallows');
  // year-wrap: a synthetic season Dec 28 – Jan 3, defined as data alone
  const wrap = { id: 'synthetic', window: { sm: 12, sd: 28, em: 1, ed: 3 } };
  ok(seasonState(wrap, D(2026, 11, 30)).live && seasonState(wrap, D(2026, 11, 30)).daysLeft === 5, 'wrap season: Dec 30 is live with 5 days left (30, 31, 1, 2, 3)');
  ok(seasonState(wrap, D(2027, 0, 2)).live && seasonState(wrap, D(2027, 0, 2)).daysLeft === 2, 'wrap season: Jan 2 is still inside the SAME window that began last year');
  const wAfter = seasonState(wrap, D(2027, 0, 4)); ok(!wAfter.live && sameDay(wAfter.nextStart, D(2027, 11, 28)), 'wrap season: Jan 4 it sleeps until Dec 28');
  ok(!seasonState(wrap, D(2026, 11, 27)).live && sameDay(seasonState(wrap, D(2026, 11, 27)).nextStart, D(2026, 11, 28)), 'wrap season: Dec 27 waits for tomorrow');
  ok(chestDisplay('hallows').name === 'Hallows Chest' && chestDisplay('gold').name === 'Golden Chest' && chestDisplay('tidings').css === '#7ab0e8',
    'one display face for every chest: seasonal and standing grades behind the same lookup'); }

// ---------- buying with Grokonians ----------
{ cleanStore(); setPin(2026, 9, 31); resetWallet(100);
  ok(purchaseSeasonalChest('hallows') === 'ok' && wallet.spends.length === 1 && wallet.spends[0][0] === 'chest:hallows' && wallet.spends[0][1] === 60 && wallet.bal === 40,
    'in season, the buy lands: Tokens.spend called once with the exact item and price (chest:hallows, 60), wallet 100 -> 40');
  ok(Rack.pending().join() === 'hallows', 'the bought chest waits in the Rack — it opens at the next intermission, in the shared reveal');
  cleanStore(); resetWallet(59);
  ok(purchaseSeasonalChest('hallows') === 'funds' && wallet.spends.length === 1 && wallet.bal === 59 && Rack.pending().length === 0,
    'short by one Grokonian: refused — the spend was attempted, nothing charged, nothing queued');
  cleanStore(); setPin(2026, 10, 14); resetWallet(500);
  ok(purchaseSeasonalChest('hallows') === 'season-over' && wallet.spends.length === 0 && wallet.bal === 500,
    'out of season (Nov 14): purchase is impossible — Tokens.spend is never even called');
  ok(purchaseSeasonalChest('tidings', D(2026, 9, 31)) === 'season-over' && wallet.spends.length === 0,
    'on Halloween, the dormant Christmas chest cannot be bought either');
  ok(purchaseSeasonalChest('nope') === 'noseason', 'an unknown chest id is refused plainly');
  setPin(2026, 9, 31); }

// ---------- the pools: seeded mathematics, and the Bible's zero ----------
{ const rng = mulberry32(20261031); const H = SEASON_BY_ID.hallows; const N = 200000;
  let cards = 0, weapons = 0, bundles = 0, bibles = 0, badCard = 0, badVariant = 0;
  const tierCount = [0, 0, 0, 0, 0, 0]; const bundleKinds = {};
  for (let i = 0; i < N; i++) { const gft = rollSeasonalGift(H, rng);
    if (gft.kind === 'card') { cards++; tierCount[gft.card.tier]++; if (!CARD_SETS.witnesses.cards.includes(gft.card)) badCard++; }
    else if (gft.kind === 'weapon') { weapons++; const w = resolveWeapon(gft.family, gft.tier, gft.variant);
      if (gft.variant !== 'hallows' || w.type !== 'fire' || !/^Torchlit /.test(w.name) || w.family === 'bible') badVariant++; }
    else { bundles++; bundleKinds[gft.bundle.kind] = (bundleKinds[gft.bundle.kind] || 0) + 1; }
    if (gft.bible || gft.family === 'bible' || (gft.card && /bible/i.test(gft.card.id))) bibles++; }
  ok(Math.abs(cards / N - 0.45) < 0.01 && Math.abs(weapons / N - 0.30) < 0.01 && Math.abs(bundles / N - 0.25) < 0.01,
    'Hallows pool rates over ' + N + ' seeded rolls: cards ' + (cards / N * 100).toFixed(1) + '% / weapons ' + (weapons / N * 100).toFixed(1) + '% / treats ' + (bundles / N * 100).toFixed(1) + '% (law: 45/30/25)');
  ok(bibles === 0, 'HARD LAW, measured: the Bible\'s rate across the whole Hallows pool is EXACTLY 0 in ' + N + ' rolls');
  ok(badCard === 0 && badVariant === 0, 'every card dealt is a Witness of the set; every weapon is a Torchlit variant whose blows land as fire');
  ok(tierCount[5] > 0 && tierCount[5] < tierCount[0] / 5 && tierCount[0] > tierCount[4],
    'the deal leans to the low rungs and the Mythic is the chase (Common ' + tierCount[0] + ' > Legendary ' + tierCount[4] + ' > Mythic ' + tierCount[5] + ' > 0)');
  ok(bundleKinds.manna > bundleKinds.grok && bundleKinds.grok > bundleKinds.orbs && bundleKinds.orbs > 0,
    'treats fall as tabled: Manna commonest, then Grokonians, then the orb treat');
  const rng2 = mulberry32(777); const T = SEASON_BY_ID.tidings; let tBib = 0, tVar = 0, tCard = 0;
  for (let i = 0; i < 100000; i++) { const gft = rollSeasonalGift(T, rng2);
    if (gft.bible || gft.family === 'bible') tBib++;
    if (gft.kind === 'weapon' && gft.variant !== null) tVar++;
    if (gft.kind === 'card') { tCard++; if (!CARD_SETS.tidings.cards.includes(gft.card)) tBib += 1000; } }
  ok(tBib === 0 && tVar === 0 && tCard > 40000, 'Tidings deals its own set and PLAIN framework weapons (no variant) — and its Bible rate is likewise exactly 0');
  ok(rollSeasonalDrop(H, 'champion', () => 0.999) === true && rollSeasonalDrop(H, 'elite', () => 0.2) === true &&
     rollSeasonalDrop(H, 'elite', () => 0.9) === false && rollSeasonalDrop(H, 'normal', () => 0.0) === false && rollSeasonalDrop(null, 'champion') === false,
    'drop law: champions always, elites at the real chance, ordinary foes never (the standing chests are U18\'s), no season no drop'); }

// ---------- the Album: keeping, duplicates, the set gift paid once ----------
{ cleanStore();
  ok(Album.grantCard('wit_gideon') === 'new' && Album.grantCard('wit_gideon') === 'dup' && Album.count('wit_gideon') === 2,
    'grantCard reports new vs duplicate honestly and keeps the count');
  const raw = store['gxhub_wotw_album_v1']; Album._s = null;
  ok(Album.owns('wit_gideon') && Album.count('wit_gideon') === 2 && !!raw, 'Album persistence round-trip: the card and its count survive a cold reload');
  store['gxhub_wotw_album_v1'] = '{corrupt'; Album._s = null;
  ok(Album.setProgress('witnesses').owned === 0, 'a corrupt Album store falls back to empty, guarded — it can never strand the game');
  cleanStore();
  CARD_SETS.witnesses.cards.slice(0, 7).forEach(c => Album.grantCard(c.id));
  ok(Album.setProgress('witnesses').owned === 7 && !Album.setComplete('witnesses'), 'seven of the Witnesses gathered — the set is not yet complete');
  Album.grantCard('wit_david');
  ok(Album.setComplete('witnesses') && Album.claimSetGift('witnesses') === true && Album.claimSetGift('witnesses') === false,
    'the eighth completes the set, and its gift can be claimed exactly ONCE');
  cleanStore(); }

// ---------- the reveal, shared: cards, duplicates, completion, treats ----------
{ cleanStore(); setPin(2026, 9, 31); ctx.Math.random = () => 0.99;
  // a bought chest opens at the next run's intermission
  resetWallet(100); purchaseSeasonalChest('hallows');
  const g = hudBattle(); ok(g.pendingChests.join() === 'hallows', 'the next run inherits the bought Hallows chest');
  g.openShop(false);
  ok(g.revealPanel === true && g.revealQueue.join() === 'hallows', 'the intermission opens the SAME reveal for the bought chest');
  const seq = [0.1, 0.0]; ctx.Math.random = () => (seq.length ? seq.shift() : 0.99); // kind: card; pick: Gideon (first weight band)
  ok(g.revealOpenChest() === true && Album.owns('wit_gideon') && g.lootFound.some(s => /Gideon/.test(s)),
    'the reveal deals a card: Gideon joins the Album, and the run\'s findings name him');
  // a second chest deals the same card -> Manna
  cleanStore(); ctx.Math.random = () => 0.99;
  const g2 = hudBattle(); g2.manna = 100; g2.pendingChests = ['hallows', 'hallows']; g2.openShop(false);
  const s1 = [0.1, 0.0]; ctx.Math.random = () => (s1.length ? s1.shift() : 0.99);
  g2.revealOpenChest();
  g2.revealNext();
  const s2 = [0.1, 0.0]; ctx.Math.random = () => (s2.length ? s2.shift() : 0.99);
  ok(g2.revealOpenChest() === true && g2.manna === 125 && Album.count('wit_gideon') === 2,
    'the duplicate card melts at reveal: +25 Manna (Common, on the ladder) — no opening is wasted');
  // completion: seven held, the reveal deals David (the Mythic band)
  cleanStore(); ctx.Math.random = () => 0.99; resetWallet(1000);
  CARD_SETS.witnesses.cards.slice(0, 7).forEach(c => Album.grantCard(c.id));
  const g3 = hudBattle(); g3.manna = 0; g3.pendingChests = ['hallows']; g3.openShop(false);
  const s3 = [0.1, 0.99]; ctx.Math.random = () => (s3.length ? s3.shift() : 0.99); // pick roll 0.99 -> David, the last weight band
  g3.revealOpenChest();
  ok(Album.setComplete('witnesses') && g3.manna === 150 && wallet.earns.some(e => e[0] === 'setgift:witnesses' && e[1] === 25),
    'the completing reveal pays the set gift AT ONCE: +150 Manna in the run, +25 Grokonians on the earn path');
  const earnsAfter = wallet.earns.length;
  const g4 = hudBattle(); g4.manna = 0; g4.pendingChests = ['hallows']; g4.openShop(false);
  const s4 = [0.1, 0.0]; ctx.Math.random = () => (s4.length ? s4.shift() : 0.99);
  g4.revealOpenChest(); // a duplicate Gideon now — completion must NOT pay again
  ok(wallet.earns.length === earnsAfter && Album.giftClaimed('witnesses'), 'later openings never re-pay the set gift — once means once');
  // treats: an orb treat banks a free orb; a Grokonian treat earns through Tokens
  cleanStore(); ctx.Math.random = () => 0.99; resetWallet(0);
  const g5 = hudBattle(); g5.pendingChests = ['hallows']; g5.openShop(false);
  const s5 = [0.9, 0.65]; ctx.Math.random = () => (s5.length ? s5.shift() : 0.99); // kind: bundle; pick: the orb treat band
  g5.revealOpenChest();
  ok(g5.freeOrbs === 1, 'a treat bundle can be an ORB TREAT: one free orb touch banked for the run');
  const orb = { def: { id: 'strength', name: 'Orb of Strength', cost: 15, dur: 60, color: 0xd83a2a, css: '#ff9a86', fx: 'x' }, cd: 0, x: g5.hero.x, y: g5.hero.y, pending: 0 };
  ok(g5.tryBuyOrb(orb) === 'bought' && g5.freeOrbs === 0 && wallet.spends.length === 0 && g5.buffStrT === 60,
    'the treat pays for the touch: the orb lands, Tokens.spend is never called, the bank empties');
  const g6 = hudBattle(); g6.pendingChests = ['hallows']; g6.openShop(false);
  const s6 = [0.9, 0.45]; ctx.Math.random = () => (s6.length ? s6.shift() : 0.99); // bundle: Grokonians 10
  g6.revealOpenChest();
  ok(wallet.earns.some(e => e[0] === 'treat' && e[1] === 10), 'a Grokonian treat is EARNED through Tokens.earn — the hub-capped path, like every earn');
  // a weapon gift from the seasonal chest is a Rack weapon under U18 rules
  cleanStore(); ctx.Math.random = () => 0.99;
  const g7 = hudBattle(); g7.pendingChests = ['hallows']; g7.openShop(false);
  const s7 = [0.6, 0.5, 0.5]; ctx.Math.random = () => (s7.length ? s7.shift() : 0.99); // weapon; family idx 3 (spear); tier roll -> Uncommon
  g7.revealOpenChest();
  ok(Rack.owns('spear:1@hallows') && resolveWeapon('spear', 1, 'hallows').type === 'fire' && Rack.list().some(w => w.key === 'spear:1@hallows'),
    'a Torchlit spear lands on the Rack under its variant key, listed beside its plain twin, blows landing as fire');
  // the reveal still refuses battle
  const g8 = hudBattle(); g8.shopOpen = false; g8.revealPanel = true; g8.revealQueue = ['hallows'];
  ok(g8.revealOpenChest() === false && !Album.owns('wit_gideon'), 'the seasonal reveal obeys the one law: no shop standing, no opening, nothing granted');
  cleanStore(); ctx.Math.random = () => 0.99; }

// ---------- drops in play: beside U18 in season, absent out of it ----------
{ cleanStore(); setPin(2026, 9, 31); ctx.Math.random = () => 0.99;
  const g = hudBattle(); g.wave = 10; g.waveHpM = hpScaleForWave(10); g.waveDmM = dmgScaleForWave(10);
  const champ = g.spawn({ def: IDOL, at: 0, boss: true });
  g.damage(champ, 1e9, 'physical');
  const grades = g.fieldChests.map(c => c.grade);
  ok(grades.includes('hallows') && grades.some(x => x === 'iron' || x === 'gold' || x === 'wood'),
    'in season, the champion leaves the Hallows chest BESIDE its standing chest (field: ' + grades.join(', ') + ')');
  cleanStore(); setPin(2026, 10, 14); ctx.Math.random = () => 0.99;
  const g2 = hudBattle(); g2.wave = 10; g2.waveHpM = hpScaleForWave(10); g2.waveDmM = dmgScaleForWave(10);
  const champ2 = g2.spawn({ def: IDOL, at: 0, boss: true });
  g2.damage(champ2, 1e9, 'physical');
  ok(g2.fieldChests.length >= 1 && !g2.fieldChests.some(c => c.grade === 'hallows'),
    'out of season (Nov 14), the champion leaves only its standing chest — the seasonal drop does not exist');
  cleanStore(); setPin(2026, 9, 31);
  const g3 = hudBattle(); g3.wave = 5; g3.waveHpM = hpScaleForWave(5); g3.waveDmM = dmgScaleForWave(5);
  const elite = g3.spawn({ def: IDOL, at: 0, boss: false });
  ctx.Math.random = () => 0.1; // every chance roll succeeds: U18 elite chest AND the seasonal roll at 0.1 < 0.35
  g3.damage(elite, 1e9, 'physical');
  ok(g3.fieldChests.some(c => c.grade === 'hallows'), 'in season, an elite Idol Golem can leave the Hallows chest too');
  cleanStore(); ctx.Math.random = () => 0.99; setPin(2026, 10, 14); }

// ---------- the balance bound: the standing benchmark, reproduced ----------
// The U13/U18 competent-play script, unaltered, at the pinned
// out-of-season date (Nov 14 2026 — the same weekly twist as the
// benchmark's world, and no seasonal chest on the field).
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
function champFight() { cleanStore(); setPin(2026, 10, 14);
  ctx.Math.random = () => 0.99; ctx.Phaser.Math.Angle.Between = () => 0;
  const g = hudBattle(); g.autoFire = true;
  buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']);
  buySquad(g, 'benjamite_archer', ['drill1', 'drill2']);
  buySquad(g, 'mighty_man', ['drill1']);
  buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']);
  buySquad(g, 'spearman_wall');
  buySquad(g, 'slinger_elah', ['swift']);
  buySquad(g, 'levite_healer');
  buySquad(g, 'shepherd_militia', ['veteran']);
  g.wave = 10; g.waveHpM = hpScaleForWave(10); g.waveDmM = dmgScaleForWave(10);
  const e = g.spawn({ def: IDOL, at: 0, boss: true }); g.waveActive = true;
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
{ const base = champFight();
  ok(base.e.dead && base.g.campHp === 500 && approx(base.sec, 32.5, 2.5),
    'BASELINE (starter = his own hand): the champion falls in ' + base.sec.toFixed(1) + 's with the camp whole at 500/500 — the standing benchmark, unmoved by seasons');
  console.log('  [sim] starter ' + base.sec.toFixed(1) + 's (benchmark ~32.5s)');
  cleanStore(); ctx.Math.random = () => 0.99;
  ctx.Phaser.Math.Angle.Between = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1); }

console.log('---');
console.log(total + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
