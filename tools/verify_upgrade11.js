#!/usr/bin/env node
// Upgrade 11 verification harness — TUTORIAL MODE (kennin's approval,
// voice 2026-10-30: "I like tutorial mode more... All right, I approve
// that. You can work on the tutorial mode."). A guided layer over the
// REAL battle scene and the REAL controls — not a mock scene: the same
// hero, buttons, squads, camp panel and orbs, practice dummies standing
// in for waves. Batteries:
// (1) statics — the menu door, the one-time first-battle offer, the
// completion/offered flags, the orb GRANT branch, the invulnerability
// guards, and the step hooks wired to the game's own events;
// (2) the full walkthrough, driven through the real paths (onTap march,
// heroAutoFire, the AUTO-FIRE button, the fight buttons, useSkill, a
// tap-to-post, RALLY, the CAMP button, an orb tap) advancing step by
// step, each step's instruction line checked as it shows;
// (3) SKIP STEP and EXIT TUTORIAL — always there, no penalties, and no
// completion flag for a run that was left early;
// (4) silent credit — an action done before its step arrives counts when
// the step arrives (toggle flipped early; Psalm cast during step one);
// (5) THE ECONOMY FIREWALL — recording Tokens/Progress stubs prove a
// whole tutorial (including a dummy kill and the free orb buy) moves
// zero Grokonians, zero XP, zero progression tracks, and never flushes;
// (6) safety — the camp cannot fall and the hero cannot die in here, and
// a dummy that reaches the hero deals him nothing at all;
// (7) the competent-play sim (auto-fire ON, Ready-only powers, copied
// from U10): the real game untouched — ~32.5s, camp 500/500.
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
ok(main.includes("const TUTORIAL_KEY='gxhub_wotw_tutorial_done'") && main.includes("const TUTORIAL_OFFER_KEY='gxhub_wotw_tutorial_offered'"), 'flags: completion and offered keys exist (gxhub_wotw_tutorial_done / _offered)');
ok(main.includes('function tutPromptNeeded(){ return !tutorialDone()&&!tutorialOffered(); }'), 'the offer shows only while neither flag is set — the flags stop SUGGESTIONS, nothing else');
ok(main.includes("'Tutorial',()=>this.scene.start('Game',{hero:'david',level:{era:'bible'},tutorial:true})"), 'ENTRY: a TUTORIAL button on the main menu starts the tutorial (David, Bible era) — present always, locked by nothing');
ok(main.includes('if(tutPromptNeeded()) this.tutPrompt(h.id);') && main.includes('else this.scene.start(\'Game\',{hero:h.id,level:this.level});'), 'ENTRY: a fresh profile\'s first Lead tap is offered the tutorial; every later entry goes straight in');
ok(main.includes('tutPrompt(heroId){ if(this._tutPromptOpen) return; this._tutPromptOpen=true; setTutorialOffered();'), 'the offered flag is set the moment the prompt SHOWS — it can never nag twice');
ok(main.includes("'Start the battle'") && main.includes("'New here?'"), 'the prompt is a choice with a plain way past it — never forced');
ok(main.includes('this.tutorial=!!(d&&d.tutorial)') && main.includes('if(this.tutorial){ this.startTutorial(); }') && main.includes('else { this.toast('), 'the battle scene branches on the tutorial flag at open — tutorial instead of shop, real game otherwise');
{ const st = main.slice(main.indexOf('startTutorial(){'), main.indexOf('tutEvent(name){'));
  ok(!st.includes('openShop(') && !st.includes('startWave(') && !st.includes('end('), 'startTutorial opens no shop, starts no wave, and can reach no end() — waveActive never turns on in here'); }
ok(main.includes("if(this.tutorial) return; // Upgrade 11: the tutorial's camp cannot fall"), 'the camp cannot fall: hitCamp refuses every blow in the tutorial');
ok(main.includes('if(this.tutorial){ h.hp=1;') && main.includes('You cannot fall here'), 'the hero cannot die: a blow that would empty his health leaves him standing at 1 HP');
ok(main.includes("if(!this.tutorial&&!Tokens.spend('orb:'+o.def.id,o.def.cost))"), 'the orb GRANT: in the tutorial tryBuyOrb never calls Tokens.spend — the buy is free, marked in code');
ok(main.includes('on the house, this once'), '...and marked in the player\'s own instruction line');
ok(main.includes('const TUT_DUMMY={ hp:120, sturdyHp:320, dmg:0, speed:26, spawnDist:300, stop:110 }'), 'dummy stats: 120 HP (320 sturdy), damage 0, slow walk, stops at the edge of the hero\'s circle');
ok(main.includes("e.tutDummy=true") && main.includes("find(e=>e.id==='pebble_golem')"), 'dummies are the Pebble Golem\'s own figure and data path, spawned through the real spawn()');
ok(main.includes('else if(e.tutDummy){') && main.includes('if(dl>TUT_DUMMY.stop)'), 'the enemy loop gives dummies their own branch — walk to the hero and wait; no strike, no march on the camp');
ok(main.includes("this.tutEvent('moved')") && main.includes("this.tutEvent('autofired')") && main.includes("this.tutEvent('autotoggled')"), 'step hooks on the real events: the march, an auto-fire strike, the toggle flip');
ok(main.includes("this.tutEvent('dodge')") && main.includes("this.tutEvent('block')") && main.includes("this.tutEvent('sprint')") && main.includes("this.tutEvent('power')"), 'step hooks: a real dodge, a raised guard, sprint switched on, and a cast at the END of useSkill (past every No-target return)');
ok(main.includes("this.tutEvent('posted')") && main.includes("this.tutEvent('rallied')") && main.includes("this.tutEvent('camp')") && main.includes("this.tutEvent('orb')"), 'step hooks: a tap-to-post, a planted banner, the camp panel opening, a successful orb buy');
ok(main.includes("'Skip step'") && main.includes("'Exit'") && main.includes('exitTutorial(){ this.scene.start(\'Menu\'); }'), 'SKIP STEP and EXIT TUTORIAL stand on the panel; exiting returns to the menu');
ok(main.includes('setTutorialDone(); // the ONLY persistent write in the whole mode'), 'FINISH sets the completion flag — the one write that outlives a tutorial run');
ok(main.includes('whisper when they are ready') || main.includes('glows and whispers'), 'the power step points out the ready whisper (glow + soft cue) by name');
{ const game = JSON.parse(read('data/game.json')); const david = game.heroes.find(h => h.id === 'david');
  ok(david.skills.some(s => s.name === 'Psalm') && david.ult.name === 'Five Stones', 'the lesson names real moves: David\'s Psalm and Five Stones are in the data the buttons read'); }

// ---------- runtime: stubbed Phaser, real main.js ----------
const store = {};
const spendCalls = [], earnCalls = [], trackCalls = [], xpCalls = []; // THE FIREWALL WITNESSES
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
    track: (k, n) => { trackCalls.push([k, n]); }, addXP: (n, id) => { xpCalls.push([n, id]); },
    level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
  Tokens: { earn: (r, n) => { earnCalls.push([r, n]); }, spend: (r, n) => { spendCalls.push([r, n]); return true; }, balance: () => 1000, milestone: () => true, setMilestone() {} },
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
const tutPromptNeeded = vm.runInContext('tutPromptNeeded', ctx);
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
function bareBattle(data) {
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
  g.scene = { start(k, d) { g.__started = [k, d]; } };
  GameProto.init.call(g, data || { hero: 'david', level: { era: 'bible' } });
  Object.assign(g, { campPos: { x: 150, y: 600 }, campSpr: null, campBar: null, manna: 340, speed: 1,
    enemies: [], squads: [], shots: [], spawnQ: [], waveActive: false, shopOpen: false, victoryOpen: false,
    orbs: [], coins: [], nightRect: null, cmdBtns: {}, fx: gfxObj() });
  g.stat = mkObj(); g.buffTxt = mkObj(); g.orderTxt = mkObj();
  g.buildHero();
  g.skillBtns = [...g.heroDef.skills, g.heroDef.ult].map(k => ({ def: k, cd: 0, cdMax: k.cd, held: 0, buffered: false, _tierShown: 0, label: mkObj(), alpha: 1 }));
  return g; }
function tutBattle() { const g = bareBattle({ hero: 'david', level: { era: 'bible' }, tutorial: true });
  g.buildHUD(); g.buildOrbs(); g.startTutorial(); return g; }
function spawnChamp(g, wave) { g.wave = wave; g.waveHpM = hpScaleForWave(wave); g.waveDmM = dmgScaleForWave(wave);
  return g.spawn({ def: IDOL, at: 0, boss: true }); }
function buySquad(g, id, ups) { const def = UNITS.bible.player.find(u => u.id === id); const s = g.addSquad(def);
  (ups || []).forEach(uid => { const u = (def.upgrades || []).find(z => z.id === uid); if (!u) return;
    s.max += u.hpAdd || 0; s.hp = s.max; s.dmg += u.dmgAdd || 0; s.armor += u.armorAdd || 0; if (u.rateMul) s.rate *= u.rateMul; s.upgrades[uid] = true; });
  return s; }
function stepUntil(g, pred, max) { let n = 0; while (!pred() && n < (max || 40)) { g.update(0, 50); n++; } return pred(); }
function freshFlags() { delete store.gxhub_wotw_tutorial_done; delete store.gxhub_wotw_tutorial_offered; }

// ---------- the first-run offer, as behavior ----------
{ freshFlags();
  ok(tutPromptNeeded() === true, 'fresh profile (no flags): the tutorial is offered');
  store.gxhub_wotw_tutorial_offered = '1';
  ok(tutPromptNeeded() === false, 'offered once: never suggested again');
  delete store.gxhub_wotw_tutorial_offered; store.gxhub_wotw_tutorial_done = '1';
  ok(tutPromptNeeded() === false, 'completed: never suggested again');
  freshFlags(); }

// ---------- the full walkthrough, through the real controls ----------
{ freshFlags(); delete store.gxhub_wotw_autofire;
  const g = tutBattle();
  ok(g.tutorial === true && g.tutStep === 0 && g.shopOpen === false && g.waveActive === false, 'the tutorial opens on step one — no shop, no wave, no timer');
  ok(/Tap the ground/.test(g.tutLine._t) && /Step 1 of 7/.test(g.tutSub._t), 'step (a) MOVE shows its line: "' + g.tutLine._t + '"');
  ok(g.tutSkipBtn && g.tutExitBtn, 'SKIP STEP and EXIT TUTORIAL stand from the first step');
  // (a) MOVE — a real ground tap, a real march
  g.onTap({ x: 430, y: 600, worldX: 430, worldY: 600 });
  ok(g.hero.tx === 430 && g.hero.ty === 600, 'the tap set the hero marching');
  ok(stepUntil(g, () => g.tutStep === 1, 120), 'he arrived — the step advanced on the real movement');
  // (b) AUTO-FIRE — the dummy comes, the hero fires on his own
  const dum = g.tutDummy;
  ok(dum && dum.def.id === 'pebble_golem' && dum.dmg === 0 && dum.hp === 120 && dum.tutDummy === true, 'a practice dummy stands in: Pebble Golem figure, 120 HP, damage 0');
  ok(stepUntil(g, () => Math.hypot(dum.x - g.hero.x, dum.y - g.hero.y) <= 116, 400), 'the dummy walked to the edge of the hero\'s circle and waited');
  const hpAtWait = g.hero.hp; for (let i = 0; i < 40; i++) g.update(0, 50);
  ok(g.hero.hp === hpAtWait && g.campHp === 500, 'two seconds at arm\'s length: the dummy dealt the hero nothing, and the camp nothing');
  ok(stepUntil(g, () => !!g.tutCred.autofired, 400), 'the hero fired ON HIS OWN — auto-fire proved by the real strike');
  ok(/AUTO-FIRE button/.test(g.tutLine._t), 'the line now names the toggle: "' + g.tutLine._t.slice(0, 60) + '..."');
  ok(g.tutStep === 1, '...but the step waits for the flip itself');
  fireUp(g.autoBtn); // the real AUTO-FIRE button
  ok(g.tutCred.autotoggled === true && g.tutStep === 2, 'one flip of the real toggle completes the step (left OFF — the flip itself is what counts)');
  fireUp(g.autoBtn); // back on for the rest of the lesson, player's choice
  // (c) DODGE, BLOCK, SPRINT — the real fight buttons' own paths
  ok(g.pressDodge() === 'dodged' && g.tutCred.dodge === true, 'DODGE pressed — counted');
  ok(/Still to try: Block, Sprint/.test(g.tutSub._t), 'the line names what is left: "' + g.tutSub._t + '"');
  ok(g.setBlock(true) === true && g.tutCred.block === true, 'BLOCK raised — counted');
  ok(/Still to try: Sprint/.test(g.tutSub._t), '...one left');
  g.setBlock(false); // a held button is lifted before sprinting — the real play order
  g.toggleSprint();
  ok(g.tutCred.sprint === true && g.tutStep === 3, 'SPRINT on — the kit step completes');
  // (d) POWER — a sturdier dummy, a real cast
  ok(g.enemies.some(e => e.tutDummy && e.max === 320), 'the sturdier dummy stands in (320 HP)');
  ok(/Psalm and Five Stones/.test(g.tutLine._t) && /whispers/.test(g.tutLine._t), 'the power line names Psalm, Five Stones — and the whisper');
  g.useSkill(1); // Psalm, by its own button's path
  ok(g.tutCred.power === true && g.tutStep === 4 && g.skillBtns[1].cd > 17, 'Psalm cast for real (cooldown running) — the power step completes');
  // (e) COMMAND YOUR ARMY — granted squad, post, then rally
  ok(g.squads.length === 1 && g.squads[0].def.id === 'shepherd_militia', 'one squad stands granted — a Shepherd Militia, free, for the lesson');
  const sq = g.squads[0];
  g.onTap({ x: sq.x, y: sq.y, worldX: sq.x, worldY: sq.y });
  ok(g.selSquad === sq, 'tap the squad: selected');
  g.onTap({ x: 560, y: 460, worldX: 560, worldY: 460 });
  ok(sq.ord === 'post' && sq.post.x === 560 && sq.post.y === 460 && g.tutPhase === 1, 'tap the ground: posted — and the step turns to its rally half');
  // Upgrade 17 re-point: the rally half is now two halves — the lesson
  // teaches the Simple face's fan first (open ORDERS), then RALLY.
  ok(/ORDERS/.test(g.tutLine._t), 'the orders line shows: "' + g.tutLine._t.slice(0, 60) + '..."');
  fireUp(g.ordersBtn);
  ok(g.fanOpen === true && g.tutPhase === 2, 'tap ORDERS: the fan opens — and the step turns to its rally half');
  ok(/RALLY/.test(g.tutLine._t), 'the rally line shows');
  fireUp(g.rallyBtn);
  ok(g.rallyMode === true && g.fanOpen === false, 'tap RALLY: planting arms — and the fan closes behind the order');
  g.onTap({ x: 640, y: 420, worldX: 640, worldY: 420 });
  ok(sq.ord === 'rally' && sq.rally.x === 640 && sq.rally.y === 420 && g.tutStep === 5, 'tap the ground: the banner plants, the squad holds it — army step complete');
  // (f) THE CAMP — the real panel, mid-fight
  ok(/Fortify/.test(g.tutLine._t) && /Repair/.test(g.tutLine._t), 'the camp line explains Fortify and Repair');
  fireUp(g.campBtn);
  ok(g.campPanelOpen === true && g.tutStep === 6, 'the CAMP button opened the real camp panel — step complete');
  g.closeCampPanel();
  // (g) ORBS — the grant
  const orb = g.orbs[0]; // Strength, at (620,300) in the Bible world
  g.hero.x = orb.x - 50; g.hero.y = orb.y; g.hero.tx = g.hero.x; g.hero.ty = g.hero.y;
  const spendsBefore = spendCalls.length;
  g.onTap({ x: orb.x, y: orb.y, worldX: orb.x, worldY: orb.y });
  ok(g.buffStrT === 60, 'the orb landed: Strength burns for 60s');
  ok(spendCalls.length === spendsBefore, '...and Tokens.spend was NEVER called — the buy was a grant');
  ok(g.tutFinished === true && store.gxhub_wotw_tutorial_done === '1', 'FINISH: the lesson completes and the completion flag is set');
  ok(/lesson is complete/.test(g.tutLine._t), 'the completion line stands: "' + g.tutLine._t + '"');
  g.exitTutorial();
  ok(g.__started && g.__started[0] === 'Menu', 'Finish returns to the menu');
  // THE FIREWALL, over the whole walkthrough
  ok(spendCalls.length === 0 && earnCalls.length === 0, 'FIREWALL: zero Grokonian spends and zero earns across the entire tutorial');
  ok(trackCalls.length === 0 && xpCalls.length === 0 && g.earned === 0, 'FIREWALL: zero progression tracks, zero XP, and the run\'s earned tally never moved');
  ok(g.over === false, 'the run never ended — end() was never reached, so nothing could flush'); }

// ---------- skip and exit: no penalties, no partial rewards ----------
{ freshFlags();
  const g = tutBattle();
  g.tutSkip();
  ok(g.tutStep === 1 && g.tutDummy, 'SKIP STEP advances (and the next step still sets its dummy)');
  g.tutSkip(); g.tutSkip();
  ok(g.tutStep === 3, 'skips keep walking the steps in order');
  g.exitTutorial();
  ok(g.__started[0] === 'Menu' && g.tutFinished === false && store.gxhub_wotw_tutorial_done === undefined, 'EXIT mid-way: back at the menu, NOT finished, and no completion flag — nothing partial is kept');
  const g2 = tutBattle();
  for (let i = 0; i < 7; i++) g2.tutSkip();
  ok(g2.tutFinished === true && store.gxhub_wotw_tutorial_done === '1', 'skipping through the last step still lands on an honest FINISH (the flag is set there, and only there)');
  freshFlags(); }

// ---------- silent credit: done early counts when the step arrives ----------
{ freshFlags(); delete store.gxhub_wotw_autofire;
  const g = tutBattle();
  fireUp(g.autoBtn); // flip the toggle OFF during step (a) — before its step exists
  ok(g.tutCred.autotoggled === true && g.tutStep === 0 && g.autoFire === false, 'the early flip is recorded, and step (a) is undisturbed');
  fireUp(g.autoBtn); // and back ON — still step (a); the step-(b) credit now stands banked
  ok(g.autoFire === true, 'flipped back on — auto-fire armed for the dummy');
  g.useSkill(1); // Psalm cast during step (a) — the power step is four steps away
  ok(g.tutCred.power === true, 'the early cast is recorded too');
  g.onTap({ x: 430, y: 600, worldX: 430, worldY: 600 });
  ok(stepUntil(g, () => g.tutStep === 2, 600), 'move, then the dummy falls to auto-fire — and the auto-fire step completes with NO flip during the step: the early flips were honored');
  g.tutSkip(); // past the kit step
  ok(g.tutStep === 4 && g.squads.length === 1, 'the power step, on entry, found its cast already done and advanced itself — the army step stands, squad granted');
  freshFlags(); }

// ---------- safety: nothing in here can hurt the player ----------
{ freshFlags();
  const g = tutBattle();
  g.hitCamp(99999, null);
  ok(g.campHp === 500 && g.over === false, 'a 99,999 blow at the camp: camp still 500/500, run not over');
  g.hurtHero(99999);
  ok(g.hero.hp === 1 && g.hero.down === 0, 'a 99,999 blow at the hero: he stands at 1 HP, never down');
  const d = g.spawnTutDummy(true);
  ok(d.max === 320 && d.speed === 26 && g.enemies.includes(d), 'the sturdy dummy: 320 HP through the same spawn path');
  ok(stepUntil(g, () => Math.hypot(d.x - g.hero.x, d.y - g.hero.y) <= 112, 600), 'it closes to the hero\'s circle...');
  const hp0 = g.hero.hp; for (let i = 0; i < 60; i++) g.update(0, 50);
  ok(g.hero.hp >= hp0 && g.campHp === 500, '...and three seconds beside him costs the hero nothing and the camp nothing');
  freshFlags(); }

// ---------- the economy firewall, at the kill itself ----------
{ freshFlags();
  const g = tutBattle();
  const d = g.spawnTutDummy(false);
  const manna0 = g.manna;
  g.damage(d, 99999, 'physical', {});
  ok(d.dead === true, 'a dummy can be killed — it is a real enemy to the real systems');
  ok(spendCalls.length === 0 && earnCalls.length === 0 && trackCalls.length === 0 && xpCalls.length === 0, 'its death moved NO Grokonians, NO tracks, NO XP — the pend exists but flush() is never called in here');
  ok(g.manna === manna0 + 12, 'the bounty landed in RUN-LOCAL manna only (' + manna0 + ' -> ' + g.manna + ') — scene state that dies with the scene');
  freshFlags(); }

// ---------- the scaling-law proof: the real game, untouched ----------
// Copied from verify_upgrade10.js: the standard competent play (orders
// through giveOrder, dodge the telegraphs, the two regular moves spent
// the moment they are ready, basic fighting by AUTO-FIRE; the ult stays
// out, as in every prior suite).
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
  ok(r.e.dead, 'the competent-play sim still clears the wave-10 champion (' + r.sec.toFixed(1) + 's)');
  ok(r.g.campHp === 500, 'camp untouched: 500/500');
  ok(approx(r.sec, 32.5, 1.0), 'duration matches the U10 benchmark: ' + r.sec.toFixed(1) + 's vs ~32.5s');
  console.log('  [sim] champion clear, auto-fire ON + Ready powers: ' + r.sec.toFixed(1) + 's, camp ' + Math.round(r.g.campHp) + '/' + r.g.campMax); }

console.log(fails === 0 ? '\nALL CHECKS PASSED' : '\n' + fails + ' CHECK(S) FAILED');
process.exit(fails ? 1 : 0);
