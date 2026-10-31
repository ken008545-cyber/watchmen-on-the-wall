#!/usr/bin/env node
// Upgrade 9 verification harness — COMMAND & CARE (kennin's rulings,
// 2026-10-30). Stubbed Phaser; exercises the REAL logic in js/main.js:
// (1) tap-to-order — squads are born posted and do NOT follow; selection
// by tap (with stack cycling), ground taps post the selected squad, the
// command bar scopes to the selection vs the army, Follow Me is an order
// again; (2) the camp panel — mid-wave, same CAMP_UPGRADES/CAMP_REPAIR
// state and prices as the shop strip, purchases land once from either
// surface, the wave does not pause behind it; (3) orbs like a potion —
// tap-to-buy in range, one-tap pending purchase from afar, the banner
// (name + effect), the drink sound hook, and the labeled buff chips.
// Plus the scaling-law proof: the wave-10 champion cleared by competent
// play under the NEW control scheme (orders driven through giveOrder),
// camp untouched — and a second clear with the army POSTED at the camp
// and the hero fighting away from it. No browser is available — thumb
// feel and banner readability at phone size need kennin's hands.
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
ok(main.includes("const ORDER_NAMES={charge:'Charge',hold:'Hold',follow:'Follow Me',flank:'Flank',fallback:'Fall Back',shieldwall:'Shield Wall'}"), 'ORDER_NAMES: the six orders, one vocabulary for bar, HUD and echoes');
ok(main.includes("this.order='hold'; this.volleyMode=false;") && main.includes('this.selSquad=null; this.campPanelOpen=false;'), 'run starts: standing order Hold, hero selected (selSquad null), camp panel closed');
ok(main.includes("ord:'post',post:null") && main.includes('s.post={x:s.x,y:s.y};'), 'addSquad: a squad is born posted where it stands');
ok(main.includes('giveOrder(id)') && main.includes('s.ord=id;') && main.includes('this.order=id; this.squads.forEach(s=>{ s.ord=null; });'), 'giveOrder: scoped to the selected squad, or army-wide (squads return to army control)');
ok(main.includes('squadOrder(s){ return s.ord||this.order; }') && main.includes("if(eo==='post'&&s.post) return {x:s.post.x,y:s.post.y};"), 'effective order + posted target: a squad marches by its own order, else the army\'s; post means its post');
ok(main.includes("if(this.squadOrder(s)==='shieldwall') m*=0.55;"), 'Shield Wall mitigation follows the squad\'s effective order');
ok(main.includes('openCampPanel()') && main.includes('renderCampPanel(){') && main.includes('toggleCampPanel(){'), 'camp panel: open / render / toggle exist');
ok(main.includes('campBtn(CAMP_UPGRADES[0]') && main.includes("const rb=button(this,colX[1],rowY[2],268,46,'Repair +'"), 'camp panel sells the SAME CAMP_UPGRADES and CAMP_REPAIR the shop strip sells');
ok((main.match(/this\.afterCampBuy\(\)/g) || []).length === 2 && main.includes('afterCampBuy(){ if(this.shopOpen) this.renderShop(false); else if(this.campPanelOpen) this.renderCampPanel(); }'), 'both camp purchases re-render whichever surface sold them — one state, two doors');
ok(main.includes("this.campBtn=button(this,130+7*117,HUD_Y+55,110,56,''") && main.includes("icon:CMD_ICONS.camp") && main.includes('this.campBtnRect={x:130+7*117,y:HUD_Y+55,w:110,h:56};'), 'persistent CAMP button + its onTap wall (its tap is never a march order) — Upgrade 16 re-point: tent symbol on the face, name in the press float'); // Upgrade 10 re-points: the button moved into the command row (the approved sketch) — same panel behind it, same wall; then the row shifted left (start x 130) to seat RALLY ninth at the same size
ok(main.includes('if(this.campPanelOpen) return;') && main.includes('if(!this.selSquad&&this.campPos&&Math.hypot(wx-this.campPos.x,wy-this.campPos.y)<=56){ this.openCampPanel(); return; }'), 'onTap: panel open walls field taps; a camp tap (hero selected) opens the panel');
ok(main.includes('o.pending=6;') && main.includes('o.pending=0; this.tryBuyOrb(o);'), 'orbs: a far tap marks the purchase pending; orbTick completes it on arrival');
ok(main.includes('this.orbBanner(o)') && main.includes('d.name.toUpperCase()') && main.includes('d.fx'), 'orbs: purchase fires the banner (name + effect text)');
ok(/orbDrink\(\)\{/.test(sfx) && main.includes('SFX.orbDrink()'), 'orbs: the drink sound exists and the purchase plays it');
ok(main.includes('drawBuffChips(){') && main.includes('this.buffChipTxts='), 'orbs: labeled buff chips are built and drawn');
ok(main.includes("'Tip: Your squads hold their ground until you direct them"), 'loading tips teach the new command scheme');

// ---------- runtime: stubbed Phaser, real main.js ----------
const store = {};
const TokensStub = { _bal: 0, _spent: [],
  balance() { return this._bal; },
  earn() {},
  spend(item, cost) { if (this._bal < cost) return false; this._bal -= cost; this._spent.push([item, cost]); return true; },
  milestone: () => true, setMilestone() {} };
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
  Tokens: TokensStub,
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
vm.runInContext('DATA = ' + JSON.stringify(JSON.parse(read('data/game.json'))) + ';', ctx);
vm.runInContext('ERAS = ' + JSON.stringify(JSON.parse(read('data/eras.json'))) + '; UNITS = ' + JSON.stringify(JSON.parse(read('data/units.json'))) + ';', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);
const ORBS = vm.runInContext('ORBS', ctx);
const CAMP_UPGRADES = vm.runInContext('CAMP_UPGRADES', ctx);
const hpScaleForWave = vm.runInContext('hpScaleForWave', ctx);
const dmgScaleForWave = vm.runInContext('dmgScaleForWave', ctx);
const UNITS = vm.runInContext('UNITS', ctx);
const IDOL = UNITS.bible.enemy.find(e => e.id === 'idol_golem');
ok(ORBS.every(o => typeof o.fx === 'string' && o.fx.length > 10), 'every orb carries its plain-language effect line for the banner');

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
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false, shopItems: [],
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
function resetWallet(n) { TokensStub._bal = n; TokensStub._spent = []; }

// ---------- RULING 1: the army does not follow unless told ----------
{ const g = bareBattle(); const s1 = buySquad(g, 'shepherd_militia'), s2 = buySquad(g, 'shepherd_slinger');
  ok(g.order === 'hold' && g.selSquad === null, 'run start: hero selected, standing army order is Hold');
  ok(s1.ord === 'post' && s1.post.x === s1.x && s1.post.y === s1.y, 'a bought squad is born posted where it stands (beside the camp)');
  g.hero.tx = 1200; g.hero.ty = 200;
  for (let i = 0; i < 60; i++) g.update(0, 50); // 3s: the hero marches away alone
  ok(Math.hypot(g.hero.x - 210, g.hero.y - 600) > 200, 'the hero marched off (' + Math.round(Math.hypot(g.hero.x - 210, g.hero.y - 600)) + 'px)');
  ok(Math.hypot(s1.x - 210, s1.y - 600) <= 1 && Math.hypot(s2.x - 210, s2.y - 600) <= 1, 'the squads did NOT follow — they hold their posts'); }
{ const g = bareBattle(); const s1 = buySquad(g, 'shepherd_militia'), s2 = buySquad(g, 'shepherd_slinger');
  g.selectSquad(s1);
  ok(g.selSquad === s1, 'select: the squad is the marching hand\'s focus');
  const htx = g.hero.tx;
  g.onTap({ x: 900, y: 300, worldX: 900, worldY: 300 });
  ok(s1.ord === 'post' && s1.post.x === 900 && s1.post.y === 300, 'ground tap posts the selected squad at the tapped ground');
  ok(g.hero.tx === htx, '...and the hero received no march order from that tap');
  ok(stepUntil(g, () => Math.hypot(s1.x - 900, s1.y - 300) <= 10, 400), 'the squad marches to its post');
  const px = s1.x, py = s1.y; for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(Math.hypot(s1.x - px, s1.y - py) <= 2, '...and holds there — posted means posted');
  ok(Math.hypot(s2.x - 210, s2.y - 600) <= 1, 'the unselected squad never moved'); }
{ const g = bareBattle(); const s1 = buySquad(g, 'shepherd_militia'), s2 = buySquad(g, 'shepherd_slinger');
  s1.x = 400; s1.y = 400; s1.post = { x: 400, y: 400 }; s2.x = 700; s2.y = 400; s2.post = { x: 700, y: 400 };
  g.onTap({ x: 400, y: 400, worldX: 400, worldY: 400 });
  ok(g.selSquad === s1, 'tap on a squad selects it');
  g.onTap({ x: 700, y: 400, worldX: 700, worldY: 400 });
  ok(g.selSquad === s2, 'tap on another squad switches the selection');
  g.onTap({ x: g.hero.x, y: g.hero.y, worldX: g.hero.x, worldY: g.hero.y });
  ok(g.selSquad === null, 'tap on the hero returns selection to the hero');
  s1.x = s2.x = 500; s1.y = s2.y = 500; s1.post = { x: 500, y: 500 }; s2.post = { x: 500, y: 500 };
  g.onTap({ x: 500, y: 500, worldX: 500, worldY: 500 }); const first = g.selSquad;
  g.onTap({ x: 500, y: 500, worldX: 500, worldY: 500 }); const second = g.selSquad;
  ok(first && second && first !== second, 'stacked squads: repeated taps cycle the selection (' + (first && first.def.name) + ' -> ' + (second && second.def.name) + ')'); }
{ const g = bareBattle(); const s1 = buySquad(g, 'shepherd_militia'), s2 = buySquad(g, 'shepherd_slinger');
  g.selectSquad(s1); g.giveOrder('charge');
  ok(s1.ord === 'charge' && s2.ord === 'post' && g.order === 'hold', 'an order with a squad selected scopes to that squad alone');
  g.selectHero(); g.giveOrder('follow');
  ok(g.order === 'follow' && s1.ord === null && s2.ord === null, 'an order with the hero selected is army-wide and returns every squad to army control');
  g.hero.x = 1000; g.hero.y = 300; // the hero is suddenly across the field
  const sx = s2.x; for (let i = 0; i < 20; i++) g.update(0, 50);
  ok(s2.x > sx + 25, 'Follow Me AS AN ORDER: the squad leaves its post to rejoin the hero');
  const g2 = bareBattle(); const a = buySquad(g2, 'shepherd_militia'), b = buySquad(g2, 'shepherd_slinger');
  g2.selectSquad(a); g2.giveOrder('follow');
  g2.hero.x = 1100; g2.hero.y = 300;
  const bx = b.x; for (let i = 0; i < 20; i++) g2.update(0, 50);
  ok(a.x > 260 && Math.hypot(b.x - bx, b.y - 600) <= 1, 'one squad on Follow Me trails the hero; the other keeps its post'); }
{ const g = bareBattle(); const s = buySquad(g, 'spearman_wall');
  const foe = spawnFoe(g, s.x + 30, s.y); const hp0 = foe.hp;
  let n = 0; while (foe.hp >= hp0 && n < 80) { g.update(0, 50); n++; }
  ok(foe.hp < hp0, 'a posted squad fights what comes to it (the foe at its post took damage)');
  ok(Math.hypot(s.x - 210, s.y - 600) <= 30, '...without abandoning its post'); }
{ const g = bareBattle(); const s = buySquad(g, 'shepherd_militia'); // melee, range 38 — shorter than a golem's reach
  const foe = spawnFoe(g, s.x + 60, s.y); foe.hp = 60;
  let n = 0; while (!foe.dead && n < 200) { g.update(0, 50); n++; }
  ok(foe.dead, 'guard post: a posted melee squad steps to an intruder inside its guard reach and kills it');
  ok(stepUntil(g, () => Math.hypot(s.x - 210, s.y - 600) <= 8, 200), '...then returns to its post when the ground is clear'); }

// ---------- RULING 2: camp care, mid-wave ----------
{ const g = bareBattle(); g.buildHUD(); g.manna = 1000;
  ok(g.campPanelOpen === false, 'the camp panel starts closed');
  fireUp(g.campBtn);
  ok(g.campPanelOpen === true && g.campItems.length > 0, 'the CAMP button opens the camp panel mid-battle');
  ok(g.buyCampUpgrade(CAMP_UPGRADES[0]) === true && g.campMax === 650 && g.manna === 800, 'Fortify I bought FROM THE PANEL: same price (200), same effect (camp max 500 -> 650)');
  ok(g.campPanelOpen === true && g.campItems.length > 0, 'the panel re-rendered after its own purchase — still open, state fresh');
  fireUp(g.campBtn);
  ok(g.campPanelOpen === false, 'the CAMP button again closes it');
  g.shopOpen = true; let rs = 0; const realRS = g.renderShop; g.renderShop = () => { rs++; };
  ok(g.buyCampUpgrade(CAMP_UPGRADES[1]) === true && g.campMax === 850 && g.manna === 480 && rs === 1, 'Fortify II bought from the SHOP surface: same chain, same prices (1000-200-320=480), shop re-rendered');
  g.renderShop = realRS; g.shopOpen = false; }
{ const g = bareBattle(); const s = buySquad(g, 'shepherd_militia');
  g.onTap({ x: 150, y: 600, worldX: 150, worldY: 600 });
  ok(g.campPanelOpen === true, 'tapping the camp itself opens the panel');
  g.closeCampPanel(); g.selectSquad(s);
  g.onTap({ x: 150, y: 600, worldX: 150, worldY: 600 });
  ok(g.campPanelOpen === false && s.post.x === 150 && s.post.y === 600, 'with a squad selected, the same tap posts the squad at the camp instead'); }
{ const g = bareBattle(); g.waveActive = true; g.openCampPanel();
  const foe = spawnFoe(g, 900, 600); const fx0 = foe.x;
  for (let i = 0; i < 40; i++) g.update(0, 50);
  ok(foe.x < fx0 - 20 && g.campPanelOpen === true, 'the wave does NOT pause for the panel — the enemy kept marching behind it');
  const hx = g.hero.tx;
  g.onTap({ x: 800, y: 300, worldX: 800, worldY: 300 });
  ok(g.hero.tx === hx, 'field taps do not leak through the open panel'); }

// ---------- RULING 3: orbs like a potion ----------
{ const g = bareBattle(); g.buildHUD(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[0]; g.hero.x = o.x; g.hero.y = o.y;
  g.onTap({ x: o.x, y: o.y, worldX: o.x, worldY: o.y });
  ok(g.buffStrT === 60 && TokensStub._bal === 85, 'tap the orb itself to buy when in range: Strength live, 15 G spent');
  ok(g._orbBanner && g._orbBanner.length === 3, 'the potion moment fires — a banner is built (panel, name, effect)');
  ok(g._orbBanner[1]._t === 'ORB OF STRENGTH' && /\+50%/.test(g._orbBanner[2]._t), 'the banner names the power and its effect: "' + g._orbBanner[1]._t + ' — ' + g._orbBanner[2]._t + '"');
  ok(g.buffTxt._t.includes('STR 60s'), 'the HUD timer line still reads STR 60s');
  ok(g.buffChipTxts[0]._t === 'STRENGTH 60s', '...and the buff chip row gains a LABELED chip: "STRENGTH 60s"'); }
{ const g = bareBattle(); g.buildOrbs(); resetWallet(100);
  const o = g.orbs[0]; // the hero stands at the camp (210,600); Strength waits at (620,300)
  ok(g.tryBuyOrb(o) === 'far' && TokensStub._bal === 100 && o.pending > 0, 'one tap from afar: nothing spent yet, but the purchase is pending');
  let n = 0; while (g.buffStrT <= 0 && n < 400) { g.update(0, 50); n++; }
  ok(g.buffStrT > 50 && TokensStub._bal === 85 && o.pending === 0, 'the hero walked up and the pending purchase completed itself (' + n + ' steps) — one clear tap, one clear result'); }

// ---------- the scaling-law proof under the new control scheme ----------
// U8's competent script and army, unchanged — except orders now travel
// the real command path (giveOrder, army-wide) instead of a field write.
// READY style: the two regular moves spent the moment they are ready.
function champFightU9() { const g = bareBattle(); g.autoFire = true; // Upgrade 10: the approved default — the hero's basics are auto-fire again (was: scripted manual presses)
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
    // Upgrade 10: no scripted presses — auto-fire (ON, the approved default) does the hero's basic fighting.
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b.cd <= 0) g.useSkill(i); }
    g.update(0, 50); steps++; }
  return { g, e, sec: steps * 0.05 }; }
{ const r = champFightU9();
  ok(r.e.dead, 'competent play under the NEW controls clears the wave-10 champion (' + r.sec.toFixed(1) + 's)');
  ok(r.g.campHp > 0, '...with the camp standing (' + Math.round(r.g.campHp) + '/' + r.g.campMax + ')');
  console.log('  [sim] champion clear, orders via giveOrder: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax); }
// The posted variant: the same army, directed squad-by-squad through the
// real tap path into a kill-zone astride the champion's road east of the
// camp — tank and spears forward, blades beside them, ranged and the
// healer behind, every field of fire overlapping — then NEVER ordered
// again: the hero fights the champion in the field (auto-fire and
// the two regular moves, Ready style) while the posted army holds.
function champFightPosted() { const g = bareBattle(); g.autoFire = true; // Upgrade 10: same re-point — auto-fire replaces the scripted manual presses
  const ss = [buySquad(g, 'swordsman_gideon', ['drill1', 'drill2']),
    buySquad(g, 'benjamite_archer', ['drill1', 'drill2']),
    buySquad(g, 'mighty_man', ['drill1']),
    buySquad(g, 'shieldman_judah', ['bulwark', 'bulwark2']),
    buySquad(g, 'spearman_wall'),
    buySquad(g, 'slinger_elah', ['swift']),
    buySquad(g, 'levite_healer'),
    buySquad(g, 'shepherd_militia', ['veteran'])];
  const posts = [[430, 690], [320, 590], [430, 610], [470, 650], [470, 570], [320, 690], [345, 645], [400, 650]];
  ss.forEach((s, i) => { g.selectSquad(s); g.onTap({ x: posts[i][0], y: posts[i][1], worldX: posts[i][0], worldY: posts[i][1] }); });
  g.selectHero();
  const e = spawnChamp(g, 10); g.waveActive = true;
  let steps = 0;
  while (steps < 4800 && !e.dead && g.campHp > 0) {
    const tele = e.heavyWind > 0 || !!e.slam;
    if (tele && g.hero.dodgeCd <= 0 && Math.hypot(g.hero.x - e.x, g.hero.y - e.y) < 220) {
      g.hero.tx = Math.max(40, g.hero.x - 260); g.hero.ty = g.hero.y; g.pressDodge(); }
    else { g.hero.tx = Math.max(40, Math.min(g.worldW - 40, e.x - (tele ? 300 : 135)));
      g.hero.ty = tele ? g.hero.y : e.y; }
    // Upgrade 10: no scripted presses — auto-fire (ON, the approved default) does the hero's basic fighting.
    for (let i = 0; i < 2; i++) { const b = g.skillBtns[i]; if (b.cd <= 0) g.useSkill(i); }
    g.update(0, 50); steps++; }
  return { g, e, sec: steps * 0.05, ss }; }
{ const r = champFightPosted();
  ok(r.ss.every(s => s.ord === 'post'), 'posted variant: every squad still holds its post order — no army order was ever given');
  ok(r.e.dead, 'posted variant: the champion still falls (' + r.sec.toFixed(1) + 's) — hero in the field, army posted at the camp');
  ok(r.g.campHp > 0, 'posted variant: the camp stands (' + Math.round(r.g.campHp) + '/' + r.g.campMax + ')');
  console.log('  [sim] champion clear, army posted at camp: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax + ', squads standing: ' + r.ss.filter(s => !s.dead).length + '/8'); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
