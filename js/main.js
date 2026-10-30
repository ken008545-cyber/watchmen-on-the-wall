// Watchmen on the Wall — Conquest. Plain JS + Phaser 3. (Tower defense retired 2026-10-30; heroes/battle pass kept.)
const W=1280,H=720,HUD_Y=610;
// Upgrade 3: the camp's health is the run's life. CAMP_MAX hit points; if it falls, the run falls.
const CAMP_MAX=500;
// Upgrade 4: the camp has its own upgrade track, bought per-run in the shop.
// Fortify tiers raise (and heal by) hpAdd; "req" chains them like unit upgrades.
const CAMP_UPGRADES=[
  {id:'fortify1', name:'Fortify I', cost:200, hpAdd:150, req:null},
  {id:'fortify2', name:'Fortify II', cost:320, hpAdd:200, req:'fortify1'},
  {id:'fortify3', name:'Fortify III', cost:450, hpAdd:250, req:'fortify2'},
  {id:'swift', name:'Swift Return', cost:300, req:null},
  {id:'watchfire', name:'Watch Fire', cost:500, req:null},
];
const CAMP_REPAIR={cost:90, heal:100};
const CAMP_FIRE={range:240, dmg:10, rate:1.2};
// Upgrade 5: Grokonian orbs — kennin's wall-buys, modelled on the wall guns
// of Black Ops Zombies. Five glowing stations stand fixed in the world; walk
// the hero up, tap the orb, and spend Grokonians MID-WAVE for its power.
// Timed buffs refresh their duration when re-bought — magnitude never stacks.
// 'dur' is seconds (0 = instant effect). Costs are Grokonians (Tokens.spend).
const ORBS=[
  {id:'strength', name:'Orb of Strength', short:'Strength', color:0xd83a2a, css:'#ff9a86', cost:15, dur:60, fx:'Hero damage +50% for 60s'},
  {id:'swiftness', name:'Orb of Swiftness', short:'Swiftness', color:0x3ac8d8, css:'#9ae8f2', cost:12, dur:60, fx:'Hero and squads move +30% faster for 60s'},
  {id:'mending', name:'Orb of Mending', short:'Mending', color:0x63c74d, css:'#a8e89a', cost:20, dur:0, fx:'Hero restored, squads healed +50%, camp +75 — right now'},
  {id:'iron', name:'Orb of Iron', short:'Iron', color:0xc8ccd4, css:'#e8ecf2', cost:18, dur:30, fx:'The camp cannot be harmed for 30s'},
  {id:'thunder', name:'Orb of Thunder', short:'Thunder', color:0xf2c14e, css:'#ffe08a', cost:25, dur:0, fx:'Lightning strikes every enemy on the field — right now'},
];
const ORB_CD=15; // seconds an orb sleeps after a purchase
const ORB_RANGE=90; // the hero must stand this close to touch an orb
// Upgrade 6: kennin's wave-flow ruling (2026-10-30, from his own playtest):
// no click is ever required to advance. EVERY between-wave shop — the first
// shop of a run included — runs a full minute of intermission on a visible
// countdown, giving real time to upgrade and buy soldiers; at zero the next
// wave starts on its own. "Next Wave Now" stays for finishing shopping early.
const SHOP_COUNTDOWN=60; // seconds of intermission between waves
// Upgrade 7: the goal-wave champion fights in THREE PHASES keyed to its HP
// (bossPhaseSync / bossTick in the Game scene). Phases add mechanics and
// tempo only — the champion's HP and base damage stay exactly on the
// flattened curve (spawn: wave scale x5 HP / x1.6 dmg); nothing here
// inflates them, so kennin's law holds: hard, skill-only, never impossible.
//  Phase I   (100-66%): a telegraphed HEAVY STRIKE — heavyWindup seconds
//    standing committed (red ring, range+heavyRangePad), then a cleave for
//    heavyMul x a normal blow to everyone still inside; step out, it whiffs.
//  Phase II  ( 66-33%): on entry the champion CALLS AN ESCORT (escortCount
//    era enemies, once per entry, announced) and gains a periodic GROUND
//    SLAM: a marked circle (slamRadius) drawn at its prey, slamDelay
//    seconds to clear it, then slamMul x damage to everyone still inside.
//  Phase III (below 33%): ENRAGE — movement x enrageSpeedMul, attack period
//    x enrageRateMul, heavy strikes heavier (enrageHeavyMul) and more
//    frequent (enrageHeavyEvery). No new summons, no stat growth: the
//    pressure is tempo, not numbers. Phases are monotonic — a healed
//    champion never un-enrages, and the escort is never re-called.
const BOSS={ p2At:2/3, p3At:1/3,
  heavyEvery:6, heavyWindup:1.1, heavyMul:3, heavyRangePad:26,
  slamEvery:7, slamDelay:1.2, slamRadius:110, slamMul:2, escortCount:4,
  enrageSpeedMul:1.35, enrageRateMul:0.7, enrageHeavyEvery:4.5, enrageHeavyMul:4 };
// Upgrade 9: COMMAND & CARE — kennin's three rulings from the 2026-10-30
// call. (1) The army no longer trails the hero by default: squads post where
// they stand until directed (tap-to-order, below); the command bar speaks
// to the SELECTED squad, or to the whole army when the hero is selected;
// Follow Me is an order again, not the default. (2) The camp's care
// (Fortify / Repair / Swift Return / Watch Fire) is reachable MID-WAVE
// from a camp panel that shares the shop's single state and prices.
// (3) Orbs announce themselves like a Minecraft potion: banner, splash,
// drink sound and a labeled buff chip — and one tap from anywhere sends
// the hero to buy (the pending purchase fires on arrival).
const ORDER_NAMES={charge:'Charge',hold:'Hold',follow:'Follow Me',flank:'Flank',fallback:'Fall Back',shieldwall:'Shield Wall'};
// Upgrade 8: HELD-POWER MASTERY — "patience is power", kennin's own mechanic
// grown from his own play (2026-10-30): cornered by five hard trolls, he held
// his power moves until the moment was forced, spent them, and lived. Every
// hero power move, while OFF cooldown and unspent, accrues charge in battle
// (never in the shop — patience is earned in the fight): Ready at once,
// Tempered after temperAt seconds held, Perfect after perfectAt. Spending
// multiplies the MOVE's effect by mul[tier] — damage, control durations,
// buff durations, yields — and a Perfect spend adds a perfectStun-second
// stun rider to every enemy the move touches. The multipliers touch the
// move only: enemy stats and the wave curve are never read from here, and a
// player who spends everything at Ready (mul 1) plays exactly the pre-U8
// game. The tension: a heavy hit (the champion's heavy strike / ground
// slam class — hurtHero's heavy flag) knocks a Perfect charge out of the
// hero's hands, down to Tempered; ordinary chip damage never does.
// INPUT_BUFFER is the press forgiveness: a skill pressed within this many
// seconds of its cooldown ending still fires the moment it is ready.
const HELD={ temperAt:20, perfectAt:45, mul:[1,1.5,2.25], names:['Ready','Tempered','Perfect'], perfectStun:0.6 };
const INPUT_BUFFER=0.15;
// Upgrade 8, second half — kennin's combat-controls design (voice,
// 2026-10-30): TWO HANDS — ONE MARCHES, ONE FIGHTS. One hand taps the map
// to move (tap-to-move, unchanged); the other works an on-screen FIGHT
// CLUSTER on the right side of the screen. Upgrade 8 made the hero's
// basic attacks manual (LIGHT/HEAVY buttons); Upgrade 10 (below) carries
// kennin's reversal of that half. What survives of the kit:
//  DODGE — a dodgeDist dash in the facing / last-move direction with
//    dodgeIframes of true invulnerability: the skilled answer to the
//    champion's telegraphed heavies, beside repositioning (U7's intent).
//  BLOCK — hold to mitigate: blockMit off ordinary blows, blockHeavyMit
//    off heavy-class blows (reduced, NEVER erased — a boss heavy still
//    lands through a guard). Guarding drains stamina and impacts cost
//    more; an emptied guard BREAKS for guardBreak seconds.
//  SPRINT — a toggle: sprintMul movement, draining stamina while moving,
//    impossible while blocking (and blocking cancels it). (Upgrade 8's
//    sprint OPENER — a bonus on a strike pressed out of a sprint —
//    retired with the manual strikes in Upgrade 10: it was a property
//    of the press, and there is no press anymore.)
//  Stamina is one pool shared by block and sprint, so the two hands argue
//  over a single resource — that argument is the fighting game.
const FIGHT={ dodgeDist:150, dodgeTime:0.22, dodgeIframes:0.30, dodgeCd:1.6,
  blockMit:0.65, blockHeavyMit:0.45, blockDrain:12, blockHitCost:8, blockHeavyCost:18, guardBreak:1.2,
  sprintMul:1.45, sprintDrain:8,
  stamMax:100, stamRegen:16, stamDelay:0.6 };
// Upgrade 10 — AUTO-FIRE, kennin's reversal (voice, 2026-10-30, after
// playtesting the manual scheme): "I would much rather have it auto
// fire. Instead of have a light and heavy attack." The hero's basic
// attacks are automatic again — nearest enemy in range, on his own
// attack clock, the pre-Upgrade-8 behavior — AND the player can turn
// auto-fire OFF (skills and ults still fire by button; the hero simply
// holds his basic attacks). The toggle sits top-right of the battle HUD,
// defaults ON, and the choice persists in localStorage.
const AUTOFIRE_KEY='gxhub_wotw_autofire';
function loadAutoFire(){ try{ const v=localStorage.getItem(AUTOFIRE_KEY); return v===null?true:v==='1'; }catch(e){ return true; } }
function saveAutoFire(on){ try{ localStorage.setItem(AUTOFIRE_KEY,on?'1':'0'); }catch(e){} }
// Upgrade 12 — CONTROLS ARE YOURS (kennin, three rulings, 2026-10-30):
// (1) a custom BUTTON LAYOUT, changed "like people can do in their
// settings on Fortnite" — drag the battle controls where your thumbs
// want them; (2) KEYBINDS — the battle actions rebindable from a
// Settings list, click-to-capture; (3) MOVEMENT SCHEMES — the hero walks
// by TAP (the original), by a virtual JOYSTICK, or Slither-style FOLLOW
// (hold on the field and he runs to your finger, arrow showing the way).
// All three persist per player in localStorage, in one settings family:
// gxhub_wotw_layout / gxhub_wotw_binds / gxhub_wotw_move. The battle
// builds every control at its Upgrade-10 default FIRST and applies a
// saved layout afterwards, so with no save the geometry is byte-for-byte
// the approved sketch. Scope call, stated plainly: positions only — no
// button scaling in this upgrade (a container's hit area does not scale
// as simply as its face, and an honest hit area matters more than the
// extra knob; size stays the approved 110x56 / 196x56 family).
const LAYOUT_KEY='gxhub_wotw_layout', BINDS_KEY='gxhub_wotw_binds', MOVE_KEY='gxhub_wotw_move';
// The movable battle controls: [id, editor label, w, h, default x, default y].
// The defaults ARE the Upgrade-10 geometry (stack x 1178; row from x 130,
// pitch 117, y HUD_Y+55=665).
const LAYOUT_DEFS=[
  ['autofire','AUTO-FIRE',196,56,1178,70],['dodge','DODGE',196,56,1178,176],['block','BLOCK',196,56,1178,240],['sprint','SPRINT',196,56,1178,304],
  ['skill0','Power 1',196,56,1178,368],['skill1','Power 2',196,56,1178,432],['skill2','Power 3',196,56,1178,496],
  ['cmd_charge','Charge',110,56,130,665],['cmd_hold','Hold',110,56,247,665],['cmd_follow','Follow Me',110,56,364,665],['cmd_flank','Flank',110,56,481,665],
  ['cmd_fallback','Fall Back',110,56,598,665],['cmd_shieldwall','Shield Wall',110,56,715,665],['cmd_volley','Volley',110,56,832,665],
  ['cmd_camp','CAMP',110,56,949,665],['cmd_rally','Rally',110,56,1066,665]];
function defaultLayoutPos(){ const o={}; LAYOUT_DEFS.forEach(d=>{ o[d[0]]={x:d[4],y:d[5]}; }); return o; }
function loadLayout(){ try{ const v=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null'); if(v&&v.pos&&typeof v.pos==='object') return v; }catch(e){} return null; }
function saveLayout(pos){ try{ localStorage.setItem(LAYOUT_KEY,JSON.stringify({pos})); }catch(e){} }
function resetLayout(){ try{ localStorage.removeItem(LAYOUT_KEY); }catch(e){} }
function layoutPositions(){ return Object.assign(defaultLayoutPos(),(loadLayout()||{pos:{}}).pos||{}); }
// Keybinds: [action id, Settings label]. The keyboard drives the SAME
// action functions the buttons drive (Game.keyAction) — no parallel
// logic. Defaults, chosen and recorded: Space dodges (the panic key
// under the thumb), Shift holds the guard, 1/2/3 are the powers in
// stack order, Q/E are the two targeting modes, B opens the camp, T
// flips auto-fire, and the orders sit on the Z X F G H J home row.
const BIND_ACTIONS=[
  ['dodge','Dodge'],['block','Block (hold)'],['sprint','Sprint'],['skill0','Power 1 (top)'],['skill1','Power 2'],['skill2','Power 3 (ult)'],['autofire','Auto-fire toggle'],['camp','Camp panel'],
  ['volley','Volley'],['rally','Rally'],['charge','Order: Charge'],['hold','Order: Hold'],['follow','Order: Follow Me'],['flank','Order: Flank'],['fallback','Order: Fall Back'],['shieldwall','Order: Shield Wall']];
const DEFAULT_BINDS={ dodge:'Space', block:'ShiftLeft', sprint:'KeyV', skill0:'Digit1', skill1:'Digit2', skill2:'Digit3', autofire:'KeyT', camp:'KeyB',
  volley:'KeyQ', rally:'KeyE', charge:'KeyZ', hold:'KeyX', follow:'KeyF', flank:'KeyG', fallback:'KeyH', shieldwall:'KeyJ' };
function loadBinds(){ const b=Object.assign({},DEFAULT_BINDS);
  try{ const v=JSON.parse(localStorage.getItem(BINDS_KEY)||'null'); if(v&&typeof v==='object') BIND_ACTIONS.forEach(([id])=>{ if(typeof v[id]==='string'&&v[id]) b[id]=v[id]; }); }catch(e){}
  return b; }
function saveBinds(b){ try{ localStorage.setItem(BINDS_KEY,JSON.stringify(b)); }catch(e){} }
function bindLabel(id){ const f=BIND_ACTIONS.find(a=>a[0]===id); return f?f[1]:id; }
function keyName(code){ if(!code) return '—';
  const map={Space:'Space',ShiftLeft:'Shift (left)',ShiftRight:'Shift (right)',ControlLeft:'Ctrl (left)',ControlRight:'Ctrl (right)',AltLeft:'Alt (left)',AltRight:'Alt (right)',Escape:'Esc',Enter:'Enter',Tab:'Tab',Backspace:'Backspace',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'};
  if(map[code]) return map[code];
  if(code.indexOf('Key')===0) return code.slice(3); if(code.indexOf('Digit')===0) return code.slice(5); return code; }
function loadMoveScheme(){ try{ const v=localStorage.getItem(MOVE_KEY); return (v==='stick'||v==='follow')?v:'tap'; }catch(e){ return 'tap'; } }
function saveMoveScheme(s){ try{ localStorage.setItem(MOVE_KEY,s); }catch(e){} }
// The drag editor, shared by the battle pause and the menu's Controls
// scene (which edits ghost buttons at the same real positions). While
// it is active the items are NOT interactive — a drag can never fire a
// button's action — and positions clamp so a button always stays fully
// on screen. onSave fires when a drag ends.
function layoutEditor(scene,onSave){ const ed={ active:false, drag:null, items:[],
  setItems(items){ ed.items=items||[]; },
  enter(){ ed.active=true; ed.items.forEach(it=>{ if(it.obj.disableInteractive) it.obj.disableInteractive(); }); },
  exit(){ ed.active=false; ed.drag=null; ed.items.forEach(it=>{ if(it.obj.setInteractive) it.obj.setInteractive({useHandCursor:true}); }); },
  down(p){ if(!ed.active||!p) return false;
    for(let i=ed.items.length-1;i>=0;i--){ const it=ed.items[i];
      if(Math.abs(p.x-it.obj.x)<=it.w/2&&Math.abs(p.y-it.obj.y)<=it.h/2){ ed.drag={it,dx:p.x-it.obj.x,dy:p.y-it.obj.y}; return true; } }
    return false; },
  move(p){ if(!ed.active||!ed.drag||!p) return; const it=ed.drag.it;
    const nx=Math.max(it.w/2,Math.min(W-it.w/2,p.x-ed.drag.dx)), ny=Math.max(it.h/2,Math.min(H-it.h/2,p.y-ed.drag.dy));
    it.obj.setPosition(nx,ny); if(it.sync) it.sync(nx,ny); },
  up(){ if(ed.drag){ ed.drag=null; if(onSave) onSave(); } } };
  if(scene.input&&scene.input.on){ scene.input.on('pointerdown',p=>ed.down(p)); scene.input.on('pointermove',p=>ed.move(p)); scene.input.on('pointerup',()=>ed.up()); }
  return ed; }
// Upgrade 11 — TUTORIAL MODE (kennin, voice 2026-10-30: "I like tutorial
// mode more... All right, I approve that. You can work on the tutorial
// mode.") A guided layer over the REAL battle scene and the REAL controls
// — not a mock: the same hero, buttons, squads, camp panel and orbs, with
// practice dummies standing in for waves. There is no wave timer, the
// camp cannot fall, the hero cannot die, and the run is self-contained:
// no Manna, Grokonian, progression, battle-pass, score or saved-squad
// state can move in here. The ONLY things that persist are the two flags
// below, and they exist solely to stop the game SUGGESTING the tutorial —
// the completion flag (set at FINISH) and the offered flag (set when the
// first-run prompt is shown). Neither locks anything; the tutorial stays
// replayable from the menu forever.
const TUTORIAL_KEY='gxhub_wotw_tutorial_done';
const TUTORIAL_OFFER_KEY='gxhub_wotw_tutorial_offered';
function tutorialDone(){ try{ return localStorage.getItem(TUTORIAL_KEY)==='1'; }catch(e){ return false; } }
function setTutorialDone(){ try{ localStorage.setItem(TUTORIAL_KEY,'1'); }catch(e){} }
function tutorialOffered(){ try{ return localStorage.getItem(TUTORIAL_OFFER_KEY)==='1'; }catch(e){ return false; } }
function setTutorialOffered(){ try{ localStorage.setItem(TUTORIAL_OFFER_KEY,'1'); }catch(e){} }
function tutPromptNeeded(){ return !tutorialDone()&&!tutorialOffered(); }
// Practice dummies (spawnTutDummy): the Pebble Golem's own figure and data
// path, tutorial numbers — slow, harmless (dmg 0), and they stop at the
// edge of the hero's circle (stop is inside David's 140 range, so
// auto-fire can always reach them; the golem's own 150 range would park
// them outside it).
const TUT_DUMMY={ hp:120, sturdyHp:320, dmg:0, speed:26, spawnDist:300, stop:110 };
// display heights (px) for atlas sprites
const SZ={moses:60,elijah:58,esther:58,noah:60,franklite:56,washingtoon:60,lincolnlog:64,oakley:58,david:58,deborah:58,gideon:58,samson:66,locust:34,frog:38,froglet:22,spearman:52,priest:52,golem:66,bearer:56,goliath:140,tower:66};
function spr(s,x,y,key,h){ const im=s.add.image(x,y,'spr',key); im.setScale((h||SZ[key]||50)/im.height); im.baseScale=im.scaleX; return im; }
// Real unit art cut from Formara's era sheets (tools/cut_units.py). A unit def
// with an "img" field uses its cut PNG; anything without one falls back to the
// old atlas sprite, unchanged.
const UNIT_IMGS=['u_shepherd_militia','u_shepherd_slinger','u_idol_golem','u_pebble_golem','u_cohortman','u_javelineer','u_brass_empire','u_brass_dart_thrower','u_man_at_arms','u_longbowman','u_gloom_barons','u_gloom_crossbow','u_musket_line','u_rifleman','u_crown_of_fog','u_fog_musketeer','u_line_infantry','u_sharpshooter','u_rust_raiders','u_rust_raider_blaster','u_trooper','u_marksman','u_clockwork_legion','u_clockwork_popper','u_peacekeeper','u_paintball_marksman','u_glitch_horde','u_glitch_painter'];
function uspr(s,x,y,def,h){ if(def.img&&s.textures.exists(def.img)){ const im=s.add.image(x,y,def.img); im.setScale((h||54)/im.height); im.baseScale=im.scaleX; return im; } return spr(s,x,y,def.sprite||'david',h); }
function applyTint(im,def){ if(def.tint&&!def.img) im.setTint(parseInt(def.tint)); }
const FONT={fontFamily:'Georgia, "Times New Roman", serif'};
const PARCH='#e8d9b0', GOLD='#d9a441';
let DATA=null; const DATA_P=()=>Progress.data;
const txt=(s,x,y,str,size,col,o)=>s.add.text(x,y,str,Object.assign({},FONT,{fontSize:size+'px',color:col||PARCH,stroke:'#140c07',strokeThickness:4},o||{}));
function button(s,x,y,w,h,label,cb,opt){ opt=opt||{};
  const c=s.add.container(x,y); const g=s.add.graphics();
  const draw=(hl)=>{g.clear();g.fillStyle(opt.disabled?0x2a2018:(hl?0x5a3a1e:0x3a2412),0.95);g.fillRoundedRect(-w/2,-h/2,w,h,8);g.lineStyle(3,opt.disabled?0x5a4a3a:0xd9a441,1);g.strokeRoundedRect(-w/2,-h/2,w,h,8);};
  draw(false); const t=txt(s,0,0,label,opt.size||20,opt.disabled?'#7a6a5a':PARCH).setOrigin(0.5);
  c.add([g,t]); c.setSize(w,h).setInteractive({useHandCursor:true});
  c.on('pointerover',()=>draw(true)); c.on('pointerout',()=>{ c.setScale(1); draw(false); });
  // Upgrade 8: button weight — every button in the game presses like it has
  // mass: it dips and lights the instant a finger lands, and springs back on
  // release, so a press is felt before the action lands.
  c.on('pointerdown',()=>{ if(opt.disabled) return; c.setScale(0.93); draw(true); });
  c.on('pointerup',(p,lx,ly,e)=>{ if(e) e.stopPropagation(); c.setScale(1); draw(false); SFX.unlock(); if(!opt.disabled) cb(); });
  c.label=t; c.redraw=draw; return c; }

// ---------- Boot: a real loading screen (Upgrade 3) ----------
// Only the logo is preloaded the classic way; everything else is queued from
// create() behind the loading screen, so the logo, title, progress bar and a
// rotating tip are on screen while the game loads. The screen holds for a
// minimum beat after loading completes instead of flashing past.
const LOAD_TIPS=[
  'Tip: Fallen squads do not return — protect them, and mend them between waves.',
  'Tip: Volley needs a ranged squad. Tap Volley, then tap a spot on the field.',
  'Tip: Shield Wall slows your squads, but cuts the hurt they take.',
  'Tip: Your hero returns only while the camp stands. Guard the tent.',
  'Tip: Coins on the field are worth the walk — every sixth coin is a Grokonian.',
  'Tip: Night waves: enemies march faster; your ranged squads shoot farther.',
  'Tip: Enemies march on the camp. A defender close by can block their road.',
  'Tip: Glowing orbs in the field sell powers for Grokonians — walk your hero up and tap one, even mid-wave.',
  'Tip: The goal-wave champion telegraphs its heavy blows — when the red ring closes or a circle is marked, MOVE.',
  'Tip: Held Power: a power move left ready grows stronger — Tempered, then Perfect. Spend it at the forced moment. But a heavy blow knocks Perfect out of your hands.',
  'Tip: Your hero strikes on his own — auto-fire. The big AUTO-FIRE button (top right) turns it off if you want power moves only.',
  'Tip: New to the wall? The Tutorial on the menu teaches the whole fight at the camp — no danger, no timer.',
  'Tip: Rally plants a banner: tap Rally, then tap the ground — the selected squad, or the whole army, moves to it and holds.',
  'Tip: DODGE makes you untouchable for a blink; BLOCK softens a blow but a boss heavy still lands through it. Sprint in, strike the opener, get out.',
  'Tip: Your squads hold their ground until you direct them — tap a squad, then tap where it should post up. Orders from the command bar go to the selected squad, or to the whole army when your hero is selected.',
  'Tip: The camp can be cared for mid-wave — tap the camp or the CAMP button to Fortify, Repair, and light the Watch Fire without leaving the fight.',
  'Tip: Tap an orb once and your hero will walk up and buy it — watch for the banner: it names the power and what it does.'
];
class Boot extends Phaser.Scene{ constructor(){super('Boot');}
  preload(){ this.load.image('logo','assets/logo.png'); }
  create(){ const t0=performance.now();
    this.add.rectangle(W/2,H/2,W,H,0x0d0906);
    if(this.textures.exists('logo')){ const lg=this.add.image(W/2,225,'logo'); lg.setScale(280/lg.height); }
    txt(this,W/2,415,'WATCHMEN ON THE WALL',44,GOLD).setOrigin(0.5);
    txt(this,W/2,462,'Conquest',22,'#cdbd95').setOrigin(0.5);
    const barBg=this.add.graphics(); barBg.lineStyle(2,0xd9a441,1); barBg.strokeRect(W/2-260,522,520,18);
    const bar=this.add.graphics();
    const pct=txt(this,W/2,566,'Loading… 0%',18,PARCH).setOrigin(0.5);
    let tipI=0; const tip=txt(this,W/2,636,LOAD_TIPS[0],17,'#cdbd95',{align:'center',wordWrap:{width:900}}).setOrigin(0.5);
    this.time.addEvent({delay:2400,loop:true,callback:()=>{ tipI=(tipI+1)%LOAD_TIPS.length; tip.setText(LOAD_TIPS[tipI]); }});
    this.load.on('progress',v=>{ bar.clear(); bar.fillStyle(0xd9a441,1); bar.fillRect(W/2-256,526,512*v,10); pct.setText('Loading… '+Math.round(v*100)+'%'); });
    this.load.on('loaderror',()=>{}); // a missing optional file (music, a unit PNG) must never stall the load
    this.load.json('data','data/game.json'); this.load.json('prog','data/progression.json'); this.load.image('bg','assets/bg_elah.jpg'); this.load.json('worlds','data/worlds.json'); this.load.json('eras','data/eras.json'); this.load.json('units','data/units.json'); ['elah','jericho','egypt','babylon','liberty','toon'].forEach(w=>this.load.image('bg_'+w,'assets/bg_'+w+'.jpg')); this.load.atlas('spr','assets/sprites.png','assets/sprites.json'); UNIT_IMGS.forEach(k=>this.load.image(k,'assets/units/'+k+'.png'));
    // Music slots (Upgrade 3): kennin's own tracks drop in here later. A 404 is fine — Music falls back to its pad.
    // No music files are loaded: kennin ruled 2026-10-30 that the generative
    // pad he heard on the loading screen is the music he wants — his own
    // battle track was removed at his word. Music.play() falls back to the
    // pad whenever no track is cached, which is now always.
    this.load.once('complete',()=>{ DATA=this.cache.json.get('data'); Progress.init(this.cache.json.get('prog'),DATA); Levels.init(this.cache.json.get('worlds'),DATA.enemies); ERAS=this.cache.json.get('eras'); UNITS=this.cache.json.get('units'); makeArt(this); makeArt2(this);
      const wait=Math.max(0,900-(performance.now()-t0));
      this.time.delayedCall(wait,()=>this.scene.start('Menu')); });
    this.load.start(); } }

function backdrop(s,dim,key){ s.add.image(W/2,H/2,key||'bg').setDisplaySize(W,H); s.add.rectangle(W/2,H/2,W,H,0x0d0906,dim); }

class Menu extends Phaser.Scene{ constructor(){super('Menu');}
  create(){ backdrop(this,0.55); Music.play(this,'menu');
    const lg=this.add.image(W/2,124,'logo'); lg.setScale(252/lg.height); this.tweens.add({targets:lg,scale:lg.scale*1.03,duration:1800,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    txt(this,W/2,262,'"I have set watchmen upon thy walls, O Jerusalem" Isaiah 62:6',20).setOrigin(0.5);
    const ds=Levels.dailySpec(), db=Levels.dailyBest(); txt(this,W/2,300,'Daily Challenge: '+Levels.world(ds.world).name+' '+(ds.index+1)+' (Hard)'+(db?'  •  best '+db.score:''),22).setOrigin(0.5);
    button(this,W/2-160,370,300,58,'Play',()=>this.scene.start('EraSelect'),{size:28});
    button(this,W/2+160,370,300,58,'Heroes',()=>this.scene.start('HeroSelect',{browse:true}),{size:26});
    button(this,W/2-160,440,300,58,'Battle Pass',()=>this.scene.start('BattlePass'),{size:26});
    button(this,W/2+160,440,300,58,'Profile & Level',()=>this.scene.start('Profile'),{size:24});
    button(this,W/2-160,510,300,50,'Unlocks',()=>this.scene.start('Unlocks'),{size:22});
    const m=button(this,725,510,140,50,'Sound: on',()=>{ m.label.setText('Sound: '+(SFX.toggle()?'off':'on')); },{size:16});
    const mu=button(this,875,510,140,50,'Music: '+(Music.enabled()?'on':'off'),()=>{ mu.label.setText('Music: '+(Music.toggle()?'on':'off')); },{size:16});
    // Upgrade 12: the Controls door — movement scheme, keybinds and the
    // button-layout editor live in the Settings scene.
    button(this,1112,510,300,50,'Controls',()=>this.scene.start('Settings'),{size:20});
    button(this,1150,42,220,46,'Fullscreen',()=>{ try{ this.scale.startFullscreen(); }catch(e){} },{size:17});
    // Upgrade 11: the tutorial's front door — always here, never locked,
    // replayable any time. It runs the Bible era with David, the hero the
    // lesson is written for (its power step names Psalm and Five Stones).
    button(this,W/2,566,280,38,'Tutorial',()=>this.scene.start('Game',{hero:'david',level:{era:'bible'},tutorial:true}),{size:18});
    const L=Progress.level(), T=Progress.state.title;
    txt(this,W/2,612,'Level '+L.lv+'  •  Account '+Progress.accountLevel()+'  •  Battle Pass tier '+Progress.bpTier()+'/30'+(T?'  •  "'+Progress.titleName(T)+'"':''),20).setOrigin(0.5);
    txt(this,W/2,652,'Grokonians: '+Tokens.balance(),24,GOLD).setOrigin(0.5); txt(this,W/2,694,'A GX Hub game'+(Tokens.mode==='hub'?'  (connected to GX Hub)':''),18).setOrigin(0.5);
  } }

function heroUnlocked(h){ return Progress.heroUnlocked(h); }
function lockLabel(h){ const u=h.unlock; return u.type==='grokonians'?u.cost+' Grokonians':(u.label||u.type); }

class HeroSelect extends Phaser.Scene{ constructor(){super('HeroSelect');}
  init(d){ this.browse=!!(d&&d.browse); this.level=(d&&d.level)||{era:'bible'}; }
  create(){ backdrop(this,0.7); Music.play(this,'menu');
    txt(this,W/2,36,this.browse?'Heroes':'Choose your Hero',38,GOLD).setOrigin(0.5);
    txt(this,W/2,76,'Grokonians: '+Tokens.balance()+'   •   Mastery gives +2% damage and HP per level, and faster skills at level 5',17,GOLD).setOrigin(0.5);
    DATA.heroes.forEach((h,i)=>{ const col=i%6,row=Math.floor(i/6),x=113+col*211,y=230+row*286, ok=heroUnlocked(h), M=Progress.mastery(h.id);
      const g=this.add.graphics(); g.fillStyle(h.theme==='liberty'?0x1a1e26:0x2a1a10,0.93); g.fillRoundedRect(x-100,y-134,200,272,10); g.lineStyle(3,ok?0xd9a441:0x5a4a3a); g.strokeRoundedRect(x-100,y-134,200,272,10);
      const im=spr(this,x,y-72,h.id,104); if(ok) this.tweens.add({targets:im,scaleY:im.scaleY*1.04,y:im.y-3,yoyo:true,repeat:-1,duration:900+i*37,ease:'Sine.inOut'}); else im.setTint(0x222222);
      txt(this,x,y-6,h.name,16,ok?PARCH:'#8a7a6a',{align:'center',wordWrap:{width:190}}).setOrigin(0.5);
      txt(this,x,y+20,h.role+' • HP '+h.hp+(ok?' • M'+M.lv:''),14).setOrigin(0.5);
      txt(this,x,y+56,h.skills.map(k=>k.name).join(', ')+'\nUlt: '+h.ult.name,13,'#cdbd95',{align:'center',wordWrap:{width:186}}).setOrigin(0.5);
      if(ok) button(this,x,y+108,170,40,this.browse?'Mastery '+M.lv+(M.max?' (max)':''):'Lead',()=>{ if(this.browse) return;
        // Upgrade 11: a fresh profile's FIRST battle entry is offered the
        // tutorial once — a prompt, never a lock. Either choice is honored
        // at once, and the offered flag is set the moment the prompt shows,
        // so it never nags again. Later battle entries go straight in.
        if(tutPromptNeeded()) this.tutPrompt(h.id);
        else this.scene.start('Game',{hero:h.id,level:this.level}); },{size:16,disabled:this.browse});
      else if(h.unlock.type==='grokonians') button(this,x,y+108,186,40,'Unlock '+h.unlock.cost+' G',()=>{ if(Tokens.spend('hero:'+h.id,h.unlock.cost)){Tokens.grant(h.id);Progress.checkAch();SFX.build();this.scene.restart({browse:this.browse,level:this.level});} },{disabled:Tokens.balance()<h.unlock.cost,size:15});
      else txt(this,x,y+108,'🔒 '+lockLabel(h),14,'#a08a6a',{align:'center',wordWrap:{width:186}}).setOrigin(0.5);
    });
    button(this,90,680,140,46,'Back',()=>this.browse?this.scene.start('Menu'):this.scene.start('EraSelect'));
  }
  // Upgrade 11: the one-time first-battle offer (see the Lead button).
  tutPrompt(heroId){ if(this._tutPromptOpen) return; this._tutPromptOpen=true; setTutorialOffered();
    const g=this.add.graphics(); g.fillStyle(0x140c07,0.97); g.fillRoundedRect(W/2-330,240,660,190,12); g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-330,240,660,190,12);
    txt(this,W/2,272,'New here?',26,GOLD).setOrigin(0.5);
    txt(this,W/2,322,'The tutorial teaches the fight at the camp — moving, auto-fire,\nyour powers, your squads, the camp and the orbs. No danger, no timer.',16,PARCH,{align:'center'}).setOrigin(0.5);
    button(this,W/2-140,390,240,48,'Tutorial',()=>this.scene.start('Game',{hero:heroId,level:this.level,tutorial:true}),{size:18});
    button(this,W/2+140,390,240,48,'Start the battle',()=>this.scene.start('Game',{hero:heroId,level:this.level}),{size:18});
  } }

class Unlocks extends Phaser.Scene{ constructor(){super('Unlocks');}
  create(){ backdrop(this,0.7); const U=DATA.unlocks;
    txt(this,W/2,60,'Unlocks',44,GOLD).setOrigin(0.5);
    txt(this,W/2,110,'Grokonians: '+Tokens.balance()+'   (earned by playing only — no store, no real money)',20,GOLD).setOrigin(0.5);
    let y=150; txt(this,200,y,'Heroes (more in Battle Pass and Heroes)',24); y+=44;
    DATA.heroes.filter(h=>h.unlock.type==='grokonians').forEach(h=>{ const ok=heroUnlocked(h);
      txt(this,220,y,h.name+' ('+h.role+')',22); const lbl=ok?'Owned':(h.unlock.type==='grokonians'?h.unlock.cost+' Grokonians':h.unlock.label);
      button(this,820,y+12,260,42,lbl,()=>{ if(Tokens.spend('hero:'+h.id,h.unlock.cost)){Tokens.grant(h.id);SFX.build();this.scene.restart();} },{disabled:ok||h.unlock.type!=='grokonians'||Tokens.balance()<h.unlock.cost,size:18}); y+=46; });
    y+=6; txt(this,200,y,'Unit styles',24); y+=40; const skinsAll=U.skins;
    skinsAll.forEach((k,si)=>{ const own=Tokens.owns('skin:'+k.id), on=Tokens.skin===k.id; txt(this,220,y,k.name,22);
      button(this,820,y+12,260,34,on?'Equipped (tap to remove)':own?'Equip':k.bpOnly?'Battle Pass reward':k.cost+' Grokonians',()=>{ if(on){Tokens.skin=null;} else if(own){Tokens.skin=k.id;} else if(!k.bpOnly&&Tokens.spend('skin:'+k.id,k.cost)){Tokens.grant('skin:'+k.id);Tokens.skin=k.id;} this.scene.restart(); },{disabled:!own&&(k.bpOnly||Tokens.balance()<k.cost),size:15}); y+=38; });
    y+=6; const p=U.perk; txt(this,200,y,'Perk',24); y+=36; txt(this,220,y,p.name+'  rank '+Tokens.perk+'/'+p.max,20);
    button(this,820,y+12,260,42,Tokens.perk>=p.max?'Maxed':p.cost+' Grokonians',()=>{ if(Tokens.spend('perk:manna',p.cost)){Tokens.perk=Tokens.perk+1;this.scene.restart();} },{disabled:Tokens.perk>=p.max||Tokens.balance()<p.cost,size:18});
    button(this,90,670,140,46,'Back',()=>this.scene.start('Menu'));
  } }


// ---------- Eras (conquest campaign structure; replaces WorldMap/LevelMap) ----------
let ERAS=null, UNITS=null;
const CQ_KEY='gxhub_wotw_conquest_v1';
const CQ={ load(){ try{ return Object.assign({stars:{}},JSON.parse(localStorage.getItem(CQ_KEY)||'{}')); }catch(e){ return {stars:{}}; } },
  save(s){ try{ localStorage.setItem(CQ_KEY,JSON.stringify(s)); }catch(e){} } };
function eraById(id){ return ERAS.eras.find(e=>e.id===id)||ERAS.eras[0]; }
function cqStars(eraId){ return CQ.load().stars[eraId]||0; }
function cqRecordStars(eraId,stars){ const s=CQ.load(); if(stars>(s.stars[eraId]||0)){ s.stars[eraId]=stars; CQ.save(s); } }
// Flattened late-game curve (SPEC): HP +3%/wave to 50, +1.5% to 150, +0.7% beyond; damage at half rate.
function curveScale(wave, hpRate, midRate, lateRate){ let s=1; const steps=Math.max(0,wave-1);
  s*=Math.pow(1+hpRate,Math.min(steps,49));
  s*=Math.pow(1+midRate,Math.min(Math.max(steps-49,0),100));
  s*=Math.pow(1+lateRate,Math.max(steps-149,0)); return s; }
const hpScaleForWave=w=>curveScale(w,0.03,0.015,0.007);
const dmgScaleForWave=w=>curveScale(w,0.015,0.0075,0.0035);

class EraSelect extends Phaser.Scene{ constructor(){super('EraSelect');}
  create(){ backdrop(this,0.72); Music.play(this,'menu');
    txt(this,W/2,40,'Choose an Era',40,GOLD).setOrigin(0.5);
    txt(this,W/2,84,'Conquest — lead your hero and his squads.  Goal: survive wave '+ERAS.goalWave+'.',19).setOrigin(0.5);
    ERAS.eras.forEach((e,i)=>{ const col=i%4,row=Math.floor(i/4),x=172+col*312,y=row===0?252:512, open=!!e.playable;
      if(open) this.add.image(x,y,'bg_elah').setDisplaySize(292,190);
      const g=this.add.graphics(); g.fillStyle(open?0x140c07:0x1a120c,open?0.35:0.92); g.fillRoundedRect(x-146,y-95,292,190,8);
      g.lineStyle(3,open?0xd9a441:0x5a4a3a); g.strokeRoundedRect(x-146,y-95,292,190,8);
      txt(this,x,y+52,e.name,24,open?PARCH:'#9a8a7a').setOrigin(0.5);
      txt(this,x,y+78,open?('★'.repeat(cqStars(e.id))+'☆'.repeat(3-cqStars(e.id))+'  •  Goal wave '+ERAS.goalWave):'🔒 Coming — battlefield art in progress',13,open?GOLD:'#a08a6a',{align:'center',wordWrap:{width:270}}).setOrigin(0.5);
      if(!open) txt(this,x,y-10,e.blurb,13,'#8a7a6a',{align:'center',wordWrap:{width:260}}).setOrigin(0.5);
      const z=this.add.zone(x,y,292,190).setInteractive({useHandCursor:true}); z.on('pointerup',()=>{ SFX.unlock(); if(open) this.scene.start('HeroSelect',{level:{era:e.id}}); else this.toast(e.name+' is coming in a later update — its battlefield art is not ready yet.'); }); });
    button(this,90,680,140,46,'Back',()=>this.scene.start('Menu'));
    this.msg=txt(this,W/2,632,'',18,'#f2c14e').setOrigin(0.5); }
  toast(m){ this.msg.setText(m); } }

// ---------- Conquest battle (replaces the tower-defense Game scene) ----------
class Game extends Phaser.Scene{ constructor(){super('Game');}
  init(d){ const b=DATA.heroes.find(h=>h.id===(d&&d.hero))||DATA.heroes[0]; this.perk=Progress.perks(b.id); const pk=this.perk;
    this.heroDef=Object.assign({},b,{hp:Math.round(b.hp*pk.hp),dmg:b.dmg*pk.dmg,skills:b.skills.map(k=>Object.assign({},k,{cd:Math.round(k.cd*pk.cd)})),ult:Object.assign({},b.ult,{cd:Math.round(b.ult.cd*pk.cd)})});
    this.eraId=(d&&d.level&&d.level.era)||'bible'; this.era=eraById(this.eraId);
    this.roster=UNITS[this.eraId]||UNITS.bible;
    this.goalWave=ERAS.goalWave; this.squadCap=ERAS.squadCap;
    this.worldW=this.era.worldW||1280; this.worldH=this.era.worldH||720;
    this.runXp=0; this.kills=0; this.pend={}; this.pendXp=0; this.shieldT=0; this.banquet=false; this.earned=0;
    // Upgrade 3: the camp is the defeat meter now — camp HP replaces lives.
    this.campHp=CAMP_MAX; this.campHurtThisWave=false; this.campHurtTotal=false; this.campWarnedWave=0;
    // Upgrade 4: campMax is the single source for the camp's current maximum
    // (CAMP_MAX is only the un-upgraded base). campUp holds this run's bought
    // camp upgrades; respawnTime is what hurtHero() actually waits.
    this.campMax=CAMP_MAX; this.campUp={}; this.respawnTime=8; this.campFireCd=0;
    // Upgrade 5: orb stations (built in create) and the timed buff timers
    // they feed. buffIronT is the HUD-facing mirror of the Iron purchase;
    // the invulnerability itself rides the existing shieldT (see applyOrb).
    this.orbs=[]; this.buffStrT=0; this.buffSpdT=0; this.buffIronT=0;
    // Upgrade 8: per-run Held Power tally — power moves spent at each tier
    // ([Ready, Tempered, Perfect]), read by the end-of-run summary and
    // nowhere else; nothing persists beyond the run.
    this.heldSpent=[0,0,0];
    this.wave=0; this.wavesCleared=0; this.endless=false; this.cleared=false; this.over=false;
    this.coins=[]; this.coinT=3; this.coinSeq=0; this.coinCount=0;
    // Upgrade 9: the standing army order at run start is Hold — squads post
    // where they are bought (at the camp) and stay until directed. Follow
    // exists only as an order now. selSquad is the marching hand's current
    // squad (null = the hero is selected, the default); campPanelOpen and
    // campItems are the mid-wave camp panel's state.
    this.order='hold'; this.volleyMode=false; this.volleyCd=0; this.rallyMode=false; this.rallyPoint=null;
    this.selSquad=null; this.campPanelOpen=false; this.campItems=[];
    this.autoFire=loadAutoFire(); // Upgrade 10: the player's saved choice (default ON)
    // Upgrade 11: tutorial mode — a guided, self-contained run over this
    // same scene (see startTutorial). tutCred records the real actions the
    // player has actually done, whenever they did them, so an action taken
    // early is credited silently when its step arrives.
    this.tutorial=!!(d&&d.tutorial); this.tutStep=-1; this.tutPhase=0; this.tutCred={}; this.tutFinished=false; this.tutDummy=null; this.tutDefs=null;
    // Upgrade 12: the player's controls — movement scheme, keybinds,
    // pause and layout-edit state. The tutorial always teaches TAP: the
    // saved scheme is never written by a tutorial run, so the player's
    // own scheme simply waits outside and is still there after.
    this.moveScheme=this.tutorial?'tap':loadMoveScheme();
    this.binds=loadBinds();
    this.stick=null; this.followOn=false; this.followPt=null; this.pendTap=null;
    this.paused=false; this.layoutEdit=false; this.layoutReg=[]; this.pauseItems=[]; this.editItems=[]; }
  gx(n){ this.runXp+=n; this.pendXp+=n; }
  tr(k,n){ this.pend[k]=(this.pend[k]||0)+(n||1); }
  flush(){ const id=this.heroDef.id; Object.entries(this.pend).forEach(([k,n])=>Progress.track(k,n)); this.pend={};
    if(this.pendXp){ Progress.addXP(this.pendXp,id); this.pendXp=0; }
    if(!this.over) Progress.takeEvents().forEach((m,i)=>this.time.delayedCall(i*1300,()=>this.toast(m,1600))); }
  earn(reason,n){ this.earned+=n; Tokens.earn(reason,n); }

  create(){ Music.play(this,'battle');
    // Upgrade 3: a bigger, explorable world. The battlefield stretches to the
    // era's world size and the camera follows the hero through it.
    const bgImg=this.add.image(0,0,this.era.bg||'bg').setOrigin(0,0).setDisplaySize(this.worldW,this.worldH).setDepth(0);
    this.add.rectangle(this.worldW/2,this.worldH/2,this.worldW,this.worldH,0x0d0906,0.15).setDepth(1);
    this.campPos={x:150,y:600}; this.campSpr=this.add.image(this.campPos.x,this.campPos.y,'camp').setDepth(2);
    this.campBar=this.add.graphics().setDepth(12);
    this.manna=ERAS.startManna; this.speed=1; this.time.timeScale=1;
    this.enemies=[]; this.squads=[]; this.shots=[]; this.spawnQ=[]; this.waveActive=false; this.shopOpen=false; this.victoryOpen=false; this.shopT=0; this.shopEndsAt=0; this.shopPage=0; this.shopItems=[]; this.nightRect=null;
    this.fx=this.add.graphics().setDepth(20);
    this.selFx=this.add.graphics().setDepth(6); // Upgrade 9: the selection ring (world layer, under the fight furniture)
    this.rallyFx=this.add.graphics().setDepth(5); // Upgrade 10: rally banners (world layer, under the selection ring)
    this.buildHero(); this.buildOrbs(); this.buildHUD();
    this.cameras.main.setBounds(0,0,this.worldW,this.worldH);
    this.cameras.main.startFollow(this.hero.spr,true,0.08,0.08);
    this.fixUI();
    this.input.on('pointerdown',p=>this.onTap(p));
    // Upgrade 12: the rest of the pointer's life — STICK/FOLLOW track the
    // press through move and release, and a deferred field tap (below)
    // resolves on release. The keyboard drives the same actions the
    // buttons drive, through keyAction.
    this.input.on('pointermove',p=>this.onPointerMove(p));
    this.input.on('pointerup',p=>this.onPointerUp(p));
    if(this.input.keyboard){ this.input.keyboard.on('keydown',e=>{ if(e&&e.code){ if(this.binds&&Object.values(this.binds).indexOf(e.code)>=0&&e.preventDefault) e.preventDefault(); this.keyAction(e.code,true); } });
      this.input.keyboard.on('keyup',e=>{ if(e&&e.code) this.keyAction(e.code,false); }); }
    this.moveFx=this.add.graphics().setDepth(17); // Upgrade 12: the FOLLOW heading arrow (world layer)
    this.stickFx=this.add.graphics().setDepth(47).setScrollFactor(0); // Upgrade 12: the joystick (screen layer)
    // Upgrade 11: a tutorial run opens on its first lesson instead of the
    // shop — no wave ever starts here (waveActive never turns on), so no
    // shop, no victory screen and no end() can ever fire in the tutorial.
    if(this.tutorial){ this.startTutorial(); }
    else { this.toast(this.era.name+' — Goal: survive wave '+this.goalWave+(this.era.verse?'\n'+this.era.verse:''),4200); this.openShop(true); }
  }
  // HUD, command bar, toasts, shop and overlays are screen furniture: anything
  // at depth >= 30 is pinned to the camera so the world can scroll beneath it.
  fixUI(){ this.children.list.forEach(o=>{ if(o&&o.depth>=30&&o.setScrollFactor) o.setScrollFactor(0); }); }
  // --- HUD: stats, command bar, hero skills ---
  buildHUD(){ const bar=this.add.graphics().setDepth(30); bar.fillStyle(0x1a110a,0.94); bar.fillRect(0,HUD_Y,W,H-HUD_Y); bar.lineStyle(3,0xd9a441); bar.lineBetween(0,HUD_Y,W,HUD_Y);
    this.stat=txt(this,12,8,'',20,PARCH).setDepth(31);
    // Upgrade 5: live orb buff timers ride a second, smaller line under the stats.
    this.buffTxt=txt(this,12,36,'',15,'#f2c14e').setDepth(31);
    this.orderTxt=txt(this,12,HUD_Y+8,'',16,GOLD).setDepth(31);
    // Upgrade 10: the command row rebuilt to the approved sketch — one
    // row of LARGE labeled buttons (110x56) along the bottom: the six
    // orders, Volley, CAMP, and Rally (the approved addition seats
    // ninth; the row starts at x 130 so all nine keep the full size).
    // The order line at HUD_Y+8 stays clear above them; speed and
    // Fullscreen keep the far right.
    const cmds=[['charge','Charge'],['hold','Hold'],['follow','Follow Me'],['flank','Flank'],['fallback','Fall Back'],['shieldwall','Shield Wall']];
    this.cmdBtns={};
    cmds.forEach(([id,label],i)=>{ const b=button(this,130+i*117,HUD_Y+55,110,56,label,()=>this.giveOrder(id),{size:16}); b.setDepth(31); this.cmdBtns[id]=b; this.regLayout('cmd_'+id,b,null); });
    const vb=button(this,130+6*117,HUD_Y+55,110,56,'Volley',()=>this.pressVolley(),{size:16}); vb.setDepth(31); this.cmdBtns.volley=vb; this.regLayout('cmd_volley',vb,(x,y)=>{ vb.sx=x; vb.sy=y; });
    // Upgrade 8: Volley carries a cooldown sweep like the skill buttons.
    vb.sx=130+6*117; vb.sy=HUD_Y+55; vb.sw=110; vb.sh=56; vb.sweep=this.add.graphics().setDepth(32);
    // Upgrade 9: the active-buff chips — each live orb power wears a labeled
    // chip (color disc + name + seconds) under the stat lines, so what the
    // hero is carrying is readable at a glance, not just a timer line.
    this.buffGfx=this.add.graphics().setDepth(32);
    this.buffChipTxts=[0,1,2].map(()=>txt(this,0,0,'',13,'#ffffff').setDepth(33).setVisible(false));
    // Upgrade 9: the CAMP button — the camp's care, one tap away mid-wave.
    // Upgrade 10: it rides the command row now, as the approved sketch
    // draws it — camp care sits with the army's orders. Same panel, same
    // CAMP_UPGRADES / CAMP_REPAIR state and prices behind it.
    this.campBtn=button(this,130+7*117,HUD_Y+55,110,56,'CAMP',()=>this.toggleCampPanel(),{size:16}); this.campBtn.setDepth(31);
    this.campBtnRect={x:130+7*117,y:HUD_Y+55,w:110,h:56};
    this.regLayout('cmd_camp',this.campBtn,(x,y)=>{ this.campBtnRect={x,y,w:110,h:56}; });
    // Upgrade 10 (approved addition): RALLY — the ninth seat on the row.
    // The whole row shifted left (start x 130) so Rally sits at the same
    // 110x56 as every other seat instead of shrinking any button. Tap
    // Rally, then tap the ground: the banner is planted there and the
    // selected squad — or the whole army, hero selected — moves to it
    // and holds (plantRally).
    this.rallyBtn=button(this,130+8*117,HUD_Y+55,110,56,'Rally',()=>this.pressRally(),{size:16}); this.rallyBtn.setDepth(31);
    this.rallyBtnRect={x:130+8*117,y:HUD_Y+55,w:110,h:56}; // Upgrade 11: where the tutorial's ring finds Rally
    this.regLayout('cmd_rally',this.rallyBtn,(x,y)=>{ this.rallyBtnRect={x,y,w:110,h:56}; });
    // Upgrade 10: the hero's power buttons are built in
    // buildFightControls() now — they ride the right-thumb stack under
    // the AUTO-FIRE toggle, as the approved sketch draws them.
    this.spdBtn=button(this,1221,HUD_Y+80,110,44,'x1',()=>{ this.speed=this.speed===1?2:1; this.spdBtn.label.setText('x'+this.speed); },{size:18}).setDepth(31);
    const fsb=button(this,1221,HUD_Y+26,110,36,'Fullscreen',()=>{ try{ this.scale.startFullscreen(); }catch(e){} },{size:13}); fsb.setDepth(31);
    // Upgrade 12: the pause/settings entry — a small ⚙ above the fight
    // stack. It opens the pause overlay (movement scheme, the layout
    // editor, resume, quit), and its rect is walled in onTap like the
    // CAMP button's: a tap on it is a button press, never a march order.
    this.pauseBtn=button(this,1246,20,56,34,'⚙',()=>this.openPause(),{size:16}); this.pauseBtn.setDepth(31);
    this.pauseBtnRect={x:1246,y:20,w:56,h:34};
    this.buildFightControls(); // Upgrade 8: the right-hand fight cluster
    this.refreshHUD(); this.fixUI(); }
  phaseName(){ return this.wave%2===0&&this.wave>0?'Night':'Day'; }
  refreshHUD(){ const goalTxt=this.endless?'∞ (goal cleared)':String(this.goalWave);
    this.stat.setText('Manna '+Math.floor(this.manna)+'   Camp '+Math.max(0,Math.ceil(this.campHp))+'/'+this.campMax+'   Wave '+this.wave+'/'+goalTxt+'   '+(this.waveActive?this.phaseName():'')+'   Grokonians +'+this.earned+'   '+this.heroDef.name+'   Squads '+this.squads.length+'/'+this.squadCap);
    // Upgrade 9: the order line names WHO the command bar speaks to — the
    // selected squad and its own order, or the army order when the hero is
    // selected.
    const selAlive=this.selSquad&&!this.selSquad.dead, disp=selAlive?(this.selSquad.ord||this.order):this.order;
    if(selAlive) this.orderTxt.setText('Squad: '+this.selSquad.def.name+' — '+(this.selSquad.ord==='post'?'Posted':(disp==='rally'?'Rally':(ORDER_NAMES[disp]||disp)))+(this.volleyMode?'   •   VOLLEY: tap a spot':'')+(this.rallyMode?'   •   RALLY: tap a spot':''));
    else this.orderTxt.setText('Order: '+(this.order==='rally'?'Rally':ORDER_NAMES[this.order])+(this.volleyMode?'   •   VOLLEY: tap a spot':'')+(this.rallyMode?'   •   RALLY: tap a spot':''));
    if(this.buffTxt){ const bp=[]; if(this.buffStrT>0) bp.push('STR '+Math.ceil(this.buffStrT)+'s'); if(this.buffSpdT>0) bp.push('SPD '+Math.ceil(this.buffSpdT)+'s'); if(this.buffIronT>0) bp.push('IRON '+Math.ceil(this.buffIronT)+'s'); this.buffTxt.setText(bp.join('    ·    ')); }
    const okey=(selAlive?this.selSquad.def.id:'army')+'|'+disp;
    if(this._lastOrder!==okey){ this._lastOrder=okey; Object.entries(this.cmdBtns).forEach(([id,b])=>{ if(b.redraw) b.redraw(id===disp); }); }
    Object.entries(this.cmdBtns).forEach(([id,b])=>{ b.alpha=(id==='volley'&&this.volleyCd>0)?0.5:1; });
    this.drawBuffChips(); }
  // Upgrade 9: the buff chips — one per live timed orb power, drawn under
  // the stat lines: colored disc, power name, seconds remaining. The old
  // timer-only line (buffTxt) still rides above them.
  drawBuffChips(){ if(!this.buffGfx||!this.buffChipTxts) return; const g=this.buffGfx; g.clear();
    const live=[]; if(this.buffStrT>0) live.push({def:ORBS[0],t:this.buffStrT}); if(this.buffSpdT>0) live.push({def:ORBS[1],t:this.buffSpdT}); if(this.buffIronT>0) live.push({def:ORBS[3],t:this.buffIronT});
    let x=12; const y=64;
    this.buffChipTxts.forEach((t,i)=>{ const c=live[i];
      if(!c){ t.setVisible(false); return; }
      const label=c.def.short.toUpperCase()+' '+Math.ceil(c.t)+'s', w=34+label.length*7.4;
      g.fillStyle(0x140c07,0.85); g.fillRoundedRect(x,y,w,22,10); g.lineStyle(1,c.def.color,0.9); g.strokeRoundedRect(x,y,w,22,10);
      g.fillStyle(c.def.color,1); g.fillCircle(x+11,y+11,6);
      t.setText(label); t.setPosition(x+22,y+4); t.setVisible(true);
      x+=w+8; }); }
  toast(m,ms){ if(this._toast) this._toast.destroy(); const t=txt(this,W/2,HUD_Y-70,m,22,GOLD,{backgroundColor:'#140c07cc',padding:{x:10,y:4},wordWrap:{width:900},align:'center'}).setOrigin(0.5).setDepth(40).setScrollFactor(0); this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||1800,duration:600,onComplete:()=>t.destroy()}); }
  onTap(p){ if(this.over||this.shopOpen||this.victoryOpen||p.y>=HUD_Y) return;
    // Upgrade 12: while paused or editing the layout, field taps belong
    // to those overlays — never to the marching hand behind them.
    if(this.paused||this.layoutEdit) return;
    // Upgrade 9: while the camp panel is open, field taps belong to the
    // panel's own buttons — never to the marching hand behind it.
    if(this.campPanelOpen) return;
    // Upgrade 8: a tap on the fight cluster is a fight input, never a
    // march order — the two hands stay separate.
    if(this.overFight(p)) return;
    // Upgrade 9: the same wall for the CAMP button — its tap is a button
    // press, not a march order at whatever world point lies beneath it.
    if(this.campBtnRect&&Math.abs(p.x-this.campBtnRect.x)<=this.campBtnRect.w/2+4&&Math.abs(p.y-this.campBtnRect.y)<=this.campBtnRect.h/2+4) return;
    // Upgrade 12: the same wall for the ⚙ pause button.
    if(this.pauseBtnRect&&Math.abs(p.x-this.pauseBtnRect.x)<=this.pauseBtnRect.w/2+4&&Math.abs(p.y-this.pauseBtnRect.y)<=this.pauseBtnRect.h/2+4) return;
    // Upgrade 12: under STICK or FOLLOW, a field press is not yet a tap —
    // it may become a drag (the stick) or a hold (follow). The press is
    // held as pendTap and only a quick, still release resolves it as a
    // tap, through this same path with _deferred set (onPointerUp). A
    // drag therefore can never become a selection or an order.
    if(this.moveScheme!=='tap'&&!p._deferred){ this.pendTap={x:p.x,y:p.y,worldX:p.worldX,worldY:p.worldY,id:p.id,t:performance.now()}; return; }
    this.fieldTap(p); }
  // The field tap itself: targeting modes, orbs, the camp, selection,
  // posting, and — under TAP only — the hero's march. Reached on
  // pointerdown under TAP, and on a quick release under STICK/FOLLOW.
  fieldTap(p){
    // p.y is a screen coordinate (the HUD check); the tap itself lands in the world.
    const wx=(p.worldX!==undefined?p.worldX:p.x), wy=(p.worldY!==undefined?p.worldY:p.y);
    if(this.volleyMode){ this.doVolley(wx,wy); return; }
    // Upgrade 10: a tap while Rally is armed plants the banner there —
    // it is a planting, never a march or selection tap.
    if(this.rallyMode){ this.plantRally(wx,wy); return; }
    // Upgrade 5: a tap on an orb is a purchase attempt, not a move order.
    const orb=(this.orbs||[]).find(o=>Math.hypot(wx-o.x,wy-o.y)<=42);
    if(orb){ this.tryBuyOrb(orb); return; }
    // Upgrade 9: a tap on the camp (hero selected) opens the camp panel —
    // the camp's care, mid-wave. With a squad selected the same tap is a
    // post order like any other ground.
    if(!this.selSquad&&this.campPos&&Math.hypot(wx-this.campPos.x,wy-this.campPos.y)<=56){ this.openCampPanel(); return; }
    // Upgrade 9: a tap on a character selects them — a squad by its body,
    // the hero by his. Repeated taps on a crowded spot cycle through
    // whoever stands there, so a stacked squad is never unselectable.
    const cand=[];
    if(this.hero&&this.hero.down<=0){ const d=Math.hypot(wx-this.hero.x,wy-this.hero.y); if(d<=44) cand.push({who:'hero',d}); }
    (this.squads||[]).forEach(s=>{ if(s.dead) return; const d=Math.hypot(wx-s.x,wy-s.y); if(d<=44) cand.push({who:s,d}); });
    if(cand.length){ cand.sort((a,b)=>a.d-b.d); const cur=this.selSquad||'hero';
      let pick=cand[0];
      if(cand.length>1){ const ci=cand.findIndex(c=>c.who===cur); if(ci>=0) pick=cand[(ci+1)%cand.length]; }
      if(pick.who==='hero') this.selectHero(); else this.selectSquad(pick.who);
      return; }
    // Ground: the selected squad posts where tapped and holds — an
    // ORDER, so it stands under every movement scheme. The hero's own
    // march is TAP's alone: under STICK/FOLLOW a ground tap never
    // march-orders him (that is the point of those schemes — he is
    // steered, not sent).
    if(this.selSquad&&!this.selSquad.dead){ const s=this.selSquad;
      s.ord='post'; s.post={x:Math.max(20,Math.min(this.worldW-20,wx)),y:Math.max(40,Math.min(this.worldH-20,wy))};
      this.floatText(s.post.x,s.post.y-16,'Hold here','#f2c14e'); this.refreshHUD();
      if(this.tutorial) this.tutEvent('posted'); // Upgrade 11: the army step watches the real post
      return; }
    if(this.moveScheme==='tap'){ this.hero.tx=Math.max(20,Math.min(this.worldW-20,wx)); this.hero.ty=Math.max(40,Math.min(this.worldH-20,wy)); } }
  doVolley(x,y){ this.volleyMode=false; this._volleyBuf=false; this.volleyCd=12; let n=0;
    this.squads.filter(s=>s.def.role==='ranged'&&!s.dead).forEach((s,i)=>{ n++; this.time.delayedCall(i*90,()=>{ this.shoot(s.x,s.y-20,{x,y,dead:false},'stone',{dmg:s.dmg*3,type:'physical',splash:90,splashAt:{x,y}},800); }); });
    if(!n){ this.toast('No ranged squads for a volley'); this.volleyCd=0; } else { SFX.sling(); this.toast('Volley away!'); }
    this.refreshHUD(); }
  // --- Upgrade 9: selection and orders (the marching hand directs) ---
  // Selection is the marching hand's focus: the hero (selSquad null, the
  // default at wave start) or one squad. Orders from the command bar go to
  // the selection: a squad carries its own order (s.ord) until countermanded;
  // with the hero selected the order is army-wide, as before — and giving
  // one returns every squad to army control (s.ord cleared).
  selectSquad(s){ this.selSquad=s; this.floatText(s.x,s.y-60,s.def.name,'#f2c14e'); this.refreshHUD(); }
  selectHero(){ this.selSquad=null; if(this.hero) this.floatText(this.hero.x,this.hero.y-64,this.hero.def.name,'#f2c14e'); this.refreshHUD(); }
  giveOrder(id){ const label=ORDER_NAMES[id]; if(!label) return; this.volleyMode=false; this.rallyMode=false;
    if(this.selSquad&&!this.selSquad.dead){ const s=this.selSquad; s.ord=id;
      this.toast(s.def.name+': '+label); this.floatText(s.x,s.y-64,label+'!','#f2c14e'); }
    else { this.order=id; this.squads.forEach(s=>{ s.ord=null; });
      this.toast('Order: '+label);
      // Upgrade 8: the order echoes above the hero, in the world — the
      // player sees the army heard it, not just a HUD line changing.
      if(this.hero) this.floatText(this.hero.x,this.hero.y-64,label+'!','#f2c14e'); }
    this.refreshHUD(); }
  squadOrder(s){ return s.ord||this.order; }
  // Where a squad is headed this frame, by its effective order: its post
  // (the default — bought squads post at the camp and hold), the army's
  // charge/hold/fall-back, or its slot in the formation around the hero
  // (Follow Me / Flank / Shield Wall).
  squadTarget(s,idx,h){ const eo=this.squadOrder(s);
    // Upgrade 10: rally — the squad's own banner point when the order is
    // its own, else the army's shared point. Arrival is a hold, like a post.
    if(eo==='rally'){ const rp=(s.ord==='rally'&&s.rally)?s.rally:this.rallyPoint; if(rp) return {x:rp.x,y:rp.y}; }
    if(eo==='post'&&s.post) return {x:s.post.x,y:s.post.y};
    if(eo==='charge'){ const e2=this.nearestEnemy(s.x,s.y,9999); return e2?{x:e2.x,y:e2.y}:{x:h.x,y:h.y}; }
    if(eo==='hold') return {x:s.x,y:s.y};
    if(eo==='fallback') return {x:this.campPos.x+70+Math.floor(idx/3)*30,y:this.campPos.y+(idx%3-1)*40};
    const o=this.formationOffset(idx,eo); return {x:h.x+o.dx,y:h.y+o.dy}; }
  // --- hero ---
  buildHero(){ const h=this.heroDef, hx=this.campPos.x+60, hy=this.campPos.y;
    // The fight state rides the hero: cd is the AUTO-FIRE clock (Upgrade
    // 10 restored the pre-Upgrade-8 automatic basic attack — the range
    // ring is its reach again), plus the surviving Upgrade 8 kit — dodge
    // dash and i-frames, facing (last-move direction), block/sprint and
    // the stamina pool they share. Upgrade 8's manual-attack state
    // (recovery/buffer, heavy wind-up) is gone with the manual scheme.
    this.hero={def:h,x:hx,y:hy,tx:hx,ty:hy,cd:0,hp:h.hp,down:0,
      dodgeT:0,dodgeCd:0,iframes:0,dodgeDx:1,dodgeDy:0,faceX:1,faceY:0,
      blocking:false,sprint:false,stamina:FIGHT.stamMax,stamDelay:0,guardBreakT:0};
    this.hero.spr=spr(this,hx,hy,h.id).setDepth(8); this.hero.hpBar=this.add.graphics().setDepth(12);
    this.hero.guardFx=this.add.graphics().setDepth(15);
    this.hero.ring=this.add.circle(hx,hy,h.range,0xffffff,0.04).setStrokeStyle(1,0xd9a441,0.4).setDepth(3); }
  hurtHero(n,heavy){ const h=this.hero; if(h.down>0) return;
    // Upgrade 8: dodge i-frames are true invulnerability — a blow timed
    // into a dodge simply is not there, heavy or otherwise, and it cannot
    // knock a Perfect charge loose either.
    if(h.iframes>0) return;
    // Upgrade 8: a held block mitigates — most of an ordinary blow, less
    // than half of a heavy one (a boss heavy still lands through a guard:
    // reduced, never erased). The impact itself costs stamina, and an
    // impact that empties the pool breaks the guard.
    if(h.blocking){ const mit=heavy?FIGHT.blockHeavyMit:FIGHT.blockMit; n=n*(1-mit);
      h.stamina=Math.max(0,h.stamina-(heavy?FIGHT.blockHeavyCost:FIGHT.blockHitCost)-n*0.15); h.stamDelay=FIGHT.stamDelay;
      if(h.stamina<=0){ this.setBlock(false); h.guardBreakT=FIGHT.guardBreak; this.floatText(h.x,h.y-84,'Guard broken!','#ff8a6a'); } }
    h.hp-=n; h.spr.setTint(0xff6a5a); this.time.delayedCall(80,()=>{ if(h.spr.active) h.spr.clearTint(); });
    // Upgrade 8: a HEAVY hit (the champion's heavy strike or ground slam —
    // the boss code passes heavy=true; ordinary enemy blows never do)
    // knocks a Perfect charge out of the hero's hands, down to Tempered.
    // Chip damage, however frequent, can never do this.
    if(heavy&&this.skillBtns){ let lost=false;
      this.skillBtns.forEach(b=>{ if(b.cd<=0&&this.heldTierOf(b)===2){ b.held=HELD.temperAt; b._tierShown=1; lost=true; } });
      if(lost) this.floatText(h.x,h.y-84,'Perfect lost!','#ff8a6a'); }
    if(h.hp<=0){ // Upgrade 11: the tutorial's hero cannot fall — a blow
      // that would empty his health leaves him standing at 1 HP and the
      // lesson goes on. (Nothing in the tutorial deals real damage anyway
      // — the dummies deal 0 — so this is a promise kept, not a path taken.)
      if(this.tutorial){ h.hp=1; this.floatText(h.x,h.y-84,'You cannot fall here','#8fd06a'); }
      else { h.down=this.respawnTime||8; h.hp=0; h.spr.setAlpha(0.35); h.blocking=false; h.sprint=false; this.toast(h.def.name+' is down! Returns in '+Math.round(this.respawnTime||8)+'s — while the camp stands',3000); } } }
  // --- Upgrade 8: Held Power + button weight ---
  heldTierOf(b){ const s=b.held||0; return s>=HELD.perfectAt?2:(s>=HELD.temperAt?1:0); }
  // A press on a skill button: fires at once when ready; a press inside the
  // input-buffer window before the cooldown ends is remembered and fired
  // by update() the moment the move is ready — mastery feels responsive,
  // never sticky. A press earlier than the window is simply a press too soon.
  // Upgrade 10 (approved addition): the POWER-READY WHISPER — when one
  // of the two great powers (the hero's second skill and his ult — for
  // David, Psalm and Five Stones) finishes cooling, it says so quietly:
  // a soft glow pulse on its button and one gentle SFX cue. No toast,
  // no banner, no clutter. update() calls this only on the tick the
  // cooldown crosses to ready AND the move stays ready (a buffered cast
  // spends the crossing and re-cools instead), and a move sitting ready
  // can never re-trigger it — it must be spent and cool again first.
  powerReady(b){ b.readyPulse=1; SFX.ready(b.def.id); }
  pressSkill(i){ const b=this.skillBtns&&this.skillBtns[i]; if(!b||this.over||this.shopOpen) return;
    if(b.cd>0){ if(b.cd<=INPUT_BUFFER) b.buffered=true; return; }
    this.useSkill(i); }
  pressVolley(){ if(this.over||this.shopOpen) return;
    if(this.volleyCd>0){ if(this.volleyCd<=INPUT_BUFFER) this._volleyBuf=true; else this.toast('Volley ready in '+Math.ceil(this.volleyCd)+'s'); return; }
    this.volleyMode=true; this.rallyMode=false; this.toast('Volley: tap a target spot'); }
  // Upgrade 10 (approved addition): RALLY — tap the button, then tap the
  // ground to plant the banner. A targeting mode like Volley's, and the
  // two modes cancel each other.
  pressRally(){ if(this.over||this.shopOpen) return;
    this.volleyMode=false; this.rallyMode=true; this.toast('Rally: tap where the banner goes'); }
  // Planting the banner follows Upgrade 9's scoping law: the selected
  // squad answers alone (its own order becomes 'rally', the point its
  // own), or — with the hero selected — the whole army answers (army
  // order 'rally', every squad returned to army control, one shared
  // point). Planting again moves the point. 'rally' is an order like
  // any other in the ord model, so any later order supersedes it: a
  // command-bar order, a direct tap-to-place, or a new rally point.
  plantRally(x,y){ this.rallyMode=false;
    const px=Math.max(20,Math.min(this.worldW-20,x)), py=Math.max(40,Math.min(this.worldH-20,y));
    if(this.selSquad&&!this.selSquad.dead){ const s=this.selSquad; s.ord='rally'; s.rally={x:px,y:py};
      this.toast(s.def.name+': Rally!'); this.floatText(px,py-24,'Rally!','#f2c14e'); }
    else { this.order='rally'; this.rallyPoint={x:px,y:py}; this.squads.forEach(s=>{ s.ord=null; });
      this.toast('Army: Rally!'); this.floatText(px,py-24,'Rally!','#f2c14e');
      if(this.hero) this.floatText(this.hero.x,this.hero.y-64,'Rally!','#f2c14e'); }
    this.refreshHUD();
    if(this.tutorial) this.tutEvent('rallied'); } // Upgrade 11: a planted banner is the rally step's proof
  // The banners that currently fly: the army's point, while at least one
  // army-order squad holds it, plus each squad's own point while that
  // squad holds its rally. When the last holder is given another order
  // the banner comes down — it flies only while someone holds it.
  rallyPoints(){ const pts=[];
    if(this.order==='rally'&&this.rallyPoint&&this.squads.some(s=>!s.dead&&!s.ord)) pts.push(this.rallyPoint);
    this.squads.forEach(s=>{ if(!s.dead&&s.ord==='rally'&&s.rally) pts.push(s.rally); });
    return pts; }
  drawRallyBanners(){ if(!this.rallyFx) return; const g=this.rallyFx; g.clear();
    const bob=Math.sin((this._pulse||0)*3)*2;
    this.rallyPoints().forEach(p=>{ g.lineStyle(3,0x8a6a3a,1); g.lineBetween(p.x,p.y,p.x,p.y-52+bob);
      g.fillStyle(0xd9a441,0.95); g.fillRect(p.x,p.y-52+bob,20,12);
      g.fillStyle(0x000000,0.35); g.fillCircle(p.x,p.y,7); g.lineStyle(2,0xf2c14e,0.8); g.strokeCircle(p.x,p.y,7); }); }
  // --- Upgrade 11: the tutorial — a guided layer over this real scene ---
  // kennin's shape: sit by the camp and learn the real systems one step at
  // a time, with no pressure. Each step shows ONE plain instruction line,
  // rings the exact control or ground to use, and advances only when the
  // player actually does the thing — the hooks are the game's own events
  // (the march in update(), heroAutoFire, toggleAutoFire, the fight
  // buttons, the cast end of useSkill, a tap-to-post, plantRally,
  // openCampPanel, a successful tryBuyOrb). tutCred remembers an action
  // done early and credits it when its step arrives (tutStepDone is
  // checked on step entry), so nothing honest is made to repeat. SKIP
  // STEP and EXIT TUTORIAL stand the whole time; exiting mid-way keeps no
  // penalties and no partial rewards — end() and flush() never run here,
  // waveActive never turns on, and the only write that outlives the run
  // is the completion flag, set at tutFinish.
  startTutorial(){ this.waveHpM=1; this.waveDmM=1; // dummies spawn outside startWave; both curves stay neutral here
    this.tutStep=0; this.tutPhase=0; this.tutFinished=false;
    this.tutDefs=[
      { id:'move', line:'This is your camp, and this is David. Tap the ground — he walks where you tap.' },
      { id:'autofire', line:'A practice dummy is coming. Stand your ground — when it steps into your circle, David fires on his own.',
        lineOff:'Your auto-fire is off — David is holding his shots. Flip AUTO-FIRE on, at the top right, and watch him work.',
        line2:'That is auto-fire. The AUTO-FIRE button at the top right is yours: flip it off — and back on, if you like.' },
      { id:'kit', line:'Three buttons guard you: DODGE slips a blow, BLOCK softens one, SPRINT runs. Press each of them once.' },
      { id:'power', line:'His power moves have their own buttons — Psalm and Five Stones. A stronger dummy is coming: cast one at it. When a power is ready again, its button glows and whispers.' },
      { id:'army', line:'This squad is yours — a gift for the lesson. Tap the squad to choose it, then tap the ground to post it there.',
        line2:'Now tap RALLY, then tap the ground. Your squad goes to the banner and holds it.' },
      { id:'camp', line:'The camp is cared for while the fight goes on. Tap CAMP — or the camp itself — and look inside: Fortify makes it stronger, Repair mends it.' },
      { id:'orbs', line:'The glowing orbs sell powers for Grokonians. Walk David to the shining orb and tap it — this first buy is on the house, this once.' },
    ];
    // Upgrade 12: the tutorial teaches TAP (init forced the scheme for
    // this scene). If the player's own scheme is something else, the
    // first line says so plainly — their scheme is untouched and waits
    // outside; nothing here writes it.
    if(loadMoveScheme()!=='tap') this.tutDefs[0].line='The tutorial teaches tap-to-move; your own scheme waits outside. '+this.tutDefs[0].line;
    // The instruction furniture: a quiet panel across the top centre —
    // clear of the stats at the left and the fight stack at the right;
    // depth 44 sits under the camp panel (50/51), whose Close button
    // stays the way out of the camp step, and the orb banner (45/46)
    // still gets its one moment over it when a buy lands.
    const items=[];
    const g=this.add.graphics().setDepth(44);
    g.fillStyle(0x140c07,0.92); g.fillRoundedRect(215,78,850,68,10); g.lineStyle(2,0xd9a441,0.9); g.strokeRoundedRect(215,78,850,68,10); items.push(g);
    this.tutLine=txt(this,W/2,88,'',15,PARCH,{align:'center',wordWrap:{width:620}}).setOrigin(0.5,0).setDepth(45); items.push(this.tutLine);
    this.tutSub=txt(this,W/2,124,'',13,'#f2c14e').setOrigin(0.5,0).setDepth(45); items.push(this.tutSub);
    this.tutExitBtn=button(this,264,112,92,38,'Exit',()=>this.exitTutorial(),{size:14}); this.tutExitBtn.setDepth(45); items.push(this.tutExitBtn);
    this.tutSkipBtn=button(this,1016,112,92,38,'Skip step',()=>this.tutSkip(),{size:13}); this.tutSkipBtn.setDepth(45); items.push(this.tutSkipBtn);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); });
    this.tutFxW=this.add.graphics().setDepth(19); // the world ring: ground, squads, orbs
    this.tutFxS=this.add.graphics().setDepth(46).setScrollFactor(0); // the screen ring: buttons
    this.tutEnterStep(); }
  // A real action happened. Record it whatever step we are on — credit
  // given early is honored when its step arrives.
  tutEvent(name){ if(!this.tutorial) return;
    if(!this.tutCred) this.tutCred={};
    if(name) this.tutCred[name]=true;
    if(this.tutFinished) return;
    const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st) return;
    if(st.id==='army'&&this.tutPhase===0&&name==='posted'){ this.tutPhase=1; this.tutRender(); return; } // the post turns the army step to its rally half
    if(this.tutStepDone(st)) this.tutAdvance(); else this.tutRender(); }
  tutStepDone(st){ const c=this.tutCred||{};
    switch(st.id){
      case 'move': return !!c.moved;
      case 'autofire': return !!(c.autofired&&c.autotoggled); // both halves, in either order
      case 'kit': return !!(c.dodge&&c.block&&c.sprint);
      case 'power': return !!c.power;
      case 'army': return this.tutPhase===1&&!!c.rallied;
      case 'camp': return !!c.camp;
      case 'orbs': return !!c.orb;
    } return false; }
  tutAdvance(){ if(this.tutFinished) return; this.tutStep++; this.tutPhase=0;
    if(this.tutStep>=(this.tutDefs||[]).length){ this.tutFinish(); return; }
    this.tutEnterStep(); }
  tutEnterStep(){ const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st) return;
    if(st.id==='autofire'&&!this.tutDummy) this.tutDummy=this.spawnTutDummy(false);
    if(st.id==='power') this.spawnTutDummy(true); // the sturdier dummy; the step-(b) one may stand beside it
    if(st.id==='army'&&!this.squads.length){ // the tutorial-granted squad: free, run-local, never saved
      const def=(this.roster.player||[]).find(u=>u.id==='shepherd_militia'); if(def) this.addSquad(def); }
    this.tutRender();
    if(this.tutStepDone(st)) this.tutAdvance(); } // silent credit: done early counts as done now
  tutSkip(){ if(!this.tutorial||this.tutFinished) return; this.tutAdvance(); }
  tutFinish(){ this.tutFinished=true; setTutorialDone(); // the ONLY persistent write in the whole mode
    if(this.tutSkipBtn) this.tutSkipBtn.setVisible(false);
    if(this.tutFxW) this.tutFxW.clear(); if(this.tutFxS) this.tutFxS.clear();
    const items=[];
    const g=this.add.graphics().setDepth(52); g.fillStyle(0x140c07,0.96); g.fillRoundedRect(W/2-420,236,840,232,12); g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-420,236,840,232,12); items.push(g);
    items.push(txt(this,W/2,262,'The lesson is complete',26,GOLD).setOrigin(0.5).setDepth(53));
    items.push(txt(this,W/2,296,'You march where you tap. David fires on his own — auto-fire, your choice.\nDodge, block and sprint guard you. Psalm and Five Stones answer your tap,\nand whisper when they are ready. Your squads post and rally where you put\nthem. The camp is cared for from CAMP. The orbs sell their powers.\nThe wall is yours.',16,PARCH,{align:'center'}).setOrigin(0.5,0).setDepth(53));
    const fb=button(this,W/2,428,200,46,'Finish',()=>this.exitTutorial(),{size:18}); fb.setDepth(53); items.push(fb);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); });
    this.tutRender(); }
  exitTutorial(){ this.scene.start('Menu'); } // nothing persists, nothing is owed — see the firewall note above
  tutRender(){ if(!this.tutLine) return;
    if(this.tutFinished){ this.tutLine.setText('The lesson is complete — the wall is yours.'); this.tutSub.setText(''); return; }
    const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st){ this.tutLine.setText(''); this.tutSub.setText(''); return; }
    let line=st.line;
    if(st.id==='autofire') line=this.tutCred.autofired?st.line2:(this.autoFire?st.line:st.lineOff);
    if(st.id==='army'&&this.tutPhase===1) line=st.line2;
    this.tutLine.setText(line);
    let sub='Step '+(this.tutStep+1)+' of '+this.tutDefs.length;
    if(st.id==='kit'){ const left=[['dodge','Dodge'],['block','Block'],['sprint','Sprint']].filter(p=>!this.tutCred[p[0]]).map(p=>p[1]);
      if(left.length) sub+='  ·  Still to try: '+left.join(', '); }
    this.tutSub.setText(sub); }
  // Where the ring goes this frame: the exact control or ground the
  // current step (and phase) is waiting on.
  tutTarget(){ const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st||this.tutFinished) return null;
    switch(st.id){
      case 'move': return {hl:'world',x:this.campPos.x+280,y:this.campPos.y};
      case 'autofire': if(!this.tutCred.autofired) return this.tutDummy&&!this.tutDummy.dead?{hl:'world',x:this.tutDummy.x,y:this.tutDummy.y}:{hl:'world',x:this.hero.x+170,y:this.hero.y};
        return this.autoBtn?{hl:'screen',x:this.autoBtn.sx,y:this.autoBtn.sy}:null;
      case 'kit': { const left=['dodge','block','sprint'].find(k=>!this.tutCred[k]); const b=left&&this.fightBtns&&this.fightBtns[left]; return b?{hl:'screen',x:b.sx,y:b.sy}:null; }
      case 'power': { const b=this.skillBtns&&this.skillBtns[1]; return b?{hl:'screen',x:b.sx,y:b.sy}:null; }
      case 'army': if(this.tutPhase===1) return this.rallyBtnRect?{hl:'screen',x:this.rallyBtnRect.x,y:this.rallyBtnRect.y}:null;
        if(!this.selSquad&&this.squads&&this.squads[0]) return {hl:'world',x:this.squads[0].x,y:this.squads[0].y};
        return {hl:'world',x:this.campPos.x+430,y:this.campPos.y-140};
      case 'camp': return this.campBtnRect?{hl:'screen',x:this.campBtnRect.x,y:this.campBtnRect.y}:null;
      case 'orbs': { let best=null,bd=1e12; (this.orbs||[]).forEach(o=>{ const d=Math.hypot(o.x-this.hero.x,o.y-this.hero.y); if(d<bd){ bd=d; best=o; } }); return best?{hl:'world',x:best.x,y:best.y}:null; }
    }
    return null; }
  tutTick(){ if(!this.tutFxW||!this.tutFxS) return; const wg=this.tutFxW, sg=this.tutFxS; wg.clear(); sg.clear();
    const t=this.tutTarget(); if(!t) return;
    const r=26+5*Math.sin((this._pulse||0)*5);
    if(t.hl==='world'){ wg.fillStyle(0xf2c14e,0.10); wg.fillCircle(t.x,t.y,r+10); wg.lineStyle(3,0xf2c14e,0.95); wg.strokeCircle(t.x,t.y,r+10); }
    else { sg.fillStyle(0xf2c14e,0.08); sg.fillCircle(t.x,t.y,r+12); sg.lineStyle(3,0xf2c14e,0.95); sg.strokeCircle(t.x,t.y,r+12); } }
  // A practice dummy: the Pebble Golem's own figure and data path, with
  // tutorial numbers — it walks to the hero and waits (see the enemy
  // loop's tutDummy branch). It goes through the real spawn() so every
  // real system sees a real enemy; the wave system never does, because
  // waveActive is false and spawn() is called by hand, not by a queue.
  spawnTutDummy(sturdy){ const def=(UNITS.bible.enemy||[]).find(e=>e.id==='pebble_golem'); if(!def) return null;
    const e=this.spawn({def,at:0,boss:false});
    e.hp=e.max=sturdy?TUT_DUMMY.sturdyHp:TUT_DUMMY.hp; e.dmg=TUT_DUMMY.dmg; e.speed=TUT_DUMMY.speed; e.tutDummy=true;
    e.x=this.hero.x+TUT_DUMMY.spawnDist; e.y=this.hero.y; if(e.spr&&e.spr.setPosition) e.spr.setPosition(e.x,e.y);
    return e; }
  // The button carries its own state on its face: a dark cooldown sweep
  // that drains as the move returns, then a charge bar along the bottom
  // that fills toward the next Held tier — gold at Tempered, bright and
  // pulsing at Perfect. Drawn from live button state every frame.
  drawSkillSweep(b){ const g=b.sweep; if(!g) return; g.clear();
    const x=b.sx-b.sw/2, y=b.sy-b.sh/2;
    if(b.cd>0){ const f=Math.min(1,b.cd/(b.cdMax||b.def.cd||1)); g.fillStyle(0x000000,0.55); g.fillRect(x,y,b.sw,b.sh*f); return; }
    const t=this.heldTierOf(b);
    const f=t===2?1:(t===1?(b.held-HELD.temperAt)/(HELD.perfectAt-HELD.temperAt):(b.held||0)/HELD.temperAt);
    g.fillStyle(t===2?0xffe98a:(t===1?0xf2c14e:0x8a7a4a),t===2?0.95:0.8); g.fillRect(x,y+b.sh-5,b.sw*Math.max(0,Math.min(1,f)),5);
    if(t===2){ g.lineStyle(3,0xffe98a,0.6+0.4*Math.sin((this._pulse||0)*6)); g.strokeRect(x,y,b.sw,b.sh); }
    else if(t===1){ g.lineStyle(2,0xf2c14e,0.8); g.strokeRect(x,y,b.sw,b.sh); }
    // Upgrade 10: the whisper's glow — a soft halo that swells once when
    // a great power comes ready, then fades (b.readyPulse decays in update()).
    if(b.readyPulse>0){ g.lineStyle(3,0xffe98a,0.15+0.5*b.readyPulse); g.strokeRect(x-2,y-2,b.sw+4,b.sh+4); } }
  // --- Upgrade 10: the right-thumb stack — kennin's approved button UI ---
  // One wide column on the right of the screen (196px wide, every button
  // 56px tall, real text labels, the game's stone-and-gold): the AUTO-FIRE
  // toggle at the top, the stamina readout under it, then DODGE, BLOCK
  // (a hold) and SPRINT, then the hero's power moves as their OWN named
  // buttons, driven from the hero data — for David: SMOOTH STONE, PSALM,
  // FIVE STONES. Each power button keeps Upgrade 8's Held Power state and
  // cooldown sweep. They are screen furniture (depth 31/32, pinned by
  // fixUI), clear of the command row below (the stack ends at y=524, the
  // bar starts at HUD_Y=610), and onTap refuses taps that land on them —
  // a press here is never also a march order.
  buildFightControls(){ this.fightBtns={}; this.fightRects=[];
    if(this.autoFire===undefined) this.autoFire=loadAutoFire();
    const mk=(id,x,y,w,h,label,cb,size)=>{ const b=button(this,x,y,w,h,label,cb,{size:size||15}); b.setDepth(31);
      b.sx=x; b.sy=y; b.sw=w; b.sh=h; b.sweep=this.add.graphics().setDepth(32);
      this.fightBtns[id]=b; this.fightRects.push({x,y,w,h}); this.regLayout(id,b,(nx,ny)=>{ b.sx=nx; b.sy=ny; }); return b; };
    const SX=1178, SW=196;
    this.autoBtn=mk('autofire',SX,70,SW,56,this.autoFire?'AUTO-FIRE: ON':'AUTO-FIRE: OFF',()=>this.toggleAutoFire(),17);
    mk('dodge',SX,176,SW,56,'DODGE',()=>this.pressDodge(),16);
    const bb=mk('block',SX,240,SW,56,'BLOCK',()=>{},16);
    mk('sprint',SX,304,SW,56,'SPRINT',()=>this.toggleSprint(),16);
    // BLOCK is a HOLD, not a press: down raises the guard, up or out drops
    // it. (These ride beside the shared helper's own press handlers.)
    bb.on('pointerdown',()=>this.setBlock(true));
    bb.on('pointerup',()=>this.setBlock(false));
    bb.on('pointerout',()=>this.setBlock(false));
    this.input.on('pointerup',()=>this.setBlock(false)); // a release anywhere ends a hold
    // The hero's power moves, from the data: his two skills and his ult,
    // in data order. Held Power state lives on the button itself — cd/
    // cdMax drive the cooldown sweep, held accrues charge while the move
    // sits ready, buffered remembers a press that landed a breath early.
    const h=this.heroDef; this.skillBtns=[];
    [...h.skills,h.ult].forEach((k,i)=>{ const b=mk('skill'+i,SX,368+i*64,SW,56,k.name,()=>this.pressSkill(i),15);
      b.cd=0; b.cdMax=k.cd; b.def=k; b.held=0; b.buffered=false; b._tierShown=0;
      this.skillBtns.push(b); });
    this.fightBar=this.add.graphics().setDepth(32);
    this.fightStat=txt(this,SX,112,'',13,'#f2c14e').setOrigin(0.5).setDepth(31);
    // Upgrade 12: every battle control now exists at its default — a
    // saved layout, if the player has one, is applied over the top.
    this.applyLayout(); }
  // The AUTO-FIRE toggle: the choice is the player's and it persists.
  toggleAutoFire(){ this.autoFire=!this.autoFire; saveAutoFire(this.autoFire);
    if(this.autoBtn) this.autoBtn.label.setText(this.autoFire?'AUTO-FIRE: ON':'AUTO-FIRE: OFF');
    this.toast(this.autoFire?'Auto-fire ON — '+this.heroDef.name+' strikes on his own':'Auto-fire OFF — power moves only, by button');
    if(this.tutorial) this.tutEvent('autotoggled'); } // Upgrade 11: the auto-fire step listens for this flip, either way
  overFight(p){ if(!this.fightRects) return false;
    return this.fightRects.some(r=>Math.abs(p.x-r.x)<=r.w/2+6&&Math.abs(p.y-r.y)<=r.h/2+6); }
  // --- Upgrade 12: layout — the registry, applying, the editor ---
  // Every movable battle control registers itself as it is built (the
  // command row in buildHUD, the stack in buildFightControls). A saved
  // layout moves the container AND syncs every coordinate the game
  // keeps beside it (sweep origins, the onTap walls, the fight rects,
  // the tutorial's rings) — there is one position per button, never two.
  regLayout(id,obj,sync){ if(!this.layoutReg) this.layoutReg=[]; const def=LAYOUT_DEFS.find(d=>d[0]===id); this.layoutReg.push({id,obj,w:def?def[2]:110,h:def?def[3]:56,sync}); }
  applyLayout(){ const pos=(loadLayout()||{pos:{}}).pos||{};
    (this.layoutReg||[]).forEach(en=>{ const p=pos[en.id]; if(!p) return;
      const nx=Math.max(en.w/2,Math.min(W-en.w/2,+p.x||0)), ny=Math.max(en.h/2,Math.min(H-en.h/2,+p.y||0));
      if(!isFinite(nx)||!isFinite(ny)) return;
      en.obj.setPosition(nx,ny); if(en.sync) en.sync(nx,ny); });
    this.syncLayoutMeta(); }
  syncLayoutMeta(){ const fb=this.fightBtns?Object.values(this.fightBtns):[];
    if(fb.length) this.fightRects=fb.map(b=>({x:b.sx,y:b.sy,w:b.sw,h:b.sh}));
    // The CAMP / RALLY onTap walls follow their buttons through the
    // registry sync callbacks (applyLayout / the editor), not from here.
    if(this.fightStat&&this.autoBtn) this.fightStat.setPosition(this.autoBtn.sx,this.autoBtn.sy+42); }
  saveLayoutFromScene(){ const pos={}; (this.layoutReg||[]).forEach(en=>{ pos[en.id]={x:Math.round(en.obj.x),y:Math.round(en.obj.y)}; }); saveLayout(pos); }
  // --- Upgrade 12: movement schemes ---
  // Switchable any time (pause overlay in battle, Controls at the menu);
  // the choice persists, and a switch clears any half-finished press.
  setMoveScheme(id){ if(id!=='tap'&&id!=='stick'&&id!=='follow') return;
    saveMoveScheme(id);
    // In the tutorial the lesson stays TAP whatever is chosen — the
    // choice is saved for outside, the scene keeps its scheme.
    if(!this.tutorial) this.moveScheme=id;
    this.stick=null; this.followOn=false; this.followPt=null; this.pendTap=null;
    this.toast(id==='tap'?'Movement: tap to move':id==='stick'?'Movement: joystick — drag on the field':'Movement: follow — hold on the field, he runs to your finger'); }
  // The press's life under STICK/FOLLOW (under TAP nothing here ever
  // runs — onTap resolves field taps on pointerdown, as always).
  // Disambiguation, the whole law: a press that MOVES more than 16px
  // becomes the scheme's steering and the tap is cancelled; a press
  // that is simply HELD arms FOLLOW after 280ms (update); a quick,
  // still release is a tap, resolved through onTap exactly as TAP
  // resolves it — selection, posting, orbs, volley and rally spots all
  // keep working, and a steering drag can never post or select.
  onPointerMove(p){ if(!p) return;
    if(this.pendTap&&p.id===this.pendTap.id){ const d=Math.hypot(p.x-this.pendTap.x,p.y-this.pendTap.y);
      if(d>16){ const down=this.pendTap; this.pendTap=null;
        if(this.moveScheme==='stick') this.stick={id:down.id,bx:down.x,by:down.y,dx:p.x-down.x,dy:p.y-down.y};
        else if(this.moveScheme==='follow'){ this.followOn=true; this.followPt={id:down.id,wx:(p.worldX!==undefined?p.worldX:p.x),wy:(p.worldY!==undefined?p.worldY:p.y)}; } } }
    if(this.stick&&p.id===this.stick.id){ this.stick.dx=p.x-this.stick.bx; this.stick.dy=p.y-this.stick.by; }
    if(this.followOn&&this.followPt&&p.id===this.followPt.id){ this.followPt.wx=(p.worldX!==undefined?p.worldX:p.x); this.followPt.wy=(p.worldY!==undefined?p.worldY:p.y); } }
  onPointerUp(p){ if(!p) return;
    // Release stops him: the steering target collapses to where he
    // stands, so letting go is a full stop, not a glide to the last point.
    if(this.stick&&p.id===this.stick.id){ this.stick=null; if(this.hero){ this.hero.tx=this.hero.x; this.hero.ty=this.hero.y; } }
    if(this.followOn&&this.followPt&&p.id===this.followPt.id){ this.followOn=false; this.followPt=null; if(this.hero){ this.hero.tx=this.hero.x; this.hero.ty=this.hero.y; } }
    if(this.pendTap&&p.id===this.pendTap.id){ const d=this.pendTap; this.pendTap=null;
      if(performance.now()-d.t<500) this.onTap({x:d.x,y:d.y,worldX:d.worldX,worldY:d.worldY,id:d.id,_deferred:true}); } }
  // The heading the indicators draw and the hero steers by: the stick's
  // vector past its deadzone, or the bearing to the held finger.
  moveHeading(){ const h=this.hero; if(!h) return null;
    if(this.stick){ const m=Math.hypot(this.stick.dx,this.stick.dy); return m>10?Math.atan2(this.stick.dy,this.stick.dx):null; }
    if(this.followOn&&this.followPt){ const dx=this.followPt.wx-h.x, dy=this.followPt.wy-h.y; return Math.hypot(dx,dy)>16?Math.atan2(dy,dx):null; }
    return null; }
  drawMoveFx(){ if(this.moveFx){ const g=this.moveFx; g.clear();
      const a=this.moveHeading();
      if(a!==null&&this.hero){ const h=this.hero, ex=h.x+Math.cos(a)*58, ey=h.y+Math.sin(a)*58;
        g.lineStyle(3,0xf2c14e,0.9); g.lineBetween(h.x,h.y,ex,ey);
        g.lineBetween(ex,ey,ex+Math.cos(a+2.5)*16,ey+Math.sin(a+2.5)*16);
        g.lineBetween(ex,ey,ex+Math.cos(a-2.5)*16,ey+Math.sin(a-2.5)*16); } }
    if(this.stickFx){ const g=this.stickFx; g.clear();
      if(this.stick){ const m=Math.hypot(this.stick.dx,this.stick.dy), cl=Math.min(m,52), a=Math.atan2(this.stick.dy,this.stick.dx);
        g.fillStyle(0x140c07,0.35); g.fillCircle(this.stick.bx,this.stick.by,52);
        g.lineStyle(2,0xd9a441,0.7); g.strokeCircle(this.stick.bx,this.stick.by,52);
        g.fillStyle(0xd9a441,0.55); g.fillCircle(this.stick.bx+Math.cos(a)*cl,this.stick.by+Math.sin(a)*cl,23); } } }
  // --- Upgrade 12: keybinds — the keyboard works the same hands ---
  // Every key routes to the very function its button calls, behind the
  // same gates the buttons live behind (the shop, the victory choice,
  // the pause, the layout editor, the run being over). BLOCK is the one
  // hold: keydown raises the guard, keyup drops it — and a release is
  // honored even if the world changed while the key was down.
  keyAction(code,down){ if(!code) return;
    const binds=this.binds||loadBinds();
    const act=Object.keys(binds).find(a=>binds[a]===code); if(!act) return;
    if(act==='block'){ if(down){ if(!this.over&&!this.shopOpen&&!this.victoryOpen&&!this.paused&&!this.layoutEdit) this.setBlock(true); }
      else this.setBlock(false); return; }
    if(!down) return;
    if(this.over||this.shopOpen||this.victoryOpen||this.paused||this.layoutEdit) return;
    switch(act){
      case 'dodge': this.pressDodge(); break;
      case 'sprint': this.toggleSprint(); break;
      case 'autofire': this.toggleAutoFire(); break;
      case 'skill0': this.pressSkill(0); break;
      case 'skill1': this.pressSkill(1); break;
      case 'skill2': this.pressSkill(2); break;
      case 'volley': this.pressVolley(); break;
      case 'rally': this.pressRally(); break;
      case 'camp': this.toggleCampPanel(); break;
      default: if(ORDER_NAMES[act]) this.giveOrder(act); } }
  // --- Upgrade 12: the pause overlay + the in-battle layout editor ---
  openPause(){ if(this.over||this.shopOpen||this.victoryOpen||this.paused||this.layoutEdit) return;
    if(this.tutorial){ this.toast('The lesson runs its own course — Exit at the top leaves it. Controls wait outside.'); return; }
    this.paused=true; this.renderPause(); }
  closePause(){ this.paused=false; this.clearPause(); }
  clearPause(){ (this.pauseItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.pauseItems=[]; }
  renderPause(){ this.clearPause(); const items=[]; this.pauseItems=items;
    const g=this.add.graphics().setDepth(58); g.fillStyle(0x140c07,0.96); g.fillRoundedRect(W/2-260,110,520,480,12); g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-260,110,520,480,12); items.push(g);
    items.push(txt(this,W/2,144,'Paused',30,GOLD).setOrigin(0.5).setDepth(59));
    items.push(txt(this,W/2,190,'Hero movement',17,PARCH).setOrigin(0.5).setDepth(59));
    const mv=(id,label,x)=>{ const b=button(this,x,228,150,44,label+(this.moveScheme===id?' ✓':''),()=>{ this.setMoveScheme(id); this.renderPause(); },{size:15}); b.setDepth(59); items.push(b); };
    mv('tap','Tap',W/2-170); mv('stick','Joystick',W/2); mv('follow','Follow',W/2+170);
    items.push(txt(this,W/2,272,'Tap: tap the ground to march. Joystick: drag on the field.\nFollow: hold on the field — he runs to your finger.',13,'#cdbd95',{align:'center'}).setOrigin(0.5).setDepth(59));
    const eb=button(this,W/2,330,300,48,'Edit button layout',()=>this.enterLayoutEdit(),{size:17}); eb.setDepth(59); items.push(eb);
    items.push(txt(this,W/2,376,'Keybinds live in Controls, on the main menu.',13,'#cdbd95').setOrigin(0.5).setDepth(59));
    const rb=button(this,W/2,434,300,52,'Resume',()=>this.closePause(),{size:19}); rb.setDepth(59); items.push(rb);
    const qb=button(this,W/2,508,300,48,'Quit run',()=>{ this.closePause(); this.end(false); },{size:16}); qb.setDepth(59); items.push(qb);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); }); }
  // Editing in battle: the pause holds the fight while the REAL buttons
  // are dragged. They are disabled for the duration (layoutEditor), so
  // no drag can fire an action, and field taps are walled by onTap's
  // layoutEdit guard — a dragging tap never becomes an order. DONE
  // returns to the pause; the layout is saved as each drag ends and
  // applies at once, because the buttons being dragged ARE the battle's.
  enterLayoutEdit(){ if(this.layoutEdit) return; this.clearPause(); this.layoutEdit=true;
    if(!this.layoutEd) this.layoutEd=layoutEditor(this,()=>this.saveLayoutFromScene());
    this.layoutEd.setItems(this.layoutReg||[]); this.layoutEd.enter();
    const items=[]; this.editItems=items;
    const g=this.add.graphics().setDepth(60); g.fillStyle(0x140c07,0.92); g.fillRoundedRect(W/2-330,10,660,44,10); g.lineStyle(2,0xf2c14e,1); g.strokeRoundedRect(W/2-330,10,660,44,10); items.push(g);
    items.push(txt(this,W/2,32,'EDITING LAYOUT — drag any button into place',17,'#f2c14e').setOrigin(0.5).setDepth(61));
    const dn=button(this,W/2-100,580,170,44,'Done',()=>this.exitLayoutEdit(),{size:16}); dn.setDepth(61); items.push(dn);
    const rs=button(this,W/2+100,580,190,44,'Reset layout',()=>{ resetLayout(); const dp=defaultLayoutPos();
      (this.layoutReg||[]).forEach(en=>{ const p=dp[en.id]; if(p){ en.obj.setPosition(p.x,p.y); if(en.sync) en.sync(p.x,p.y); } });
      this.syncLayoutMeta(); this.toast('Layout reset to the standard'); },{size:15}); rs.setDepth(61); items.push(rs);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); }); }
  exitLayoutEdit(){ if(!this.layoutEdit) return; this.layoutEdit=false;
    if(this.layoutEd) this.layoutEd.exit();
    (this.editItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.editItems=[];
    this.saveLayoutFromScene();
    if(this.paused) this.renderPause(); }
  // Upgrade 10: AUTO-FIRE — the hero's basic attack, restored. When the
  // toggle is ON the hero strikes the nearest enemy inside his range
  // circle on his own attack clock (h.cd against hd.rate): melee damage
  // at hand range, a sling stone beyond it, through the orb multiplier
  // like every hero hit — the pre-Upgrade-8 behavior, numbers unchanged.
  // When the toggle is OFF he performs NO basic attacks at all; his
  // power moves still fire by button. Striking drops a raised guard.
  heroAutoFire(){ const h=this.hero, hd=h.def; if(!this.autoFire||!h||h.down>0||h.cd>0) return;
    const t=this.nearestEnemy(h.x,h.y,hd.range+(hd.range<80?8:0));
    if(!t) return;
    h.cd=hd.rate;
    if(h.blocking) this.setBlock(false);
    if(hd.range<80){ this.damage(t,hd.dmg*this.orbDmgMul(),hd.dmgType,{crit:0.1}); this.spark(t.x,t.y,0xe8e0c8,3); }
    else { this.shoot(h.x,h.y,t,hd.dmgType==='holy'?'ember':'stone',{dmg:hd.dmg*this.orbDmgMul(),type:hd.dmgType,crit:0.1},620); SFX.sling(); }
    if(this.tutorial) this.tutEvent('autofired'); } // Upgrade 11: proof the hero fired on his own
  pressDodge(){ const h=this.hero; if(!h||this.over||this.shopOpen||this.victoryOpen||h.down>0) return 'none';
    if(h.dodgeCd>0){ if(h.dodgeCd<=INPUT_BUFFER) h.dodgeBuf=true; return 'buffered'; }
    // Dash where the hero is heading (his march target), else where he faces.
    let dx=h.tx-h.x, dy=h.ty-h.y; const dl=Math.hypot(dx,dy);
    if(dl>6){ dx/=dl; dy/=dl; } else { dx=h.faceX; dy=h.faceY; }
    h.dodgeDx=dx; h.dodgeDy=dy; h.dodgeT=FIGHT.dodgeTime; h.iframes=FIGHT.dodgeIframes; h.dodgeCd=FIGHT.dodgeCd;
    if(h.blocking) this.setBlock(false);
    if(this.tutorial) this.tutEvent('dodge'); SFX.sling(); return 'dodged'; } // Upgrade 11: a real dodge, counted
  setBlock(on){ const h=this.hero; if(!h) return false;
    if(on){ if(h.down>0||h.guardBreakT>0||h.stamina<=1) return false;
      if(h.sprint){ h.sprint=false; if(this.fightBtns&&this.fightBtns.sprint) this.fightBtns.sprint.redraw(false); }
      h.blocking=true; if(this.tutorial) this.tutEvent('block'); } // Upgrade 11: the guard was really raised
    else h.blocking=false;
    if(this.fightBtns&&this.fightBtns.block) this.fightBtns.block.redraw(h.blocking);
    return h.blocking; }
  toggleSprint(){ const h=this.hero; if(!h||this.over||this.shopOpen||h.down>0) return;
    if(h.blocking){ this.toast('Cannot sprint behind a raised guard'); return; }
    if(!h.sprint&&h.stamina<=5){ this.toast('Too winded to sprint'); return; }
    h.sprint=!h.sprint;
    if(this.tutorial&&h.sprint) this.tutEvent('sprint'); // Upgrade 11: sprint switched on counts
    if(this.fightBtns&&this.fightBtns.sprint) this.fightBtns.sprint.redraw(h.sprint);
    this.floatText(h.x,h.y-64,h.sprint?'Sprint!':'Sprint off','#f2c14e'); }
  // Per-frame fight bookkeeping: dodge cooldown and i-frames, the dodge
  // press buffer, guard break, and the stamina economy — block and
  // sprint drain one pool; rest refills it after a breath. (Upgrade 10:
  // the manual-attack recovery/buffer and the heavy wind-up left with
  // the manual scheme; auto-fire keeps its own clock in update().)
  fightTick(dt){ const h=this.hero; if(!h) return;
    if(h.dodgeCd>0) h.dodgeCd-=dt;
    if(h.iframes>0) h.iframes-=dt;
    if(h.guardBreakT>0) h.guardBreakT-=dt;
    if(h.dodgeBuf&&h.dodgeCd<=0){ h.dodgeBuf=false; this.pressDodge(); }
    let drained=false;
    if(h.blocking){ h.stamina=Math.max(0,h.stamina-FIGHT.blockDrain*dt); h.stamDelay=FIGHT.stamDelay; drained=true;
      if(h.stamina<=0){ this.setBlock(false); h.guardBreakT=FIGHT.guardBreak; this.floatText(h.x,h.y-84,'Guard broken!','#ff8a6a'); } }
    else if(h.sprint&&Math.hypot(h.tx-h.x,h.ty-h.y)>6){ h.stamina=Math.max(0,h.stamina-FIGHT.sprintDrain*dt); h.stamDelay=FIGHT.stamDelay; drained=true;
      if(h.stamina<=0){ h.sprint=false; if(this.fightBtns&&this.fightBtns.sprint) this.fightBtns.sprint.redraw(false); this.floatText(h.x,h.y-84,'Winded!','#ff8a6a'); } }
    if(!drained){ if(h.stamDelay>0) h.stamDelay-=dt;
      else if(h.stamina<FIGHT.stamMax) h.stamina=Math.min(FIGHT.stamMax,h.stamina+FIGHT.stamRegen*dt); }
    this.drawFightUI(); }
  // The stack's faces: the dodge recovery veil, the stamina pool as a
  // bar under the AUTO-FIRE toggle and as the BLOCK button's base strip.
  drawFightUI(){ const B=this.fightBtns; if(!B||!this.hero) return; const h=this.hero;
    const veil=(b,frac)=>{ if(!b||!b.sweep) return; const g=b.sweep; g.clear();
      if(frac>0){ g.fillStyle(0x000000,0.55); g.fillRect(b.sx-b.sw/2,b.sy-b.sh/2,b.sw,b.sh*Math.min(1,frac)); } };
    veil(B.dodge,h.dodgeCd>0?h.dodgeCd/FIGHT.dodgeCd:0);
    if(B.block&&B.block.sweep){ const g=B.block.sweep; g.clear();
      g.fillStyle(h.guardBreakT>0?0xa33b20:0x5aa33b,0.9); g.fillRect(B.block.sx-B.block.sw/2,B.block.sy+B.block.sh/2-5,B.block.sw*Math.max(0,h.stamina)/FIGHT.stamMax,5); }
    if(this.fightBar){ const g=this.fightBar; g.clear();
      // Upgrade 12: the bar rides under the AUTO-FIRE toggle wherever
      // the player's layout puts it (at the default: 1080,122, as ever).
      const bx=this.autoBtn?this.autoBtn.sx-98:1080, by=this.autoBtn?this.autoBtn.sy+52:122;
      g.fillStyle(0x000000,0.7); g.fillRect(bx,by,196,10);
      g.fillStyle(h.stamina>30?0x5aa33b:0xa33b20,1); g.fillRect(bx,by,196*Math.max(0,h.stamina)/FIGHT.stamMax,10);
      g.lineStyle(1,0xd9a441,0.9); g.strokeRect(bx,by,196,10); }
    const st=Math.ceil(h.stamina);
    if(this.fightStat&&this._stamShown!==st){ this._stamShown=st; this.fightStat.setText('STAMINA '+st); } }
  // Upgrade 3: the hero returns only while the camp stands. If the camp has
  // fallen the run is already over, so a downed hero simply stays down.
  tickHeroDown(dt){ const h=this.hero; if(h.down<=0) return; h.down-=dt;
    if(h.down<=0&&this.campHp>0){ h.hp=h.def.hp; h.down=0; h.spr.setAlpha(1); h.x=h.tx=this.campPos.x+60; h.y=h.ty=this.campPos.y; this.toast(h.def.name+' returns!'); } }
  // Upgrade 3: camp damage. Union Shield (shieldT) turns every blow aside.
  // The goal-wave champion hits the camp three times as hard.
  hitCamp(amt,e){ if(this.over) return;
    if(this.tutorial) return; // Upgrade 11: the tutorial's camp cannot fall — no blow lands on it at all
    if(this.shieldT>0) return;
    if(e&&e.boss) amt*=3;
    this.campHp-=amt; this.campHurtThisWave=true; this.campHurtTotal=true;
    if(this.campSpr){ this.campSpr.setTintFill(0xff8a6a); this.time.delayedCall(90,()=>{ if(this.campSpr&&this.campSpr.active) this.campSpr.clearTint(); }); }
    SFX.campHit();
    if(this.campWarnedWave!==this.wave){ this.campWarnedWave=this.wave; SFX.campWarning(); this.toast('The camp is under attack!',2600); }
    if(this.campHp<=0){ this.campHp=0; this.refreshHUD(); this.end(false); return; }
    this.refreshHUD(); }
  drawCampBar(){ if(!this.campBar) return; const f=Math.max(0,this.campHp/this.campMax), x=this.campPos.x-46, y=this.campPos.y-58, b=this.campBar;
    b.clear(); b.fillStyle(0x000000,0.7); b.fillRect(x,y,92,8); b.fillStyle(f>0.3?0x5aa33b:0xa33b20,1); b.fillRect(x,y,92*f,8); b.lineStyle(1,0xd9a441,0.9); b.strokeRect(x,y,92,8); }
  // --- camp upgrades (Upgrade 4): the camp grows with the run, bought in the shop ---
  campUpLocked(u){ return !!(u.req&&!this.campUp[u.req]); }
  buyCampUpgrade(u){ if(this.campUp[u.id]||this.campUpLocked(u)||this.manna<u.cost) return false;
    this.manna-=u.cost; this.campUp[u.id]=true;
    if(u.hpAdd){ this.campMax+=u.hpAdd; this.campHp=Math.min(this.campMax,this.campHp+u.hpAdd); }
    if(u.id==='swift') this.respawnTime=4;
    if(u.id==='watchfire') this.campFireCd=0;
    SFX.build(); this.afterCampBuy(); this.refreshHUD(); return true; }
  buyCampRepair(){ if(this.campHp>=this.campMax||this.manna<CAMP_REPAIR.cost) return false;
    this.manna-=CAMP_REPAIR.cost; this.campHp=Math.min(this.campMax,this.campHp+CAMP_REPAIR.heal);
    SFX.build(); this.afterCampBuy(); this.refreshHUD(); return true; }
  // Upgrade 9: a camp purchase re-renders whichever surface sold it — the
  // between-wave shop's camp strip or the mid-wave camp panel. One state,
  // one price list (CAMP_UPGRADES / CAMP_REPAIR), two doors.
  afterCampBuy(){ if(this.shopOpen) this.renderShop(false); else if(this.campPanelOpen) this.renderCampPanel(); }
  // --- Upgrade 9: the camp panel — camp care reachable mid-wave ---
  // Tapping the camp (or the CAMP button) opens a compact overlay with the
  // same purchases at the same prices. The wave does NOT pause: the fight
  // continues behind it, field taps are walled off while it is open
  // (onTap), and purchases land instantly, exactly as in the shop.
  toggleCampPanel(){ if(this.over||this.shopOpen||this.victoryOpen) return;
    if(this.campPanelOpen) this.closeCampPanel(); else this.openCampPanel(); }
  openCampPanel(){ if(this.campPanelOpen||this.shopOpen||this.over) return; this.campPanelOpen=true; this.renderCampPanel();
    if(this.tutorial) this.tutEvent('camp'); } // Upgrade 11: opening the panel is the camp step's proof
  closeCampPanel(){ this.campPanelOpen=false; this.clearCampPanel(); }
  campAdd(o){ if(!this.campItems) this.campItems=[]; this.campItems.push(o); return o; }
  clearCampPanel(){ (this.campItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.campItems=[]; }
  renderCampPanel(){ this.clearCampPanel();
    const px=340,py=148,pw=600,ph=384;
    const g=this.add.graphics().setDepth(50); g.fillStyle(0x140c07,0.95); g.fillRoundedRect(px,py,pw,ph,12); g.lineStyle(3,0xd9a441); g.strokeRoundedRect(px,py,pw,ph,12); this.campAdd(g);
    this.campAdd(txt(this,px+pw/2,py+30,'THE CAMP',26,GOLD).setOrigin(0.5).setDepth(51));
    this.campAdd(txt(this,px+pw/2,py+62,'Camp '+Math.max(0,Math.ceil(this.campHp))+'/'+this.campMax+' HP   ·   Manna '+Math.floor(this.manna),16,PARCH).setOrigin(0.5).setDepth(51));
    const colX=[px+150,px+450], rowY=[py+118,py+176,py+234];
    const campBtn=(u,x,y)=>{ if(this.campUp[u.id]){ this.campAdd(txt(this,x,y,u.name+' ✓',15,'#8fd06a').setOrigin(0.5).setDepth(51)); return; }
      const locked=this.campUpLocked(u);
      const b=button(this,x,y,268,46,(locked?'🔒 ':'')+u.name+' · '+u.cost,()=>this.buyCampUpgrade(u),{size:15,disabled:locked||this.manna<u.cost}); b.setDepth(51); this.campAdd(b); };
    campBtn(CAMP_UPGRADES[0],colX[0],rowY[0]); campBtn(CAMP_UPGRADES[1],colX[0],rowY[1]); campBtn(CAMP_UPGRADES[2],colX[0],rowY[2]);
    campBtn(CAMP_UPGRADES[3],colX[1],rowY[0]); campBtn(CAMP_UPGRADES[4],colX[1],rowY[1]);
    const full=this.campHp>=this.campMax;
    const rb=button(this,colX[1],rowY[2],268,46,'Repair +'+CAMP_REPAIR.heal+' · '+CAMP_REPAIR.cost,()=>this.buyCampRepair(),{size:15,disabled:full||this.manna<CAMP_REPAIR.cost}); rb.setDepth(51); this.campAdd(rb);
    const cb=button(this,px+pw/2,py+ph-40,220,46,'Close',()=>this.closeCampPanel(),{size:16}); cb.setDepth(51); this.campAdd(cb);
    this.fixUI(); }
  // Watch Fire: a camp that has bought its fire fights back — an ember at the
  // nearest enemy in range every CAMP_FIRE.rate seconds, with a gold spark at
  // the camp so the shot has a visible source.
  campFireTick(dt){ if(!this.campUp||!this.campUp.watchfire||!this.waveActive) return;
    this.campFireCd-=dt; if(this.campFireCd>0) return;
    const t=this.nearestEnemy(this.campPos.x,this.campPos.y,CAMP_FIRE.range);
    if(!t){ this.campFireCd=0.25; return; }
    this.campFireCd=CAMP_FIRE.rate;
    this.shoot(this.campPos.x,this.campPos.y-40,t,'ember',{dmg:CAMP_FIRE.dmg,type:'fire',crit:0},700);
    this.spark(this.campPos.x,this.campPos.y-46,0xd9a441,2); }
  // --- field coins (Upgrade 3): the bigger map pays those who explore it ---
  spawnCoin(){ this.coinSeq=(this.coinSeq||0)+1; const grok=this.coinSeq%6===0;
    const x=Phaser.Math.Between(this.campPos.x+220,this.worldW-160), y=Phaser.Math.Between(90,this.worldH-90);
    const spr=this.add.image(x,y,grok?'coing':'coin').setDepth(6);
    this.tweens.add({targets:spr,scale:1.25,alpha:0.75,duration:650,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.coins.push({spr,x,y,grok}); }
  collectCoins(){ if(!this.hero||this.hero.down>0) return; const h=this.hero;
    this.coins=this.coins.filter(c=>{ if(Math.hypot(c.x-h.x,c.y-h.y)>=28) return true;
      this.tweens.killTweensOf(c.spr); c.spr.destroy(); this.coinCount++;
      if(c.grok){ this.earn('coin',1); this.floatText(c.x,c.y-14,'+1 Grokonian','#fff3c0'); }
      else { this.manna+=8; this.floatText(c.x,c.y-14,'+8 Manna',GOLD); }
      SFX.coinPickup(c.grok); this.refreshHUD(); return false; }); }
  // --- Grokonian orbs (Upgrade 5): wall-buys for the conquest field ---
  // Stations stand at fixed fractions of the world, so every era inherits the
  // same five posts: Strength north-mid, Swiftness south-mid, Mending just
  // east of the camp, Iron centre-field, Thunder deep toward the enemy edge.
  // In the Bible world (1920x1200) those fractions land at (620,300),
  // (620,900), (360,600), (1050,600) and (1500,600).
  buildOrbs(){ const spots=[[0.323,0.25],[0.323,0.75],[0.1875,0.5],[0.547,0.5],[0.781,0.5]];
    ORBS.forEach((def,i)=>{ const x=Math.round(spots[i][0]*this.worldW), y=Math.round(spots[i][1]*this.worldH);
      const glow=this.add.circle(x,y-8,34,def.color,0.16).setDepth(4);
      const img=this.add.image(x,y,'orb_'+def.id).setDepth(5);
      const label=txt(this,x,y-58,def.short+' · '+def.cost+' G',14,def.css).setOrigin(0.5).setDepth(6);
      this.tweens.add({targets:img,scale:1.07,duration:1100,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      this.tweens.add({targets:glow,alpha:0.07,duration:1100,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      this.orbs.push({def,x,y,img,glow,label,cd:0,hinted:false,pending:0}); }); }
  // The two timed multipliers, consulted exactly where damage and speed are
  // computed (hero attack + movement, squad movement) — no parallel systems.
  orbDmgMul(){ return this.buffStrT>0?1.5:1; }
  orbSpdMul(){ return this.buffSpdT>0?1.3:1; }
  tryBuyOrb(o){ const h=this.hero; if(!h) return 'none';
    if(o.cd>0){ this.toast(o.def.name+' is recharging — '+Math.ceil(o.cd)+'s'); return 'cooldown'; }
    if(h.down>0){ this.toast(h.def.name+' is down — no one stands to touch the orb'); return 'down'; }
    if(Math.hypot(h.x-o.x,h.y-o.y)>ORB_RANGE){ this.toast('Move closer to the orb');
      // walk the hero to a spot beside the orb; the next tap buys
      h.tx=Math.max(20,Math.min(this.worldW-20,o.x-58)); h.ty=Math.max(40,Math.min(this.worldH-20,o.y));
      // Upgrade 9: ONE tap is now the whole instruction — the purchase is
      // pending, and orbTick completes it the moment the hero arrives in
      // range (while the orb is awake). One clear tap, one clear result.
      o.pending=6;
      return 'far'; }
    // Upgrade 11: in the tutorial a buy is a GRANT, never a purchase —
    // Tokens is not called at all, so no real Grokonian can move here
    // (the U11 harness proves the spend count stays zero through a buy).
    if(!this.tutorial&&!Tokens.spend('orb:'+o.def.id,o.def.cost)){ this.toast('Not enough Grokonians (have '+Tokens.balance()+')'); return 'funds'; }
    o.cd=ORB_CD; o._cdShown=null; o.pending=0;
    this.applyOrb(o); if(this.tutorial) this.tutEvent('orb'); SFX.orbBuy(); if(SFX.orbDrink) SFX.orbDrink(); this.orbBanner(o); this.spark(o.x,o.y-8,o.def.color,10); this.refreshHUD();
    return 'bought'; }
  // Upgrade 9: the potion moment — a purchase you cannot miss. A colored
  // burst and a closing ring at the hero in the orb's own color, and a
  // banner at the top of the screen naming the power and what it does, in
  // the orb's voice: NAME — effect. (Scenes without a graphics factory —
  // the verification harnesses — skip the banner furniture; the burst and
  // the buff itself still land.)
  orbBanner(o){ const d=o.def, h=this.hero;
    if(h){ this.spark(h.x,h.y-10,d.color,16);
      if(this.add.circle){ const ring=this.add.circle(h.x,h.y,14,d.color,0.35).setDepth(17);
        this.tweens.add({targets:ring,scale:3.2,alpha:0,duration:450,onComplete:()=>ring.destroy()}); } }
    if(!this.add.graphics||!this.add.text) return;
    const items=[]; const bw=440,bh=64,bx=W/2-bw/2,by=64;
    const g=this.add.graphics().setDepth(45); g.fillStyle(0x140c07,0.92); g.fillRoundedRect(bx,by,bw,bh,10); g.lineStyle(3,d.color,1); g.strokeRoundedRect(bx,by,bw,bh,10); items.push(g);
    g.fillStyle(d.color,1); g.fillCircle(bx+30,by+bh/2,11);
    const n=txt(this,bx+52,by+8,d.name.toUpperCase(),20,d.css).setDepth(46); items.push(n);
    const f=txt(this,bx+52,by+36,d.fx,14,PARCH).setDepth(46); items.push(f);
    items.forEach(it=>{ if(it.setScrollFactor) it.setScrollFactor(0); });
    this._orbBanner=items;
    this.tweens.add({targets:items,alpha:0,delay:1700,duration:500,onComplete:()=>items.forEach(it=>{ try{it.destroy();}catch(e){} })}); }
  applyOrb(o){ const d=o.def, h=this.hero;
    if(d.id==='strength'){ this.buffStrT=d.dur; this.toast('Orb of Strength — hero damage +50% for 60s'); }
    else if(d.id==='swiftness'){ this.buffSpdT=d.dur; this.toast('Orb of Swiftness — hero and squads move +30% faster for 60s'); }
    else if(d.id==='mending'){ h.hp=h.def.hp;
      this.squads.forEach(s=>{ if(!s.dead) s.hp=Math.min(s.max,s.hp+s.max*0.5); });
      this.campHp=Math.min(this.campMax,this.campHp+75);
      this.floatText(h.x,h.y-56,'Mended!','#a8e89a'); this.spark(this.campPos.x,this.campPos.y-30,0x63c74d,6);
      this.toast('Orb of Mending — hero restored, squads +50%, camp +75'); }
    else if(d.id==='iron'){ // reuses the Union Shield mechanic: hitCamp already turns blows aside while shieldT runs
      this.shieldT=Math.max(this.shieldT,d.dur); this.buffIronT=d.dur;
      this.toast('Orb of Iron — the camp cannot be harmed for 30s'); }
    else if(d.id==='thunder'){ this.enemies.slice().forEach(e=>{ if(!e.dead) this.damage(e,e.boss?75:150,'holy'); });
      this.cameras.main.flash(180,255,240,180); SFX.stomp();
      this.toast('Orb of Thunder — the storm falls on the whole enemy host'); } }
  orbTick(dt){ if(this.buffStrT>0) this.buffStrT=Math.max(0,this.buffStrT-dt);
    if(this.buffSpdT>0) this.buffSpdT=Math.max(0,this.buffSpdT-dt);
    if(this.buffIronT>0) this.buffIronT=Math.max(0,this.buffIronT-dt);
    for(const o of this.orbs){ if(o.cd>0) o.cd=Math.max(0,o.cd-dt);
      const c=Math.ceil(o.cd);
      if(o._cdShown!==c){ o._cdShown=c;
        if(c>0){ o.label.setText(o.def.short+' · '+c+'s'); o.img.setAlpha(0.45); o.glow.setVisible(false); }
        else { o.label.setText(o.def.short+' · '+o.def.cost+' G'); o.img.setAlpha(1); o.glow.setVisible(true); } }
      // Upgrade 9: a pending one-tap purchase completes itself on arrival.
      if(o.pending>0){ o.pending-=dt;
        if(o.pending<=0) o.pending=0;
        else if(o.cd<=0&&this.hero&&this.hero.down<=0&&Math.hypot(this.hero.x-o.x,this.hero.y-o.y)<=ORB_RANGE){ o.pending=0; this.tryBuyOrb(o); } }
      if(!o.hinted&&this.hero&&this.hero.down<=0&&Math.hypot(this.hero.x-o.x,this.hero.y-o.y)<140){ o.hinted=true; this.toast(o.def.name+' — '+o.def.cost+' Grokonians. Tap the orb to buy its power.',2400); } } }
  // --- squads ---
  addSquad(def,x,y){ const s={def,x:x||(this.campPos?this.campPos.x+60:170),y:y||(this.campPos?this.campPos.y:360),hp:def.hp,max:def.hp,dmg:def.dmg,range:def.range,rate:def.rate,speed:def.speed,
      // Upgrade 9: a squad is born POSTED where it stands (beside the camp)
      // and holds until directed. ord null means "under the army order".
      armor:def.role==='shield'?0.2:0,cd:0,buffRateT:0,buffDmgT:0,dead:false,upgrades:{},ord:'post',post:null};
    s.post={x:s.x,y:s.y};
    s.spr=uspr(this,s.x,s.y,def,def.img?58:54); applyTint(s.spr,def);
    s.bar=this.add.graphics().setDepth(12); this.squads.push(s); return s; }
  hurtSquad(s,amt){ if(s.dead) return; let m=1-(s.armor||0); if(this.squadOrder(s)==='shieldwall') m*=0.55; s.hp-=amt*m;
    s.spr.setTint(0xff6a5a); this.time.delayedCall(60,()=>{ if(!s.dead&&s.spr.active){ s.spr.clearTint(); applyTint(s.spr,s.def); } });
    if(s.hp<=0){ s.dead=true; if(this.selSquad===s) this.selSquad=null; s.spr.destroy(); s.bar.destroy(); this.toast(s.def.name+' has fallen. Squad lost — the fallen do not return this run',2800); } }
  formationOffset(i,ord){ ord=ord||this.order; const col=Math.floor(i/3), row=i%3;
    if(ord==='flank') return {dx:-16-col*30,dy:(row-1)*74};
    if(ord==='shieldwall') return {dx:(this.squads[i]&&this.squads[i].def.role==='shield'?26:-30-col*30),dy:(row-1)*40};
    return {dx:-46-col*38,dy:(row-1)*38}; }
  // --- enemies & waves ---
  waveComp(w){ const E=this.roster.enemy, byId=id=>E.find(e=>e.id===id);
    const comp=[]; const push=(id,n)=>{ if(n>0) comp.push([byId(id),n]); };
    if(this.eraId==='bible'){
      // Upgrade 2 tuning: the wave 3-5 wall was swarm volume plus healing
      // priests arriving a wave too early. Fewer locusts/frogs, priests held
      // to wave 5; spearmen and the late curve untouched.
      push('locust_swarm',Math.min(2+w,9)); push('plague_frog',Math.max(0,w-2));
      if(w>=2) push('philistine_spearman',Math.min(1+w,9));
      if(w>=5) push('baal_priest',Math.min(w-3,5));
      if(w>=5) push('pebble_golem',Math.min(w-3,6));
      if(w>=7) push('idol_golem',Math.min(w-5,4));
      if(w===this.goalWave) push('idol_golem',1); // goal-wave champion (boss-scaled at spawn)
    } else { // generic fallback for future eras
      push(E[3].id,Math.min(2+w,10)); push(E[0].id,w>=5?Math.min(w-3,5):0); push(E[1].id,w>=4?Math.min(w-2,6):0); push(E[2].id,w>=6?Math.min(w-4,4):0);
    }
    return comp.filter(([,n])=>n>0); }
  startWave(){ this.wave++; this.waveActive=true; this.campHurtThisWave=false;
    const night=this.wave%2===0;
    if(this.nightRect) this.nightRect.destroy();
    if(night) this.nightRect=this.add.rectangle(this.worldW/2,this.worldH/2,this.worldW,this.worldH,0x0a1030,0.22).setDepth(18);
    const hpM=hpScaleForWave(this.wave), dmM=dmgScaleForWave(this.wave);
    let t=0.6, bossDone=false;
    this.waveComp(this.wave).forEach(([def,n])=>{ for(let i=0;i<n;i++){ const boss=(this.wave===this.goalWave&&def.id==='idol_golem'&&i===n-1&&!this.endless&&!bossDone); if(boss) bossDone=true;
        this.spawnQ.push({def,at:t,boss}); t+=def.spawnGap||(def.role==='ranged'?1.1:0.75); } t+=1.2; });
    this.spawnQ.sort((a,b)=>a.at-b.at); this.waveClock=0; this.waveHpM=hpM; this.waveDmM=dmM;
    SFX.wave(); this.toast('Wave '+this.wave+(night?' — Night':' — Day')+(this.wave===this.goalWave&&!this.endless?' — the goal wave!':'')); this.refreshHUD(); }
  spawn(q){ const d=q.def, hpM=this.waveHpM*(q.boss?5:1), dmM=this.waveDmM*(q.boss?1.6:1);
    const e={def:d,hp:d.hp*hpM,max:d.hp*hpM,dmg:d.dmg*dmM,range:d.range,rate:d.rate,speed:d.speed*(this.wave%2===0?1.08:1),
      x:this.worldW+20+Math.random()*30,y:120+Math.random()*Math.max(60,this.worldH-280),cd:0,dead:false,boss:q.boss,armorType:'flesh',ph:Math.random()*6};
    e.spr=uspr(this,e.x,e.y,d,q.boss?120:(d.img?66:(SZ[d.sprite]||54))); applyTint(e.spr,d);
    e.spr.setDepth(7); e.bar=this.add.graphics().setDepth(12); if(d.heals) e.healCd=1.5; if(q.boss) this.setupBoss(e); this.enemies.push(e); return e; }
  // --- goal-wave champion: boss name + health bar (the old TD treatment) ---
  setupBoss(e){ this.boss=e; this.bossBar=this.add.graphics().setDepth(32).setScrollFactor(0);
    this.bossName=txt(this,W/2,HUD_Y-30,e.def.name.toUpperCase()+' — GOAL-WAVE CHAMPION',20,GOLD).setOrigin(0.5).setDepth(32).setScrollFactor(0);
    // Upgrade 7: phase state lives on the champion itself. heavyT counts to
    // the next wind-up, heavyWind is the wind-up in progress (the champion
    // stands committed while it runs), slamT/slam are the Phase II ground
    // slam and its live telegraph, escorted makes the Phase II call once-only.
    e.bossPhase=1; e.heavyT=BOSS.heavyEvery; e.heavyWind=0; e.slamT=BOSS.slamEvery; e.slam=null; e.escorted=false;
    // Telegraphs are drawn in the WORLD (no scrollFactor): the wind-up ring
    // around the champion and the slam's marked circle on the ground.
    this.bossFx=this.add.graphics().setDepth(6);
    this.cameras.main.shake(400,0.008); SFX.stomp(); this.toast(e.def.name+' has come out to fight!',2600); }
  bossTick(dt){ if(!this.bossBar) return; const e=this.boss; if(!e||e.dead){ this.clearBoss(); return; }
    dt=dt||0;
    const f=Math.max(0,e.hp/e.max), bb=this.bossBar; bb.clear();
    bb.fillStyle(0x000000,0.7); bb.fillRect(W/2-250,HUD_Y-16,500,12); bb.fillStyle(0xa33b20,1); bb.fillRect(W/2-250,HUD_Y-16,500*f,12);
    bb.lineStyle(2,0xd9a441); bb.strokeRect(W/2-250,HUD_Y-16,500,12);
    // Upgrade 7: phases + telegraphs. Phase sync is defensive here (damage()
    // already fires it the instant a threshold is crossed); telegraphs are
    // redrawn every tick so they can never lie about where death lands.
    this.bossPhaseSync(e);
    this.bossDrawFx(e);
    if(e.stun>0) return; // a stunned champion's timers hold — the telegraph stays honest
    // --- heavy strike: wind up committed, then the cleave ---
    if(e.heavyWind>0){ e.heavyWind-=dt;
      if(e.spr&&e.spr.setScale&&e.spr.baseScale) e.spr.setScale(e.spr.baseScale*(1+0.15*(1-Math.max(0,e.heavyWind)/BOSS.heavyWindup)));
      if(e.heavyWind<=0){ e.heavyWind=0;
        if(e.spr&&e.spr.active){ e.spr.clearTint(); applyTint(e.spr,e.def); if(e.spr.setScale&&e.spr.baseScale) e.spr.setScale(e.spr.baseScale); }
        this.bossHeavyStrike(e); } }
    else { e.heavyT-=dt;
      if(e.heavyT<=0){ if(this.bossEngaged(e)){ e.heavyWind=BOSS.heavyWindup; e.heavyT=this.bossHeavyEvery(e);
          if(e.spr&&e.spr.active) e.spr.setTintFill(0xff5a3a);
          this.floatText(e.x,e.y-84,'!','#ff8a6a'); this.spark(e.x,e.y,0xff5a3a,4); }
        else e.heavyT=0.5; } }
    // --- ground slam (Phase II and beyond) ---
    if((e.bossPhase||1)>=2){
      if(e.slam){ e.slam.t-=dt;
        if(e.slam.t<=0){ const s=e.slam; e.slam=null; e.slamT=BOSS.slamEvery; this.bossSlamImpact(e,s); } }
      else { e.slamT-=dt;
        if(e.slamT<=0){ const pos=this.bossSlamTarget(e);
          if(pos){ e.slam={x:pos.x,y:pos.y,t:BOSS.slamDelay}; this.spark(pos.x,pos.y,0xff8a3a,4); }
          else e.slamT=1; } } } }
  clearBoss(){ if(this.bossBar){ this.bossBar.destroy(); this.bossBar=null; } if(this.bossName){ this.bossName.destroy(); this.bossName=null; } if(this.bossFx){ this.bossFx.destroy(); this.bossFx=null; } this.boss=null; }
  // --- Upgrade 7: champion phases ---
  // Effective tempo/stat helpers — the ONLY places phase multipliers live,
  // so the champion's stored stats (hp, max, dmg, rate, speed) never change.
  bossAtkRate(e){ return e.rate*((e.bossPhase||1)>=3?BOSS.enrageRateMul:1); }
  bossMoveMul(e){ return (e.bossPhase||1)>=3?BOSS.enrageSpeedMul:1; }
  bossHeavyMul(e){ return (e.bossPhase||1)>=3?BOSS.enrageHeavyMul:BOSS.heavyMul; }
  bossHeavyEvery(e){ return (e.bossPhase||1)>=3?BOSS.enrageHeavyEvery:BOSS.heavyEvery; }
  // Thresholds are fractions of MAX hp. Monotonic: phases never step back,
  // and each crossed phase's entry fires exactly once, in order — a single
  // huge hit through both lines lands the champion in Phase III with the
  // escort called once on the way through, never twice, never skipped.
  bossPhaseSync(e){ if(!e||e.dead||!e.boss) return; const f=e.hp/e.max;
    const p=f>BOSS.p2At?1:(f>BOSS.p3At?2:3), cur=e.bossPhase||1;
    if(p<=cur) return;
    for(let k=cur+1;k<=p;k++) this.bossEnterPhase(e,k);
    e.bossPhase=p; }
  bossEnterPhase(e,p){ SFX.bossRoar();
    if(this.bossName&&this.tweens) this.tweens.add({targets:this.bossName,scale:1.25,duration:160,yoyo:true,repeat:1,ease:'Sine.inOut'});
    if(p===2){ e.slamT=BOSS.slamEvery; this.bossSummonEscort(e);
      this.toast(e.def.name+' calls its servants! Phase II — watch the ground!',3000); }
    if(p===3){ e.heavyT=Math.min(e.heavyT,BOSS.enrageHeavyEvery);
      if(this.bossName){ this.bossName.setText(e.def.name.toUpperCase()+' — ENRAGED'); if(this.bossName.setColor) this.bossName.setColor('#ff8a6a'); }
      this.toast(e.def.name+' is ENRAGED! Phase III — faster, heavier blows!',3000); }
    this.floatText(e.x,e.y-96,'PHASE '+['','I','II','III'][p]+'!','#ff8a6a'); }
  // The Phase II escort: a capped handful of the era's own soldiers, called
  // once. Era-driven like everything else: spear first, then infantry and
  // ranged; never the champion's own kind, never a healer.
  bossSummonEscort(e){ if(e.escorted) return; e.escorted=true;
    const E=this.roster.enemy, pick=r=>E.find(d=>d.role===r&&d.id!==e.def.id&&!d.heals);
    const pref=[pick('spear'),pick('infantry'),pick('spear'),pick('ranged')].filter(Boolean);
    const offs=[[-76,-56],[76,-56],[-76,56],[76,56]], defs=[];
    for(let i=0;i<BOSS.escortCount;i++){ const d=pref[i%pref.length]||E.find(d=>d.id!==e.def.id&&!d.heals); if(d) defs.push(d); }
    defs.forEach((d,i)=>{ const s=this.spawn({def:d,at:0,boss:false});
      s.x=Math.max(30,Math.min(this.worldW-30,e.x+offs[i][0])); s.y=Math.max(50,Math.min(this.worldH-30,e.y+offs[i][1]));
      if(s.spr.setPosition) s.spr.setPosition(s.x,s.y); this.spark(s.x,s.y,0xd9a441,4); }); }
  // Engaged = a living defender within the 90px road-block, or the camp
  // itself within striking distance — the same terms the march AI uses.
  bossEngaged(e){ const h=this.hero;
    if(h&&h.down<=0&&Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y)<=90) return true;
    for(const s of this.squads){ if(!s.dead&&Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y)<=90) return true; }
    return Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y)<=e.range+34; }
  // The slam falls where the prey stands when the champion commits: the
  // nearest defender within 150px, else the camp if the champion is on it.
  bossSlamTarget(e){ let best=null,bd=150; const h=this.hero;
    if(h&&h.down<=0){ const d=Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y); if(d<bd){ bd=d; best={x:h.x,y:h.y}; } }
    for(const s of this.squads){ if(s.dead) continue; const d=Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y); if(d<bd){ bd=d; best={x:s.x,y:s.y}; } }
    if(best) return best;
    if(Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y)<=e.range+74) return {x:this.campPos.x,y:this.campPos.y};
    return null; }
  // Telegraphs, redrawn from live state every tick: the wind-up ring closes
  // around the champion as the blow gathers; the slam's circle fills toward
  // full radius as impact nears. Nothing damages before its mark completes.
  bossDrawFx(e){ if(!this.bossFx) return; const g=this.bossFx; g.clear();
    if(e.heavyWind>0){ const hr=e.range+BOSS.heavyRangePad, p=1-Math.max(0,e.heavyWind)/BOSS.heavyWindup;
      g.fillStyle(0xff5a3a,0.08+0.12*p); g.fillCircle(e.x,e.y,hr);
      g.lineStyle(3,0xff5a3a,0.95); g.strokeCircle(e.x,e.y,hr*(0.6+0.4*p)); }
    if(e.slam){ const p=1-Math.max(0,e.slam.t)/BOSS.slamDelay;
      g.fillStyle(0xff8a3a,0.10+0.20*p); g.fillCircle(e.slam.x,e.slam.y,BOSS.slamRadius*Math.max(0.15,p));
      g.lineStyle(3,0xff8a3a,1); g.strokeCircle(e.slam.x,e.slam.y,BOSS.slamRadius); } }
  // The heavy blow itself: a cleave — every defender still inside the ring
  // takes heavyMul x a normal blow (the camp takes it through hitCamp, whose
  // own boss x3 keeps the camp blow at the same 3x-a-normal-blow weight).
  // Whoever stepped out takes nothing: the dodge is the skill.
  bossHeavyStrike(e){ const hr=e.range+BOSS.heavyRangePad, dmg=e.dmg*this.bossHeavyMul(e); let hit=false;
    const h=this.hero;
    if(h&&h.down<=0&&Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y)<=hr){ this.hurtHero(dmg,true); hit=true; }
    this.squads.slice().forEach(s=>{ if(!s.dead&&Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y)<=hr){ this.hurtSquad(s,dmg); hit=true; } });
    if(!hit&&Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y)<=e.range+34) this.hitCamp(dmg,e);
    SFX.stomp(); this.cameras.main.shake(160,0.006); this.spark(e.x,e.y,0xff8a6a,8); }
  // The slam lands: slamMul x damage to everyone still inside the marked
  // circle; the camp, if the circle covers it, takes one normal camp blow.
  bossSlamImpact(e,s){ const dmg=e.dmg*BOSS.slamMul, h=this.hero;
    if(h&&h.down<=0&&Phaser.Math.Distance.Between(s.x,s.y,h.x,h.y)<=BOSS.slamRadius) this.hurtHero(dmg,true);
    this.squads.slice().forEach(q=>{ if(!q.dead&&Phaser.Math.Distance.Between(s.x,s.y,q.x,q.y)<=BOSS.slamRadius) this.hurtSquad(q,dmg); });
    if(Phaser.Math.Distance.Between(s.x,s.y,this.campPos.x,this.campPos.y)<=BOSS.slamRadius) this.hitCamp(e.dmg,e);
    SFX.stomp(); this.cameras.main.shake(220,0.008);
    const c=this.add.circle(s.x,s.y,BOSS.slamRadius,0xff8a3a,0.3).setDepth(6); this.tweens.add({targets:c,alpha:0,scale:1.15,duration:320,onComplete:()=>c.destroy()}); }
  // --- combat core ---
  damage(e,amt,type,opt){ if(e.dead) return; opt=opt||{};
    let m=(DATA.armorTable[e.armorType]||{})[type]||1; if(opt.crit&&Math.random()<opt.crit){ m*=e.boss?2.5:2; this.floatText(e.x,e.y-20,'CRIT','#f2c14e'); }
    e.hp-=amt*m; SFX.enemyHit();
    if(e.boss&&e.hp>0) this.bossPhaseSync(e); // Upgrade 7: crossing a phase line changes the champion NOW, once
    if(opt.slow){ e.slow=Math.max(e.slow||0,opt.slow); e.slowT=Math.max(e.slowT||0,1.2); }
    if(opt.stun){ e.stun=Math.max(e.stun||0,opt.stun*(e.boss?0.3:1)); }
    if(opt.burn){ e.burn=Math.max(e.burn||0,opt.burn[0]); e.burnT=Math.max(e.burnT||0,opt.burn[1]); }
    if(e.spr.active){ e.spr.setTintFill(0xffffff); this.time.delayedCall(60,()=>{ if(!e.dead&&e.spr.active){ e.spr.clearTint(); applyTint(e.spr,e.def); } }); }
    if(e.hp<=0) this.kill(e); }
  kill(e){ e.dead=true; this.kills++; this.manna+=e.def.bounty||5; this.tr('kills'); if(e.def.sprite==='locust') this.tr('flyKills');
    if(e.boss){ this.tr('bossKills'); this.clearBoss(); this.toast(e.def.name+' has fallen!',2400); } this.gx(DATA_P().xp.kill); SFX.enemyDie(); this.spark(e.x,e.y,0xcdbd95,8);
    this.tweens.add({targets:e.spr,alpha:0,scale:0.3,duration:250,onComplete:()=>e.spr.destroy()}); e.bar.destroy(); this.refreshHUD(); }
  shoot(x,y,target,key,opt,speed){ const s=this.add.image(x,y,key).setDepth(13); this.shots.push({s,target,opt,speed:speed||560,lx:target.x,ly:target.y}); }
  spark(x,y,col,n){ for(let i=0;i<(n||4);i++){ const p=this.add.image(x,y,'spark').setTint(col).setDepth(16).setScale(0.8); this.tweens.add({targets:p,x:x+Phaser.Math.Between(-24,24),y:y+Phaser.Math.Between(-24,24),alpha:0,scale:0.2,duration:350,onComplete:()=>p.destroy()}); } }
  floatText(x,y,s,c){ const t=txt(this,x,y,s,14,c).setOrigin(0.5).setDepth(25); this.tweens.add({targets:t,y:y-26,alpha:0,duration:700,onComplete:()=>t.destroy()}); }
  nearestEnemy(x,y,r){ let best=null,bd=r; for(const e of this.enemies){ if(e.dead) continue; const d=Phaser.Math.Distance.Between(x,y,e.x,e.y); if(d<bd){ bd=d; best=e; } } return best; }
  useSkill(i){ const b=this.skillBtns[i]; if(this.over||b.cd>0||this.shopOpen) return; const k=b.def, h=this.hero, E=this.enemies.filter(e=>!e.dead);
    // Upgrade 8: the Held tier is read at the moment of the cast. Every
    // effect below flows through dmgS/shootS/buffS/ctrlS, which multiply it
    // by HELD.mul[tier]; at Ready the multiplier is 1 and the move is
    // byte-for-byte the pre-U8 move. A 'No target' return anywhere in the
    // switch consumes NOTHING — no cooldown, no charge, no tally.
    const tier=this.heldTierOf(b), mul=HELD.mul[tier];
    const dmgS=(e,amt,type,opt)=>{ opt=Object.assign({},opt||{});
      if(opt.stun) opt.stun*=mul; if(opt.slow) opt.slow*=mul;
      if(opt.burn) opt.burn=[opt.burn[0]*mul,opt.burn[1]];
      if(tier===2) opt.stun=Math.max(opt.stun||0,HELD.perfectStun); // Perfect flourish: the blow also stuns
      this.damage(e,amt*mul,type,opt); };
    const shootS=(x,y,t,key,opt,sp)=>{ opt=Object.assign({},opt||{}); opt.dmg=(opt.dmg||0)*mul;
      if(opt.stun) opt.stun*=mul; if(tier===2) opt.stun=Math.max(opt.stun||0,HELD.perfectStun);
      this.shoot(x,y,t,key,opt,sp); };
    const buffS=(rate,dmg)=>buffSquads(rate?rate*mul:0,dmg?dmg*mul:0);
    const ctrlS=v=>v*mul+(tier===2?HELD.perfectStun:0); // control durations scale; Perfect adds its stun rider
    const near=(r)=>E.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y)<r);
    const strongest=(n,list)=>(list||E).slice().sort((a,b2)=>b2.hp-a.hp).slice(0,n);
    const ring=(r,col)=>{ const c=this.add.circle(h.x,h.y,10,col,0.3).setDepth(15); this.tweens.add({targets:c,radius:r,alpha:0,duration:500,onComplete:()=>c.destroy()}); };
    const buffSquads=(rate,dmg)=>this.squads.forEach(s=>{ if(rate) s.buffRateT=rate; if(dmg) s.buffDmgT=dmg; });
    switch(k.id){
      case 'stone': { const t=strongest(1,near(h.def.range*2))[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:120,type:'physical',stun:1.5,crit:0.2},700); break; }
      case 'psalm': buffS(6,0); ring(240,0xd9a441); break;
      case 'five': { const ts=strongest(5); if(!ts.length) return this.toast('No target'); ts.forEach((t,j)=>this.time.delayedCall(j*120,()=>shootS(h.x,h.y,t,'stone',{dmg:250*(t.boss?3:1),type:'physical',stun:0.5},800))); SFX.ult(); this.cameras.main.flash(200,217,164,65); break; }
      case 'rally': buffS(0,8); ring(400,0xd9a441); break;
      case 'palm': near(170).forEach(e=>e.stun=Math.max(e.stun||0,ctrlS(2))); ring(170,0x8a6a9a); break;
      case 'song': E.forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=6*mul; dmgS(e,60,'holy'); }); this.cameras.main.flash(250,200,180,230); break;
      case 'lamp': near(180).forEach(e=>{ if(!e.boss) e.confuse=3*mul; }); ring(180,0xf2c14e); break;
      case 'three': for(let j=0;j<12;j++) this.time.delayedCall(j*70,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,40,'holy'); this.spark(t.x,t.y,0xf2c14e); } }); break;
      case 'sword': E.forEach(e=>dmgS(e,150,'holy')); this.cameras.main.flash(250,242,193,78); break;
      case 'jaw': near(90).forEach(e=>dmgS(e,90,'physical')); ring(90,0xe8e0c8); break;
      case 'roar': near(150).forEach(e=>{ e.stun=Math.max(e.stun||0,ctrlS(1.5)); }); ring(150,0xd8572a); this.cameras.main.shake(150,0.004); break;
      case 'geyser': near(150).forEach(e=>dmgS(e,80,'holy',{slow:0.4})); ring(150,0x6a9ad8); break;
      case 'manna': { const gain=Math.round(40*mul); this.manna+=gain; this.floatText(h.x,h.y-30,'+'+gain+' Manna',GOLD); this.refreshHUD(); break; }
      case 'sea': E.forEach(e=>{ if(!e.boss){ e.x=Math.min(this.worldW+10,e.x+260); e.stun=Math.max(e.stun||0,ctrlS(1)); } else dmgS(e,200,'holy'); }); this.cameras.main.flash(300,120,170,220); break;
      case 'altarflame': near(160).forEach(e=>dmgS(e,30,'fire',{burn:[22,4]})); ring(160,0xd8572a); break;
      case 'ravens': h.hp=Math.min(h.def.hp,h.hp+h.def.hp*0.5*mul); this.floatText(h.x,h.y-30,'+HP','#8fd06a'); break;
      case 'chariot': E.forEach(e=>dmgS(e,120,'fire',{burn:[20,4]})); this.cameras.main.flash(300,242,140,60); break;
      case 'banquet': this.banquet=1+0.5*mul; this.toast('Royal Banquet: +'+Math.round(50*mul)+'% Manna for the next wave clear'); break;
      case 'plea': E.forEach(e=>{ e.slow=Math.max(e.slow||0,0.4); e.slowT=6*mul; }); ring(400,0x8a6a9a); break;
      case 'time': this.squads.forEach(s=>{ s.cd=0; s.buffRateT=10*mul; s.buffDmgT=10*mul; }); this.cameras.main.flash(250,230,200,240); break;
      case 'pair': for(let j=0;j<6;j++) this.time.delayedCall(j*120,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,45,'physical'); this.spark(t.x,t.y,0xcdbd95,3); } }); break;
      case 'rain': near(220).forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=5*mul; }); ring(220,0xdfe6ee); break;
      case 'ark': { const mend=Math.round(50*mul); this.campHp=Math.min(this.campMax,this.campHp+mend); E.forEach(e=>dmgS(e,100,'holy')); this.floatText(this.campPos.x,this.campPos.y-70,'Camp +'+mend,'#8fd06a'); this.toast('The Ark: the camp is mended (+'+mend+')'); this.refreshHUD(); break; }
      case 'kite': { let src=h, hit=[]; for(let j=0;j<4;j++){ const c=E.filter(e=>!hit.includes(e)&&Phaser.Math.Distance.Between(e.x,e.y,src.x,src.y)<220).sort((a,b2)=>Phaser.Math.Distance.Between(a.x,a.y,src.x,src.y)-Phaser.Math.Distance.Between(b2.x,b2.y,src.x,src.y))[0]; if(!c) break; this.fx.lineStyle(3,0xf2e07a,1).lineBetween(src.x,src.y,c.x,c.y); dmgS(c,90,'sonic',{stun:0.5}); hit.push(c); src=c; } this.time.delayedCall(150,()=>this.fx.clear()); if(!hit.length) return this.toast('No target'); break; }
      case 'bifocal': buffS(0,8); ring(260,0xf2e07a); break;
      case 'almanac': for(let j=0;j<10;j++) this.time.delayedCall(j*110,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,120,'sonic',{stun:0.4}); this.spark(t.x,t.y,0xf2e07a,5); } }); this.cameras.main.flash(200,240,230,150); break;
      case 'crossing': { const t=strongest(1)[0]; if(!t) return this.toast('No target'); h.x=h.tx=t.x; h.y=h.ty=t.y; near(110).forEach(e=>dmgS(e,100,'physical')); ring(110,0x3a5a9a); break; }
      case 'cherry': { const t=strongest(1,near(160))[0]; if(!t) return this.toast('No target'); dmgS(t,220,'physical',{stun:1}); break; }
      case 'forge': h.hp=h.def.hp; buffS(10,0); this.cameras.main.flash(250,200,210,240); break;
      case 'log': near(140).forEach(e=>e.stun=Math.max(e.stun||0,ctrlS(2.5))); ring(140,0x8a5a2a); break;
      case 'speech': buffS(0,10); ring(400,0xd9a441); break;
      case 'union': this.shieldT=10*mul; this.toast('Union Shield: the camp takes no damage for '+Math.round(10*mul)+'s'); break;
      case 'trick': strongest(3,near(260)).forEach(t=>shootS(h.x,h.y,t,'stone',{dmg:100,type:'physical',crit:0.5},900)); break;
      case 'sharp': { const t=strongest(1,near(320))[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:180,type:'physical',crit:0.5},1100); break; }
      case 'show': for(let j=0;j<15;j++) this.time.delayedCall(j*80,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length) shootS(h.x,h.y,Phaser.Utils.Array.GetRandom(L),'stone',{dmg:60,type:'physical',crit:0.3},1000); }); break;
      case 'pillars': E.forEach(e=>{ dmgS(e,300,'physical'); e.stun=Math.max(e.stun||0,ctrlS(2)); }); this.cameras.main.shake(400,0.012); SFX.stomp(); break;
      default: { const t=strongest(1)[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:100,type:'physical'},700); break; }
    }
    this.floatText(h.x,h.y-56,k.name+'!','#f2c14e');
    if(tier>0) this.floatText(h.x,h.y-74,HELD.names[tier]+'!','#ffe98a');
    if(k.id!=='five') SFX.skill(); if(i===2){ this.tr('ults'); if(k.id!=='five') SFX.ult(); }
    // Upgrade 8: the cast spends the charge and is tallied at its tier.
    this.heldSpent[tier]++; b.held=0; b._tierShown=0; b.buffered=false; b.cd=k.cd; b.cdMax=k.cd;
    if(this.tutorial) this.tutEvent('power'); } // Upgrade 11: a real cast — reached only past every 'No target' return, so it always counts
  // --- between-wave shop ---
  // Upgrade 6: the intermission deadline is a wall-clock moment, set ONCE
  // here. It lives on the scene, not on any shop widget, so buying, paging
  // and the re-renders they cause never reset or pause it. shopT is the
  // remaining-seconds mirror update() maintains from that deadline.
  openShop(first){ if(this.campPanelOpen) this.closeCampPanel(); this.shopOpen=true; this.shopFirst=!!first; this.shopT=SHOP_COUNTDOWN; this.shopEndsAt=Date.now()+SHOP_COUNTDOWN*1000; this.shopPage=0;
    // squads and hero mend between waves
    this.squads.forEach(s=>{ s.hp=s.max; }); this.hero.hp=this.heroDef.hp;
    this.renderShop(first); }
  shopTimerLabel(){ const s=Math.max(0,Math.ceil(this.shopT)); return 'Next wave in '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
  shopAdd(o){ this.shopItems.push(o); return o; }
  clearShop(){ this.shopItems.forEach(o=>{ try{o.destroy();}catch(e){} }); this.shopItems=[]; }
  ownedSquad(defId){ return this.squads.find(s=>s.def.id===defId&&!s.dead); }
  // Upgrade 3: an upgrade with a "req" is locked until that upgrade is owned.
  // Branch picks store their chosen name under 'branch', which counts as owned.
  upgradeLocked(owned,u){ return !!(u.req&&!(owned.upgrades&&owned.upgrades[u.req])); }
  // Upgrade 4: the camp strip — a slim full-width bar under the shop header,
  // page 1 only, so it never consumes a unit slot. Left: the camp and its
  // current strength. Then the five one-time upgrades and repeatable Repair.
  renderCampStrip(){ const sy=92;
    const g=this.add.graphics().setDepth(51); g.fillStyle(0x2a1a10,0.97); g.fillRoundedRect(48,sy,W-96,42,8); g.lineStyle(2,0xd9a441); g.strokeRoundedRect(48,sy,W-96,42,8); this.shopAdd(g);
    this.shopAdd(txt(this,64,sy+7,'THE CAMP',15,GOLD).setDepth(52));
    this.shopAdd(txt(this,64,sy+24,'Camp '+Math.max(0,Math.ceil(this.campHp))+'/'+this.campMax+' HP',12,PARCH).setDepth(52));
    CAMP_UPGRADES.forEach((u,i)=>{ const cx=410+i*146, cy=sy+21;
      if(this.campUp[u.id]){ this.shopAdd(txt(this,cx,cy,u.name+' ✓',13,'#8fd06a').setOrigin(0.5).setDepth(52)); return; }
      const locked=this.campUpLocked(u);
      const b=button(this,cx,cy,142,34,(locked?'🔒 ':'')+u.name+' '+u.cost,()=>this.buyCampUpgrade(u),{size:13,disabled:locked||this.manna<u.cost}); b.setDepth(52); this.shopAdd(b); });
    const full=this.campHp>=this.campMax;
    const rb=button(this,1140,sy+21,142,34,'Repair +'+CAMP_REPAIR.heal+' · '+CAMP_REPAIR.cost,()=>this.buyCampRepair(),{size:13,disabled:full||this.manna<CAMP_REPAIR.cost}); rb.setDepth(52); this.shopAdd(rb); }
  renderShop(first){ this.clearShop();
    const units=this.roster.player, pages=Math.ceil(units.length/6), pageUnits=units.slice(this.shopPage*6,this.shopPage*6+6);
    // Panel starts at y=38, below the HUD stat line, so the header is never clipped behind the shop.
    const bg=this.add.graphics().setDepth(50); bg.fillStyle(0x140c07,0.92); bg.fillRect(24,38,W-48,H-62); bg.lineStyle(3,0xd9a441); bg.strokeRect(24,38,W-48,H-62); this.shopAdd(bg);
    const head=first?'Prepare your squads':('Wave '+this.wavesCleared+' survived!  +'+(this.lastBonus||0)+' manna');
    this.shopAdd(txt(this,W/2,50,head,26,GOLD).setOrigin(0.5).setDepth(51));
    this.shopHead2=this.shopAdd(txt(this,W/2,76,'',19,PARCH).setOrigin(0.5).setDepth(51)); this.updateShopHead();
    // Upgrade 4: the camp strip lives on page 1 only, and pushes that page's
    // unit grid down by 24px; pages 2+ keep the original geometry untouched.
    const gridY=this.shopPage===0?136:112;
    if(this.shopPage===0) this.renderCampStrip();
    if(this.shopFirst) this.shopAdd(txt(this,W/2,635,'If the camp falls, the run falls — and the fallen hero only returns while it stands.',13,'#cdbd95').setOrigin(0.5).setDepth(51));
    pageUnits.forEach((def,i)=>{ const col=i%3,row=Math.floor(i/3),x=70+col*400,y=gridY+row*252,cx=x+190;
      const g=this.add.graphics().setDepth(51); g.fillStyle(0x2a1a10,0.97); g.fillRoundedRect(x,y,380,238,10); g.lineStyle(2,0xd9a441); g.strokeRoundedRect(x,y,380,238,10); this.shopAdd(g);
      const im=uspr(this,x+42,y+44,def,58).setDepth(52); applyTint(im,def); this.shopAdd(im);
      const owned=this.ownedSquad(def.id);
      this.shopAdd(txt(this,x+78,y+14,def.name,19,GOLD,{wordWrap:{width:290}}).setDepth(52));
      const st=owned?{hp:owned.max,dmg:owned.dmg}:{hp:def.hp,dmg:def.dmg};
      this.shopAdd(txt(this,x+78,y+44,def.role+'  ·  hp '+st.hp+'  ·  dmg '+st.dmg+(owned?'  ·  in squad ✓':''),15,PARCH).setDepth(52));
      if(!owned){ const canBuy=this.manna>=def.cost&&this.squads.length<this.squadCap;
        const b=button(this,x+100,y+118,170,48,'Buy '+def.cost,()=>{ if(this.manna>=def.cost&&this.squads.length<this.squadCap){ this.manna-=def.cost; this.addSquad(def); SFX.build(); this.renderShop(false); this.refreshHUD(); } },{size:17,disabled:!canBuy}); b.setDepth(52); this.shopAdd(b);
        if(this.squads.length>=this.squadCap) this.shopAdd(txt(this,x+250,y+118,'Squad full ('+this.squadCap+')',14,'#a08a6a').setDepth(52));
      } else {
        // Upgrade 3: upgrades stack in rows so chained tiers (Drill t1 -> t2,
        // Bulwark -> Bulwark t2, branch -> Veteran) each get their own line,
        // and a "req" upgrade renders locked until its prerequisite is owned.
        let rowY=y+96;
        (def.upgrades||[]).forEach((u)=>{ const uy=rowY;
          if(u.id==='maxtier'){ this.shopAdd(txt(this,x+20,uy+18,'Max tier',16,'#8fd06a').setDepth(52)); rowY+=48; return; }
          if(owned.upgrades[u.id]){ this.shopAdd(txt(this,x+20,uy+18,u.id==='branch'?('Branch: '+owned.upgrades[u.id]):(u.name+' ✓'),16,'#8fd06a').setDepth(52)); rowY+=48; return; }
          if(u.id==='branch'){ this.shopAdd(txt(this,x+20,uy+2,'Pick one',13,'#cdbd95').setDepth(52));
            u.options.forEach((op,oi)=>{ const b=button(this,x+92+oi*130,uy+26,124,42,op.name+' '+u.cost,()=>{ if(this.manna>=u.cost){ this.manna-=u.cost; owned.upgrades.branch=op.name; owned.max+=op.hpAdd||0; owned.hp=owned.max; owned.dmg+=op.dmgAdd||0; owned.speed+=op.speedAdd||0; this.tr('branches'); SFX.build(); this.renderShop(false); this.refreshHUD(); } },{size:14,disabled:this.manna<u.cost}); b.setDepth(52); this.shopAdd(b); });
            rowY+=54; return; }
          const locked=this.upgradeLocked(owned,u);
          const reqName=u.req?((((def.upgrades||[]).find(z=>z.id===u.req)||{}).name)||(u.req==='branch'?'a branch pick':u.req)):null;
          const b=button(this,x+100,uy+22,190,42,u.name+' '+u.cost,()=>{ if(this.manna>=u.cost&&!this.upgradeLocked(owned,u)){ this.manna-=u.cost; owned.upgrades[u.id]=true; owned.max+=u.hpAdd||0; owned.hp=owned.max; owned.dmg+=u.dmgAdd||0; owned.armor+=u.armorAdd||0; if(u.rateMul) owned.rate*=u.rateMul; if(u.id.startsWith('drill')) this.tr('branches'); SFX.build(); this.renderShop(false); this.refreshHUD(); } },{size:14,disabled:locked||this.manna<u.cost}); b.setDepth(52); this.shopAdd(b);
          if(locked) this.shopAdd(txt(this,x+212,uy+22,'🔒 Needs '+reqName,13,'#a08a6a').setDepth(52));
          rowY+=48;
        });
        if(!(def.upgrades||[]).length) this.shopAdd(txt(this,x+20,y+114,'Max tier',16,'#8fd06a').setDepth(52));
      }
    });
    const quit=button(this,120,668,180,48,'Quit run',()=>this.end(false),{size:17}); quit.setDepth(52); this.shopAdd(quit);
    if(pages>1){ const pv=button(this,420,668,60,48,'◀',()=>{ this.shopPage=(this.shopPage+pages-1)%pages; this.renderShop(false); },{size:18}); pv.setDepth(52); this.shopAdd(pv);
      this.shopAdd(txt(this,490,668,(this.shopPage+1)+'/'+pages,18,PARCH).setOrigin(0.5).setDepth(52));
      const nx=button(this,560,668,60,48,'▶',()=>{ this.shopPage=(this.shopPage+1)%pages; this.renderShop(false); },{size:18}); nx.setDepth(52); this.shopAdd(nx); }
    const go=button(this,820,668,300,54,'Next Wave Now ▶',()=>this.closeShop(),{size:22}); go.setDepth(52); this.shopAdd(go);
    this.shopTimerTxt=this.shopAdd(txt(this,1090,668,this.shopTimerLabel(),18,GOLD).setOrigin(0.5).setDepth(52));
    this.fixUI();
  }
  updateShopHead(){ if(this.shopHead2) this.shopHead2.setText('Manna '+Math.floor(this.manna)+'  •  Squads '+this.squads.length+'/'+this.squadCap+'  •  Next: wave '+(this.wave+1)+' ('+((this.wave+1)%2===0?'night':'day')+')  •  Goal: wave '+this.goalWave+(this.endless?' (cleared — Endless)':'')); }
  closeShop(){ this.shopOpen=false; this.shopFirst=false; this.shopEndsAt=0; this.clearShop(); this.startWave(); }
  waveClear(){ this.waveActive=false; this.wavesCleared=this.wave;
    let bonus=60+this.wave*8; if(this.banquet){ bonus=Math.round(bonus*this.banquet); this.banquet=0; } // banquet stores its multiplier (1.5 at Ready; a Held cast strengthens it, Upgrade 8)
    const perfect=!this.campHurtThisWave; this.manna+=bonus; this.lastBonus=bonus;
    this.tr('waves'); this.gx(DATA_P().xp.wave); if(perfect){ this.tr('perfectWaves'); this.gx(DATA_P().xp.perfectWave); }
    this.earn('wave',DATA.grokonians.perWave+(perfect?DATA.grokonians.perfectWaveBonus:0));
    SFX.win();
    if(this.wave>=this.goalWave&&!this.endless){ this.cleared=true; this.showVictory(); }
    else { this.toast('Wave '+this.wave+' cleared  +'+bonus+' Manna'+(perfect?'  (perfect)':'')); this.flush(); this.openShop(false); }
    this.refreshHUD(); }
  showVictory(){ this.victoryOpen=true; const s=[];
    const campFrac=Math.max(0,this.campHp/this.campMax);
    const stars=campFrac>=0.85?3:(campFrac>=0.45?2:1);
    const bg=this.add.graphics().setDepth(55); bg.fillStyle(0x140c07,0.94); bg.fillRect(340,180,600,330); bg.lineStyle(3,0xd9a441); bg.strokeRect(340,180,600,330); s.push(bg);
    s.push(txt(this,W/2,225,this.era.name+': Held!',38,GOLD).setOrigin(0.5).setDepth(56));
    s.push(txt(this,W/2,275,'★'.repeat(stars)+'☆'.repeat(3-stars),36,GOLD).setOrigin(0.5).setDepth(56));
    s.push(txt(this,W/2,325,'Goal wave '+this.goalWave+' survived. Endless waves go on from here —\nhow deep can your squads march?',18,PARCH,{align:'center'}).setOrigin(0.5).setDepth(56));
    const c=button(this,W/2-160,440,290,56,'Continue Endless',()=>{ s.forEach(o=>{try{o.destroy();}catch(e){}}); this.victoryOpen=false; this.endless=true; this.flush(); this.openShop(false); },{size:19}); c.setDepth(56); s.push(c);
    const f=button(this,W/2+160,440,290,56,'Finish run',()=>{ s.forEach(o=>{try{o.destroy();}catch(e){}}); this.victoryOpen=false; this.end(true); },{size:19}); f.setDepth(56); s.push(f); this.fixUI(); }
  // --- main loop ---
  update(time,delta){ if(this.over) return;
    if(this.shopOpen){ // Upgrade 6: every shop counts the same honest minute
      // down from the wall-clock deadline set in openShop. Phaser stops
      // calling update() while the tab is hidden, so a returning player
      // simply finds the minute elapsed and the wave beginning — the timer
      // never grants hidden bonus time and never freezes mid-shop. At zero,
      // closeShop() flips shopOpen off before startWave(), so the wave can
      // only ever start once.
      this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000);
      if(this.shopTimerTxt) this.shopTimerTxt.setText(this.shopTimerLabel());
      if(this.shopT<=0) this.closeShop();
      return; }
    if(this.victoryOpen) return;
    // Upgrade 12: the pause (and the layout editing inside it) holds the
    // whole battle — no timer, no timer's cousin, runs behind it.
    if(this.paused||this.layoutEdit) return;
    const dt=Math.min(0.05,delta/1000)*this.speed; if(this.shieldT>0) this.shieldT-=delta/1000*this.speed;
    this._pulse=(this._pulse||0)+dt; // Upgrade 8: drives the Perfect glow pulse in drawSkillSweep
    if(this.tutorial) this.tutTick(); // Upgrade 11: the highlight ring breathes here
    if(this.volleyCd>0){ this.volleyCd-=dt;
      if(this.volleyCd<=0){ this.volleyCd=0; this.refreshHUD();
        // Upgrade 8: a Volley press buffered in its last breath fires now.
        if(this._volleyBuf){ this._volleyBuf=false; this.volleyMode=true; this.toast('Volley: tap a target spot'); } } }
    { const vb=this.cmdBtns&&this.cmdBtns.volley; // Volley's cooldown sweep
      if(vb&&vb.sweep){ vb.sweep.clear(); if(this.volleyCd>0){ const f=Math.min(1,this.volleyCd/12); vb.sweep.fillStyle(0x000000,0.55); vb.sweep.fillRect(vb.sx-vb.sw/2,vb.sy-vb.sh/2,vb.sw,vb.sh*f); } } }
    this.orbTick(dt);
    this.fightTick(dt); // Upgrade 8: recovery, buffers, wind-ups, stamina
    // spawns
    if(this.waveActive){ this.waveClock+=dt; while(this.spawnQ.length&&this.spawnQ[0].at<=this.waveClock) this.spawn(this.spawnQ.shift()); }
    // field coins (Upgrade 3): one every ~6s of an active wave, max 8 out
    if(this.waveActive){ this.coinT-=dt; if(this.coinT<=0){ this.coinT=6; if(this.coins.length<8) this.spawnCoin(); } }
    this.collectCoins();
    const night=this.wave%2===0;
    // hero movement + combat
    const h=this.hero, hd=h.def;
    // Upgrade 12: FOLLOW arms itself when a press is simply HELD (the
    // slither way) — a quick tap stays a tap (onPointerUp resolves it).
    if(this.moveScheme==='follow'&&this.pendTap&&performance.now()-this.pendTap.t>280){ const pd=this.pendTap; this.pendTap=null;
      this.followOn=true; this.followPt={id:pd.id,wx:(pd.worldX!==undefined?pd.worldX:pd.x),wy:(pd.worldY!==undefined?pd.worldY:pd.y)}; }
    // Upgrade 12: STICK / FOLLOW steering — while a scheme is steering,
    // it owns the hero's march target; the one movement block below
    // still applies his speed, the orb multiplier, sprint and the
    // guard's drag, exactly as for a tapped target. TAP never enters.
    if(h.down<=0&&h.dodgeT<=0){
      if(this.stick){ const m=Math.hypot(this.stick.dx,this.stick.dy);
        if(m>10){ h.tx=h.x+this.stick.dx/m*130; h.ty=h.y+this.stick.dy/m*130; } else { h.tx=h.x; h.ty=h.y; } }
      else if(this.followOn&&this.followPt){ h.tx=this.followPt.wx; h.ty=this.followPt.wy; } }
    if(h.down>0){ this.tickHeroDown(dt); }
    else if(h.dodgeT>0){ // Upgrade 8: the dodge dash owns the body until it ends
      const dst=FIGHT.dodgeDist/FIGHT.dodgeTime*dt; h.x+=h.dodgeDx*dst; h.y+=h.dodgeDy*dst; h.dodgeT-=dt;
      h.x=Math.max(20,Math.min(this.worldW-20,h.x)); h.y=Math.max(40,Math.min(this.worldH-20,h.y));
      h.spr.setFlipX(h.dodgeDx<0); }
    else { const dx=h.tx-h.x, dy=h.ty-h.y, dl=Math.hypot(dx,dy);
      if(dl>3){ h.faceX=dx/dl; h.faceY=dy/dl;
        const spd=hd.speed*this.orbSpdMul()*(h.sprint?FIGHT.sprintMul:1)*(h.blocking?0.45:1);
        const st=Math.min(dl,spd*dt); h.x+=dx/dl*st; h.y+=dy/dl*st; h.spr.setFlipX(dx<0);
        if(this.tutorial) this.tutEvent('moved'); } // Upgrade 11: the march itself is the move step's proof
      h.hp=Math.min(hd.hp,h.hp+hd.hp*0.01*dt); }
    // Upgrade 10: AUTO-FIRE — the hero's basic attack clock runs here,
    // and heroAutoFire() strikes when the toggle is ON (kennin's reversal
    // of Upgrade 8's manual scheme; OFF means no basic attacks at all).
    if(h.cd>0) h.cd-=dt;
    this.heroAutoFire();
    h.spr.setOrigin(0.5,0.9).setPosition(h.x,h.y+18).setDepth(8+h.y/1000); h.ring.setPosition(h.x,h.y);
    h.hpBar.clear(); h.hpBar.fillStyle(0x000000,0.7); h.hpBar.fillRect(h.x-22,h.y-48,44,5); h.hpBar.fillStyle(0x5aa33b,1); h.hpBar.fillRect(h.x-22,h.y-48,44*Math.max(0,h.hp)/hd.hp,5);
    // Upgrade 8: a raised guard shows as an arc on the hero's facing side.
    if(h.guardFx){ const g=h.guardFx; g.clear();
      if(h.blocking&&h.down<=0&&g.arc){ const a=Math.atan2(h.faceY,h.faceX); g.lineStyle(4,0x9ae8f2,0.9); g.beginPath(); g.arc(h.x,h.y,30,a-1.1,a+1.1,false); g.strokePath(); } }
    this.drawCampBar();
    this.drawMoveFx(); // Upgrade 12: the stick and the follow arrow, drawn from live state
    this.campFireTick(dt);
    // Upgrade 9: the selection ring — a breathing gold circle under whoever
    // the marching hand currently directs: the selected squad, or the hero
    // when the hero is selected (the default).
    if(this.selFx){ const sg=this.selFx; sg.clear();
      const st=this.selSquad&&!this.selSquad.dead?this.selSquad:(h.down<=0?h:null);
      if(st){ const sr=(this.selSquad?27:31)*(1+0.07*Math.sin((this._pulse||0)*5)); sg.lineStyle(2,0xf2c14e,0.95); sg.strokeCircle(st.x,st.y+8,sr); } }
    this.drawRallyBanners(); // Upgrade 10: a banner flies only while someone holds it
    // squads
    this.squads=this.squads.filter(s=>!s.dead);
    if(this.selSquad&&this.selSquad.dead) this.selSquad=null;
    this.squads.forEach((s,idx)=>{ if(s.buffRateT>0) s.buffRateT-=dt; if(s.buffDmgT>0) s.buffDmgT-=dt;
      const rangeMul=(night&&s.def.role==='ranged')?1.1:1, range=s.range*rangeMul;
      const foe=this.nearestEnemy(s.x,s.y,range);
      // Upgrade 9: each squad marches by its EFFECTIVE order — its own
      // directed order, or the army's when it carries none. Posted is the
      // default: hold the ground you stand on and fight what comes.
      const eo=this.squadOrder(s), tgt=this.squadTarget(s,idx,h);
      let tx=tgt.x, ty=tgt.y;
      // Upgrade 9: a posted squad GUARDS its post. An enemy that comes
      // within guard reach (its range + 50) is met and fought at contact —
      // a post is ground held, not a statue: without this, a melee squad
      // posted on the road could be struck by an enemy standing at its own
      // reach (44px) beyond the squad's shorter arm (38px), and camp
      // defense would be a fiction. When the intruder falls or leaves, the
      // squad returns to its post. Support squads (the healer) hold their
      // post and work from it.
      if((eo==='post'||eo==='rally')&&s.def.role!=='support'){ const gf=this.nearestEnemy(s.x,s.y,range+50); if(gf){ tx=gf.x; ty=gf.y; } } // Upgrade 10: a rallied squad guards its banner the way a posted squad guards its post
      const dx=tx-s.x, dy=ty-s.y, dl=Math.hypot(dx,dy), spd=s.speed*(eo==='shieldwall'?0.6:1)*this.orbSpdMul();
      if(!foe&&dl>8){ const st=Math.min(dl,spd*dt); s.x+=dx/dl*st; s.y+=dy/dl*st; s.spr.setFlipX(dx<0); }
      else if(foe&&dl>range*0.9&&eo!=='hold'){ const st=Math.min(dl,spd*dt); s.x+=dx/dl*st; s.y+=dy/dl*st; }
      s.spr.setOrigin(0.5,0.9).setPosition(s.x,s.y+16).setDepth(7+s.y/1000);
      s.cd-=dt*(s.buffRateT>0?1.4:1);
      if(foe&&s.cd<=0){ s.cd=s.rate; const dmg=s.dmg*(s.buffDmgT>0?1.3:1);
        if(s.def.role==='ranged'||s.def.role==='support') this.shoot(s.x,s.y-20,foe,'stone',{dmg,type:'physical',crit:0.08},620);
        else { this.damage(foe,dmg,'physical',{crit:0.08}); this.spark(foe.x,foe.y,0xe8e0c8,2); } }
      // Levite Healer (Upgrade 3): mends the most-wounded squad within 120px at 6 HP/s.
      if(s.def.healsSquads){ let tgt=null,bf=1; for(const o of this.squads){ if(o!==s&&!o.dead&&o.hp<o.max&&Math.hypot(o.x-s.x,o.y-s.y)<120){ const f=o.hp/o.max; if(f<bf){ bf=f; tgt=o; } } }
        if(tgt){ tgt.hp=Math.min(tgt.max,tgt.hp+6*dt); s.healFxT=(s.healFxT||0)-dt; if(s.healFxT<=0){ s.healFxT=0.5; this.spark(tgt.x,tgt.y-12,0x8fd06a,1); } } }
      s.bar.clear(); if(s.hp<s.max){ s.bar.fillStyle(0x000000,0.7); s.bar.fillRect(s.x-16,s.y-34,32,4); s.bar.fillStyle(0x5aa33b,1); s.bar.fillRect(s.x-16,s.y-34,32*Math.max(0,s.hp)/s.max,4); }
    });
    // enemies
    for(const e of this.enemies){ if(e.dead) continue;
      if(e.burnT>0){ e.burnT-=dt; e.hp-=e.burn*dt; if(e.hp<=0){ this.kill(e); continue; } }
      if(e.def.heals){ e.healCd=(e.healCd||1.5)-dt; if(e.healCd<=0){ e.healCd=2.5;
        for(const o of this.enemies){ if(o!==e&&!o.dead&&o.hp<o.max&&Phaser.Math.Distance.Between(e.x,e.y,o.x,o.y)<110){ o.hp=Math.min(o.max,o.hp+15); this.spark(o.x,o.y-10,0x8fd06a,1); } } } }
      if(e.slowT>0) e.slowT-=dt; else e.slow=0;
      if(e.stun>0){ e.stun-=dt; }
      else if(e.confuse>0){ e.confuse-=dt; e.x+=e.speed*0.6*dt; }
      else if(e.boss&&e.heavyWind>0){ /* Upgrade 7: winding up a heavy blow — the champion stands committed while the ring closes; step out or take it. */ }
      else if(e.tutDummy){ // Upgrade 11: a practice dummy walks to the hero
        // and waits at the edge of his range circle. It never strikes (its
        // dmg is 0), never marches on the camp, and belongs to no wave.
        if(h.down<=0){ const dx=h.x-e.x, dy=h.y-e.y, dl=Math.hypot(dx,dy)||1;
          if(dl>TUT_DUMMY.stop){ e.x+=dx/dl*e.speed*dt; e.y+=dy/dl*e.speed*dt; e.spr.setFlipX(dx<0); } } }
      else { // Upgrade 3: the camp is the prize. A defender within 90px blocks
        // the road and the enemy stops to fight it; otherwise it marches on
        // the camp and, on arrival, stays and attacks it. It never vanishes,
        // and the run ends only when the camp itself falls.
        let def=null,bd=90;
        if(h.down<=0){ const d=Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y); if(d<bd){ bd=d; def={x:h.x,y:h.y,kind:'hero'}; } }
        for(const s of this.squads){ if(s.dead) continue; const d=Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y); if(d<bd){ bd=d; def={x:s.x,y:s.y,kind:'squad',s}; } }
        const dc=Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y);
        if(def){ const dx=def.x-e.x, dy=def.y-e.y, dl=Math.hypot(dx,dy)||1;
          if(bd>e.range+6){ const sp=e.speed*(1-(e.slow||0))*(e.boss?this.bossMoveMul(e):1); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0); }
          else { e.cd-=dt; if(e.cd<=0){ e.cd=e.boss?this.bossAtkRate(e):e.rate;
            if(def.kind==='hero') this.hurtHero(e.dmg); else this.hurtSquad(def.s,e.dmg);
            SFX.enemyAttack(); this.spark(def.x,def.y,0xc0392b,2); } }
        } else if(dc>e.range+34){ const dx=this.campPos.x-e.x, dy=this.campPos.y-e.y, dl=Math.hypot(dx,dy)||1;
          const sp=e.speed*(1-(e.slow||0))*(e.boss?this.bossMoveMul(e):1); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0);
        } else { e.cd-=dt; if(e.cd<=0){ e.cd=e.boss?this.bossAtkRate(e):e.rate; this.hitCamp(e.dmg,e); this.spark(this.campPos.x+30,this.campPos.y-10,0xc0392b,2); } }
      }
      const p={x:e.x,y:e.y}; e.spr.setOrigin(0.5,0.9).setPosition(p.x,p.y+(e.def.size||18)).setDepth((e.boss?9:7)+p.y/1000);
      e.bar.clear(); if(e.hp<e.max){ e.bar.fillStyle(0x000000,0.7); e.bar.fillRect(e.x-16,e.y-36,32,4); e.bar.fillStyle(0xa33b20,1); e.bar.fillRect(e.x-16,e.y-36,32*Math.max(0,e.hp)/e.max,4); }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.bossTick(dt);
    // shots
    for(const s of this.shots){ const tg=s.target; if(tg&&!tg.dead&&tg.x!==undefined){ s.lx=tg.x; s.ly=tg.y; }
      const a=Phaser.Math.Angle.Between(s.s.x,s.s.y,s.lx,s.ly), step=s.speed*dt;
      if(Phaser.Math.Distance.Between(s.s.x,s.s.y,s.lx,s.ly)<=step+4){ s.done=true; s.s.destroy(); SFX.hit();
        if(s.opt.splash){ const at=s.opt.splashAt||{x:s.lx,y:s.ly}; this.enemies.forEach(e=>{ if(!e.dead&&Phaser.Math.Distance.Between(e.x,e.y,at.x,at.y)<s.opt.splash) this.damage(e,s.opt.dmg,s.opt.type,s.opt); });
          const c=this.add.circle(at.x,at.y,s.opt.splash,0xd9a441,0.22).setDepth(4); this.tweens.add({targets:c,alpha:0,duration:350,onComplete:()=>c.destroy()}); }
        else if(tg&&!tg.dead) this.damage(tg,s.opt.dmg,s.opt.type,s.opt); }
      else { s.s.x+=Math.cos(a)*step; s.s.y+=Math.sin(a)*step; s.s.rotation+=0.3; } }
    this.shots=this.shots.filter(s=>!s.done);
    // Upgrade 8: skill buttons live here — cooldown drains, a buffered press
    // fires the moment its move is ready, and a ready move accrues Held
    // charge (battle time only: this loop never runs while the shop is
    // open, so patience cannot be farmed in the intermission). Crossing a
    // tier floats the tier name over the hero; the button's face — label,
    // colour and sweep — is redrawn from the same state.
    this.skillBtns.forEach((b,bi)=>{ const wasCd=b.cd>0; if(b.cd>0){ b.cd-=dt;
        if(b.cd<=0){ b.cd=0; if(b.buffered){ b.buffered=false; this.useSkill(bi); } } }
      if(b.cd>0){ b.label.setText(b.def.name+'\n'+Math.ceil(b.cd)+'s'); b.alpha=0.5; }
      else { b.held=(b.held||0)+dt; const t=this.heldTierOf(b);
        if(t>(b._tierShown||0)){ b._tierShown=t; this.floatText(h.x,h.y-72,b.def.name+' — '+HELD.names[t]+'!','#ffe98a'); }
        b.label.setText(b.def.name+(t>0?'\n'+HELD.names[t]:'')); if(b.label.setColor) b.label.setColor(t===2?'#ffe98a':(t===1?'#f2c14e':'#e8d9b0')); b.alpha=1; }
      // Upgrade 10: the power-ready whisper — the crossing tick only,
      // and only for the two great powers (second skill and ult).
      if(wasCd&&b.cd<=0&&bi>=1) this.powerReady(b);
      if(b.readyPulse>0) b.readyPulse=Math.max(0,b.readyPulse-dt*1.6);
      this.drawSkillSweep(b); });
    // wave end
    if(this.waveActive&&!this.spawnQ.length&&!this.enemies.length) this.waveClear();
    this.refreshHUD();
  }
  end(win){ if(this.over) return; this.over=true; this.clearShop(); this.shopOpen=false; this.closeCampPanel();
    const XP=DATA_P().xp;
    if(win){ this.tr('clears'); this.gx(XP.clear); this.earn('clear',DATA.grokonians.clear);
      if(!this.campHurtTotal){ this.earn('perfectClear',DATA.grokonians.perfectClear); this.tr('perfectClears'); this.gx(XP.perfectClear); }
      if(this.eraId==='bible'){ const first=!Tokens.milestone('clearCh1'); Tokens.setMilestone('clearCh1'); this.newUnlock=first; }
      SFX.win(); } else SFX.lose();
    // Upgrade 3: stars and score now read from the camp the player kept standing.
    // Upgrade 4: the fraction divides by the CURRENT max, so Fortify tiers
    // neither gift nor steal stars — keeping 85% of a bigger camp is the same feat.
    const campFrac=Math.max(0,this.campHp/this.campMax);
    const stars=win?(campFrac>=0.85?3:(campFrac>=0.45?2:1)):0;
    if(win) cqRecordStars(this.eraId,stars);
    this.flush(); const ev=Progress.takeEvents();
    const rec={score:this.kills*10+Math.round(campFrac*20)*50+this.wavesCleared*100+stars*500};
    if(window.GXHub&&GXHub.submitScore) GXHub.submitScore(rec.score,this.wavesCleared); // GX Hub leaderboard (no-op standalone)
    this.time.delayedCall(800,()=>this.scene.start('End',{win,earned:this.earned,newUnlock:this.newUnlock,perfect:!this.campHurtTotal,xp:this.runXp,hero:this.heroDef.id,ev,stars,rec,waves:this.wavesCleared,era:this.eraId,eraName:this.era.name,endless:this.endless,held:this.heldSpent?this.heldSpent.slice():[0,0,0]})); } }

class End extends Phaser.Scene{ constructor(){super('End');}
  create(d){ backdrop(this,0.7);
    txt(this,W/2,150,d.win?(d.eraName||'Era')+': Held':'The Camp has Fallen',52,d.win?GOLD:'#c0392b').setOrigin(0.5);
    if(d.win) txt(this,W/2,212,'★'.repeat(d.stars)+'☆'.repeat(3-d.stars),40,GOLD).setOrigin(0.5);
    txt(this,W/2,262,d.win?'"The battle is the LORD\'s." 1 Samuel 17:47':'"Be strong and of a good courage." Joshua 1:9',22).setOrigin(0.5);
    txt(this,W/2,305,'Score '+(d.rec?d.rec.score:0)+(d.endless?'  •  Endless run — waves survived: '+d.waves:''),22,'#f2c14e').setOrigin(0.5);
    txt(this,W/2,340,'Grokonians earned this run: '+d.earned+(d.perfect&&d.win?'  (perfect clear!)':''),28,GOLD).setOrigin(0.5);
    // Upgrade 8: the mastery readout — how the run's power moves were spent,
    // so patience is a skill the player can see and chase run over run.
    if(d.held&&(d.held[0]+d.held[1]+d.held[2])>0){ const hp=[]; if(d.held[2]) hp.push(d.held[2]+' Perfect'); if(d.held[1]) hp.push(d.held[1]+' Tempered'); if(d.held[0]) hp.push(d.held[0]+' Ready'); txt(this,W/2,366,'Held Power: '+hp.join(', '),18,'#ffe98a').setOrigin(0.5); }
    txt(this,W/2,385,'Total Grokonians: '+Tokens.balance(),22).setOrigin(0.5);
    const L=Progress.level(), M=Progress.mastery(d.hero);
    txt(this,W/2,425,'+'+d.xp+' XP   •   Level '+L.lv+' ('+L.into+'/'+L.need+')   •   Mastery '+M.lv+'   •   Battle Pass tier '+Progress.bpTier(),20).setOrigin(0.5);
    const notes=(d.newUnlock?['New hero unlocked: Gideon!']:[]).concat(d.ev||[]).slice(0,4); notes.forEach((n,i)=>txt(this,W/2,460+i*26,n,19,'#f2c14e').setOrigin(0.5));
    button(this,W/2-280,600,250,58,'Play again',()=>this.scene.start('HeroSelect',{level:{era:d.era||'bible'}}),{size:22});
    button(this,W/2,600,250,58,'Battle Pass',()=>this.scene.start('BattlePass'),{size:22});
    button(this,W/2+280,600,250,58,'Era select',()=>this.scene.start('EraSelect'),{size:22}); } }

// ---------- Battle Pass ----------
class BattlePass extends Phaser.Scene{ constructor(){super('BattlePass');}
  create(){ backdrop(this,0.75); const P=Progress.data, S=P.season, T=Progress.bpTier(), st=Progress.state;
    txt(this,W/2,34,S.name,34,GOLD).setOrigin(0.5);
    txt(this,W/2,72,'FREE track  •  Tier '+T+'/'+S.free.length+'  •  '+Progress.bpDaysLeft()+' days left  •  '+(st.bpXp%S.xpPerTier)+'/'+S.xpPerTier+' XP to next tier',18).setOrigin(0.5);
    txt(this,W/2,98,'Earn XP from waves, bosses and daily/weekly challenges. Premium track: not available (no paid content).',15,'#a08a6a').setOrigin(0.5);
    const icon=r=>r.type==='grok'?r.value+' G':r.type==='hero'?((DATA.heroes.find(h=>h.id===r.value)||{}).name||r.value):r.type==='skin'?'Skin: '+((DATA.unlocks.skins.find(k=>k.id===r.value)||{}).name||r.value):'Title: '+Progress.titleName(r.value);
    S.free.forEach((r,i)=>{ const col=i%10,row=Math.floor(i/10),x=72+col*126,y=180+row*150, got=Progress.bpClaimed(r.tier), can=!got&&T>=r.tier;
      const g=this.add.graphics(); g.fillStyle(got?0x2a3a1a:can?0x5a3a1e:0x1a120c,0.95); g.fillRoundedRect(x-58,y-60,116,128,8); g.lineStyle(2,can?0xf2c14e:got?0x8fd06a:0x5a4a3a); g.strokeRoundedRect(x-58,y-60,116,128,8);
      txt(this,x,y-46,'Tier '+r.tier,15,GOLD).setOrigin(0.5);
      if(r.type==='hero'){ const im=spr(this,x,y-6,r.value,54); if(T<r.tier) im.setTint(0x333333); } else txt(this,x,y-6,r.type==='grok'?'◎':r.type==='skin'?'▲':'✦',30,GOLD).setOrigin(0.5);
      txt(this,x,y+28,icon(r),12,PARCH,{align:'center',wordWrap:{width:108}}).setOrigin(0.5);
      if(can){ const z=this.add.zone(x,y,116,128).setInteractive({useHandCursor:true}); z.on('pointerup',()=>{ Progress.bpClaim(r.tier); SFX.build(); this.scene.restart(); }); txt(this,x,y+54,'CLAIM',13,'#f2c14e').setOrigin(0.5); }
      else txt(this,x,y+54,got?'✓ claimed':'🔒',12,got?'#8fd06a':'#7a6a5a').setOrigin(0.5); });
    const can=S.free.filter(r=>!Progress.bpClaimed(r.tier)&&T>=r.tier).length;
    button(this,W/2,665,300,50,'Claim all ('+can+')',()=>{ Progress.bpClaimAll(); SFX.build(); this.scene.restart(); },{disabled:!can});
    txt(this,W/2+330,665,'Grokonians: '+Tokens.balance(),20,GOLD).setOrigin(0.5);
    button(this,90,665,140,46,'Back',()=>this.scene.start('Menu')); } }

// ---------- Profile ----------
class Profile extends Phaser.Scene{ constructor(){super('Profile');}
  create(){ backdrop(this,0.78); const P=Progress.data, L=Progress.level(), st=Progress.state;
    txt(this,W/2,34,'Profile & Level',36,GOLD).setOrigin(0.5);
    txt(this,60,80,'Player level '+L.lv,26); const g=this.add.graphics(); g.fillStyle(0x000000,0.7); g.fillRect(60,118,360,14); g.fillStyle(0xd9a441,1); g.fillRect(60,118,360*L.into/L.need,14);
    txt(this,60,138,L.into+'/'+L.need+' XP  •  Account level '+Progress.accountLevel(),17);
    txt(this,60,162,'Account = level/2 + achievements/3 + total mastery/5. It opens worlds.',13,'#a08a6a');
    let y=196; txt(this,60,y,'Worlds',22,GOLD); y+=30;
    Levels.data.worlds.forEach(w=>{ const o=Levels.worldOpen(w); txt(this,70,y,(o?'✓ ':'🔒 ')+w.name+'  —  '+(w.playable?'account '+w.reqAccount:'coming soon')+(o?'  ★'+Levels.worldStars(w.id):''),15,o?PARCH:'#8a7a6a'); y+=22; });
    y+=10; txt(this,60,y,'Title',22,GOLD); y+=32;
    const own=Progress.ownedTitles(); if(!own.length) txt(this,70,y,'Earn titles from the Battle Pass and mastery.',15,'#a08a6a');
    own.slice(0,6).forEach((t,i)=>button(this,135+(i%3)*150,y+10+Math.floor(i/3)*44,140,38,(st.title===t?'✓ ':'')+Progress.titleName(t),()=>{ Progress.setTitle(t); this.scene.restart(); },{size:13}));
    // right column: challenges + achievements
    let ry=80; txt(this,640,ry,'Daily challenges',22,GOLD); ry+=30;
    Progress.challenges('daily').forEach(c=>{ txt(this,650,ry,(c.done?'✓ ':'• ')+c.text+'  '+c.have+'/'+c.goal,15,c.done?'#8fd06a':PARCH); ry+=21; });
    ry+=6; txt(this,640,ry,'Weekly challenges',22,GOLD); ry+=30;
    Progress.challenges('weekly').forEach(c=>{ txt(this,650,ry,(c.done?'✓ ':'• ')+c.text+'  '+c.have+'/'+c.goal,15,c.done?'#8fd06a':PARCH); ry+=21; });
    ry+=6; txt(this,640,ry,'Achievements '+Progress.achCount()+'/'+P.achievements.length,22,GOLD); ry+=30;
    P.achievements.forEach((a,i)=>{ const ok=!!st.ach[a.id]; txt(this,650+(i%2)*300,ry+Math.floor(i/2)*21,(ok?'✓ ':'○ ')+a.name+' ('+Math.min(a.goal,Progress.stat(a.stat))+'/'+a.goal+')',13,ok?'#8fd06a':'#a08a6a'); });
    button(this,90,680,140,46,'Back',()=>this.scene.start('Menu')); } }


// ---------- Controls (Upgrade 12): the player's own settings ----------
// One scene for the three rulings' home settings: the movement scheme,
// the keybind list (click a key, press the new one), and the button
// layout — edited here on ghost buttons standing at the layout's REAL
// positions over the battlefield art, and in battle from the ⚙ pause,
// where the real buttons themselves are dragged. Both editors write
// the one saved layout (gxhub_wotw_layout); the battle applies it.
class Settings extends Phaser.Scene{ constructor(){super('Settings');}
  create(){ backdrop(this,0.78);
    this.binds=loadBinds(); this.moveScheme=loadMoveScheme(); this._cap=null;
    this.setItems=[]; this.bindItems=[]; this.ghostObjs=[]; this.ghostItems=[]; this._ghostEd=null;
    const keep=o=>{ this.setItems.push(o); return o; };
    keep(txt(this,W/2,38,'Controls',38,GOLD).setOrigin(0.5));
    keep(txt(this,90,92,'Hero movement',22,GOLD));
    this.moveBtns={};
    [['tap','Tap to move',300],['stick','Joystick',560],['follow','Follow (hold)',820]].forEach(([id,label,x])=>{ const b=button(this,x,132,240,46,label,()=>{ this.moveScheme=id; saveMoveScheme(id); this.markMove(); this.bindStatus.setText('Movement: '+label+'. It applies to the next battle — and at once, from the ⚙ pause in battle.'); },{size:16}); keep(b); this.moveBtns[id]=b; });
    keep(txt(this,90,196,'Keybinds',22,GOLD));
    keep(txt(this,90,222,'Click a key, then press the new one. Escape cancels. A key already in use trades places — a swap, so no action is ever left keyless.',14,'#cdbd95'));
    this.renderBinds();
    this.bindStatus=keep(txt(this,W/2,540,'',16,'#f2c14e').setOrigin(0.5));
    keep(button(this,300,592,260,46,'Reset keybinds',()=>{ this.binds=Object.assign({},DEFAULT_BINDS); saveBinds(this.binds); this._cap=null; this.renderBinds(); this.bindStatus.setText('Keybinds reset to the standard set.'); },{size:16}));
    keep(button(this,640,592,260,46,'Reset button layout',()=>{ resetLayout(); this.bindStatus.setText('Button layout reset to the standard.'); },{size:16}));
    keep(button(this,980,592,300,46,'Edit button layout',()=>this.enterGhostEdit(),{size:16}));
    keep(txt(this,W/2,648,'In battle, the ⚙ pause edits the real buttons in place — and holds the fight while you do.',13,'#a08a6a').setOrigin(0.5));
    button(this,90,680,140,46,'Back',()=>{ if(this._ghostEd) this.exitGhostEdit(); this.scene.start('Menu'); });
    if(this.input.keyboard) this.input.keyboard.on('keydown',e=>this.bindKeyEvent(e));
    // A click anywhere else gives up a capture in progress.
    this.input.on('pointerdown',()=>{ if(this._cap){ this._cap=null; this.renderBinds(); this.bindStatus.setText('Rebind cancelled.'); } });
    this.markMove(); }
  markMove(){ if(!this.moveBtns) return;
    Object.entries(this.moveBtns).forEach(([id,b])=>{ b.label.setText((id==='tap'?'Tap to move':id==='stick'?'Joystick':'Follow (hold)')+(this.moveScheme===id?' ✓':'')); }); }
  renderBinds(){ (this.bindItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.bindItems=[];
    BIND_ACTIONS.forEach(([id,label],i)=>{ const col=i<8?0:1, row=i%8, x=col===0?120:700, y=252+row*30;
      const t=txt(this,x,y,label,15,PARCH); this.bindItems.push(t);
      const kb=button(this,x+330,y+13,190,26,this._cap===id?'press a key…':keyName(this.binds[id]),()=>this.beginBindCapture(id),{size:13}); this.bindItems.push(kb); }); }
  beginBindCapture(id){ this._cap=id; this.renderBinds(); this.bindStatus.setText('Press a key for '+bindLabel(id)+' — Escape cancels.'); }
  // Conflict law: a SWAP. The action that held the captured key receives
  // the key this action is giving up, so a rebind can never strand an
  // action with no key at all.
  bindKeyEvent(e){ if(!this._cap||!e||!e.code) return; const code=e.code;
    if(e.preventDefault) e.preventDefault();
    if(code==='Escape'){ this._cap=null; this.renderBinds(); this.bindStatus.setText('Rebind cancelled.'); return; }
    const act=this._cap, binds=Object.assign({},this.binds);
    const other=Object.keys(binds).find(a=>a!==act&&binds[a]===code);
    if(other) binds[other]=binds[act];
    binds[act]=code; this.binds=binds; saveBinds(binds); this._cap=null; this.renderBinds();
    this.bindStatus.setText(bindLabel(act)+' is now on '+keyName(code)+(other?(' — swapped with '+bindLabel(other)+'.'):'.')); }
  setSectionVisible(v){ (this.setItems||[]).concat(this.bindItems||[]).forEach(o=>{ try{ o.setVisible(v); }catch(e){} }); }
  // The layout editor, menu side: ghost buttons (the game's own button
  // face) standing at the layout's real positions over the field. What
  // transfers is the position — the battle's real buttons land exactly
  // where these ghosts are left.
  enterGhostEdit(){ if(this._ghostEd) return; this._cap=null; this.setSectionVisible(false);
    const pos=layoutPositions(), items=[];
    LAYOUT_DEFS.forEach(d=>{ const p=pos[d[0]];
      const b=button(this,p.x,p.y,d[2],d[3],d[1],()=>{},{size:d[2]>150?15:13}); b.setDepth(40);
      this.ghostObjs.push(b); items.push({id:d[0],obj:b,w:d[2],h:d[3],sync:null}); });
    const g=this.add.graphics().setDepth(41); g.fillStyle(0x140c07,0.92); g.fillRoundedRect(W/2-330,10,660,44,10); g.lineStyle(2,0xf2c14e,1); g.strokeRoundedRect(W/2-330,10,660,44,10); this.ghostItems.push(g);
    this.ghostItems.push(txt(this,W/2,32,'EDITING LAYOUT — drag any button into place',17,'#f2c14e').setOrigin(0.5).setDepth(42));
    const dn=button(this,W/2-100,580,170,44,'Done',()=>this.exitGhostEdit(),{size:16}); dn.setDepth(42); this.ghostItems.push(dn);
    const rs=button(this,W/2+100,580,190,44,'Reset layout',()=>{ resetLayout(); const dp=defaultLayoutPos(); items.forEach(it=>{ it.obj.setPosition(dp[it.id].x,dp[it.id].y); }); },{size:15}); rs.setDepth(42); this.ghostItems.push(rs);
    this._ghostEd=layoutEditor(this,()=>{ const out={}; items.forEach(it=>{ out[it.id]={x:Math.round(it.obj.x),y:Math.round(it.obj.y)}; }); saveLayout(out); });
    this._ghostEd.setItems(items); this._ghostEd.enter(); }
  exitGhostEdit(){ if(!this._ghostEd) return; this._ghostEd.exit(); this._ghostEd=null;
    (this.ghostObjs||[]).concat(this.ghostItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} });
    this.ghostObjs=[]; this.ghostItems=[]; this.setSectionVisible(true); } }

window.__game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#0d0906',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:3},
  scene:[Boot,Menu,Settings,EraSelect,HeroSelect,Unlocks,BattlePass,Profile,Game,End]});
