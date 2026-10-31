// Watchmen on the Wall — Conquest. Plain JS + Phaser 3. (Tower defense retired 2026-10-30; heroes/battle pass kept.)
const W=1280,H=720,HUD_Y=610;
// Upgrade 3: CAMP_MAX hit points. Camp-Falls (2026-10-31): the camp's
// health is the hero's way back, not the run's life — if it falls, the
// fight goes on and only the hero's own fall, with no camp standing,
// ends the run.
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
// Upgrade 14 — THE LAST PIECES (kennin's start word, 2026-10-30): endless
// champions, the Bible heroes' identities, and the weekly twists, all
// from ERA-IDEAS.md.
//  ENDLESS: the goal-wave champion's engine (Upgrade 7, untouched) also
//  rises in endless mode — one champion every ENDLESS_CHAMP_EVERY waves
//  past the goal, at the same spawn scale (curve x5 HP / x1.6 dmg) with
//  the same three phases. Ten is the campaign's own rhythm — the goal
//  itself is wave 10 — so the deep game keeps the same heartbeat.
//  HEROES: Deborah and Samson already stand on the roster with their
//  powers; what was missing is who they ARE. Deborah, the Palm Judge:
//  her song hangs over the field — while she leads, the whole enemy
//  line advances at deborahSongAdvance of its pace, and her ult (Song
//  of Deborah) is the crescendo that halves it outright. Samson, the
//  Nazirite: power that peaks when he stands alone — with no living
//  squad within samsonAloneRange px, his basic blows land at
//  samsonAloneDmgMul. The price is the standing itself: an army held
//  away from its hero. Both passives multiply the player's own side
//  only — enemy stats and the wave curve are never read from here.
//  TWISTS: one law per calendar week for Bible runs, alternating by
//  week index (deterministic: the same week always names the same
//  law). Night of the Torches — every wave is a night wave, and a
//  stronger one than nature makes: ranged squads reach torchRangeMul,
//  the enemy marches at torchEnemySpd (a plain night is 1.1 / 1.08).
//  The Seventh Day — every seventhEvery-th wave holds its whole spawn
//  back seventhRest seconds while manna rains at seventhMannaPerSec
//  (150 over the rest: a wave-bonus-sized gift, on the economy's own
//  scale). First-pass numbers, kennin's to tune.
const ENDLESS_CHAMP_EVERY=10;
const HEROISM={ deborahSongAdvance:0.92, samsonAloneRange:240, samsonAloneDmgMul:1.5 };
const TWIST={ torchRangeMul:1.25, torchEnemySpd:1.15, seventhEvery:7, seventhRest:10, seventhMannaPerSec:15 };
const TWISTS=[
  {id:'torches', name:'Night of the Torches', blurb:'Every wave is night — your ranged reach farther, the enemy marches faster.'},
  {id:'seventh', name:'The Seventh Day', blurb:'Every 7th wave opens with ten seconds of rest — no enemy comes, and manna rains.'},
];
function weekIndex(d){ d=d||new Date(); const days=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); return Math.floor((days+3)/7); }
function twistForWeek(w){ const n=TWISTS.length; return TWISTS[((w%n)+n)%n]; }
function currentTwist(){ return twistForWeek(weekIndex()); }
// ---------- iPhone fullscreen hotfix (kennin, 2026-10-31) ----------
// Abel plays on an iPhone, where Safari gives a web page no Fullscreen
// API for page elements: the old button could only fail silently there.
// The supported route is the installed home-screen app — Add to Home
// Screen launches this game standalone, edge-to-edge and truly full
// screen. So the button now tells the truth by platform:
//   standalone  -> the game is already fullscreen; the button hides.
//   iOS browser -> the button opens a short panel naming the install.
//   elsewhere   -> the button requests real fullscreen, as it always did.
// displayMode is a PURE function over an injectable environment so the
// verification suite can prove the whole UA matrix without a browser.
const IOS_FS_HELP='On iPhone, install the game for true fullscreen: tap Share, then Add to Home Screen — it opens like an app, full screen.';
function displayMode(env){ env=env||{};
  const nav=env.navigator||(typeof navigator!=='undefined'?navigator:null);
  const win=env.window||(typeof window!=='undefined'?window:null);
  const doc=env.document||(typeof document!=='undefined'?document:null);
  let standalone=false;
  try{ standalone=!!(win&&win.matchMedia&&win.matchMedia('(display-mode: standalone)').matches); }catch(e){}
  if(nav&&nav.standalone===true) standalone=true;
  const ua=(nav&&nav.userAgent)||'';
  const platform=(nav&&nav.platform)||'';
  const ios=/iPhone|iPad|iPod/.test(ua)||(platform==='MacIntel'&&(nav&&nav.maxTouchPoints||0)>1);
  const root=doc&&doc.documentElement;
  const canFullscreen=!!(root&&(root.requestFullscreen||root.webkitRequestFullscreen));
  if(standalone) return {mode:'standalone',standalone:true,ios:ios,canFullscreen:canFullscreen,showButton:false,installHelp:false};
  if(ios&&!canFullscreen) return {mode:'ios-install',standalone:false,ios:true,canFullscreen:false,showButton:true,installHelp:true};
  return {mode:'browser',standalone:false,ios:ios,canFullscreen:canFullscreen,showButton:true,installHelp:false};
}
function showIOSFullscreenHelp(s){ if(!s||s._iosFsPanel) return false;
  const items=[]; s._iosFsPanel=items;
  const g=s.add.graphics(); if(g.setDepth) g.setDepth(90); items.push(g);
  g.fillStyle(0x0d0906,0.82); g.fillRect(0,0,W,H);
  g.fillStyle(0x140c07,0.98); g.fillRoundedRect(W/2-380,218,760,284,14);
  g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-380,218,760,284,14);
  const title=txt(s,W/2,258,'FULLSCREEN ON IPHONE',26,GOLD).setOrigin(0.5); if(title.setDepth) title.setDepth(91); items.push(title);
  const body=txt(s,W/2,340,IOS_FS_HELP,20,PARCH,{align:'center',wordWrap:{width:660}}).setOrigin(0.5); if(body.setDepth) body.setDepth(91); items.push(body);
  const close=button(s,W/2,454,180,44,'Got it',()=>{ items.forEach(o=>{ try{ o.destroy(); }catch(e){} }); s._iosFsPanel=null; },{size:17});
  if(close.setDepth) close.setDepth(92); items.push(close);
  return true;
}
function fullscreenRoute(s){ const st=displayMode();
  if(st.mode==='standalone') return 'standalone';
  if(st.installHelp){ showIOSFullscreenHelp(s); return 'install'; }
  return 'native';
}
// ---------- Upgrade 18: WEAPONS & LOOT (kennin, 2026-10-31) ----------
// "I also want to add guns... I want there to be guns and different type
// of weapons and powers. I also want the bible to be a weapon as well. I
// want the weapons to drop rpg with chests and things like that."
// (Building stays HELD by his word the same night — U15 stands as-is;
// this upgrade adds no building work and ports none to rooms.)
//
// The hero's basic attack is weapon-driven now. Seven FAMILIES — sling,
// bow, sword, spear, and the guns: pistol, rifle, scattergun — each with
// its own pattern, its own synthesized voice (js/sfx.js), and an innate
// TRAIT. Six RARITY TIERS — kennin's ladder, the GX Monsters ladder —
// scale a family's stats modestly and strengthen its trait. THE BALANCE
// BOUND: the Common sling IS the pre-U18 attack, number for number
// (dmg 18, rate 0.7, range 140, crit 0.10, a stone at 620), so the
// standing champion benchmark (~32.5s, camp whole) is reproduced with
// it equipped and the enemy curve never moves. Weapon damage is rated
// for a standard arm: the hero's own damage stat scales it (hero dmg /
// 18), and his tempo scales its rate (hero rate / 0.7) — so David feels
// exactly the table, Samson's strength carries any weapon harder, and
// mastery keeps meaning what it meant. A weapon carries its own damage
// type (the guns and the old arms are physical; the Bible is holy) —
// the hero's innate dmgType governed only the old built-in attack.
//
// THE BIBLE stands apart: not a family, never on the ladder, never
// sold — found, in Gold chests alone, at low odds. Its attack throws
// bolts of light; its power, the Word, is a periodic verse-blast around
// the hero plus a strength aura for squads standing near him.
//
// CHESTS are the only road to new weapons: ~2% of ordinary enemies, a
// real chance from ELITES (the roster's elite class — the non-champion
// Idol Golem; flagged in BUILD-NOTES), guaranteed from champions. The
// hero banks a chest by walking over it; chests open in the
// intermission on a reveal panel — battle is never interrupted by
// loot. THE RACK is the persistent armory below (guarded storage, the
// CQ pattern): duplicates of an owned family+tier convert to Manna at
// reveal, and banked-but-unopened chests wait in the Rack for the next
// intermission — they never vanish. Rooms keep their fixed loadout:
// weapons are solo-first, like U15 was (js/net.js untouched).
const WEAPON_TIERS=[
  { id:'common',    name:'Common',    color:0xc8ccd4, css:'#c8ccd4', mul:1,    rateMul:1,    rangeMul:1,    critAdd:0,    dupManna:25  },
  { id:'uncommon',  name:'Uncommon',  color:0x8fd06a, css:'#8fd06a', mul:1.15, rateMul:1.03, rangeMul:1.04, critAdd:0.02, dupManna:40  },
  { id:'rare',      name:'Rare',      color:0x6ab0f2, css:'#6ab0f2', mul:1.30, rateMul:1.06, rangeMul:1.08, critAdd:0.04, dupManna:70  },
  { id:'epic',       name:'Epic',      color:0xb07ae8, css:'#b07ae8', mul:1.50, rateMul:1.10, rangeMul:1.12, critAdd:0.07, dupManna:120 },
  { id:'legendary', name:'Legendary', color:0xf2a03c, css:'#f2a03c', mul:1.75, rateMul:1.14, rangeMul:1.16, critAdd:0.10, dupManna:200 },
  { id:'mythic',    name:'Mythic',    color:0xf25c5c, css:'#f25c5c', mul:2.05, rateMul:1.18, rangeMul:1.20, critAdd:0.14, dupManna:325 },
];
const WEAPON_FAMILIES={
  sling:{ name:'Sling', type:'physical', dmg:18, rate:0.70, range:140, crit:0.10, proj:'stone',
    traitName:'True Aim', trait:'Crit chance grows with rarity — a shepherd\'s eye, sharpened.',
    names:['Shepherd\'s Sling','Watchman\'s Sling','Sling of the Valley','Sling of the Mighty Men','Sling of Elah','The Seventh Stone'] },
  bow:{ name:'Bow', type:'physical', dmg:15, rate:0.55, range:185, crit:0.12, proj:'arrow',
    traitName:'Keen String', trait:'Crits land harder as rarity rises — the string sings truer.',
    names:['Hunter\'s Bow','Bow of the Watch','Bow of Kedar','Bow of the Mighty','Bow of Jonathan','Bow of the Morning'] },
  sword:{ name:'Sword', type:'physical', dmg:24, rate:0.80, range:58, crit:0.10, proj:null,
    traitName:'Cleave', trait:'The swing is an arc, and the arc widens with rarity — everything in it is struck.',
    names:['Short Sword','Soldier\'s Sword','Sword of the Wall','Sword of Gilead','Blade of the Captain','Sword of the Dawn'] },
  spear:{ name:'Spear', type:'physical', dmg:21, rate:0.85, range:96, crit:0.08, proj:null,
    traitName:'Long Reach', trait:'The thrust runs through its mark — and pierces one more at Epic, another at Mythic.',
    names:['Casting Spear','Spear of the Guard','Spear of the Wall','Spear of Phinehas','Spear of Joshua','Spear of the Host'] },
  pistol:{ name:'Pistol', type:'physical', dmg:13, rate:0.38, range:150, crit:0.22, proj:'bullet',
    traitName:'Deadeye', trait:'Fast hands, and a crit chance that grows with rarity.',
    names:['Pocket Pistol','Frontier Pistol','Duelist\'s Pistol','Officer\'s Pistol','The Peacemaker','The Last Word'] },
  rifle:{ name:'Rifle', type:'physical', dmg:30, rate:1.05, range:260, crit:0.12, proj:'bullet',
    traitName:'Through the Line', trait:'The shot does not stop at its mark — it pierces the whole line.',
    names:['Long Rifle','Sharpshooter\'s Rifle','Rifle of the Ridge','Marksman\'s Rifle','The Long Witness','Rifle of the Seventh Hill'] },
  scattergun:{ name:'Scattergun', type:'physical', dmg:7, rate:1.00, range:100, crit:0.05, proj:'stone',
    traitName:'Fuller Spread', trait:'More pellets join the spread as rarity rises — five at Common, seven at Mythic.',
    names:['Scattergun','Coach Gun','Trench Sweeper','The Harvester','The Wide Net','Thunder of the Field'] },
};
const WEAPON_FAMILY_ORDER=['sling','bow','sword','spear','pistol','rifle','scattergun'];
// THE BIBLE — singular, off the ladder. blast* is the Word spoken around
// the bearer; aura* is its strength for the squads near him.
const BIBLE_WEAPON={ family:'bible', name:'The Bible', display:'The Bible — the Word of God', type:'holy',
  dmg:26, rate:0.62, range:195, crit:0.15, proj:'light',
  blastEvery:6, blastDmg:45, blastRadius:130, auraRange:175, auraDmgMul:1.25,
  traitName:'The Word', trait:'Every few seconds the Word speaks: a blast of light around the bearer, and strength for the squads who stand near him.' };
const BIBLE_VERSES=['"Thy word is a lamp unto my feet." Ps 119:105','"The word of God is quick, and powerful." Heb 4:12','"Heaven and earth shall pass away, but my words shall not pass away." Matt 24:35','"Thy word have I hid in mine heart." Ps 119:11'];
// Resolution: family + tier -> the carried weapon. Monotonic by
// construction — every multiplier rises with the tier, so within a
// family a higher tier is never weaker in damage, rate, range or crit,
// and each trait number (arc / pierce / pellets / critMul) steps up at
// its named tiers.
function resolveWeapon(family,tier,variant){ if(family==='bible') return Object.assign({tier:-1,tierName:'Unique',key:'bible',familyName:'The Bible'},BIBLE_WEAPON);
  const F=WEAPON_FAMILIES[family]||WEAPON_FAMILIES.sling, T=WEAPON_TIERS[tier]||WEAPON_TIERS[0];
  const w={ family:family, tier:tier, tierName:T.name, key:family+':'+tier, name:F.names[tier]||F.name, familyName:F.name,
    type:F.type, proj:F.proj, traitName:F.traitName, trait:F.trait,
    dmg:Math.round(F.dmg*T.mul*10)/10, rate:Math.round(F.rate/T.rateMul*1000)/1000,
    range:Math.round(F.range*T.rangeMul), crit:Math.round((F.crit+T.critAdd)*100)/100,
    arc:0, pierce:0, pellets:0, critMul:1 };
  if(family==='sword') w.arc=110+18*tier;                      // the arc's total width, degrees: 110 -> 200
  if(family==='spear') w.pierce=1+(tier>=3?1:0)+(tier>=5?1:0); // foes struck through, beyond the first
  if(family==='scattergun') w.pellets=5+Math.floor(tier/2);    // 5,5,6,6,7,7
  if(family==='bow') w.critMul=1+0.12*tier;                    // crits land harder
  if(family==='rifle') w.pierce=99;                            // through the whole line
  // Upgrade 19: a SEASONAL VARIANT (the Hallows torch-flame dressing)
  // is the same weapon under U18's rules — same numbers, same trait —
  // wearing the season: a new key ('family:tier@hallows'), a Torchlit
  // name, the flame's palette, and blows that land as FIRE. It lives
  // on the Rack beside its plain twin; neither replaces the other.
  if(variant==='hallows'){ w.variant='hallows'; w.key=w.key+'@hallows'; w.name='Torchlit '+w.name; w.type='fire'; w.flame=true;
    w.trait=w.trait+' Wreathed in torch-flame: every blow lands as fire.'; }
  return w; }
function parseWeaponKey(key){ if(key==='bible') return {family:'bible',tier:-1};
  const parts=String(key||'').split('@'), p=parts[0].split(':'); const f=WEAPON_FAMILIES[p[0]]?p[0]:'sling';
  return {family:f,tier:Math.max(0,Math.min(5,parseInt(p[1],10)||0)),variant:parts[1]||null}; }
// --- chests: grades, drop chances, loot rolls ---
// Grades weight the rarity odds; Gold alone can hold the Bible, at
// BIBLE_ODDS, and only while the Rack lacks it (the Bible is unique —
// a bearer who carries it finds an ordinary weapon instead).
const CHEST_GRADES={
  wood:{ name:'Wooden Chest', color:0xb08d4a, css:'#b08d4a', tiers:[0.62,0.25,0.10,0.025,0.005,0] },
  iron:{ name:'Iron Chest',   color:0xc8ccd4, css:'#c8ccd4', tiers:[0.38,0.30,0.20,0.09,0.025,0.005] },
  gold:{ name:'Golden Chest', color:0xf2c14e, css:'#f2c14e', tiers:[0.18,0.24,0.26,0.18,0.10,0.04] },
};
const CHEST_DROPS={
  normal:  { chance:0.02, grades:[['wood',0.80],['iron',0.18],['gold',0.02]] },
  elite:   { chance:0.35, grades:[['wood',0.45],['iron',0.40],['gold',0.15]] },
  champion:{ chance:1,    grades:[['iron',0.55],['gold',0.45]] },
};
const BIBLE_ODDS=0.03;
// rng is injectable so the harness drives the real rolls with a seeded
// stream; the game passes nothing and gets Math.random.
function rollChestDrop(kind,rng){ const R=rng||Math.random, D=CHEST_DROPS[kind]||CHEST_DROPS.normal;
  if(R()>=D.chance) return null;
  let r=R(), acc=0; for(const pair of D.grades){ acc+=pair[1]; if(r<acc) return pair[0]; } return D.grades[0][0]; }
// Roll order is fixed — Bible check (Gold only), family, tier — so a
// seeded stream reads the same way every time.
function rollLoot(grade,rng,hasBible){ const R=rng||Math.random, G=CHEST_GRADES[grade]||CHEST_GRADES.wood;
  if(grade==='gold'&&!hasBible&&R()<BIBLE_ODDS) return { bible:true };
  const family=WEAPON_FAMILY_ORDER[Math.min(WEAPON_FAMILY_ORDER.length-1,Math.floor(R()*WEAPON_FAMILY_ORDER.length))];
  let r=R(), acc=0, tier=0; for(let i=0;i<G.tiers.length;i++){ acc+=G.tiers[i]; tier=i; if(r<acc) break; }
  return { family:family, tier:tier }; }
// --- THE RACK: the persistent armory (the CQ pattern, guarded) ---
const RACK_KEY='gxhub_wotw_rack_v1';
const Rack={ _s:null,
  _base(){ return { owned:{ 'sling:0':true }, equipped:'sling:0', pending:[] }; },
  _load(){ if(this._s) return this._s;
    try{ const s=Object.assign(this._base(),JSON.parse(localStorage.getItem(RACK_KEY)||'{}'));
      if(!s.owned||typeof s.owned!=='object') s.owned={ 'sling:0':true };
      if(!s.owned['sling:0']) s.owned['sling:0']=true; // the starter can never be lost
      if(!Array.isArray(s.pending)) s.pending=[];
      if(!s.equipped||!s.owned[s.equipped]) s.equipped='sling:0';
      this._s=s; }catch(e){ this._s=this._base(); }
    return this._s; },
  _save(){ try{ localStorage.setItem(RACK_KEY,JSON.stringify(this._s)); }catch(e){} },
  reset(){ this._s=null; try{ localStorage.removeItem(RACK_KEY); }catch(e){} this._load(); },
  owns(key){ return !!this._load().owned[key]; },
  grant(key){ const s=this._load(); if(s.owned[key]) return 'dup'; s.owned[key]=true; this._save(); return 'new'; }, // 'new' | 'dup' — a duplicate converts to Manna at reveal
  equippedKey(){ return this._load().equipped; },
  equip(key){ const s=this._load(); if(!s.owned[key]) return false; s.equipped=key; this._save(); return true; },
  equippedWeapon(){ const p=parseWeaponKey(this.equippedKey()); return resolveWeapon(p.family,p.tier,p.variant); },
  pending(){ return this._load().pending.slice(); },
  setPending(list){ const s=this._load(); s.pending=(list||[]).filter(g=>CHEST_GRADES[g]||SEASON_BY_ID[g]); this._save(); }, // Upgrade 19: seasonal chest ids wait in the same queue
  // The armory's list: the Bible first (it stands above the ladder),
  // then families in arsenal order, tiers ascending.
  list(){ const s=this._load();
    // Every owned key resolves — the Bible first (it stands above the
    // ladder), then families in arsenal order, tiers ascending, and a
    // seasonal variant (Upgrade 19) directly after its plain twin.
    const all=Object.keys(s.owned).filter(k=>s.owned[k]).map(k=>{ const p=parseWeaponKey(k); return resolveWeapon(p.family,p.tier,p.variant); });
    const rank=w=>w.family==='bible'?-1:WEAPON_FAMILY_ORDER.indexOf(w.family);
    all.sort((a,b)=>rank(a)-rank(b)||(a.tier-b.tier)||((a.variant?1:0)-(b.variant?1:0)));
    return all; },
};
// ---------- Upgrade 19: SEASONAL CHESTS & GIFT CARDS (kennin, 2026-10-31) ----------
// "I want to make a chest system where you can get gifts in like the
// madden player cards. I want to make Halloween themed chest and base
// the chest system off of seasons and holidays." — and, minutes later:
// "You gotta make it where you can buy them with the grokonians."
//
// SEASONS ARE DATA. A season is a row below: an id, a name, a YEARLY
// window by month/day (it may wrap the year end), a visual identity, a
// gift pool, a Grokonian price. A season is LIVE when the player's own
// date falls inside its window; adding a future holiday is a new row,
// never new code. The U18 Wood/Iron/Gold chests stand exactly as they
// were — this system stands beside them, and a seasonal chest waits in
// the Rack's one pending queue and opens in the same intermission
// reveal, bought or found alike: battle is never interrupted by loot.
//
// GIFTS ARE CARDS, in the Madden sense: a seasonal chest can deal a
// collectible CARD — a name, a tier on kennin's six-rung ladder, a set,
// a face drawn from the game's own glyph family. Cards persist in the
// ALBUM (guarded storage, the Rack's pattern). A duplicate card melts
// into Manna at reveal, like a duplicate weapon; finishing a set pays
// the set's gift ONCE — Manna to the run and Grokonians through the
// Tokens earn path, so the hub's caps apply as they do to every earn.
//
// THE HALLOWS CHEST is first, and it wears kennin's own settled
// meaning of the day: celebrating the living in Christ, and those who
// died in Christ who live with Him now. A chest of REMEMBRANCE in
// torch-flame gold — the Night of the Torches' own fire — with no
// horror and no devil anywhere in it. Its card set honors WITNESSES;
// each card carries a name, an epithet in plain words, and a Scripture
// REFERENCE — no new verse text is quoted on a card (the only quoted
// words in the game remain the verified U18 Word cycle).
//
// THE HARD LAW, unchanged and extended: the Bible enters NO seasonal
// pool and NO purchasable chest, at any tier, ever. It is not in any
// table below — the U19 suite proves its rate is exactly zero across
// every seasonal pool and path, and U18's Gold reveal remains its only
// road into a player's hands. Rooms keep their fixed loadout:
// seasonal chests are solo-side this pass, like U18 (js/net.js clean).
const CARD_DUP_MANNA=[25,40,70,120,200,325]; // a duplicate card melts like a duplicate weapon — the same ladder, tier for tier
const CARD_TIER_WEIGHTS=[30,26,20,13,8,3];   // a set's cards are dealt weighted toward the low rungs — the Mythic is the chase
// Card faces reuse the game's existing glyph textures (the U16/U17
// hand): David's lyre, Deborah's palm, Gideon's torch-flame, Samson's
// pillars, Peter's stone, Stephen's stones, Paul's sword, John's star.
const CARD_SETS={
  witnesses:{ id:'witnesses', name:'The Witnesses', giftManna:150, giftGrok:25,
    blurb:'Those who stood in the faith — the living in Christ, and those who died in His name and live with Him now.',
    cards:[
      { id:'wit_gideon',  name:'Gideon',  epithet:'Torches in jars, carried into the night',        ref:'Judges 7',     tier:0, glyph:'ico_flame'  },
      { id:'wit_samson',  name:'Samson',  epithet:'Strength given — and spent at the pillars',      ref:'Judges 16',    tier:1, glyph:'ico_pillar' },
      { id:'wit_deborah', name:'Deborah', epithet:'Judge and prophetess, under the palm',           ref:'Judges 5',     tier:2, glyph:'ico_palm'   },
      { id:'wit_peter',   name:'Peter',   epithet:'The rock who stood and spoke',                   ref:'Acts 2',       tier:2, glyph:'ico_stone1' },
      { id:'wit_john',    name:'John',    epithet:'The disciple who remained — and saw the end',    ref:'Revelation 1', tier:3, glyph:'ico_burst'  },
      { id:'wit_stephen', name:'Stephen', epithet:'The first martyr, his face like an angel\'s',    ref:'Acts 7',       tier:3, glyph:'ico_stones5'},
      { id:'wit_paul',    name:'Paul',    epithet:'Apostle to the nations',                         ref:'Acts 9',       tier:4, glyph:'ico_sword'  },
      { id:'wit_david',   name:'David',   epithet:'Shepherd, king, and psalmist',                   ref:'1 Samuel 17',  tier:5, glyph:'ico_psalm'  },
    ] },
  tidings:{ id:'tidings', name:'Tidings of Great Joy', giftManna:100, giftGrok:20,
    blurb:'The first witnesses of the birth — those who heard, who saw, and who carried the news.',
    cards:[
      { id:'tid_shepherds', name:'The Shepherds', epithet:'The first to hear the tidings',        ref:'Luke 2',    tier:0, glyph:'wpn_sling' },
      { id:'tid_joseph',    name:'Joseph',        epithet:'The guardian who obeyed in silence',   ref:'Matthew 1', tier:1, glyph:'ico_build' },
      { id:'tid_anna',      name:'Anna',          epithet:'The prophetess who waited and watched', ref:'Luke 2',    tier:1, glyph:'ico_flame' },
      { id:'tid_simeon',    name:'Simeon',        epithet:'The watcher who saw salvation',        ref:'Luke 2',    tier:2, glyph:'ico_pillar'},
      { id:'tid_mary',      name:'Mary',          epithet:'The mother who believed',              ref:'Luke 1',    tier:3, glyph:'ico_burst' },
      { id:'tid_magi',      name:'The Magi',      epithet:'Seekers who followed the star',        ref:'Matthew 2', tier:4, glyph:'ico_jar'   },
    ] },
};
const CARD_SET_ORDER=['witnesses','tidings'];
const CARD_BY_ID={};
CARD_SET_ORDER.forEach(sid=>{ CARD_SETS[sid].cards.forEach(c=>{ c.set=sid; CARD_BY_ID[c.id]=c; }); });
function cardDef(id){ return CARD_BY_ID[id]||null; }
// The seasons themselves. weaponTiers is the rarity ladder a season's
// weapon gifts are dealt on (Hallows deals on Iron's, Tidings on
// Wood's); variant names the seasonal dressing on those weapons
// (Hallows only — Tidings deals the framework's plain generic gifts).
const SEASONS=[
  { id:'hallows', name:'Hallows Chest', price:60,
    window:{ sm:10, sd:25, em:11, ed:7 },
    color:0xf28c3c, css:'#f28c3c',
    tagline:'In remembrance — the living in Christ, and those who died in His name and live with Him now.',
    set:'witnesses', variant:'hallows',
    pool:{ card:0.45, weapon:0.30, bundle:0.25 },
    weaponTiers:[0.38,0.30,0.20,0.09,0.025,0.005],
    drop:{ elite:0.35 },
    bundles:[ {kind:'manna',amount:120,w:4}, {kind:'grok',amount:10,w:3}, {kind:'orbs',amount:1,w:2}, {kind:'manna',amount:60,w:2}, {kind:'grok',amount:25,w:1} ] },
  { id:'tidings', name:'Tidings Chest', price:60,
    window:{ sm:12, sd:18, em:12, ed:27 },
    color:0x7ab0e8, css:'#7ab0e8',
    tagline:'Tidings of great joy — the season of the birth, and of those who first heard of it.',
    set:'tidings', variant:null,
    pool:{ card:0.45, weapon:0.30, bundle:0.25 },
    weaponTiers:[0.62,0.25,0.10,0.025,0.005,0],
    drop:{ elite:0.35 },
    bundles:[ {kind:'manna',amount:100,w:4}, {kind:'grok',amount:10,w:3}, {kind:'orbs',amount:1,w:2}, {kind:'manna',amount:50,w:2}, {kind:'grok',amount:20,w:1} ] },
];
const SEASON_BY_ID={}; SEASONS.forEach(sv=>{ SEASON_BY_ID[sv.id]=sv; });
// --- the calendar: one window math for the panel, the drops, the shop ---
const SEASON_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function seasonWindowOf(sv,year){ const w=sv.window, wraps=(w.em<w.sm)||(w.em===w.sm&&w.ed<w.sd);
  return { start:new Date(year,w.sm-1,w.sd,0,0,0,0), end:new Date(wraps?year+1:year,w.em-1,w.ed,23,59,59,999) }; }
// Live means: the player's date stands inside the window, both named
// days whole. daysLeft counts today. Out of season, nextStart is the
// next opening — windows that wrap the year end resolve correctly
// from either side of New Year.
function seasonState(sv,date){ const d=date||new Date(), y=d.getFullYear();
  for(const yy of [y-1,y,y+1]){ const iv=seasonWindowOf(sv,yy);
    if(d>=iv.start&&d<=iv.end){ const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()), b=new Date(iv.end.getFullYear(),iv.end.getMonth(),iv.end.getDate());
      return { live:true, daysLeft:Math.round((b-a)/86400000)+1, start:iv.start, end:iv.end }; }
    if(d<iv.start) return { live:false, nextStart:iv.start }; }
  return { live:false, nextStart:seasonWindowOf(sv,y+1).start }; }
function liveSeason(date){ for(const sv of SEASONS){ if(seasonState(sv,date).live) return sv; } return null; }
function nextSeason(date){ let best=null;
  for(const sv of SEASONS){ const st=seasonState(sv,date); if(st.live) continue;
    if(!best||st.nextStart<best.state.nextStart) best={ season:sv, state:st }; }
  return best; }
function seasonWindowLabel(sv){ const w=sv.window; return SEASON_MONTHS[w.sm-1]+' '+w.sd+' – '+SEASON_MONTHS[w.em-1]+' '+w.ed; }
function seasonDateLabel(dt){ return SEASON_MONTHS[dt.getMonth()]+' '+dt.getDate(); }
// One display face for every chest the reveal can hold: a U18 grade or
// a season's chest, behind one lookup (name / color / css).
function chestDisplay(id){ if(CHEST_GRADES[id]) return CHEST_GRADES[id];
  const sv=SEASON_BY_ID[id]; if(sv) return { name:sv.name, color:sv.color, css:sv.css, season:sv };
  return CHEST_GRADES.wood; }
// In play, in season: elites at the season's real chance, champions
// ALWAYS — beside the U18 chests, never instead of them. Ordinary
// enemies leave the standing chests to U18's own roll.
function rollSeasonalDrop(sv,kind,rng){ if(!sv) return false;
  if(kind==='champion') return true;
  if(kind==='elite') return (rng||Math.random)()<((sv.drop&&sv.drop.elite)||0.35);
  return false; }
// The seasonal gift roll. Roll order is fixed — kind, then the gift —
// so a seeded stream reads the same way every time. NO Bible branch
// exists here, at any weight: that absence is the law, not an odds row.
function rollSeasonalGift(sv,rng){ const R=rng||Math.random, P=sv.pool, set=CARD_SETS[sv.set];
  const r=R();
  if(r<P.card){ let tot=0; set.cards.forEach(c=>{ tot+=CARD_TIER_WEIGHTS[c.tier]; });
    let x=R()*tot, card=set.cards[set.cards.length-1];
    for(const c of set.cards){ x-=CARD_TIER_WEIGHTS[c.tier]; if(x<0){ card=c; break; } }
    return { kind:'card', card:card }; }
  if(r<P.card+P.weapon){ const family=WEAPON_FAMILY_ORDER[Math.min(WEAPON_FAMILY_ORDER.length-1,Math.floor(R()*WEAPON_FAMILY_ORDER.length))];
    let x=R(), acc=0, tier=0; for(let i=0;i<sv.weaponTiers.length;i++){ acc+=sv.weaponTiers[i]; tier=i; if(x<acc) break; }
    return { kind:'weapon', family:family, tier:tier, variant:sv.variant||null }; }
  let tot=0; sv.bundles.forEach(b=>{ tot+=b.w; });
  let x=R()*tot, bundle=sv.bundles[sv.bundles.length-1];
  for(const b of sv.bundles){ x-=b.w; if(x<0){ bundle=b; break; } }
  return { kind:'bundle', bundle:{ kind:bundle.kind, amount:bundle.amount } }; }
// Buying with Grokonians (kennin: "You gotta make it where you can buy
// them with the grokonians"): the spend rides the Tokens path — the
// orb path — and a bought chest joins the Rack's pending queue,
// opening in the same intermission reveal as a found one. Out of
// season there is nothing to buy: the chest is not purchasable, and
// (rollSeasonalDrop is only consulted under liveSeason) not droppable.
function purchaseSeasonalChest(seasonId,date){ const sv=SEASON_BY_ID[seasonId]; if(!sv) return 'noseason';
  if(!seasonState(sv,date).live) return 'season-over';
  if(!Tokens.spend('chest:'+sv.id,sv.price)) return 'funds';
  const p=Rack.pending(); p.push(sv.id); Rack.setPending(p); return 'ok'; }
// --- THE ALBUM: the gift cards' keeping (the Rack's guarded pattern) ---
const ALBUM_KEY='gxhub_wotw_album_v1';
const Album={ _s:null,
  _base(){ return { cards:{}, gifts:{} }; },
  _load(){ if(this._s) return this._s;
    try{ const s=Object.assign(this._base(),JSON.parse(localStorage.getItem(ALBUM_KEY)||'{}'));
      if(!s.cards||typeof s.cards!=='object') s.cards={};
      if(!s.gifts||typeof s.gifts!=='object') s.gifts={};
      this._s=s; }catch(e){ this._s=this._base(); }
    return this._s; },
  _save(){ try{ localStorage.setItem(ALBUM_KEY,JSON.stringify(this._s)); }catch(e){} },
  reset(){ this._s=null; try{ localStorage.removeItem(ALBUM_KEY); }catch(e){} this._load(); },
  owns(id){ return (this._load().cards[id]||0)>0; },
  count(id){ return this._load().cards[id]||0; },
  // 'new' | 'dup' — a duplicate melts into Manna at reveal, and the
  // count is kept so the Album can say how many times a card was found.
  grantCard(id){ const s=this._load(), had=(s.cards[id]||0)>0; s.cards[id]=(s.cards[id]||0)+1; this._save(); return had?'dup':'new'; },
  setProgress(setId){ const set=CARD_SETS[setId]; if(!set) return { owned:0, total:0 };
    return { owned:set.cards.filter(c=>this.owns(c.id)).length, total:set.cards.length }; },
  setComplete(setId){ const p=this.setProgress(setId); return p.total>0&&p.owned===p.total; },
  giftClaimed(setId){ return !!this._load().gifts[setId]; },
  claimSetGift(setId){ const s=this._load(); if(s.gifts[setId]) return false; s.gifts[setId]=Date.now(); this._save(); return true; },
};
// Upgrade 15 — GATHER & BUILD (kennin, voice 2026-10-30: gather by mining
// — wood from trees, stone from rocks — then build defenses around the
// camp, "like fences, like in Fortnite Save the World where you have to
// protect the core. We could do that for the camp." His warmly-received
// addition: pieces wear with use and are mended between waves.)
//  RESOURCES: trees and rock outcrops stand at fixed fractions of the
//  world (NODE_SPOTS — the orb-station pattern, so every era inherits
//  the same posts; in the Bible world, 1920x1200, the trees land at
//  (480,240) (768,420) (979,180) (1171,756) (1421,300) (1680,876) and
//  the rocks at (518,1020) (883,1020) (1114,420) (1517,1020) (1766,516)
//  — all clear of the camp, every orb station, and each other). The
//  hero gathers by STANDING at a node: every GATHER.tick seconds of
//  standing still within GATHER.range, one swing lands (tree: the melee
//  swish; rock: the blunt knock — the SFX families the field already
//  speaks) and GATHER.yield of its resource joins the run's purse. A
//  node holds GATHER.gathers swings, then stands gathered-out and
//  REGROWS after GATHER.regrow seconds — the slow timer, not a
//  between-wave gift, so a long defense can be re-timbered mid-run but
//  never strip-mined in one breath. Wood and stone are RUN purse only —
//  never Manna, never Grokonians, never saved.
//  BUILDING: the BUILD button opens a build bar — Wooden Fence (wood)
//  and Stone Wall (stone), Mend for a worn piece, Demolish to take one
//  down. Placement snaps to the BUILD.grid and obeys ONE passability
//  law, stated plainly: pieces may stand anywhere EXCEPT inside the
//  camp's own ground (campClear), across a resource node or an orb
//  station (nodeClear / orbClear), or in the spawn mouth band at the
//  world's east edge (spawnBand) — the road in can be FUNNELED but
//  never SEALED. The law needs no pathfinding to keep: there is none in
//  this game. An enemy marches on the camp and stops for the nearest
//  blocker in its 90px scan; a piece joins that scan as a blocker with
//  HP, so a full ring is only ever a DELAY — the ring is chewed through
//  piece by piece and the camp is reached the moment a gap opens.
//  Nothing a player builds can make the camp unreachable, and nothing
//  here touches an enemy stat or the wave curve: building is a
//  player-side tool, and kennin's scaling law stands untouched.
//  PIECES IN COMBAT: a piece blocks only when it truly stands between
//  the enemy and the camp — it joins the blocker scan when its
//  effective distance (center distance minus bodyR) beats the nearest
//  defender's AND its own distance to the camp is no more than the
//  enemy's plus behindPad. An enemy that reaches it attacks it at its
//  own rate and damage, through damageBuild; wear shows as tint stages
//  and an HP bar, and at zero the piece falls and the road reopens.
//  The champion chews pieces with his ordinary blows through the same
//  loop; his telegraphed specials stay aimed at the living — a fence
//  delays his march and eats his plain attacks, it does not eat a
//  heavy strike meant for men. The hero and his squads pass through
//  pieces freely (no friendly collision exists anywhere in this game).
//  MEND restores mendHealFrac of a piece's max HP for a mendCostDiv-th
//  of its build cost (rounded up — 2 of its resource for either piece),
//  and refuses a whole piece. DEMOLISH refunds demolishRefund of the
//  build cost (rounded down — 3 of 6): taking a wall down is a real
//  decision, not a free re-deal. First-pass numbers, kennin's to tune.
const GATHER={ range:80, tick:0.55, woodYield:2, stoneYield:2, gathers:5, regrow:45 };
const BUILD={ grid:64, campClear:118, spawnBand:150, nodeClear:64, orbClear:76, bodyR:30, behindPad:30,
  mendHealFrac:0.5, mendCostDiv:3, demolishRefund:0.5,
  pieces:{ fence:{id:'fence',name:'Wooden Fence',res:'wood',cost:6,hp:120,tex:'fence'},
           wall:{id:'wall',name:'Stone Wall',res:'stone',cost:6,hp:320,tex:'stonewall'} } };
const NODE_SPOTS={ trees:[[0.25,0.20],[0.40,0.35],[0.51,0.15],[0.61,0.63],[0.74,0.25],[0.875,0.73]],
                   rocks:[[0.27,0.85],[0.46,0.85],[0.58,0.35],[0.79,0.85],[0.92,0.43]] };
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
const LAYOUT_KEY='gxhub_wotw_layout', BINDS_KEY='gxhub_wotw_binds', MOVE_KEY='gxhub_wotw_move', FACE_KEY='gxhub_wotw_face';
// The movable battle controls: [id, editor label, w, h, default x, default y].
// Upgrade 17: the faces are CIRCLES now, so w==h==diameter for every
// battle control. The hierarchy kennin approved stands in the diameters:
// powers 76, the thumb cluster (auto-fire, GUARD, sprint) and
// BUILD/ORDERS 64, the command rank 56.
// Upgrade 20: the default seats move to natural phone-landscape THUMB
// ARCS (kennin: the buttons sat "on weird and awkward parts of the
// screen"). The powers arc down the bottom-right (the ult nearest the
// corner thumb), GUARD and SPRINT stand on the bottom-left rail for
// the left thumb, AUTO-FIRE keeps the top-right, CAMP and ORDERS ride
// the right rail above the powers, and nothing stands mid-screen or
// top-left but the readouts. The command row keeps its Full-face seats
// (x from 130, pitch 117, y 665). Dodge and Block no longer have seats
// of their own — they are one GUARD circle now (see the press grammar).
const LAYOUT_DEFS=[
  ['autofire','AUTO-FIRE',64,64,1178,76],['guard','GUARD',64,64,102,448],['sprint','SPRINT',64,64,102,548],
  ['skill0','Power 1',76,76,1178,368],['skill1','Power 2',76,76,1178,462],['skill2','Power 3',76,76,1178,556],
  ['cmd_charge','Charge',56,56,130,665],['cmd_hold','Hold',56,56,247,665],['cmd_follow','Follow Me',56,56,364,665],['cmd_flank','Flank',56,56,481,665],
  ['cmd_fallback','Fall Back',56,56,598,665],['cmd_shieldwall','Shield Wall',56,56,715,665],['cmd_volley','Volley',56,56,832,665],
  ['cmd_camp','CAMP',56,56,949,665],['cmd_rally','Rally',56,56,1066,665],
  ['build','BUILD',64,64,1130,665],['orders','ORDERS',64,64,1178,268]];
// --- Upgrade 17 → Upgrade 20: the battle faces -----------------------
// U17 gave the battle two faces: SIMPLE (the core circles plus ORDERS
// fanning the command rank) and FULL (every circle always visible).
// Upgrade 20 (kennin, live call 2026-10-31: the buttons "need to be
// like easier to press they're on weird and awkward parts of the
// screen" → "shortened down to just a few buttons and like the way you
// press them makes them do more things" → "Adjust it for the whole
// thing") renames SIMPLE to FEW and makes FEW the face of the WHOLE
// game: the default for everyone, on every platform. FEW stands only
// the three powers, GUARD, Sprint, the auto-fire toggle, CAMP and
// ORDERS — and the presses themselves do more (the press grammar,
// HOLD_MS below). FULL remains, exactly as approved before, for a
// player who actively chooses it.
// MIGRATION RULE, stated plainly: a face picked in Controls or the
// pause FROM Upgrade 20 onward is stamped (FACE_MIG_KEY) and always
// wins. A 'full' stored before Upgrade 20 is NOT honored on its own —
// the whole-thing ruling moves that player to FEW until they actively
// re-pick Full, which stamps the choice and restores it for good.
// U17's 'simple' simply reads as 'few'. Saved LAYOUTS and BINDS are
// untouched by all of this: seats and keys persist and apply in both
// faces exactly as before (the pre-U20 stack seats in an old layout
// still land where the player left those circles).
const FACE_MIG_KEY='gxhub_wotw_face_u20';
function hasPriorControls(){ try{ return !!(localStorage.getItem(LAYOUT_KEY)||localStorage.getItem(BINDS_KEY)||localStorage.getItem(MOVE_KEY)); }catch(e){ return false; } }
function loadFace(){ try{ const v=localStorage.getItem(FACE_KEY);
    if(v==='few'||v==='simple') return 'few';
    if(v==='full') return localStorage.getItem(FACE_MIG_KEY)==='1'?'full':'few'; }catch(e){}
  return 'few'; }
function saveFace(f){ try{ localStorage.setItem(FACE_KEY,f); }catch(e){} }
// An ACTIVE face choice (Controls / pause, Upgrade 20 onward): the
// stamp is what makes the choice win over the migration rule above.
function saveFaceChoice(f){ saveFace(f); try{ localStorage.setItem(FACE_MIG_KEY,'1'); }catch(e){} }
// The fan's members, in fan order, and where each stands relative to
// the ORDERS anchor (offsets from the anchor's seat, so the whole fan
// follows ORDERS wherever the player drags it — the fan is a GROUP in
// the Few face; individual seats belong to Full). Upgrade 20: ORDERS
// rides the right rail now, so the fan opens in its row above the bar
// extending LEFT from the anchor.
const FAN_MEMBERS=['cmd_charge','cmd_hold','cmd_follow','cmd_flank','cmd_fallback','cmd_shieldwall','cmd_volley','cmd_rally','build'];
const FAN_OFFSETS={ cmd_charge:{dx:-1048,dy:284}, cmd_hold:{dx:-964,dy:284}, cmd_follow:{dx:-880,dy:284}, cmd_flank:{dx:-796,dy:284},
  cmd_fallback:{dx:-712,dy:284}, cmd_shieldwall:{dx:-628,dy:284}, cmd_volley:{dx:-544,dy:284}, cmd_rally:{dx:-460,dy:284}, build:{dx:-372,dy:284} };
// In the Few face CAMP never hides — it rides the right rail directly
// above ORDERS, a fixed offset from the ORDERS seat, the fan-group
// pattern: drag ORDERS and CAMP rides with it; its own seat (949,665)
// belongs to the Full face's command row.
const CAMP_RAIL={dx:0,dy:-86};
// --- Upgrade 20: the press grammar -----------------------------------
// One press, two verbs: a TAP does the first thing, a HOLD (past
// HOLD_MS) does the second — and the player SEES the second verb
// coming: the circle's rim fills toward the hold in the same gold arc
// language as the cooldown rings (drawn from live press state by
// drawSkillSweep / drawFightUI / drawPressFx). The grammar:
//   GUARD     tap = Dodge          hold = Block (release ends it)
//   a power   tap = cast           hold = AIMED cast (drag the
//             reticle, release casts at that point; Smooth Stone's
//             hold is its aim the same way)
//   ORDERS    tap = fan open/close hold = RALLY, armed at once
//   CAMP      tap = camp panel     hold = quick Repair
//   AUTO-FIRE tap = toggle         hold = open the controls (pause)
// Sprint stays a tap toggle — it is a state, not a verb pair.
const HOLD_MS=280;
// A radial arc drawn from line segments only (the one graphics verb
// every surface in the game already trusts): the cooldown/charge
// language of the circular UI — sweeps and rings around the glyphs.
function arcSegs(g,cx,cy,r,a0,a1,w,col,alpha){ if(!g||a1<=a0) return; const steps=Math.max(2,Math.ceil((a1-a0)/0.24));
  g.lineStyle(w,col,alpha===undefined?1:alpha);
  for(let i=0;i<steps;i++){ const t0=a0+(a1-a0)*i/steps, t1=a0+(a1-a0)*(i+1)/steps;
    g.lineBetween(cx+Math.cos(t0)*r,cy+Math.sin(t0)*r,cx+Math.cos(t1)*r,cy+Math.sin(t1)*r); } }
function defaultLayoutPos(){ const o={}; LAYOUT_DEFS.forEach(d=>{ o[d[0]]={x:d[4],y:d[5]}; }); return o; }
function loadLayout(){ try{ const v=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null'); if(v&&v.pos&&typeof v.pos==='object') return v; }catch(e){} return null; }
function saveLayout(pos){ try{ localStorage.setItem(LAYOUT_KEY,JSON.stringify({pos})); }catch(e){} }
function resetLayout(){ try{ localStorage.removeItem(LAYOUT_KEY); }catch(e){} }
function layoutPositions(){ return Object.assign(defaultLayoutPos(),(loadLayout()||{pos:{}}).pos||{}); }
// Keybinds: [action id, Settings label]. The keyboard drives the SAME
// action functions the buttons drive (Game.keyAction) — no parallel
// logic. Defaults, chosen and recorded: Space is the GUARD key (the
// panic key under the thumb — Upgrade 20: tap it to dodge, hold it to
// block, the press grammar on one key), 1/2/3 are the powers in stack
// order, Q/E are the two targeting modes, B opens the camp, T flips
// auto-fire, and the orders sit on the Z X F G H J home row.
// Upgrade 20 migration: the old 'dodge' and 'block' actions retire
// into 'guard'. A stored set's explicit 'guard' wins; else a stored
// 'dodge' bind is inherited as the Guard key (the dodge key was the
// hand's home); the old 'block' key is freed.
const BIND_ACTIONS=[
  ['guard','Guard — tap: Dodge · hold: Block'],['sprint','Sprint'],['skill0','Power 1 (top)'],['skill1','Power 2'],['skill2','Power 3 (ult)'],['autofire','Auto-fire toggle'],['camp','Camp panel'],
  ['volley','Volley'],['rally','Rally'],['charge','Order: Charge'],['hold','Order: Hold'],['follow','Order: Follow Me'],['flank','Order: Flank'],['fallback','Order: Fall Back'],['shieldwall','Order: Shield Wall'],
  ['build','Build mode']]; // Upgrade 15: C for construction — free among the defaults
const DEFAULT_BINDS={ guard:'Space', sprint:'KeyV', skill0:'Digit1', skill1:'Digit2', skill2:'Digit3', autofire:'KeyT', camp:'KeyB',
  volley:'KeyQ', rally:'KeyE', charge:'KeyZ', hold:'KeyX', follow:'KeyF', flank:'KeyG', fallback:'KeyH', shieldwall:'KeyJ', build:'KeyC' };
function loadBinds(){ const b=Object.assign({},DEFAULT_BINDS);
  try{ const v=JSON.parse(localStorage.getItem(BINDS_KEY)||'null'); if(v&&typeof v==='object'){ BIND_ACTIONS.forEach(([id])=>{ if(typeof v[id]==='string'&&v[id]) b[id]=v[id]; });
    if(typeof v.guard!=='string'&&typeof v.dodge==='string'&&v.dodge) b.guard=v.dodge; } }catch(e){}
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
      // Upgrade 17: circle buttons are picked by their circle, panels by
      // their rectangle — the editor's hand obeys the same shape as the
      // player's. Either way the drag takes the button by its centre.
      const hit=(it.obj.circleR)?Math.hypot(p.x-it.obj.x,p.y-it.obj.y)<=it.obj.circleR:(Math.abs(p.x-it.obj.x)<=it.w/2&&Math.abs(p.y-it.obj.y)<=it.h/2);
      if(hit){ ed.drag={it,dx:p.x-it.obj.x,dy:p.y-it.obj.y}; return true; } }
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
  // Upgrade 17: opt.circle (a diameter) makes the face a CIRCLE. The
  // hit test is truly circular, enforced HERE from the pointer's own
  // local coordinates (lx/ly are in the container's centred frame —
  // the same frame the face is drawn in): a tap in the bounding
  // square's corner, outside the radius, never reaches the press
  // handlers at all, so it cannot fire, dip, or light the button —
  // it falls through to the field beneath. (The container's Phaser
  // hit area stays the default rectangle, a harmless superset: the
  // radius gate is the law, and it is exact under any Phaser version.)
  const circR=opt.circle?opt.circle/2:0; c.circleR=circR;
  const inCirc=(lx,ly)=>!circR||Math.hypot(lx||0,ly||0)<=circR;
  const draw=(hl)=>{g.clear();
    if(circR){ g.fillStyle(opt.disabled?0x2a2018:(hl?0x5a3a1e:0x3a2412),0.95); g.fillCircle(0,0,circR); g.lineStyle(3,opt.disabled?0x5a4a3a:0xd9a441,1); g.strokeCircle(0,0,circR); return; }
    g.fillStyle(opt.disabled?0x2a2018:(hl?0x5a3a1e:0x3a2412),0.95);g.fillRoundedRect(-w/2,-h/2,w,h,8);g.lineStyle(3,opt.disabled?0x5a4a3a:0xd9a441,1);g.strokeRoundedRect(-w/2,-h/2,w,h,8);};
  draw(false);
  // Upgrade 16: a button may wear a SYMBOL instead of its name — opt.icon
  // names a texture drawn by makeIcons(). The word survives only where it
  // belongs: as a small caption when opt.caption asks (the Controls
  // screen's ghost buttons, so the name sits beside the symbol while
  // learning the layout), and as the press float (opt.floatName) — a
  // press on a battle button briefly floats its name above it, the way
  // Upgrade 9 floats skill names, so the symbol teaches its meaning in
  // the moment. With an icon and no caption the label text is EMPTY and
  // hidden: no word stands on the button's face.
  let t;
  if(opt.icon){ const im=s.add.image(0,opt.caption?(circR?-9:-8):0,opt.icon); const disp=circR?opt.circle*0.64:Math.min(h*0.64,w*0.42); im.setScale(disp/ICON_SIZE); c.icon=im; c.iconKey=opt.icon;
    t=txt(s,0,opt.caption?h/2-12:0,opt.caption?label:'',opt.caption?11:(opt.size||20),opt.disabled?'#7a6a5a':PARCH).setOrigin(0.5);
    if(!opt.caption) t.setVisible(false); }
  else t=txt(s,0,0,label,opt.size||20,opt.disabled?'#7a6a5a':PARCH).setOrigin(0.5);
  c.add(c.icon?[g,c.icon,t]:[g,t]); c.setSize(w,h).setInteractive({useHandCursor:true});
  // Camp-Falls rider (2026-10-31): a HOVER speaks the name too — the
  // same press float, so a mouse player can learn the symbol family
  // by resting on a circle, not only by pressing it (floatBtnName
  // keeps a single float alive, so a sweep across the row cannot stack).
  c.on('pointerover',(p,lx,ly)=>{ if(inCirc(lx,ly)){ draw(true); if(opt.floatName&&s.floatBtnName) s.floatBtnName(c,opt.floatName); } }); c.on('pointerout',()=>{ c.setScale(1); draw(false); });
  // Upgrade 8: button weight — every button in the game presses like it has
  // mass: it dips and lights the instant a finger lands, and springs back on
  // release, so a press is felt before the action lands.
  c.on('pointerdown',(p,lx,ly)=>{ if(opt.disabled||!inCirc(lx,ly)) return; c.setScale(0.93); draw(true);
    if(opt.floatName&&s.floatBtnName) s.floatBtnName(c,opt.floatName); });
  c.on('pointerup',(p,lx,ly,e)=>{ if(e) e.stopPropagation(); c.setScale(1); draw(false); if(!inCirc(lx,ly)) return; SFX.unlock(); if(!opt.disabled) cb(); });
  c.label=t; c.redraw=draw; return c; }

// ---------- Upgrade 16: the symbol family ----------
// Kennin's ruling (voice, 2026-10-30): the battle buttons stop carrying
// WORDS and carry SYMBOLS. One coherent family, drawn in code at boot
// (Phaser Graphics -> generated textures; no emoji, no icon files, no
// text glyphs), in the game's gold-on-dark language, sized for the
// existing 110x56 / 196x56 faces. Names are not lost — they live in the
// Controls list, on the Controls ghosts as captions, and in the press
// float (Game.floatBtnName). Menus keep their words; only the battle
// faces change.
const ICON_SIZE=120;
const CMD_ICONS={charge:'ico_charge',hold:'ico_hold',follow:'ico_follow',flank:'ico_flank',fallback:'ico_fallback',shieldwall:'ico_shieldwall',volley:'ico_volley',camp:'ico_camp',rally:'ico_rally'};
const LAYOUT_ICONS={autofire:'ico_auto',guard:'ico_guard',sprint:'ico_sprint',skill0:'ico_burst',skill1:'ico_burst',skill2:'ico_burst',cmd_charge:'ico_charge',cmd_hold:'ico_hold',cmd_follow:'ico_follow',cmd_flank:'ico_flank',cmd_fallback:'ico_fallback',cmd_shieldwall:'ico_shieldwall',cmd_volley:'ico_volley',cmd_camp:'ico_camp',cmd_rally:'ico_rally',build:'ico_build',orders:'ico_banner'};
// A hero's power wears the symbol of what it IS: David's Psalm is a lyre,
// Five Stones is five stones in an arc, Smooth Stone one stone ringed.
// Other heroes resolve by their own names' plain meanings, with the
// eight-point burst as the family's generic power mark.
function skillIconKey(def){ const n=((def&&def.name)||'').toLowerCase();
  if(n.includes('five stones')) return 'ico_stones5';
  if(n.includes('psalm')||n.includes('song')) return 'ico_psalm';
  if(n.includes('stone')) return 'ico_stone1';
  if(n.includes('flame')||n.includes('fire')||n.includes('altar')||n.includes('chariot')) return 'ico_flame';
  if(n.includes('sea')||n.includes('geyser')||n.includes('wave')) return 'ico_wave';
  if(n.includes('palm')||n.includes('judgment')) return 'ico_palm';
  if(n.includes('sword')||n.includes('cleave')||n.includes('jawbone')) return 'ico_sword';
  if(n.includes('roar')) return 'ico_roar';
  if(n.includes('rally')) return 'ico_banner';
  if(n.includes('pitcher')) return 'ico_jar';
  if(n.includes('manna')||n.includes('meal')||n.includes('raven')) return 'ico_bowl';
  if(n.includes('pillar')) return 'ico_pillar';
  return 'ico_burst'; }
function makeIcons(scene){ if(!scene||!scene.make||!scene.make.graphics) return;
  const GOLD=0xd9a441, BRIGHT=0xf2c14e, PARCH=0xe8d9b0, INK=0x140c07, STONE=0x9a8a76;
  function tex(key,fn){ if(scene.textures&&scene.textures.exists&&scene.textures.exists(key)) return;
    const g=scene.make.graphics({x:0,y:0,add:false}); fn(g); g.generateTexture(key,ICON_SIZE,ICON_SIZE); g.destroy(); }
  function arc(g,cx,cy,r,a0,a1,w,col){ g.lineStyle(w,col,1); const N=16;
    for(let i=0;i<N;i++){ const t0=a0+(a1-a0)*i/N, t1=a0+(a1-a0)*(i+1)/N;
      g.lineBetween(cx+Math.cos(t0)*r,cy+Math.sin(t0)*r,cx+Math.cos(t1)*r,cy+Math.sin(t1)*r); } }
  function spark(g,cx,cy,r,col){ g.fillStyle(col,1);
    g.fillPoints([{x:cx,y:cy-r},{x:cx+r*0.26,y:cy-r*0.26},{x:cx+r,y:cy},{x:cx+r*0.26,y:cy+r*0.26},{x:cx,y:cy+r},{x:cx-r*0.26,y:cy+r*0.26},{x:cx-r,y:cy},{x:cx-r*0.26,y:cy-r*0.26}],true); }
  function shieldAt(g,cx,cy,s,col){ g.fillStyle(col,1);
    g.fillPoints([{x:cx,y:cy-30*s},{x:cx+22*s,y:cy-20*s},{x:cx+22*s,y:cy+6*s},{x:cx,y:cy+34*s},{x:cx-22*s,y:cy+6*s},{x:cx-22*s,y:cy-20*s}],true); }
  function head(g,x,y,ang,col){ const s=11; g.fillStyle(col,1);
    g.fillPoints([{x:x+Math.cos(ang)*s,y:y+Math.sin(ang)*s},{x:x+Math.cos(ang+2.5)*s*0.8,y:y+Math.sin(ang+2.5)*s*0.8},{x:x+Math.cos(ang-2.5)*s*0.8,y:y+Math.sin(ang-2.5)*s*0.8}],true); }
  tex('ico_psalm',g=>{ arc(g,60,50,25,Math.PI*0.12,Math.PI*0.88,7,GOLD); // the lyre's U
    g.lineStyle(6,GOLD,1); g.lineBetween(35,50,32,26); g.lineBetween(85,50,88,26);
    g.lineStyle(5,BRIGHT,1); g.lineBetween(30,27,90,27); // crossbar
    g.lineStyle(2,PARCH,1); [46,60,74].forEach(x=>g.lineBetween(x,31,x,58)); // strings
    g.lineStyle(6,GOLD,1); g.lineBetween(42,84,78,84); }); // base
  tex('ico_stones5',g=>{ for(let i=0;i<5;i++){ const a=Math.PI*(1.12+0.19*i), x=60+Math.cos(a)*27, y=64+Math.sin(a)*21;
      g.fillStyle(i%2?PARCH:GOLD,1); g.fillEllipse(x,y,19,14); } });
  tex('ico_stone1',g=>{ g.lineStyle(4,BRIGHT,1); g.strokeCircle(60,60,43);
    g.fillStyle(GOLD,1); g.fillEllipse(60,62,36,25); g.fillStyle(PARCH,1); g.fillEllipse(53,56,13,8); });
  tex('ico_flame',g=>{ g.fillStyle(GOLD,1);
    g.fillPoints([{x:60,y:18},{x:76,y:52},{x:84,y:66},{x:78,y:88},{x:66,y:98},{x:52,y:98},{x:40,y:86},{x:38,y:64},{x:48,y:46}],true);
    g.fillStyle(PARCH,1); g.fillEllipse(60,80,17,24); });
  tex('ico_wave',g=>{ arc(g,44,52,20,Math.PI*1.05,Math.PI*2.15,6,GOLD); arc(g,76,70,20,Math.PI*1.05,Math.PI*2.15,6,BRIGHT);
    arc(g,44,86,20,Math.PI*1.05,Math.PI*2.0,6,STONE); });
  tex('ico_palm',g=>{ g.lineStyle(5,GOLD,1); g.lineBetween(60,98,60,44);
    [[-38,-6],[-26,-22],[0,-30],[26,-22],[38,-6]].forEach(([dx,dy])=>{ g.lineStyle(4,BRIGHT,1); g.lineBetween(60,48,60+dx,48+dy); }); });
  tex('ico_sword',g=>{ g.lineStyle(9,GOLD,1); g.lineBetween(38,82,76,44); // blade
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:82,y:26},{x:86,y:40},{x:72,y:46}],true); // tip
    g.lineStyle(6,PARCH,1); g.lineBetween(30,66,48,84); // guard
    g.lineStyle(6,STONE,1); g.lineBetween(34,80,26,88); g.fillStyle(BRIGHT,1); g.fillCircle(24,90,5); }); // grip + pommel
  tex('ico_roar',g=>{ g.fillStyle(BRIGHT,1); g.fillCircle(44,60,7);
    arc(g,44,60,17,-0.9,0.9,5,GOLD); arc(g,44,60,29,-0.9,0.9,5,GOLD); arc(g,44,60,41,-0.9,0.9,5,STONE); });
  tex('ico_banner',g=>{ g.lineStyle(5,GOLD,1); g.lineBetween(42,20,42,98);
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:42,y:24},{x:86,y:32},{x:74,y:44},{x:86,y:54},{x:42,y:52}],true);
    g.fillStyle(GOLD,1); g.fillCircle(42,18,5); });
  tex('ico_jar',g=>{ g.fillStyle(GOLD,1); g.fillEllipse(60,68,44,52);
    g.fillRect(50,26,20,14); g.fillStyle(BRIGHT,1); g.fillPoints([{x:66,y:28},{x:88,y:40},{x:64,y:44}],true);
    g.fillStyle(INK,1); g.fillEllipse(60,30,16,7); });
  tex('ico_bowl',g=>{ g.fillStyle(GOLD,1); const pts=[]; for(let i=0;i<=12;i++){ const a=Math.PI*i/12; pts.push({x:60+Math.cos(a)*36,y:62+Math.sin(a)*22}); }
    g.fillPoints(pts,true); g.lineStyle(4,BRIGHT,1); g.lineBetween(24,62,96,62);
    g.fillStyle(PARCH,1); [44,60,76].forEach((x,i)=>g.fillCircle(x,40-(i===1?8:0),5)); });
  tex('ico_pillar',g=>{ g.fillStyle(GOLD,1); g.fillRect(28,26,64,9); g.fillRect(28,86,64,9);
    g.fillRect(36,38,13,45); g.fillRect(71,38,13,45); g.fillStyle(BRIGHT,1); g.fillRect(28,26,64,4); });
  tex('ico_burst',g=>{ for(let i=0;i<8;i++){ const a=Math.PI*i/4; g.lineStyle(i%2?4:6,i%2?STONE:GOLD,1);
      g.lineBetween(60+Math.cos(a)*10,60+Math.sin(a)*10,60+Math.cos(a)*32,60+Math.sin(a)*32); }
    g.fillStyle(BRIGHT,1); g.fillCircle(60,60,8); });
  tex('ico_dodge',g=>{ arc(g,62,66,27,Math.PI*1.02,Math.PI*1.98,8,BRIGHT); // the swoosh
    head(g,90,62,-0.5,GOLD); arc(g,58,84,20,Math.PI*1.1,Math.PI*1.8,5,GOLD); });
  tex('ico_block',g=>{ shieldAt(g,60,58,1.05,GOLD); shieldAt(g,60,58,0.78,INK);
    g.lineStyle(4,PARCH,1); g.lineBetween(60,36,60,82); g.lineBetween(43,52,77,52); });
  // Upgrade 20: GUARD — the shield with the dodge swoosh across it:
  // one circle, both verbs (tap slips, hold stands). ico_dodge and
  // ico_block above stay in the family (drawn, unassigned) so nothing
  // that names them can break; GUARD is the face the hand learns now.
  tex('ico_guard',g=>{ shieldAt(g,56,56,0.98,GOLD); shieldAt(g,56,56,0.72,INK);
    g.lineStyle(4,PARCH,1); g.lineBetween(56,34,56,78); g.lineBetween(40,50,72,50);
    arc(g,64,88,26,Math.PI*1.05,Math.PI*1.95,6,BRIGHT); head(g,90,84,-0.5,BRIGHT); });
  tex('ico_sprint',g=>{ g.fillStyle(GOLD,1); // the boot: leg, then foot
    g.fillPoints([{x:42,y:22},{x:62,y:22},{x:62,y:56},{x:88,y:70},{x:88,y:84},{x:42,y:84}],true);
    g.lineStyle(5,BRIGHT,1); g.lineBetween(38,86,90,86); // sole
    g.lineStyle(5,BRIGHT,1); g.lineBetween(12,40,30,40); g.lineBetween(8,56,30,56); g.lineBetween(12,72,30,72); }); // speed lines
  tex('ico_charge',g=>{ g.lineStyle(8,GOLD,1); g.lineBetween(34,86,80,40); g.lineStyle(8,STONE,1); g.lineBetween(86,86,40,40);
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:88,y:24},{x:90,y:40},{x:76,y:44}],true); g.fillPoints([{x:32,y:24},{x:44,y:44},{x:30,y:40}],true);
    g.lineStyle(5,PARCH,1); g.lineBetween(28,68,44,84); g.lineBetween(92,68,76,84); });
  tex('ico_hold',g=>{ g.lineStyle(5,GOLD,1); g.lineBetween(52,22,52,86); // planted pole
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:52,y:26},{x:88,y:34},{x:52,y:46}],true); // grounded flag
    g.lineStyle(6,STONE,1); g.lineBetween(28,90,92,90); // the ground it holds
    g.fillStyle(GOLD,1); g.fillPoints([{x:44,y:90},{x:60,y:78},{x:76,y:90}],true); }); // mound
  tex('ico_follow',g=>{ spark(g,84,32,13,BRIGHT); // the star to move toward
    g.fillStyle(GOLD,1); g.fillEllipse(36,76,15,21); g.fillStyle(PARCH,1); g.fillEllipse(54,56,15,21); // footsteps
    arc(g,52,84,30,Math.PI*1.25,Math.PI*1.85,4,STONE); });
  tex('ico_flank',g=>{ g.fillStyle(STONE,1); g.fillRect(52,42,16,36); // the center block
    arc(g,60,60,33,Math.PI*0.72,Math.PI*1.28,6,GOLD); head(g,38,80,2.2,GOLD); // left hook
    arc(g,60,60,33,-Math.PI*0.28,Math.PI*0.28,6,BRIGHT); head(g,82,80,0.94,BRIGHT); }); // right hook
  tex('ico_fallback',g=>{ shieldAt(g,36,60,0.8,GOLD); // the shield behind
    g.lineStyle(7,BRIGHT,1); g.lineBetween(92,60,54,60); head(g,50,60,Math.PI,BRIGHT); }); // the arrow back to it
  tex('ico_shieldwall',g=>{ shieldAt(g,33,60,0.66,GOLD); shieldAt(g,60,60,0.66,BRIGHT); shieldAt(g,87,60,0.66,GOLD); });
  tex('ico_volley',g=>{ [[30,26],[48,20],[66,20],[84,26]].forEach(([x,y],i)=>{ g.lineStyle(5,i%2?GOLD:BRIGHT,1);
      g.lineBetween(x+16,y+34,x,y); head(g,x-2,y-4,Math.PI*1.25,i%2?GOLD:BRIGHT); }); // the fan, arcing down
    g.lineStyle(3,PARCH,1); g.strokeCircle(74,92,9); }); // the marked spot
  tex('ico_camp',g=>{ g.fillStyle(GOLD,1); g.fillPoints([{x:60,y:24},{x:94,y:88},{x:26,y:88}],true); // the tent
    g.fillStyle(INK,1); g.fillPoints([{x:60,y:54},{x:74,y:88},{x:46,y:88}],true); // its door
    g.lineStyle(4,BRIGHT,1); g.lineBetween(60,24,60,12); g.fillStyle(BRIGHT,1); g.fillPoints([{x:60,y:6},{x:76,y:10},{x:60,y:15}],true); });
  tex('ico_rally',g=>{ g.lineStyle(5,GOLD,1); g.lineBetween(56,16,56,84); // the planted banner
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:56,y:20},{x:92,y:28},{x:80,y:38},{x:92,y:48},{x:56,y:46}],true);
    g.lineStyle(4,GOLD,1); g.strokeCircle(56,88,17); }); // the ring it holds
  tex('ico_build',g=>{ g.fillStyle(STONE,1); g.fillRect(38,52,9,40); g.fillRect(74,52,9,40); // fence posts
    g.fillStyle(GOLD,1); g.fillRect(28,60,64,11); g.fillRect(28,76,64,11); // its boards
    g.lineStyle(7,PARCH,1); g.lineBetween(40,50,66,26); // hammer handle
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:58,y:14},{x:84,y:22},{x:78,y:36},{x:54,y:28}],true); }); // hammer head
  tex('ico_auto',g=>{ arc(g,60,60,42,-Math.PI*0.35,Math.PI*0.95,6,STONE); head(g,100,44,-0.6,BRIGHT); // the circular arrow
    arc(g,54,60,21,-Math.PI*0.42,Math.PI*0.42,6,GOLD); // the bow
    g.lineStyle(3,PARCH,1); const a=Math.PI*0.42; g.lineBetween(54+Math.cos(-a)*21,60+Math.sin(-a)*21,54+Math.cos(a)*21,60+Math.sin(a)*21); }); // its string
  // --- Upgrade 18: the arsenal's glyphs (the armory, the reveal, the hero's marker) ---
  tex('wpn_sling',g=>{ g.lineStyle(6,GOLD,1); g.lineBetween(60,96,60,58); g.lineBetween(60,58,40,30); g.lineBetween(60,58,80,30); // the fork
    g.lineStyle(3,PARCH,1); g.lineBetween(40,30,86,44); g.lineBetween(80,30,86,44); // the straps
    g.fillStyle(BRIGHT,1); g.fillEllipse(90,44,15,12); }); // the stone, loaded
  tex('wpn_bow',g=>{ arc(g,52,60,40,-Math.PI*0.42,Math.PI*0.42,6,GOLD); // the bow
    g.lineStyle(3,PARCH,1); const a=Math.PI*0.42; g.lineBetween(52+Math.cos(-a)*40,60+Math.sin(-a)*40,52+Math.cos(a)*40,60+Math.sin(a)*40); // its string
    g.lineStyle(4,BRIGHT,1); g.lineBetween(38,60,88,60); head(g,92,60,0,BRIGHT); // the arrow, drawn
    g.lineStyle(3,STONE,1); g.lineBetween(38,60,30,52); g.lineBetween(38,60,30,68); });
  tex('wpn_sword',g=>{ g.lineStyle(9,GOLD,1); g.lineBetween(60,66,60,26); // the blade, upright
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:60,y:8},{x:66,y:26},{x:54,y:26}],true); // its point
    g.lineStyle(6,PARCH,1); g.lineBetween(38,70,82,70); // the guard
    g.lineStyle(7,STONE,1); g.lineBetween(60,74,60,94); g.fillStyle(BRIGHT,1); g.fillCircle(60,100,6); }); // grip + pommel
  tex('wpn_spear',g=>{ g.lineStyle(6,STONE,1); g.lineBetween(34,94,78,42); // the long shaft
    g.fillStyle(BRIGHT,1); g.fillPoints([{x:92,y:14},{x:96,y:34},{x:76,y:44},{x:72,y:24}],true); // the leaf head
    g.lineStyle(3,GOLD,1); g.lineBetween(72,44,82,34); });
  tex('wpn_pistol',g=>{ g.fillStyle(GOLD,1); g.fillRect(22,34,66,13); // the barrel
    g.fillStyle(BRIGHT,1); g.fillRect(82,36,12,9); // the muzzle
    g.fillStyle(STONE,1); g.fillPoints([{x:34,y:47},{x:52,y:47},{x:46,y:88},{x:30,y:88}],true); // the grip
    g.fillStyle(GOLD,1); g.fillCircle(58,30,6); g.fillRect(28,28,10,6); }); // hammer + sight
  tex('wpn_rifle',g=>{ g.fillStyle(GOLD,1); g.fillRect(14,40,78,10); // the long barrel
    g.fillStyle(BRIGHT,1); g.fillRect(92,42,12,6); // the muzzle
    g.fillStyle(STONE,1); g.fillPoints([{x:14,y:50},{x:44,y:50},{x:38,y:66},{x:12,y:62}],true); // the stock
    g.fillStyle(STONE,1); g.fillPoints([{x:56,y:50},{x:68,y:50},{x:64,y:74},{x:54,y:74}],true); // the grip
    g.lineStyle(3,PARCH,1); g.lineBetween(52,40,52,30); g.lineBetween(76,40,76,32); }); // the sights
  tex('wpn_scatter',g=>{ g.fillStyle(GOLD,1); g.fillRect(26,32,58,10); g.fillRect(26,50,58,10); // twin barrels, wide
    g.fillStyle(BRIGHT,1); g.fillCircle(88,37,6); g.fillCircle(88,55,6); // the open mouths
    g.fillStyle(STONE,1); g.fillPoints([{x:26,y:60},{x:50,y:60},{x:42,y:78},{x:22,y:74}],true); g.fillPoints([{x:58,y:60},{x:70,y:60},{x:66,y:84},{x:56,y:84}],true); });
  tex('wpn_bible',g=>{ g.fillStyle(PARCH,1); // the open book, honored — parchment pages, gold cover beneath
    g.fillPoints([{x:60,y:44},{x:38,y:36},{x:20,y:40},{x:20,y:84},{x:38,y:80},{x:60,y:88}],true);
    g.fillPoints([{x:60,y:44},{x:82,y:36},{x:100,y:40},{x:100,y:84},{x:82,y:80},{x:60,y:88}],true);
    g.fillStyle(GOLD,1); g.fillPoints([{x:60,y:92},{x:36,y:84},{x:16,y:88},{x:16,y:92},{x:104,y:92},{x:104,y:88},{x:84,y:84},{x:60,y:92}],true);
    g.lineStyle(2,STONE,1); [34,46,70,84].forEach(x=>{ g.lineBetween(x,50,x+(x<60?2:-2),74); }); // the written lines
    g.lineStyle(4,BRIGHT,1); g.lineBetween(60,10,60,28); g.lineBetween(51,18,69,18); // the cross of light above it
    spark(g,88,20,8,BRIGHT); spark(g,32,16,6,GOLD); });
}

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
  'Tip: Your hero strikes on his own — auto-fire. The AUTO-FIRE circle (top right) turns it off if you want power moves only; hold it to open the controls.',
  'Tip: New to the wall? The Tutorial on the menu teaches the whole fight at the camp — no danger, no timer.',
  'Tip: Rally plants a banner: HOLD the ORDERS circle (or tap Rally in its open rank), then tap the ground — the selected squad, or the whole army, moves to it and holds.',
  'Tip: GUARD does both: TAP it to dodge — untouchable for a blink — or HOLD it to block and soften a blow (a boss heavy still lands through it). Sprint in, strike the opener, get out.',
  'Tip: Your squads hold their ground until you direct them — tap a squad, then tap where it should post up. Orders from the command bar go to the selected squad, or to the whole army when your hero is selected.',
  'Tip: The camp can be cared for mid-wave — tap the camp or the CAMP button to Fortify, Repair, and light the Watch Fire without leaving the fight. HOLD CAMP and the Repair is bought at once.',
  'Tip: Seasons bring their own chests — the Hallows Chest stands open Oct 25 – Nov 7. Elites and champions drop it in season, and the Chests panel sells it for Grokonians. Its gift cards fill the Album; finish a set and it pays.',
  'Tip: Tap an orb once and your hero will walk up and buy it — watch for the banner: it names the power and what it does.',
  'Tip: Between waves, step out of the shop: gather wood from trees and stone from rocks, and BUILD fences and walls around the camp. Worn pieces can be mended; the enemy road can be funneled, never sealed.'
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
    this.load.once('complete',()=>{ DATA=this.cache.json.get('data'); Progress.init(this.cache.json.get('prog'),DATA); Levels.init(this.cache.json.get('worlds'),DATA.enemies); ERAS=this.cache.json.get('eras'); UNITS=this.cache.json.get('units'); makeArt(this); makeArt2(this); makeIcons(this);
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
    const m=button(this,725,510,140,50,'Sound: '+((SFX.volume&&SFX.volume()===0)?'off':'on'),()=>{ m.label.setText('Sound: '+(SFX.toggle()?'off':'on')); },{size:16});
    const mu=button(this,875,510,140,50,'Music: '+(Music.enabled()?'on':'off'),()=>{ mu.label.setText('Music: '+(Music.toggle()?'on':'off')); },{size:16});
    // Upgrade 12: the Controls door — movement scheme, keybinds and the
    // button-layout editor live in the Settings scene.
    button(this,1112,510,300,50,'Controls',()=>this.scene.start('Settings'),{size:20});
    const fsMenuBtn=button(this,1150,42,220,46,'Fullscreen',()=>{ if(fullscreenRoute(this)==='native'){ try{ this.scale.startFullscreen(); }catch(e){} } },{size:17});
    if(displayMode().mode==='standalone') fsMenuBtn.setVisible(false);
    // Upgrade 18: the Armory's front door — the Rack, where found
    // weapons are kept and the carried one is chosen.
    button(this,130,42,220,46,'Armory',()=>this.scene.start('Armory',{from:'Menu'}),{size:17});
    // Upgrade 19: the Chests door — the seasons' calendar, seasonal
    // chests for sale in Grokonians, and the road to the card Album.
    button(this,378,42,230,46,'Chests',()=>this.scene.start('Chests',{from:'Menu'}),{size:17});
    // Upgrade 11: the tutorial's front door — always here, never locked,
    // replayable any time. It runs the Bible era with David, the hero the
    // lesson is written for (its power step names Psalm and Five Stones).
    button(this,W/2-160,566,280,38,'Tutorial',()=>this.scene.start('Game',{hero:'david',level:{era:'bible'},tutorial:true}),{size:18});
    // Multiplayer (Slice 1): the Play Together door — NetLobby lives in
    // js/net.js and registers itself with the running game from there.
    button(this,W/2+160,566,280,38,'Play Together',()=>this.scene.start('NetLobby'),{size:18});
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
    // Upgrade 18: the Armory stands beside the heroes, too — choose the
    // weapon before you choose who carries it.
    button(this,1160,36,180,40,'Armory',()=>this.scene.start('Armory',{from:'HeroSelect',fromData:{browse:this.browse,level:this.level}}),{size:16});
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
    this.msg=txt(this,W/2,632,'',18,'#f2c14e').setOrigin(0.5);
    // Upgrade 14: the era screen names the week's law before anyone marches.
    const tw=currentTwist(); this.msg.setText('This week in the Bible era: '+tw.name+' — '+tw.blurb); }
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
    // Upgrade 3: camp HP replaces lives. Camp-Falls (kennin's ruling,
    // restated 2026-10-31): the camp is the RESPAWN, not the defeat
    // meter — the run ends only when the hero falls with no camp
    // standing to bring him back (see campFall / hurtHero).
    this.campHp=CAMP_MAX; this.campHurtThisWave=false; this.campHurtTotal=false; this.campWarnedWave=0;
    this.campSndFirst=false; this.campSndHalf=false; this.campSndQuarter=false; // Upgrade 13: camp threshold drums, once per run each
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
    this.paused=false; this.layoutEdit=false; this.layoutReg=[]; this.pauseItems=[]; this.editItems=[]; this._iosFsPanel=null;
    // Upgrade 17 → 20: the battle face. The tutorial always teaches
    // FEW (the fan and the press grammar are the lesson); a real run
    // takes the player's own face by loadFace()'s migration rule —
    // FEW for everyone unless Full was actively re-picked after
    // Upgrade 20. The fan starts closed; seatPos remembers every
    // control's layout seat apart from where the fan may be standing
    // it right now.
    this.face=this.tutorial?'few':loadFace(); this.fanOpen=false; this._fanShown=false; this.seatPos={};
    // Upgrade 20: the press grammar's live state — one record per
    // pressable kind, {t0, held, id} while a press is down. tickPresses
    // crosses a press into its HOLD verb at HOLD_MS; endPresses
    // resolves the release into its TAP verb when the hold never came.
    // skillAim is the aimed cast's reticle point (world coordinates).
    this.guardPress=null; this.skillPress=null; this.ordersPress=null; this.campPress=null; this.afPress=null; this.skillAim=null;
    // Upgrade 14: the week's law rides a Bible run (null in other eras,
    // and null in the tutorial, whose economy firewall stays sealed).
    // seventhT/seventhAcc are the Seventh Day's rest clock and its manna
    // drip accumulator, driven by update() while the held-back wave waits.
    this.twist=(!this.tutorial&&this.eraId==='bible')?currentTwist().id:null; this.seventhT=0; this.seventhAcc=0;
    // Upgrade 15: gather & build state — the run's wood/stone purse, the
    // field's resource nodes, the pieces built from them, build mode and
    // its bar, and the intermission spent on the field (the shop's other
    // room, on the shop's own deadline).
    this.wood=0; this.stone=0; this.builds=[]; this.nodes=[]; this.buildMode=false; this.buildTool='fence'; this.gatherT=0;
    this.interField=false; this.buildItems=[]; this.interItems=[]; this.buildBarRect=null; this.interBtnRects=[]; this.buildBtnRect=null;
    // Upgrade 18: the carried weapon — the Rack's equipped piece,
    // resolved. The tutorial always teaches the starter sling (the
    // lesson's weapon), whatever the Rack holds. pendingChests are the
    // banked chests waiting for this intermission (the Rack keeps them
    // between runs); fieldChests lie on the field, unbanked; the
    // reveal queue is the intermission's opening ceremony.
    this.weaponKey=this.tutorial?'sling:0':Rack.equippedKey();
    // The starter is not a found weapon: while it is what the Rack
    // holds, every hero fights with HIS OWN HAND — his innate damage,
    // rate, range and type, delivered as it always was (a melee blow
    // at hand range, a stone or an ember beyond it). That is what
    // "the starter preserves today's behavior" means for the whole
    // roster, Samson's jawbone and Deborah's holy ember included; for
    // David the innate profile IS the Common sling, number for number.
    // The moment a found weapon is equipped, its pattern takes over.
    if(this.weaponKey==='sling:0'){ const hd0=this.heroDef;
      this.weapon={ family:'innate', key:'sling:0', tier:0, tierName:'Innate', name:hd0.name+'\'s own hand', familyName:'His own hand',
        type:hd0.dmgType, dmg:hd0.dmg, rate:hd0.rate, range:hd0.range, crit:0.10, proj:hd0.dmgType==='holy'?'ember':'stone',
        arc:0, pierce:0, pellets:0, critMul:1, traitName:'His Own Hand', trait:'' }; }
    else { const wp=parseWeaponKey(this.weaponKey); this.weapon=resolveWeapon(wp.family,wp.tier,wp.variant); }
    this.bibleT=null; this._verseI=0;
    this.fieldChests=[]; this.pendingChests=this.tutorial?[]:Rack.pending();
    this.revealQueue=[]; this.revealItems=[]; this.revealPanel=false; this.lootFound=[];
    this.freeOrbs=0; } // Upgrade 19: orb treats (seasonal bundle gifts) — free orb touches banked for THIS run
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
    this.buildGhost=this.add.graphics().setDepth(19); // Upgrade 15: the build-mode placement ghost (world layer)
    this.buildHero(); this.buildOrbs(); this.buildNodes(); this.buildHUD();
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
    this.aimFx=this.add.graphics().setDepth(18); // Upgrade 20: the aimed cast's reticle (world layer)
    this.pressFx=this.add.graphics().setDepth(33).setScrollFactor(0); // Upgrade 20: hold-fill rims for the circles without a sweep of their own (screen layer)
    // Upgrade 11: a tutorial run opens on its first lesson instead of the
    // shop — no wave ever starts here (waveActive never turns on), so no
    // shop, no victory screen and no end() can ever fire in the tutorial.
    if(this.tutorial){ this.startTutorial(); }
    else { this.toast(this.era.name+' — Goal: survive wave '+this.goalWave+(this.era.verse?'\n'+this.era.verse:'')+(this.twist?'\nThis week\'s law: '+this.twistDef().name+' — '+this.twistDef().blurb:'')+'\nCarrying: '+this.weapon.name,4200); this.openShop(true); }
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
    // Upgrade 17: the row is a rank of CIRCLES now (56 across, same
    // seats). In the Simple face these buttons are fan members: their
    // presses arrive wrapped so issuing from the fan closes it behind
    // the order (fanPress) — the action itself is the same function
    // the Full face and the keyboard have always called.
    cmds.forEach(([id,label],i)=>{ const b=button(this,130+i*117,HUD_Y+55,56,56,'',()=>this.fanPress(()=>this.giveOrder(id)),{size:16,icon:CMD_ICONS[id],floatName:label,circle:56}); b.setDepth(31); this.cmdBtns[id]=b; this.regLayout('cmd_'+id,b,null); });
    const vb=button(this,130+6*117,HUD_Y+55,56,56,'',()=>this.fanPress(()=>this.pressVolley()),{size:16,icon:CMD_ICONS.volley,floatName:'Volley',circle:56}); vb.setDepth(31); this.cmdBtns.volley=vb; this.regLayout('cmd_volley',vb,(x,y)=>{ vb.sx=x; vb.sy=y; });
    // Upgrade 8: Volley carries a cooldown sweep like the skill buttons
    // (Upgrade 17: the sweep is a ring around the circle now — vb.sx/sy
    // follow the button's ACTIVE centre, kept by applyFace).
    vb.sx=130+6*117; vb.sy=HUD_Y+55; vb.sw=56; vb.sh=56; vb.sweep=this.add.graphics().setDepth(32);
    // Upgrade 9: the active-buff chips — each live orb power wears a labeled
    // chip (color disc + name + seconds) under the stat lines, so what the
    // hero is carrying is readable at a glance, not just a timer line.
    this.buffGfx=this.add.graphics().setDepth(32);
    this.buffChipTxts=[0,1,2].map(()=>txt(this,0,0,'',13,'#ffffff').setDepth(33).setVisible(false));
    // Upgrade 9: the CAMP button — the camp's care, one tap away mid-wave.
    // Upgrade 10: it rides the command row now, as the approved sketch
    // draws it — camp care sits with the army's orders. Same panel, same
    // CAMP_UPGRADES / CAMP_REPAIR state and prices behind it.
    // Upgrade 20: CAMP is a press-grammar button — TAP opens the camp
    // panel, HOLD quick-repairs — so its shared-helper callback is a
    // no-op and the press wiring (wirePress) drives both verbs.
    this.campBtn=button(this,130+7*117,HUD_Y+55,56,56,'',()=>{},{size:16,icon:CMD_ICONS.camp,floatName:'Camp',circle:56}); this.campBtn.setDepth(31);
    this.campBtnRect={x:130+7*117,y:HUD_Y+55,w:56,h:56};
    this.regLayout('cmd_camp',this.campBtn,(x,y)=>{ this.campBtnRect={x,y,w:56,h:56}; });
    this.wirePress(this.campBtn,'camp');
    // Upgrade 10 (approved addition): RALLY — the ninth seat on the row.
    // The whole row shifted left (start x 130) so Rally sits at the same
    // 110x56 as every other seat instead of shrinking any button. Tap
    // Rally, then tap the ground: the banner is planted there and the
    // selected squad — or the whole army, hero selected — moves to it
    // and holds (plantRally).
    this.rallyBtn=button(this,130+8*117,HUD_Y+55,56,56,'',()=>this.fanPress(()=>this.pressRally()),{size:16,icon:CMD_ICONS.rally,floatName:'Rally',circle:56}); this.rallyBtn.setDepth(31);
    this.rallyBtnRect={x:130+8*117,y:HUD_Y+55,w:56,h:56}; // Upgrade 11: where the tutorial's ring finds Rally (applyFace keeps it on the ACTIVE circle)
    this.regLayout('cmd_rally',this.rallyBtn,(x,y)=>{ this.rallyBtnRect={x,y,w:56,h:56}; });
    // Upgrade 17: ORDERS — the Few face's fan anchor, a banner circle.
    // Upgrade 20: it rides the right rail above the powers (its
    // default seat, 1178,268), and it is a press-grammar button —
    // TAP fans the command rank open above the bar; HOLD arms RALLY
    // at once, the fan never opening. In the Full face it is hidden
    // (every command already stands). Its seat is a layout seat like
    // any other, and CAMP's rail spot and the fan's spots are all
    // measured from it — the group rides the anchor.
    this.ordersBtn=button(this,1178,268,64,64,'',()=>{},{size:16,icon:'ico_banner',floatName:'Orders',circle:64}); this.ordersBtn.setDepth(31);
    this.regLayout('orders',this.ordersBtn,(x,y)=>{ if(this.face==='few'&&(this.fanOpen||this._fanShown)) this.applyFace(); });
    this.wirePress(this.ordersBtn,'orders');
    // Upgrade 10: the hero's power buttons are built in
    // buildFightControls() now — they ride the right-thumb stack under
    // the AUTO-FIRE toggle, as the approved sketch draws them.
    // Upgrade 17: the speed toggle is a battle control, so it joins the
    // circles (44 across, its word shrunk to the 'x1' it always showed).
    // Fullscreen stays a rectangle by exception: it is a display
    // utility whose whole word is its meaning, and no circle that fits
    // the corner could carry it — noted in BUILD-NOTES, not hidden.
    this.spdBtn=button(this,1221,HUD_Y+80,44,44,'x1',()=>{ this.speed=this.speed===1?2:1; this.spdBtn.label.setText('x'+this.speed); },{size:15,circle:44}).setDepth(31);
    const fsb=button(this,1221,HUD_Y+26,110,36,'Fullscreen',()=>{ if(fullscreenRoute(this)==='native'){ try{ this.scale.startFullscreen(); }catch(e){} } },{size:13}); fsb.setDepth(31); this.fsb=fsb;
    if(displayMode().mode==='standalone') fsb.setVisible(false);
    // Upgrade 12: the pause/settings entry — a small ⚙ above the fight
    // stack. It opens the pause overlay (movement scheme, the layout
    // editor, resume, quit), and its rect is walled in onTap like the
    // CAMP button's: a tap on it is a button press, never a march order.
    this.pauseBtn=button(this,1246,20,40,40,'⚙',()=>this.openPause(),{size:16,circle:40}); this.pauseBtn.setDepth(31);
    this.pauseBtnRect={x:1246,y:20,w:40,h:40};
    // Upgrade 15: the BUILD button — the right column's eighth seat,
    // directly under the power stack in the same 196x56 family (its
    // bottom edge, 596, still clears the command bar). It is command
    // furniture, not a fight input: it does NOT join fightRects (the
    // Upgrade-10 stack wall stays exactly seven), it keeps its own
    // onTap wall like CAMP and ⚙, and it registers in the layout
    // system like every other battle control.
    // Upgrade 17: BUILD is a 64 circle at the row's right end — its old
    // seat under the stack belongs to the grown power circles now. In
    // the Simple face it is the fan's last member; buildBtnRect always
    // names its ACTIVE circle (fan position while the fan stands).
    this.buildBtn=button(this,1130,HUD_Y+55,64,64,'',()=>this.fanPress(()=>this.toggleBuildMode()),{size:16,icon:'ico_build',floatName:'Build',circle:64}); this.buildBtn.setDepth(31);
    this.buildBtnRect={x:1130,y:HUD_Y+55,w:64,h:64};
    this.regLayout('build',this.buildBtn,(x,y)=>{ this.buildBtnRect={x,y,w:64,h:64}; });
    this.buildFightControls(); // Upgrade 8: the right-hand fight cluster
    this.refreshHUD(); this.fixUI(); }
  phaseName(){ return this.wave>0&&this.isNightWave(this.wave)?'Night':'Day'; }
  refreshHUD(){ const goalTxt=this.endless?'∞ (goal cleared)':String(this.goalWave);
    this.stat.setText('Manna '+Math.floor(this.manna)+'   Camp '+Math.max(0,Math.ceil(this.campHp))+'/'+this.campMax+'   Wave '+this.wave+'/'+goalTxt+'   '+(this.waveActive?this.phaseName():'')+'   Grokonians +'+this.earned+'   '+this.heroDef.name+'   Squads '+this.squads.length+'/'+this.squadCap+'   Wood '+Math.floor(this.wood||0)+' · Stone '+Math.floor(this.stone||0));
    // Upgrade 9: the order line names WHO the command bar speaks to — the
    // selected squad and its own order, or the army order when the hero is
    // selected.
    const selAlive=this.selSquad&&!this.selSquad.dead, disp=selAlive?(this.selSquad.ord||this.order):this.order;
    if(selAlive) this.orderTxt.setText('Squad: '+this.selSquad.def.name+' — '+(this.selSquad.ord==='post'?'Posted':(disp==='rally'?'Rally':(ORDER_NAMES[disp]||disp)))+(this.volleyMode?'   •   VOLLEY: tap a spot':'')+(this.rallyMode?'   •   RALLY: tap a spot':''));
    else this.orderTxt.setText('Order: '+(this.order==='rally'?'Rally':ORDER_NAMES[this.order])+(this.volleyMode?'   •   VOLLEY: tap a spot':'')+(this.rallyMode?'   •   RALLY: tap a spot':''));
    if(this.buffTxt){ const bp=[]; if(this.buffStrT>0) bp.push('STR '+Math.ceil(this.buffStrT)+'s'); if(this.buffSpdT>0) bp.push('SPD '+Math.ceil(this.buffSpdT)+'s'); if(this.buffIronT>0) bp.push('IRON '+Math.ceil(this.buffIronT)+'s'); if(this.hero&&this.samsonAlone()) bp.push('ALONE ×'+HEROISM.samsonAloneDmgMul); this.buffTxt.setText(bp.join('    ·    ')); }
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
  onTap(p){ if(this._iosFsPanel||this.over||this.shopOpen||this.victoryOpen||p.y>=HUD_Y) return;
    // Upgrade 12: while paused or editing the layout, field taps belong
    // to those overlays — never to the marching hand behind them.
    if(this.paused||this.layoutEdit) return;
    // Upgrade 9: while the camp panel is open, field taps belong to the
    // panel's own buttons — never to the marching hand behind it.
    if(this.campPanelOpen) return;
    // Upgrade 17: while the ORDERS fan stands open, taps belong to it:
    // a tap on one of its circles is that button's press (the wall
    // lets the button's own handler do the work), and a tap anywhere
    // else closes the fan — consumed, so a closing tap never becomes
    // a march order by accident. ORDERS itself closes it via its own
    // toggle. The walls are circles now, like the buttons.
    if(this.fanIsOpen()){ const onFan=FAN_MEMBERS.some(id=>{ const b=this.fanBtn(id); return b&&Math.hypot(p.x-b.x,p.y-b.y)<=(b.circleR||28); });
      const onOrders=this.ordersBtn&&Math.hypot(p.x-this.ordersBtn.x,p.y-this.ordersBtn.y)<=(this.ordersBtn.circleR||32);
      if(onFan||onOrders) return;
      this.closeFan(); return; }
    // Upgrade 8: a tap on the fight cluster is a fight input, never a
    // march order — the two hands stay separate.
    if(this.overFight(p)) return;
    // Upgrade 9: the same wall for the CAMP button — its tap is a button
    // press, not a march order at whatever world point lies beneath it.
    // (Upgrade 17: the wall is the button's circle, plus a breath.)
    if(this.campBtnRect&&Math.hypot(p.x-this.campBtnRect.x,p.y-this.campBtnRect.y)<=this.campBtnRect.w/2+4) return;
    // Upgrade 12: the same wall for the ⚙ pause button.
    if(this.pauseBtnRect&&Math.hypot(p.x-this.pauseBtnRect.x,p.y-this.pauseBtnRect.y)<=this.pauseBtnRect.w/2+4) return;
    // Upgrade 15: the same wall for the BUILD button — and while build
    // mode stands open, the build bar's own ground belongs to its tools;
    // while the intermission field bar stands, its buttons own their taps.
    if(this.buildBtnRect&&Math.hypot(p.x-this.buildBtnRect.x,p.y-this.buildBtnRect.y)<=this.buildBtnRect.w/2+4) return;
    if(this.buildMode&&this.buildBarRect&&Math.abs(p.x-this.buildBarRect.x)<=this.buildBarRect.w/2&&Math.abs(p.y-this.buildBarRect.y)<=this.buildBarRect.h/2) return;
    if(this.interField&&(this.interBtnRects||[]).some(r=>Math.abs(p.x-r.x)<=r.w/2+4&&Math.abs(p.y-r.y)<=r.h/2+4)) return;
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
    // Upgrade 15: in build mode a field tap is a build act — place,
    // mend, demolish — never a march, a selection, or a targeting tap.
    if(this.buildMode){ this.buildTap(wx,wy); return; }
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
    // Upgrade 18: the range ring is the WEAPON's reach now, stroked in
    // its tier's color (the Bible's ring burns gold-white), and a small
    // weapon glyph rides at the hero's shoulder — what he carries is
    // readable at a glance, modestly.
    const w=this.weapon||resolveWeapon('sling',0), tierCol=w.family==='bible'?0xfff3c0:(WEAPON_TIERS[Math.max(0,w.tier)]||WEAPON_TIERS[0]).color;
    this.hero.ring=this.add.circle(hx,hy,w.range,0xffffff,0.04).setStrokeStyle(1,tierCol,0.45).setDepth(3);
    this.hero.wpn=this.add.image(hx+26,hy-44,'wpn_'+(w.family==='innate'?'sling':w.family)).setDepth(9).setScale(0.34);
    if(w.flame&&this.hero.wpn.setTint) this.hero.wpn.setTint(0xf28c3c); // Upgrade 19: a Torchlit weapon's glyph burns orange at his shoulder
    this.hero.wpnShown=w.family!=='innate'; if(!this.hero.wpnShown&&this.hero.wpn.setVisible) this.hero.wpn.setVisible(false); }
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
      else { h.down=this.respawnTime||8; h.hp=0; h.spr.setAlpha(0.35); h.blocking=false; h.sprint=false; SFX.heroDown(); this.toast(h.def.name+' is down! Returns in '+Math.round(this.respawnTime||8)+'s — while the camp stands',3000);
        // Camp-Falls: he fell with no camp to bring him back. There is
        // no respawn to wait for — this fall IS the defeat, spoken now.
        if(this.campHp<=0){ this._heroFell=true; this.end(false); } } } }
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
    this.exitBuildMode(); this.volleyMode=true; this.rallyMode=false; this.toast('Volley: tap a target spot'); }
  // Upgrade 10 (approved addition): RALLY — tap the button, then tap the
  // ground to plant the banner. A targeting mode like Volley's, and the
  // two modes cancel each other.
  pressRally(){ if(this.over||this.shopOpen) return;
    this.volleyMode=false; this.exitBuildMode(); this.rallyMode=true; this.toast('Rally: tap where the banner goes');
    if(this.tutorial) this.tutEvent('rallyarm'); } // Upgrade 11 → 20: arming Rally is the army step's second proof (reached by the fan's RALLY or by holding ORDERS)
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
      { id:'kit', line:'One button stands guard now: GUARD, at your left thumb. TAP it and David dodges; HOLD it and he blocks. SPRINT, beneath it, runs. Try all three.' },
      { id:'power', line:'His power moves have their own buttons — Psalm and Five Stones. A stronger dummy is coming: cast one at it. When a power is ready again, its button glows and whispers.',
        line2:'Now aim one. HOLD a power button down — a gold ring wakes on the field. Drag it onto the dummy, let go, and the power lands where you put it.' },
      { id:'army', line:'This squad is yours — a gift for the lesson. Tap the squad to choose it, then tap the ground to post it there.',
        line2:'Your orders live behind one button: ORDERS, on the right rail. HOLD it down — a press held does more — and Rally arms at once.',
        line3:'Rally is armed. Now tap the ground: your squad goes to the banner and holds it. (A quick TAP of ORDERS opens the whole command rank instead.)' },
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
    if(st.id==='army'&&this.tutPhase===0&&name==='posted'){ this.tutPhase=1; this.tutRender(); return; } // the post turns the army step to its orders half
    // Upgrade 20: Rally ARMING turns the army step to its planting
    // half — the arming comes from holding ORDERS (or the fan's
    // RALLY), and one credited earlier is honored the same way.
    if(st.id==='army'&&this.tutPhase===1&&(name==='rallyarm'||this.tutCred.rallyarm)){ this.tutPhase=2; this.tutRender(); return; }
    // Upgrade 20: the power step's first cast turns it to its aiming half.
    if(st.id==='power'&&this.tutPhase===0&&name==='power'){ this.tutPhase=1; this.tutRender(); return; }
    if(this.tutStepDone(st)) this.tutAdvance(); else this.tutRender(); }
  tutStepDone(st){ const c=this.tutCred||{};
    switch(st.id){
      case 'move': return !!c.moved;
      case 'autofire': return !!(c.autofired&&c.autotoggled); // both halves, in either order
      case 'kit': return !!(c.dodge&&c.block&&c.sprint);
      case 'power': return this.tutPhase===1&&!!c.aimed; // Upgrade 20: a cast, then an AIMED cast
      case 'army': return this.tutPhase===2&&!!c.rallied;
      case 'camp': return !!c.camp;
      case 'orbs': return !!c.orb;
    } return false; }
  tutAdvance(){ if(this.tutFinished) return; this.tutStep++; this.tutPhase=0;
    if(this.tutStep>=(this.tutDefs||[]).length){ this.tutFinish(); return; }
    this.tutEnterStep(); }
  tutEnterStep(){ const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st) return;
    // Upgrade 20: a cast made before the power step arrived still
    // turns the step to its aiming half on entry.
    if(st.id==='power'&&this.tutCred&&this.tutCred.power) this.tutPhase=1;
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
    items.push(txt(this,W/2,296,'You march where you tap. David fires on his own — auto-fire, your choice.\nGUARD guards you: a tap dodges, a hold blocks; SPRINT runs. Your powers\nanswer a tap — and a hold aims them where you drag. Your squads post\nwhere you put them; ORDERS opens the command rank on a tap and arms\nRally on a hold. The camp is cared for from CAMP — hold it to repair.\nThe orbs sell their powers. The wall is yours.',16,PARCH,{align:'center'}).setOrigin(0.5,0).setDepth(53));
    const fb=button(this,W/2,428,200,46,'Finish',()=>this.exitTutorial(),{size:18}); fb.setDepth(53); items.push(fb);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); });
    this.tutRender(); }
  exitTutorial(){ this.scene.start('Menu'); } // nothing persists, nothing is owed — see the firewall note above
  tutRender(){ if(!this.tutLine) return;
    if(this.tutFinished){ this.tutLine.setText('The lesson is complete — the wall is yours.'); this.tutSub.setText(''); return; }
    const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st){ this.tutLine.setText(''); this.tutSub.setText(''); return; }
    let line=st.line;
    if(st.id==='autofire') line=this.tutCred.autofired?st.line2:(this.autoFire?st.line:st.lineOff);
    if(st.id==='power'&&this.tutPhase===1) line=st.line2;
    if(st.id==='army'&&this.tutPhase===1) line=st.line2;
    if(st.id==='army'&&this.tutPhase===2) line=st.line3;
    this.tutLine.setText(line);
    let sub='Step '+(this.tutStep+1)+' of '+this.tutDefs.length;
    if(st.id==='kit'){ const left=[['dodge','Tap Guard'],['block','Hold Guard'],['sprint','Sprint']].filter(p=>!this.tutCred[p[0]]).map(p=>p[1]);
      if(left.length) sub+='  ·  Still to try: '+left.join(', '); }
    this.tutSub.setText(sub); }
  // Where the ring goes this frame: the exact control or ground the
  // current step (and phase) is waiting on.
  tutTarget(){ const st=this.tutDefs&&this.tutDefs[this.tutStep]; if(!st||this.tutFinished) return null;
    switch(st.id){
      case 'move': return {hl:'world',x:this.campPos.x+280,y:this.campPos.y};
      case 'autofire': if(!this.tutCred.autofired) return this.tutDummy&&!this.tutDummy.dead?{hl:'world',x:this.tutDummy.x,y:this.tutDummy.y}:{hl:'world',x:this.hero.x+170,y:this.hero.y};
        return this.autoBtn?{hl:'screen',x:this.autoBtn.sx,y:this.autoBtn.sy}:null;
      case 'kit': { const left=['dodge','block','sprint'].find(k=>!this.tutCred[k]); const b=left&&this.fightBtns&&this.fightBtns[left==='sprint'?'sprint':'guard']; return b?{hl:'screen',x:b.sx,y:b.sy}:null; } // Upgrade 20: dodge and block both ring GUARD
      case 'power': { const b=this.skillBtns&&this.skillBtns[1]; return b?{hl:'screen',x:b.sx,y:b.sy}:null; }
      case 'army': if(this.tutPhase===2) return {hl:'world',x:this.campPos.x+430,y:this.campPos.y-140}; // Upgrade 20: Rally is armed — the ring waits on the ground where the banner goes
        if(this.tutPhase===1) return this.ordersBtn?{hl:'screen',x:this.ordersBtn.x,y:this.ordersBtn.y}:null;
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
    // Upgrade 17: the sweep speaks in rings now. On cooldown a dark disc
    // veils the glyph while a gold arc sweeps clockwise from the top,
    // growing back as the power returns (the arc's length IS the time
    // left, read at a glance). Smooth Stone's held charge — always
    // ring-shaped in spirit — draws as a rim arc climbing to the
    // Tempered rim and the pulsing Perfect rim; the power-ready
    // whisper is a ring pulse that swells once and fades.
    const cx=b.sx, cy=b.sy, r=(b.sw||56)/2;
    if(b.cd>0){ const f=Math.min(1,b.cd/(b.cdMax||b.def.cd||1));
      g.fillStyle(0x000000,0.45); g.fillCircle(cx,cy,r-2);
      arcSegs(g,cx,cy,r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-f),4,0xf2c14e,0.9); return; }
    const t=this.heldTierOf(b);
    const f=t===2?1:(t===1?(b.held-HELD.temperAt)/(HELD.perfectAt-HELD.temperAt):(b.held||0)/HELD.temperAt);
    if(f>0) arcSegs(g,cx,cy,r-3,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,f)),3,t===2?0xffe98a:(t===1?0xf2c14e:0x8a7a4a),t===2?0.95:0.8);
    if(t===2){ g.lineStyle(3,0xffe98a,0.6+0.4*Math.sin((this._pulse||0)*6)); g.strokeCircle(cx,cy,r+1); }
    else if(t===1){ g.lineStyle(2,0xf2c14e,0.8); g.strokeCircle(cx,cy,r+1); }
    // Upgrade 10: the whisper's glow — a soft halo that swells once when
    // a great power comes ready, then fades (b.readyPulse decays in update()).
    if(b.readyPulse>0){ g.lineStyle(3,0xffe98a,0.15+0.5*b.readyPulse); g.strokeCircle(cx,cy,r+3+(1-b.readyPulse)*5); }
    // Upgrade 20: while THIS power is being pressed, its rim fills
    // toward the hold — the player watches the aimed cast coming, in
    // the same arc language. Once held, the rim stands full and bright.
    if(this.skillPress&&this.skillBtns&&this.skillBtns[this.skillPress.i]===b){ const f=Math.min(1,(performance.now()-this.skillPress.t0)/HOLD_MS);
      arcSegs(g,cx,cy,r+4,-Math.PI/2,-Math.PI/2+Math.PI*2*f,3,this.skillPress.held?0xffe98a:0xf2c14e,0.95); } }
  // --- Upgrade 10: the right-thumb stack — kennin's approved button UI ---
  // One column on the right of the screen (stone-and-gold — Upgrade 16:
  // SYMBOLS on the faces, names only in the press float and the Controls
  // list — Upgrade 17: CIRCLES, the thumb cluster 64 across, the powers
  // 76): the AUTO-FIRE toggle at the top, the stamina readout under it,
  // then DODGE, BLOCK (a hold) and SPRINT, then the hero's power moves
  // as their OWN buttons, driven from the hero data — for David: SMOOTH
  // STONE, PSALM, FIVE STONES. Each power button keeps Upgrade 8's Held
  // Power state and its cooldown — a ring sweep now. They are screen
  // furniture (depth 31/32, pinned by fixUI), clear of the command row
  // below (the stack's last rim ends at y=594, the bar starts at
  // HUD_Y=610), and onTap refuses taps that land on them — a press here
  // is never also a march order.
  buildFightControls(){ this.fightBtns={}; this.fightRects=[];
    if(this.autoFire===undefined) this.autoFire=loadAutoFire();
    // Upgrade 17: the stack is built of CIRCLES — mk takes a diameter.
    // sx/sy keep naming each circle's centre; the sweep rings draw
    // around it; the fight rects carry the radius for circular walls.
    const mk=(id,x,y,d,label,cb,size,icon,floatName)=>{ const b=button(this,x,y,d,d,label,cb,{size:size||15,icon:icon,floatName:floatName,circle:d}); b.setDepth(31);
      b.sx=x; b.sy=y; b.sw=d; b.sh=d; b.sweep=this.add.graphics().setDepth(32);
      this.fightBtns[id]=b; this.fightRects.push({x,y,w:d,h:d,r:d/2}); this.regLayout(id,b,(nx,ny)=>{ b.sx=nx; b.sy=ny; }); return b; };
    // Upgrade 20: the stack is a THUMB ARC now, not a column — the
    // powers arc down the bottom-right (Power 1 highest, the ult
    // nearest the corner thumb), AUTO-FIRE keeps the top-right above
    // them, and GUARD + SPRINT stand on the bottom-left rail for the
    // left thumb (see LAYOUT_DEFS). Diameters never shrank: powers 76,
    // the thumb circles 64.
    // Upgrade 16: the faces wear symbols. AUTO-FIRE's state is the face
    // itself — lit gold when ON, dimmed when OFF (applyAutoFace).
    // Upgrade 20: AUTO-FIRE is press-grammar — TAP toggles, HOLD opens
    // the controls — so its helper callback is a no-op, like GUARD's.
    this.autoBtn=mk('autofire',1178,76,64,'',()=>{},17,'ico_auto','Auto-fire');
    this.wirePress(this.autoBtn,'autofire');
    this.applyAutoFace();
    // GUARD — Dodge and Block merged into one circle (Upgrade 20):
    // TAP dodges, HOLD blocks and the release ends the block. The
    // grammar lives in wirePress/tickPresses/endPresses; the helper
    // callback is deliberately a no-op so a release over the button
    // can never ALSO fire a verb.
    const gb=mk('guard',102,448,64,'',()=>{},16,'ico_guard','Guard');
    this.wirePress(gb,'guard');
    gb.on('pointerout',()=>this.endGuardPress()); // sliding off the circle ends the press, as Block's hold always ended
    mk('sprint',102,548,64,'',()=>this.toggleSprint(),16,'ico_sprint','Sprint'); // Sprint stays a tap toggle — a state, not a verb pair
    // A release ANYWHERE resolves every open press (and still ends a
    // raised guard raised outside the grammar, as it always has).
    this.input.on('pointerup',p=>{ this.endPresses(p); this.setBlock(false); });
    // The hero's power moves, from the data: his two skills and his ult,
    // in data order. Held Power state lives on the button itself — cd/
    // cdMax drive the cooldown sweep, held accrues charge while the move
    // sits ready, buffered remembers a press that landed a breath early.
    // Upgrade 20: a power is press-grammar too — TAP casts as it always
    // has; HOLD raises the reticle, the drag aims it, and the release
    // casts at that point (useSkillAt). The helper callback is a no-op;
    // a press on a COOLING power goes straight to pressSkill, whose
    // input buffer is the tap behavior — a hold never aims a move that
    // is not ready.
    const h=this.heroDef; this.skillBtns=[];
    [...h.skills,h.ult].forEach((k,i)=>{ const b=mk('skill'+i,1178,[368,462,556][i],76,'',()=>{},15,skillIconKey(k),k.name);
      b.cd=0; b.cdMax=k.cd; b.def=k; b.held=0; b.buffered=false; b._tierShown=0;
      this.wirePress(b,'skill',i);
      this.skillBtns.push(b); });
    this.fightBar=this.add.graphics().setDepth(32);
    this.fightStat=txt(this,1178,116,'',13,'#f2c14e').setOrigin(0.5).setDepth(31);
    // Upgrade 12: every battle control now exists at its default — a
    // saved layout, if the player has one, is applied over the top.
    this.applyLayout(); }
  // --- Upgrade 20: the press grammar --------------------------------
  // wirePress gives a circle the grammar: its pointerdown (inside the
  // radius, behind the same gates its verbs live behind) opens a press
  // record; tickPresses (update) crosses it into the HOLD verb at
  // HOLD_MS; the scene-wide release (endPresses) resolves a press that
  // never crossed into its TAP verb. The shared helper's own callback
  // is a no-op on every grammar button, so the helper's release can
  // never double-fire a verb the grammar already spoke.
  pressGatesOpen(){ return !(this.over||this.shopOpen||this.victoryOpen||this.paused||this.layoutEdit); }
  wirePress(btn,kind,idx){ if(!btn||!btn.on) return;
    // Camp-Falls rider (2026-10-31): the release OVER the button
    // resolves HERE, on the button itself. The shared helper's own
    // pointerup calls stopPropagation, and in the vendored Phaser
    // that cancels the shared input event data — processUpEvents
    // then never emits the scene-level 'pointerup' at all (proven in
    // vendor/phaser.min.js: the scene POINTER_UP is emitted only
    // when the event data was not cancelled). U20 wired every TAP
    // verb to that scene release, so a press released over its own
    // circle was never resolved: the record lingered and fired late,
    // on some later field release. In the watched playtest that was
    // the CAMP button: tapped, nothing opened — the panel answered
    // only to the camp structure's own field tap, which never goes
    // near the button's release path. The handler below runs in the
    // object phase, before suppression can matter; endPresses is
    // idempotent (it clears what it resolves), so the scene path
    // still serving field releases costs nothing.
    btn.on('pointerup',p=>this.endPresses(p));
    btn.on('pointerdown',(p,lx,ly)=>{ if(Math.hypot(lx||0,ly||0)>(btn.circleR||32)) return; // the circle is the law, as everywhere
      if(!this.pressGatesOpen()) return;
      const rec={t0:performance.now(),held:false,id:p&&p.id};
      if(kind==='guard'){ if(this.hero&&this.hero.down>0) return; this.guardPress=rec; }
      else if(kind==='skill'){ const b=this.skillBtns&&this.skillBtns[idx];
        if(!b) return;
        if(b.cd>0){ this.pressSkill(idx); return; } // cooling: the tap path (buffer) — no aim for a move not ready
        rec.i=idx; this.skillPress=rec; this.skillAim=this.defaultAimPoint(); }
      else if(kind==='orders'){ if(this.face!=='few') return; this.ordersPress=rec; }
      else if(kind==='camp'){ this.campPress=rec; }
      else if(kind==='autofire'){ this.afPress=rec; } }); }
  // Where an aimed cast's reticle opens: on the nearest foe inside a
  // generous reach, else a step ahead of the hero where he faces.
  defaultAimPoint(){ const h=this.hero; if(!h) return {x:0,y:0};
    const t=this.nearestEnemy?this.nearestEnemy(h.x,h.y,320):null;
    if(t) return {x:t.x,y:t.y};
    return {x:h.x+(h.faceX||1)*130,y:h.y+(h.faceY||0)*130}; }
  tickPresses(){ const now=performance.now();
    const cross=(rec,fn)=>{ if(rec&&!rec.held&&now-rec.t0>=HOLD_MS){ rec.held=true; fn(); } };
    cross(this.guardPress,()=>this.setBlock(true)); // GUARD hold: the guard rises and stays until the release
    cross(this.skillPress,()=>{}); // a power's hold is the reticle itself — drawn from skillPress.held; the cast waits for the release
    cross(this.ordersPress,()=>this.pressRally()); // ORDERS hold: RALLY arms at once, the fan never opens
    cross(this.campPress,()=>this.quickRepairCamp()); // CAMP hold: the quick Repair, now
    cross(this.afPress,()=>this.openPause()); } // AUTO-FIRE hold: the controls
  endPresses(p){ const match=rec=>rec&&((p&&p.id)!==undefined?((rec.id===undefined||rec.id===p.id)):true);
    if(this.guardPress&&match(this.guardPress)) this.endGuardPress();
    if(this.skillPress&&match(this.skillPress)){ const rec=this.skillPress; this.skillPress=null;
      if(rec.held){ if(this.skillAim) this.useSkill(rec.i,this.skillAim); }
      else this.pressSkill(rec.i); // the TAP cast — pressSkill exactly, buffer and all
      this.skillAim=null; }
    if(this.ordersPress&&match(this.ordersPress)){ const rec=this.ordersPress; this.ordersPress=null;
      if(!rec.held) this.toggleFan(); } // the TAP: the fan opens (or closes)
    if(this.campPress&&match(this.campPress)){ const rec=this.campPress; this.campPress=null;
      if(!rec.held) this.toggleCampPanel(); } // the TAP: the camp panel
    if(this.afPress&&match(this.afPress)){ const rec=this.afPress; this.afPress=null;
      if(!rec.held) this.toggleAutoFire(); } } // the TAP: the toggle
  endGuardPress(){ const rec=this.guardPress; if(!rec) return; this.guardPress=null;
    if(rec.held) this.setBlock(false); // the hold ends: the guard drops
    else this.pressDodge(); } // the TAP: the dodge — a short press can never block
  // The Guard key (Space by default): keydown opens the same press,
  // keyup resolves it — the grammar on the keyboard, one key both verbs.
  beginGuardKey(){ if(!this.pressGatesOpen()||this.guardPress) return;
    if(this.hero&&this.hero.down>0) return; this.guardPress={t0:performance.now(),held:false,id:'key'}; }
  endGuardKey(){ if(this.guardPress&&this.guardPress.id==='key') this.endGuardPress(); }
  // CAMP's hold verb: the camp panel's own Repair, bought at once.
  // When it cannot be bought the press still answers — a shake of the
  // CAMP circle and the reason floated over the camp, never silence.
  quickRepairCamp(){ if(!this.pressGatesOpen()&&!this.campPanelOpen) return;
    if(this.campHp>=this.campMax){ this.explainNoRepair('The camp is whole — nothing to mend'); return; }
    if(this.manna<CAMP_REPAIR.cost){ this.explainNoRepair('Repair needs '+CAMP_REPAIR.cost+' Manna'); return; }
    if(this.buyCampRepair()) this.floatText(this.campPos.x,this.campPos.y-84,'Repaired +'+CAMP_REPAIR.heal,'#8fd06a'); }
  explainNoRepair(msg){ this.floatText(this.campPos.x,this.campPos.y-84,msg,'#ff8a6a');
    if(this.campBtn&&this.tweens) this.tweens.add({targets:this.campBtn,scaleX:0.86,scaleY:0.86,duration:55,yoyo:true,repeat:3}); }
  // The reticle (world layer): a gold ring and cross at the aim point,
  // with a faint thread back to the hero so the cast's origin reads.
  drawAimFx(){ if(!this.aimFx) return; const g=this.aimFx; g.clear();
    if(!this.skillPress||!this.skillPress.held||!this.skillAim||!this.hero) return;
    const a=this.skillAim, h=this.hero, pu=1+0.08*Math.sin((this._pulse||0)*6);
    g.lineStyle(2,0xf2c14e,0.35); g.lineBetween(h.x,h.y,a.x,a.y);
    g.lineStyle(3,0xf2c14e,0.95); g.strokeCircle(a.x,a.y,20*pu);
    g.lineBetween(a.x-30,a.y,a.x-10,a.y); g.lineBetween(a.x+10,a.y,a.x+30,a.y);
    g.lineBetween(a.x,a.y-30,a.x,a.y-10); g.lineBetween(a.x,a.y+10,a.x,a.y+30);
    g.fillStyle(0xf2c14e,0.9); g.fillCircle(a.x,a.y,3); }
  // The hold-fill rims for the two grammar circles that have no sweep
  // graphics of their own (ORDERS, CAMP): a bright arc climbing
  // clockwise from the top, its length the fraction of the hold
  // already served — the player watches the second verb coming.
  drawPressFx(){ if(!this.pressFx) return; const g=this.pressFx; g.clear();
    const now=performance.now();
    const rim=(cx,cy,r,rec)=>{ if(!rec) return; const f=Math.min(1,(now-rec.t0)/HOLD_MS);
      arcSegs(g,cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*f,4,rec.held?0xffe98a:0xf2c14e,0.95); };
    if(this.ordersBtn) rim(this.ordersBtn.x,this.ordersBtn.y,(this.ordersBtn.circleR||32)-3,this.ordersPress);
    if(this.campBtnRect) rim(this.campBtnRect.x,this.campBtnRect.y,(this.campBtnRect.w||56)/2-3,this.campPress); }
  // Upgrade 16: the AUTO-FIRE face — ON is gold and lit, OFF is dim and
  // unlit. The toast still speaks the state in words; the button does not.
  applyAutoFace(){ if(!this.autoBtn) return;
    if(this.autoBtn.icon) this.autoBtn.icon.setTint(this.autoFire?0xffffff:0x6a5a4a);
    if(this.autoBtn.redraw) this.autoBtn.redraw(!!this.autoFire); }
  // The AUTO-FIRE toggle: the choice is the player's and it persists.
  toggleAutoFire(){ this.autoFire=!this.autoFire; saveAutoFire(this.autoFire);
    this.applyAutoFace();
    this.toast(this.autoFire?'Auto-fire ON — '+this.heroDef.name+' strikes on his own':'Auto-fire OFF — power moves only, by button');
    if(this.tutorial) this.tutEvent('autotoggled'); } // Upgrade 11: the auto-fire step listens for this flip, either way
  overFight(p){ if(!this.fightRects) return false;
    // Upgrade 17: the wall is the circle itself — a corner tap outside
    // the radius is NOT over the button, so it falls through to the
    // field (a march, a post) instead of dying in a dead corner.
    return this.fightRects.some(r=>Math.hypot(p.x-r.x,p.y-r.y)<=(r.r!==undefined?r.r:r.w/2)); }
  // --- Upgrade 12: layout — the registry, applying, the editor ---
  // Every movable battle control registers itself as it is built (the
  // command row in buildHUD, the stack in buildFightControls). A saved
  // layout moves the container AND syncs every coordinate the game
  // keeps beside it (sweep origins, the onTap walls, the fight rects,
  // the tutorial's rings) — there is one position per button, never two.
  regLayout(id,obj,sync){ if(!this.layoutReg) this.layoutReg=[]; const def=LAYOUT_DEFS.find(d=>d[0]===id);
    // Upgrade 17: seatPos is the layout truth apart from wherever a
    // control is standing right now — the fan moves its members for
    // display, but their seats stay here, recorded through the sync.
    const wrapped=(x,y)=>{ if(!this.seatPos) this.seatPos={}; this.seatPos[id]={x,y}; if(sync) sync(x,y); };
    this.layoutReg.push({id,obj,w:def?def[2]:56,h:def?def[3]:56,sync:wrapped}); }
  applyLayout(){ const pos=(loadLayout()||{pos:{}}).pos||{};
    (this.layoutReg||[]).forEach(en=>{ const p=pos[en.id]; if(!p) return;
      const nx=Math.max(en.w/2,Math.min(W-en.w/2,+p.x||0)), ny=Math.max(en.h/2,Math.min(H-en.h/2,+p.y||0));
      if(!isFinite(nx)||!isFinite(ny)) return;
      en.obj.setPosition(nx,ny); if(en.sync) en.sync(nx,ny); });
    this.syncLayoutMeta(); this.applyFace(); }
  // A control's layout seat: the saved position if the registry sync
  // has recorded one, else the table default. (Upgrade 17: seats are
  // never read back off a container — the table is the truth.)
  seatOf(id){ const s=this.seatPos&&this.seatPos[id]; if(s) return s; return defaultLayoutPos()[id]||{x:0,y:0}; }
  syncLayoutMeta(){ const fb=this.fightBtns?Object.values(this.fightBtns):[];
    if(fb.length) this.fightRects=fb.map(b=>({x:b.sx,y:b.sy,w:b.sw,h:b.sh,r:b.sw/2}));
    // The CAMP / RALLY onTap walls follow their buttons through the
    // registry sync callbacks (applyLayout / the editor), not from here.
    if(this.fightStat&&this.autoBtn) this.fightStat.setPosition(this.autoBtn.sx,this.autoBtn.sy+40); }
  saveLayoutFromScene(){ const pos={}; (this.layoutReg||[]).forEach(en=>{ const s=this.seatOf(en.id); pos[en.id]={x:Math.round(s.x),y:Math.round(s.y)}; }); saveLayout(pos); } // seats only — never a container's live position: in the Simple editor the fan members STAND at fan spots, and a fan spot saved as a seat would strand the button there in the Full face
  // --- Upgrade 17 → 20: the faces and the ORDERS fan -----------------
  // One mover for every face change: applyFace reads this.face and
  // this.fanOpen and puts every control where the face says it stands.
  // Seats never change here — only display positions, visibility, and
  // the active-position walls (volley sweep origin, camp/rally/build
  // rects). Upgrade 20: in the FEW face, CAMP is a rail rider, not a
  // fan member — it stands ALWAYS (few buttons, never a hidden camp),
  // positioned from the ORDERS seat by CAMP_RAIL, so the editor moves
  // it by moving ORDERS, as one group with the fan.
  fanBtn(id){ if(id==='build') return this.buildBtn||null; if(id==='cmd_rally') return this.rallyBtn||null;
    if(id==='cmd_camp') return this.campBtn||null;
    if(id&&id.indexOf('cmd_')===0&&this.cmdBtns) return this.cmdBtns[id.slice(4)]||null;
    const en=(this.layoutReg||[]).find(e=>e.id===id); return en?en.obj:null; }
  fanSpot(id){ const o=this.seatOf('orders');
    const f=FAN_OFFSETS[id]||{dx:0,dy:0}; return {x:o.x+f.dx,y:o.y+f.dy}; }
  campRailSpot(){ const o=this.seatOf('orders'); return {x:o.x+CAMP_RAIL.dx,y:o.y+CAMP_RAIL.dy}; }
  btnShow(b,shown){ if(!b) return; if(b.setVisible) b.setVisible(shown);
    if(shown){ if(b.setInteractive) b.setInteractive({useHandCursor:true}); }
    else if(b.disableInteractive) b.disableInteractive(); }
  applyFace(){ if(!this.cmdBtns||!this.ordersBtn) return;
    const few=this.face==='few', showFan=few&&(this.fanOpen||this._fanShown);
    FAN_MEMBERS.forEach(id=>{ const b=this.fanBtn(id); if(!b) return;
      if(!few){ this.btnShow(b,true); const s=this.seatOf(id); b.setPosition(s.x,s.y); }
      else if(showFan){ const s=this.fanSpot(id); b.setPosition(s.x,s.y); this.btnShow(b,true); }
      else this.btnShow(b,false); });
    this.btnShow(this.ordersBtn,few);
    // CAMP: its own seat on the Full face's row; the rail spot in Few.
    if(this.campBtn){ const cp=few?this.campRailSpot():this.seatOf('cmd_camp');
      this.campBtn.setPosition(cp.x,cp.y); this.campBtnRect={x:cp.x,y:cp.y,w:56,h:56}; }
    // The active-position records follow the circles that are standing,
    // computed from seats and fan geometry (never read off a container):
    const act=id=>(few&&showFan)?this.fanSpot(id):this.seatOf(id);
    const vb=this.cmdBtns.volley; if(vb){ const a=act('cmd_volley'); vb.sx=a.x; vb.sy=a.y; }
    if(this.rallyBtn){ const a=act('cmd_rally'); this.rallyBtnRect={x:a.x,y:a.y,w:56,h:56}; }
    if(this.buildBtn){ if(few&&!showFan) this.buildBtnRect={x:-9999,y:-9999,w:64,h:64};
      else { const a=act('build'); this.buildBtnRect={x:a.x,y:a.y,w:64,h:64}; } } }
  fanIsOpen(){ return this.face==='few'&&!!this.fanOpen; }
  toggleFan(){ if(this.face!=='few') return;
    this.fanOpen=!this.fanOpen; this.applyFace();
    if(this.fanOpen){ SFX.tap&&SFX.tap(); if(this.tutorial) this.tutEvent('fanopen'); } }
  closeFan(){ if(!this.fanOpen) return; this.fanOpen=false; this.applyFace(); }
  // A fan member's press: issue the order, then close the fan behind it.
  // In the Full face (or with the fan shut) the action simply runs.
  fanPress(fn){ const was=this.fanIsOpen(); if(fn) fn(); if(was&&this.fanOpen) this.closeFan(); }
  setFace(f){ if(f==='simple') f='few'; if(f!=='few'&&f!=='full') return; this.face=f; saveFaceChoice(f); this.fanOpen=false; this.applyFace();
    this.toast(f==='few'?'Buttons: Few — a few circles, and a press does more: tap for one thing, hold for another':'Buttons: Full — every circle stands'); }
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
    if(p.worldX!==undefined) this._ptrW={x:p.worldX,y:p.worldY}; // Upgrade 15: the build ghost follows the pointer's world point
    // Upgrade 20: an aimed cast's reticle follows the holding finger —
    // the drag IS the aiming. World coordinates, clamped to the field.
    if(this.skillPress&&(p.id===undefined||this.skillPress.id===undefined||p.id===this.skillPress.id)&&p.worldX!==undefined)
      this.skillAim={x:Math.max(20,Math.min(this.worldW-20,p.worldX)),y:Math.max(40,Math.min(this.worldH-20,p.worldY))};
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
    // Upgrade 20: the GUARD key carries the press grammar on the
    // keyboard — keydown opens the press, keyup resolves it (a quick
    // tap dodges; a hold blocks until the key comes up). A release is
    // honored even if the world changed while the key was down.
    if(act==='guard'){ if(down) this.beginGuardKey(); else this.endGuardKey(); return; }
    if(!down) return;
    if(this.over||this.shopOpen||this.victoryOpen||this.paused||this.layoutEdit) return;
    switch(act){
      case 'sprint': this.toggleSprint(); break;
      case 'autofire': this.toggleAutoFire(); break;
      case 'skill0': this.pressSkill(0); break;
      case 'skill1': this.pressSkill(1); break;
      case 'skill2': this.pressSkill(2); break;
      case 'volley': this.pressVolley(); break;
      case 'rally': this.pressRally(); break;
      case 'camp': this.toggleCampPanel(); break;
      case 'build': this.toggleBuildMode(); break;
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
    // Upgrade 17 → 20: the battle face, switchable right here mid-run.
    items.push(txt(this,W/2,306,'Battle buttons',17,PARCH).setOrigin(0.5).setDepth(59));
    const fb=(id,label,x)=>{ const b=button(this,x,340,160,40,label+(this.face===id?' ✓':''),()=>{ this.setFace(id); this.renderPause(); },{size:15}); b.setDepth(59); items.push(b); };
    fb('few','Few',W/2-85); fb('full','Full',W/2+85);
    const eb=button(this,W/2,392,300,48,'Edit button layout',()=>this.enterLayoutEdit(),{size:17}); eb.setDepth(59); items.push(eb);
    items.push(txt(this,W/2,436,'Keybinds live in Controls, on the main menu.',13,'#cdbd95').setOrigin(0.5).setDepth(59));
    const rb=button(this,W/2,478,300,52,'Resume',()=>this.closePause(),{size:19}); rb.setDepth(59); items.push(rb);
    const qb=button(this,W/2,540,300,48,'Quit run',()=>{ this.closePause(); this.end(false); },{size:16}); qb.setDepth(59); items.push(qb);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); }); }
  // Editing in battle: the pause holds the fight while the REAL buttons
  // are dragged. They are disabled for the duration (layoutEditor), so
  // no drag can fire an action, and field taps are walled by onTap's
  // layoutEdit guard — a dragging tap never becomes an order. DONE
  // returns to the pause; the layout is saved as each drag ends and
  // applies at once, because the buttons being dragged ARE the battle's.
  enterLayoutEdit(){ if(this.layoutEdit) return; this.clearPause(); this.layoutEdit=true;
    if(!this.layoutEd) this.layoutEd=layoutEditor(this,()=>this.saveLayoutFromScene());
    // Upgrade 17 → 20: the editor edits the face the player stands in.
    // In the Few face the fan's circles AND CAMP are positioned AS A
    // GROUP relative to ORDERS (the editor shows the fan open and
    // CAMP on its rail) — only ORDERS is dragged; the group rides it
    // and its members are not editor items. In the Full face every
    // command stands at its own seat and ORDERS is not an item (it
    // is the Few face's anchor, not a Full control). Buttons that are
    // not items are still disabled for the duration, so a displayed
    // group member can never fire mid-edit.
    const few=this.face==='few';
    if(few){ this._fanShown=true; this.applyFace(); }
    const edItems=(this.layoutReg||[]).filter(en=>few?!(FAN_MEMBERS.includes(en.id)||en.id==='cmd_camp'):en.id!=='orders');
    this.layoutEd.setItems(edItems); this.layoutEd.enter();
    (this.layoutReg||[]).forEach(en=>{ if(!edItems.includes(en)&&en.obj.disableInteractive) en.obj.disableInteractive(); });
    const items=[]; this.editItems=items;
    const g=this.add.graphics().setDepth(60); g.fillStyle(0x140c07,0.92); g.fillRoundedRect(W/2-330,10,660,44,10); g.lineStyle(2,0xf2c14e,1); g.strokeRoundedRect(W/2-330,10,660,44,10); items.push(g);
    items.push(txt(this,W/2,32,'EDITING LAYOUT — drag any button into place',17,'#f2c14e').setOrigin(0.5).setDepth(61));
    const dn=button(this,W/2-100,580,170,44,'Done',()=>this.exitLayoutEdit(),{size:16}); dn.setDepth(61); items.push(dn);
    const rs=button(this,W/2+100,580,190,44,'Reset layout',()=>{ resetLayout(); const dp=defaultLayoutPos();
      (this.layoutReg||[]).forEach(en=>{ const p=dp[en.id]; if(p){ en.obj.setPosition(p.x,p.y); if(en.sync) en.sync(p.x,p.y); } });
      this.syncLayoutMeta(); this.applyFace(); this.toast('Layout reset to the standard'); },{size:15}); rs.setDepth(61); items.push(rs);
    items.forEach(o=>{ if(o.setScrollFactor) o.setScrollFactor(0); }); }
  exitLayoutEdit(){ if(!this.layoutEdit) return; this.layoutEdit=false;
    if(this.layoutEd) this.layoutEd.exit();
    (this.editItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.editItems=[];
    this.saveLayoutFromScene();
    this._fanShown=false; this.applyFace(); // fan members return to their seats / hiding; every control's interactivity restored per the face
    if(this.paused) this.renderPause(); }
  // Upgrade 10: AUTO-FIRE — the hero's basic attack, restored. When the
  // toggle is ON the hero strikes the nearest enemy inside his range
  // circle on his own attack clock (h.cd against hd.rate): melee damage
  // at hand range, a sling stone beyond it, through the orb multiplier
  // like every hero hit — the pre-Upgrade-8 behavior, numbers unchanged.
  // When the toggle is OFF he performs NO basic attacks at all; his
  // power moves still fire by button. Striking drops a raised guard.
  // Upgrade 18: the basic attack is the WEAPON's. Each family fires its
  // own pattern (below); the Common sling's branch is the pre-U18 attack
  // verbatim — same stone, same speed, same numbers — because the
  // resolver returns dmg 18 / rate 0.7 / range 140 / crit 0.10 for it
  // and David's scaling factors are both 1. The hero faces his target
  // when he strikes, so sword arcs and spear lines read his facing.
  heroAutoFire(){ const h=this.hero, hd=h.def; if(!this.autoFire||!h||h.down>0||h.cd>0) return;
    const w=this.weapon||(this.weapon=resolveWeapon('sling',0));
    const t=this.nearestEnemy(h.x,h.y,w.range+(w.range<80?8:0));
    if(!t) return;
    h.cd=w.rate*(hd.rate/0.7);
    if(h.blocking) this.setBlock(false);
    const dl=Math.hypot(t.x-h.x,t.y-h.y)||1; h.faceX=(t.x-h.x)/dl; h.faceY=(t.y-h.y)/dl;
    const dmg=w.dmg*(hd.dmg/18)*this.heroDmgMul();
    if(w.family==='innate'){ // his own hand: the pre-U18 attack, verbatim
      if(w.range<80){ this.damage(t,hd.dmg*this.heroDmgMul(),w.type,{crit:0.1}); this.spark(t.x,t.y,0xe8e0c8,3); SFX.atkMelee(true); }
      else { this.shoot(h.x,h.y,t,w.proj,{dmg:hd.dmg*this.heroDmgMul(),type:w.type,crit:0.1},620); if(w.type==='holy') SFX.atkBow(true); else SFX.atkSling(true); } }
    else if(w.family==='sword'){ // CLEAVE: everything inside the arc is struck
      const half=(w.arc||110)*Math.PI/360, fa=Math.atan2(h.faceY,h.faceX);
      this.enemies.slice().forEach(e=>{ if(e.dead||Math.hypot(e.x-h.x,e.y-h.y)>w.range+10) return;
        let da=Math.abs(Math.atan2(e.y-h.y,e.x-h.x)-fa); if(da>Math.PI) da=2*Math.PI-da;
        if(da<=half) this.damage(e,dmg,w.type,{crit:w.crit}); });
      this.spark(t.x,t.y,0xe8e0c8,3); SFX.atkMelee(true); }
    else if(w.family==='spear'){ // the thrust: a line through the mark, pierced
      this.lineHits(h.x,h.y,t.x,t.y,w.range,26).slice(0,1+(w.pierce||0)).forEach(e=>this.damage(e,dmg,w.type,{crit:w.crit}));
      this.spark(t.x,t.y,0xe8e0c8,3); SFX.atkSpear(true); }
    else if(w.family==='scattergun'){ // the spread: pellets seek the nearest foes in reach, round-robin
      const foes=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-h.x,e.y-h.y)<=w.range)
        .sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y));
      for(let i=0;i<(w.pellets||5);i++) this.shoot(h.x,h.y,foes[i%foes.length],'stone',{dmg:dmg,type:w.type,crit:w.crit},700);
      SFX.atkScatter(true); }
    else if(w.family==='rifle'){ this.shoot(h.x,h.y,t,'bullet',{dmg:dmg,type:w.type,crit:w.crit,pierce:99,flyRange:w.range+40},1350); SFX.atkRifle(true); }
    else if(w.family==='pistol'){ this.shoot(h.x,h.y,t,'bullet',{dmg:dmg,type:w.type,crit:w.crit},1050); SFX.atkPistol(true); }
    else if(w.family==='bow'){ this.shoot(h.x,h.y,t,'arrow',{dmg:dmg,type:w.type,crit:w.crit,critMul:w.critMul||1},820); SFX.atkBow(true); }
    else if(w.family==='bible'){ this.shoot(h.x,h.y,t,'light',{dmg:dmg,type:'holy',crit:w.crit},900); SFX.bibleShot(); }
    else { this.shoot(h.x,h.y,t,'stone',{dmg:dmg,type:w.type,crit:w.crit},620); SFX.atkSling(true); }
    if(this.tutorial) this.tutEvent('autofired'); } // Upgrade 11: proof the hero fired on his own
  // Foes standing on the line from (x,y) toward (tx,ty), nearest first:
  // projection inside the reach, perpendicular distance inside the width.
  lineHits(x,y,tx,ty,range,width){ const dx=tx-x, dy=ty-y, dl=Math.hypot(dx,dy)||1, ux=dx/dl, uy=dy/dl;
    return this.enemies.filter(e=>{ if(e.dead) return false; const ex=e.x-x, ey=e.y-y, p=ex*ux+ey*uy;
      return p>=0&&p<=range+10&&Math.abs(ex*uy-ey*ux)<=width; })
      .sort((a,b)=>((a.x-x)*ux+(a.y-y)*uy)-((b.x-x)*ux+(b.y-y)*uy)); }
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
    if(this.fightBtns&&this.fightBtns.guard) this.fightBtns.guard.redraw(h.blocking); // Upgrade 20: the merged GUARD circle wears the guard's light
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
    // Upgrade 17: the dodge veil is a dark disc with a recovery arc, and
    // the block stamina strip is a ring around the Block circle. The
    // stamina BAR under the toggle stays a bar (it is a readout, not a
    // button) but narrows to the toggle's own width.
    // Upgrade 20: both fight rings ride the one GUARD circle now, drawn
    // together on its sweep — the dodge recovery veil (disc + arc),
    // the stamina ring (green while the guard holds, red through a
    // guard break), and, while GUARD is pressed, the hold-fill rim
    // that shows Block coming. AUTO-FIRE's sweep carries its own
    // hold-fill (its hold opens the controls).
    if(B.guard&&B.guard.sweep){ const b=B.guard, g=b.sweep, r=(b.sw||56)/2; g.clear();
      if(h.dodgeCd>0){ const frac=h.dodgeCd/FIGHT.dodgeCd; g.fillStyle(0x000000,0.5); g.fillCircle(b.sx,b.sy,r-2);
        arcSegs(g,b.sx,b.sy,r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-Math.min(1,frac)),3,0xf2c14e,0.85); }
      arcSegs(g,b.sx,b.sy,r-3,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,h.stamina)/FIGHT.stamMax,3,h.guardBreakT>0?0xa33b20:0x5aa33b,0.9);
      if(this.guardPress){ const f=Math.min(1,(performance.now()-this.guardPress.t0)/HOLD_MS);
        arcSegs(g,b.sx,b.sy,r+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f,3,this.guardPress.held?0xffe98a:0xf2c14e,0.95); } }
    if(B.autofire&&B.autofire.sweep){ const b=B.autofire, g=b.sweep; g.clear();
      if(this.afPress){ const f=Math.min(1,(performance.now()-this.afPress.t0)/HOLD_MS);
        arcSegs(g,b.sx,b.sy,(b.sw||56)/2+3,-Math.PI/2,-Math.PI/2+Math.PI*2*f,3,this.afPress.held?0xffe98a:0xf2c14e,0.95); } }
    if(this.fightBar){ const g=this.fightBar; g.clear();
      // Upgrade 12: the bar rides under the AUTO-FIRE toggle wherever
      // the player's layout puts it (Upgrade 17: as wide as the toggle).
      const bw=this.autoBtn?this.autoBtn.sw:64, bx=this.autoBtn?this.autoBtn.sx-bw/2:1146, by=this.autoBtn?this.autoBtn.sy+(this.autoBtn.sh/2)+16:124;
      g.fillStyle(0x000000,0.7); g.fillRect(bx,by,bw,8);
      g.fillStyle(h.stamina>30?0x5aa33b:0xa33b20,1); g.fillRect(bx,by,bw*Math.max(0,h.stamina)/FIGHT.stamMax,8);
      g.lineStyle(1,0xd9a441,0.9); g.strokeRect(bx,by,bw,8); }
    const st=Math.ceil(h.stamina);
    if(this.fightStat&&this._stamShown!==st){ this._stamShown=st; this.fightStat.setText('STAMINA '+st); } }
  // Upgrade 3: the hero returns only while the camp stands. Camp-Falls:
  // if the camp is rubble he simply stays down — the defeat itself is
  // spoken by campFall (he was already down when it fell) or by hurtHero
  // (he fell after it), never by this clock.
  tickHeroDown(dt){ const h=this.hero; if(h.down<=0) return; h.down-=dt;
    if(h.down<=0&&this.campHp>0){ h.hp=h.def.hp; h.down=0; h.spr.setAlpha(1); h.x=h.tx=this.campPos.x+60; h.y=h.ty=this.campPos.y; this.toast(h.def.name+' returns!'); } }
  // Upgrade 3: camp damage. Union Shield (shieldT) turns every blow aside.
  // The goal-wave champion hits the camp three times as hard.
  hitCamp(amt,e){ if(this.over) return;
    if(this.tutorial) return; // Upgrade 11: the tutorial's camp cannot fall — no blow lands on it at all
    if(this.campHp<=0) return; // Camp-Falls: rubble takes no blows — nothing is left to hit, and the fall is spoken once
    if(this.shieldT>0) return;
    if(e&&e.boss) amt*=3;
    this.campHp-=amt; this.campHurtThisWave=true; this.campHurtTotal=true;
    if(this.campSpr){ this.campSpr.setTintFill(0xff8a6a); this.time.delayedCall(90,()=>{ if(this.campSpr&&this.campSpr.active) this.campSpr.clearTint(); }); }
    SFX.campHit();
    // Upgrade 13: the threshold drum — first blood, half, quarter camp.
    // Each crossing is spoken once per run, however the HP got there.
    { const f=this.campHp/this.campMax;
      if(!this.campSndFirst){ this.campSndFirst=true; SFX.campAlarm(1); }
      if(f<=0.5&&!this.campSndHalf){ this.campSndHalf=true; SFX.campAlarm(2); }
      if(f<=0.25&&!this.campSndQuarter){ this.campSndQuarter=true; SFX.campAlarm(3); } }
    if(this.campWarnedWave!==this.wave){ this.campWarnedWave=this.wave; SFX.campWarning(); this.toast('The camp is under attack!',2600); }
    if(this.campHp<=0){ this.campHp=0; this.refreshHUD(); this.campFall(); return; }
    this.refreshHUD(); }
  // --- Camp-Falls (kennin's ruling, given twice and restated while he
  // watched the playtest, 2026-10-31 ~02:02 CDT): "The camp is only
  // there so the player can respawn. When the camp is not there or if
  // the camp gets destroyed while the player is still alive, the player
  // has to die to lose." The camp is the respawn, not the run: its fall
  // changes what a hero's death MEANS, and nothing else about the fight.
  campDown(){ return this.campHp<=0; }
  campFall(){ if(this.over) return;
    this.syncCampRubble();
    SFX.campAlarm(3);
    this.toast('The camp has fallen — no more respawns. Stay alive.',4200);
    this.floatText(this.campPos.x,this.campPos.y-84,'THE CAMP HAS FALLEN','#ff8a6a');
    // A hero already down was waiting on the camp's promise; with the
    // camp gone the wait has no end — the run ends here, at the fall.
    if(this.hero&&this.hero.down>0){ this._heroFell=true; this.end(false); } }
  // The rubble read: the camp sprite dims and greys where it stands.
  // syncCampRubble follows campHp wherever it changed — a blow, a
  // Repair, a Fortify tier, a mending orb — so the picture can never
  // disagree with the number. campFall calls it the moment of the
  // fall; update() calls it every frame for every quieter road back.
  syncCampRubble(){ const down=this.campHp<=0;
    if(down===!!this._campDown) return; this._campDown=down;
    if(this.campSpr){ if(down){ if(this.campSpr.setTint) this.campSpr.setTint(0x6a5a4a); if(this.campSpr.setAlpha) this.campSpr.setAlpha(0.55); }
      else { if(this.campSpr.clearTint) this.campSpr.clearTint(); if(this.campSpr.setAlpha) this.campSpr.setAlpha(1); } } }
  drawCampBar(){ if(!this.campBar) return; if(this.campHp<=0){ this.campBar.clear(); return; } // Camp-Falls: the bar leaves the field with the camp
    const f=Math.max(0,this.campHp/this.campMax), x=this.campPos.x-46, y=this.campPos.y-58, b=this.campBar;
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
  campFireTick(dt){ if(!this.campUp||!this.campUp.watchfire||!this.waveActive||this.campHp<=0) return; // Camp-Falls: the fire is the camp's — rubble has no fire; a rebuilt camp's fire returns with it
    this.campFireCd-=dt; if(this.campFireCd>0) return;
    const t=this.nearestEnemy(this.campPos.x,this.campPos.y,CAMP_FIRE.range);
    if(!t){ this.campFireCd=0.25; return; }
    this.campFireCd=CAMP_FIRE.rate;
    this.shoot(this.campPos.x,this.campPos.y-40,t,'ember',{dmg:CAMP_FIRE.dmg,type:'fire',crit:0},700);
    this.spark(this.campPos.x,this.campPos.y-46,0xd9a441,2); }
  // --- Upgrade 15: gather & build — nodes, the purse, pieces, build mode ---
  // Resource nodes stand at fixed fractions of the world (NODE_SPOTS),
  // the orb-station pattern: every era inherits the same posts, clear of
  // the camp, the orb stations and each other.
  buildNodes(){ this.nodes=[];
    const add=(kind,fx,fy)=>{ const x=Math.round(fx*this.worldW), y=Math.round(fy*this.worldH);
      const spr=this.add.image(x,y,kind==='tree'?'tree':'rock').setDepth(4);
      const n={kind,x,y,hp:GATHER.gathers,max:GATHER.gathers,regrowT:0,spr}; this.nodes.push(n); this.nodeVisual(n); };
    NODE_SPOTS.trees.forEach(([fx,fy])=>add('tree',fx,fy));
    NODE_SPOTS.rocks.forEach(([fx,fy])=>add('rock',fx,fy)); }
  // A gathered-out node stands dimmed, greyed and shrunk until it regrows.
  nodeVisual(n){ if(!n.spr) return; const gone=n.hp<=0;
    if(n.spr.setAlpha) n.spr.setAlpha(gone?0.5:1);
    if(n.spr.setTint){ if(gone) n.spr.setTint(0x8a7a68); else n.spr.clearTint(); }
    if(n.spr.setScale) n.spr.setScale(gone?0.8:1); }
  // Gathering: the hero gathers by STANDING at a node — still (his feet
  // settled, under every movement scheme: a target reached, a stick
  // released, a finger lifted) and within GATHER.range. Every
  // GATHER.tick of standing, one swing lands and the yield joins the
  // purse. Walking through a grove gathers nothing; a dodge or a march
  // breaks the rhythm and the channel restarts.
  gatherTick(dt){ if(!this.nodes||!this.hero) return; const h=this.hero;
    for(const n of this.nodes){ if(n.hp<=0&&n.regrowT>0){ n.regrowT-=dt;
      if(n.regrowT<=0){ n.hp=n.max; this.nodeVisual(n); } } }
    if(h.down>0){ this.gatherT=0; this._ghx=h.x; this._ghy=h.y; return; }
    const still=this._ghx!==undefined&&Math.hypot(h.x-this._ghx,h.y-this._ghy)<2.5;
    this._ghx=h.x; this._ghy=h.y;
    if(!still){ this.gatherT=0; return; }
    const n=this.nodes.find(n=>n.hp>0&&Math.hypot(n.x-h.x,n.y-h.y)<=GATHER.range);
    if(!n){ this.gatherT=0; return; }
    this.gatherT=(this.gatherT||0)+dt;
    if(this.gatherT<GATHER.tick) return;
    this.gatherT=0; n.hp--;
    const isTree=n.kind==='tree', gain=isTree?GATHER.woodYield:GATHER.stoneYield;
    if(isTree){ this.wood=(this.wood||0)+gain; SFX.atkMelee(false); } else { this.stone=(this.stone||0)+gain; SFX.atkBlunt(false); }
    this.floatText(n.x,n.y-56,'+'+gain+' '+(isTree?'Wood':'Stone'),isTree?'#c9a46a':'#c8ccd4');
    this.spark(n.x,n.y-8,isTree?0x6a8a3a:0x9aa0a8,3);
    if(this.tweens) this.tweens.add({targets:n.spr,x:n.x+3,duration:45,yoyo:true,repeat:1});
    if(n.hp<=0){ n.regrowT=GATHER.regrow; this.nodeVisual(n); this.floatText(n.x,n.y-76,'Gathered out — it will regrow','#a08a6a'); }
    this.refreshHUD(); this.refreshBuildBar(); }
  // --- build mode: the bar, the tools, placement, pieces ---
  // Build mode and the targeting modes are exclusive meanings for a
  // field tap: entering one cancels the others. The camp panel and the
  // build bar likewise close each other — one overlay at a time.
  toggleBuildMode(){ if(this.over||this.shopOpen||this.victoryOpen||this.paused||this.layoutEdit) return;
    // The tutorial's seven steps stand unchanged; building waits for
    // the real wall, the same refusal the ⚙ gives there.
    if(this.tutorial){ this.toast('Building waits for the real wall — the lesson stays as it is.'); return; }
    if(this.buildMode){ this.exitBuildMode(); return; }
    this.closeFan(); // Upgrade 17: build mode and the fan never stand together
    this.buildMode=true; this.volleyMode=false; this.rallyMode=false;
    if(this.campPanelOpen) this.closeCampPanel();
    this.renderBuildBar(); this.refreshHUD(); }
  exitBuildMode(){ this.buildMode=false; this.clearBuildBar(); }
  clearBuildBar(){ (this.buildItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.buildItems=[]; this.buildBarRect=null; }
  refreshBuildBar(){ if(this.buildMode) this.renderBuildBar(); }
  renderBuildBar(){ this.clearBuildBar(); if(!this.buildMode) return; const items=[]; this.buildItems=items;
    const cy=HUD_Y-72;
    const g=this.add.graphics().setDepth(55); g.fillStyle(0x140c07,0.94); g.fillRoundedRect(W/2-430,cy-40,860,80,10); g.lineStyle(2,0xd9a441,1); g.strokeRoundedRect(W/2-430,cy-40,860,80,10); items.push(g);
    items.push(txt(this,W/2,cy-24,'Wood '+Math.floor(this.wood||0)+'  ·  Stone '+Math.floor(this.stone||0)+'  —  tap the field to use the tool in hand',13,'#cdbd95').setOrigin(0.5).setDepth(56));
    const mendCost=Math.max(1,Math.ceil(BUILD.pieces.fence.cost/BUILD.mendCostDiv));
    const tool=(id,label,x,w,afford)=>{ const b=button(this,x,cy+14,w,40,label,()=>{ this.buildTool=id; this.renderBuildBar(); },{size:14,disabled:!afford}); b.setDepth(56); if(this.buildTool===id) b.redraw(true); items.push(b); };
    tool('fence','Fence · '+BUILD.pieces.fence.cost+' wood',W/2-330,180,(this.wood||0)>=BUILD.pieces.fence.cost);
    tool('wall','Wall · '+BUILD.pieces.wall.cost+' stone',W/2-140,180,(this.stone||0)>=BUILD.pieces.wall.cost);
    tool('mend','Mend · '+mendCost,W/2+40,140,true);
    tool('demolish','Demolish',W/2+190,170,true);
    const dn=button(this,W/2+360,cy+14,110,40,'Done',()=>this.exitBuildMode(),{size:14}); dn.setDepth(56); items.push(dn);
    this.buildBarRect={x:W/2,y:cy,w:860,h:80};
    this.fixUI(); }
  buildCell(wx,wy){ return {cx:Math.floor(wx/BUILD.grid)*BUILD.grid+BUILD.grid/2, cy:Math.floor(wy/BUILD.grid)*BUILD.grid+BUILD.grid/2}; }
  // The placement law (see BUILD at the top of the file): a cell is
  // refused for exactly one named reason, or it is buildable. Occupancy
  // is the caller's check — it depends on the tool in hand.
  canPlace(cx,cy){ if(cx<BUILD.grid||cx>this.worldW-BUILD.grid||cy<BUILD.grid||cy>this.worldH-BUILD.grid/2) return 'bounds';
    if(Math.hypot(cx-this.campPos.x,cy-this.campPos.y)<BUILD.campClear) return 'camp';
    if(cx>this.worldW-BUILD.spawnBand) return 'spawn';
    for(const n of (this.nodes||[])) if(Math.hypot(cx-n.x,cy-n.y)<BUILD.nodeClear) return 'node';
    for(const o of (this.orbs||[])) if(Math.hypot(cx-o.x,cy-o.y)<BUILD.orbClear) return 'orb';
    return null; }
  buildTap(wx,wy){ const cell=this.buildCell(wx,wy);
    const pc=(this.builds||[]).find(b=>b.cx===cell.cx&&b.cy===cell.cy);
    if(pc){ if(this.buildTool==='mend') return this.mendBuild(pc);
      if(this.buildTool==='demolish') return this.demolishBuild(pc);
      this.toast('Already built there — Mend it, Demolish it, or pick another spot'); return 'occupied'; }
    if(this.buildTool==='mend'||this.buildTool==='demolish'){ this.toast('Nothing built there'); return 'empty'; }
    return this.tryPlace(this.buildTool,wx,wy); }
  tryPlace(kind,wx,wy){ const def=BUILD.pieces[kind]; if(!def) return 'nodef';
    const cell=this.buildCell(wx,wy), cx=cell.cx, cy=cell.cy;
    if((this.builds||[]).some(b=>b.cx===cx&&b.cy===cy)) return 'occupied';
    const bad=this.canPlace(cx,cy);
    if(bad){ this.toast({bounds:'Off the field',camp:'Too close to the camp — the tent needs its ground',spawn:'The enemy road stays open — nothing seals the spawn mouth',node:'A tree or rock stands there',orb:'Too close to an orb station'}[bad]||'Cannot build there'); return bad; }
    if((this[def.res]||0)<def.cost){ this.toast('Not enough '+def.res+' — gather more from '+(def.res==='wood'?'trees':'rocks')); return 'funds'; }
    this[def.res]-=def.cost;
    const pc={def,x:cx,y:cy,cx,cy,hp:def.hp,max:def.hp};
    pc.spr=this.add.image(cx,cy,def.tex).setDepth(6);
    pc.bar=this.add.graphics().setDepth(12);
    this.builds.push(pc); this.drawBuildBar(pc);
    this.spark(cx,cy-8,def.res==='wood'?0xb08d4a:0xc8ccd4,5); SFX.build();
    this.refreshBuildBar(); this.refreshHUD();
    return 'placed'; }
  // A piece under attack: wear shows in tint stages over its HP bar, and
  // at zero the piece falls — sprite, bar and registry entry together —
  // and the road it held reopens.
  damageBuild(pc,amt){ if(!pc||pc.hp<=0) return; pc.hp-=amt;
    if(pc.hp<=0){ this.teardownBuild(pc);
      this.floatText(pc.x,pc.y-34,(pc.def.id==='fence'?'Fence':'Wall')+' down!','#ff8a6a');
      this.spark(pc.x,pc.y,pc.def.res==='wood'?0xb08d4a:0xc8ccd4,8); SFX.atkBlunt(false); return; }
    this.buildWear(pc); this.drawBuildBar(pc); }
  buildWear(pc){ if(!pc.spr) return; const f=pc.hp/pc.max;
    if(f>2/3) pc.spr.clearTint(); else pc.spr.setTint(f>1/3?0xcfc0a8:0x9a8874); }
  drawBuildBar(pc){ const g=pc.bar; if(!g) return; g.clear();
    if(pc.hp<pc.max){ g.fillStyle(0x000000,0.7); g.fillRect(pc.x-28,pc.y-30,56,5);
      g.fillStyle(pc.hp/pc.max>0.35?0x5aa33b:0xa33b20,1); g.fillRect(pc.x-28,pc.y-30,56*Math.max(0,pc.hp)/pc.max,5); } }
  teardownBuild(pc){ pc.hp=0; if(pc.spr) pc.spr.destroy(); if(pc.bar) pc.bar.destroy();
    this.builds=(this.builds||[]).filter(b=>b!==pc); }
  // Mend: half the piece's strength back for a third of its cost. A
  // whole piece refuses — mending is care, not a purse leak.
  mendBuild(pc){ if(pc.hp>=pc.max){ this.toast('That piece is already whole'); return 'full'; }
    const cost=Math.max(1,Math.ceil(pc.def.cost/BUILD.mendCostDiv)), purse=pc.def.res;
    if((this[purse]||0)<cost){ this.toast('Mending needs '+cost+' '+purse); return 'funds'; }
    this[purse]-=cost; pc.hp=Math.min(pc.max,pc.hp+pc.max*BUILD.mendHealFrac);
    this.buildWear(pc); this.drawBuildBar(pc); SFX.build(); this.spark(pc.x,pc.y-8,0x8fd06a,3);
    this.refreshBuildBar(); this.refreshHUD(); return 'mended'; }
  // Demolish: half the cost back (rounded down). Rebuilding elsewhere
  // is a plan; demolishing is never a free re-deal of the full price.
  demolishBuild(pc){ const refund=Math.floor(pc.def.cost*BUILD.demolishRefund), purse=pc.def.res;
    this[purse]=(this[purse]||0)+refund;
    this.teardownBuild(pc); this.floatText(pc.x,pc.y-30,'+'+refund+' '+purse+' back',GOLD); SFX.atkBlunt(false);
    this.refreshBuildBar(); this.refreshHUD(); return 'demolished'; }
  // The placement ghost: the cell under the pointer, green when the
  // tool in hand may land there, gold over a piece it can work on, red
  // when it may not. A guide drawn from live state — never a promise
  // the tap itself doesn't re-check.
  drawBuildGhost(){ const g=this.buildGhost; if(!g) return; g.clear();
    if(!this.buildMode||!this._ptrW) return;
    const cell=this.buildCell(this._ptrW.x,this._ptrW.y);
    const pc=(this.builds||[]).find(b=>b.cx===cell.cx&&b.cy===cell.cy);
    let ok=false;
    if(pc) ok=(this.buildTool==='mend'&&pc.hp<pc.max)||this.buildTool==='demolish';
    else if(this.buildTool==='fence'||this.buildTool==='wall'){ const def=BUILD.pieces[this.buildTool]; ok=!this.canPlace(cell.cx,cell.cy)&&(this[def.res]||0)>=def.cost; }
    const col=ok?(pc?0xf2c14e:0x5aa33b):0xa33b20;
    g.fillStyle(col,0.10); g.fillRect(cell.cx-BUILD.grid/2,cell.cy-BUILD.grid/2,BUILD.grid,BUILD.grid);
    g.lineStyle(2,col,0.9); g.strokeRect(cell.cx-BUILD.grid/2,cell.cy-BUILD.grid/2,BUILD.grid,BUILD.grid); }
  // --- Upgrade 15: the intermission's other room — the field ---
  // Stepping out of the shop does not close the intermission: the same
  // shopEndsAt deadline keeps running in update(), the field bar below
  // carries the same countdown, and the wave starts from the field at
  // zero exactly once (beginInterWave), or early by its button.
  leaveShopToField(){ if(!this.shopOpen||this.revealPanel) return; this.shopOpen=false; this.shopFirst=false; this.clearShop();
    this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000);
    this.interField=true; this.renderInterBar(); }
  renderInterBar(){ this.clearInterBar(); const items=[]; this.interItems=items;
    const g=this.add.graphics().setDepth(55); g.fillStyle(0x140c07,0.94); g.fillRoundedRect(W/2-340,76,680,56,10); g.lineStyle(2,0xd9a441,1); g.strokeRoundedRect(W/2-340,76,680,56,10); items.push(g);
    this.interTxt=txt(this,478,104,this.shopTimerLabel(),16,GOLD).setOrigin(0.5).setDepth(56); items.push(this.interTxt);
    const sb=button(this,740,104,120,40,'Shop',()=>this.openShop(false,true),{size:15}); sb.setDepth(56); items.push(sb);
    const nb=button(this,890,104,150,40,'Next Wave ▶',()=>this.beginInterWave(),{size:15}); nb.setDepth(56); items.push(nb);
    items.push(txt(this,W/2,152,'Between waves: gather wood and stone — BUILD fences and walls around the camp.',13,'#cdbd95').setOrigin(0.5).setDepth(56));
    this.interBtnRects=[{x:740,y:104,w:120,h:40},{x:890,y:104,w:150,h:40}];
    this.fixUI(); }
  clearInterBar(){ (this.interItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.interItems=[]; this.interTxt=null; this.interBtnRects=[]; }
  beginInterWave(){ if(!this.interField) return; this.interField=false; this.clearInterBar(); this.startWave(); }
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
  // Upgrade 14: hero identity and weekly-twist helpers (see HEROISM /
  // TWIST at the top of the file). enemySpdMul is Deborah's song over
  // the field; samsonAlone is Samson's standing, read live — a squad
  // marching to his side ends it the moment it arrives, and a squad's
  // fall can wake it mid-fight. heroDmgMul is the hero's full basic-
  // attack multiplier: the orb's strength, and Samson's alone-price.
  twistDef(){ return TWISTS.find(t=>t.id===this.twist)||null; }
  isNightWave(w){ return w%2===0||this.twist==='torches'; }
  enemySpdMul(){ return this.heroDef&&this.heroDef.id==='deborah'?HEROISM.deborahSongAdvance:1; }
  samsonAlone(){ if(!this.heroDef||this.heroDef.id!=='samson'||!this.hero||this.hero.down>0) return false;
    return !this.squads.some(s=>!s.dead&&Phaser.Math.Distance.Between(s.x,s.y,this.hero.x,this.hero.y)<=HEROISM.samsonAloneRange); }
  heroDmgMul(){ return this.orbDmgMul()*(this.samsonAlone()?HEROISM.samsonAloneDmgMul:1); }
  // Upgrade 18: THE WORD — while the Bible is carried and a wave is
  // being fought, its blast gathers and speaks every blastEvery
  // seconds: holy damage to every foe within blastRadius of the hero,
  // a ring of light, and the next verse in the rotation spoken over
  // him. Its aura is separate and constant: squads standing within
  // auraRange strike at auraDmgMul (bibleAuraMul, read at the squad
  // attack site). Neither runs in the shop, the tutorial (which never
  // carries it), or after the run.
  bibleTick(dt){ if(!this.weapon||this.weapon.family!=='bible'||!this.waveActive||this.over) return;
    const h=this.hero; if(!h||h.down>0) return;
    this.bibleT=(this.bibleT==null?BIBLE_WEAPON.blastEvery:this.bibleT)-dt;
    if(this.bibleT>0) return;
    this.bibleT=BIBLE_WEAPON.blastEvery;
    const dmg=BIBLE_WEAPON.blastDmg*(h.def.dmg/18)*this.heroDmgMul();
    this.enemies.slice().forEach(e=>{ if(!e.dead&&Math.hypot(e.x-h.x,e.y-h.y)<=BIBLE_WEAPON.blastRadius) this.damage(e,dmg,'holy',{}); });
    if(this.add.circle){ const c=this.add.circle(h.x,h.y,14,0xfff3c0,0.35).setDepth(15);
      if(this.tweens) this.tweens.add({targets:c,radius:BIBLE_WEAPON.blastRadius,alpha:0,duration:480,onComplete:()=>c.destroy()}); }
    this.floatText(h.x,h.y-84,BIBLE_VERSES[this._verseI=((this._verseI||0)+1)%BIBLE_VERSES.length],'#fff3c0');
    SFX.bibleBlast(); }
  bibleAuraMul(s){ if(!this.weapon||this.weapon.family!=='bible'||!this.hero||this.hero.down>0) return 1;
    return Math.hypot(s.x-this.hero.x,s.y-this.hero.y)<=BIBLE_WEAPON.auraRange?BIBLE_WEAPON.auraDmgMul:1; }
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
    // Upgrade 19: an orb TREAT (a seasonal bundle gift) pays for the
    // touch instead — one banked treat, one free orb, this run only.
    if(!this.tutorial&&(this.freeOrbs||0)>0){ this.freeOrbs--; this.toast('A treat pays for this orb — '+this.freeOrbs+' free '+(this.freeOrbs===1?'orb':'orbs')+' left'); }
    else if(!this.tutorial&&!Tokens.spend('orb:'+o.def.id,o.def.cost)){ this.toast('Not enough Grokonians (have '+Tokens.balance()+')'); return 'funds'; }
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
    if(s.hp<=0){ s.dead=true; if(this.selSquad===s) this.selSquad=null; s.spr.destroy(); s.bar.destroy(); SFX.allyDie(); this.toast(s.def.name+' has fallen. Squad lost — the fallen do not return this run',2800); } }
  // Upgrade 13: a squad's weapon has a voice — archers and bowmen loose
  // a string, every other ranged hand a sling, spears stab, and the
  // melee lines swing (with a grunt of effort under the swing, capped
  // hard inside SFX so a full line never turns to noise).
  squadAtkSfx(s){ const d=s.def;
    if(d.role==='ranged'||d.role==='support'){ if(/archer|bowman/.test(d.id)) SFX.atkBow(false); else SFX.atkSling(false); }
    else if(d.role==='spear') SFX.atkSpear(false);
    else { SFX.atkMelee(false); SFX.exert(); } }
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
      else if(this.endless&&w>this.goalWave&&w%ENDLESS_CHAMP_EVERY===0) push('idol_golem',1); // Upgrade 14: the endless champion, on the ten-wave heartbeat
    } else { // generic fallback for future eras
      push(E[3].id,Math.min(2+w,10)); push(E[0].id,w>=5?Math.min(w-3,5):0); push(E[1].id,w>=4?Math.min(w-2,6):0); push(E[2].id,w>=6?Math.min(w-4,4):0);
    }
    return comp.filter(([,n])=>n>0); }
  startWave(){ this.wave++; this.waveActive=true; this.campHurtThisWave=false;
    const night=this.isNightWave(this.wave); this.waveNight=night;
    if(this.nightRect) this.nightRect.destroy();
    if(night) this.nightRect=this.add.rectangle(this.worldW/2,this.worldH/2,this.worldW,this.worldH,0x0a1030,0.22).setDepth(18);
    const hpM=hpScaleForWave(this.wave), dmM=dmgScaleForWave(this.wave);
    let t=0.6, bossDone=false;
    // Upgrade 14: a champion wave is the goal wave — or, in endless, every
    // ENDLESS_CHAMP_EVERY waves past it. One champion per wave, always.
    const champWave=(this.wave===this.goalWave&&!this.endless)||(this.endless&&this.wave>this.goalWave&&this.wave%ENDLESS_CHAMP_EVERY===0);
    this.waveComp(this.wave).forEach(([def,n])=>{ for(let i=0;i<n;i++){ const boss=(champWave&&def.id==='idol_golem'&&i===n-1&&!bossDone); if(boss) bossDone=true;
        this.spawnQ.push({def,at:t,boss}); t+=def.spawnGap||(def.role==='ranged'?1.1:0.75); } t+=1.2; });
    this.spawnQ.sort((a,b)=>a.at-b.at); this.waveClock=0; this.waveHpM=hpM; this.waveDmM=dmM;
    // Upgrade 14: the Seventh Day — the wave's whole spawn holds back for
    // the rest; update() rains the manna while the field stands empty.
    this.seventhT=0; this.seventhAcc=0;
    if(this.twist==='seventh'&&this.wave%TWIST.seventhEvery===0){ this.spawnQ.forEach(q=>{ q.at+=TWIST.seventhRest; }); this.seventhT=TWIST.seventhRest; }
    SFX.wave(); this.toast('Wave '+this.wave+(night?' — Night':' — Day')+(this.wave===this.goalWave&&!this.endless?' — the goal wave!':'')+(champWave&&this.endless?' — a champion rises!':'')+(this.seventhT>0?' — the Seventh Day: rest, and manna rains':'')); this.refreshHUD(); }
  spawn(q){ const d=q.def, hpM=this.waveHpM*(q.boss?5:1), dmM=this.waveDmM*(q.boss?1.6:1);
    const e={def:d,hp:d.hp*hpM,max:d.hp*hpM,dmg:d.dmg*dmM,range:d.range,rate:d.rate,speed:d.speed*(this.waveNight?(this.twist==='torches'?TWIST.torchEnemySpd:1.08):1),
      x:this.worldW+20+Math.random()*30,y:120+Math.random()*Math.max(60,this.worldH-280),cd:0,dead:false,boss:q.boss,armorType:'flesh',ph:Math.random()*6};
    e.spr=uspr(this,e.x,e.y,d,q.boss?120:(d.img?66:(SZ[d.sprite]||54))); applyTint(e.spr,d);
    e.spr.setDepth(7); e.bar=this.add.graphics().setDepth(12); if(d.heals) e.healCd=1.5; if(q.boss) this.setupBoss(e); this.enemies.push(e);
    if(d.sprite==='golem') SFX.golemSpawn(); // Upgrade 13: stone announces itself — a rumble as it takes the field
    return e; }
  // --- goal-wave champion: boss name + health bar (the old TD treatment) ---
  setupBoss(e){ this.boss=e; this.bossBar=this.add.graphics().setDepth(32).setScrollFactor(0);
    this.bossName=txt(this,W/2,HUD_Y-30,e.def.name.toUpperCase()+(this.endless?' — ENDLESS CHAMPION · WAVE '+this.wave:' — GOAL-WAVE CHAMPION'),20,GOLD).setOrigin(0.5).setDepth(32).setScrollFactor(0);
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
          SFX.bossWarn(BOSS.heavyWindup); // Upgrade 13: the wind-up has a rising voice — pitch is the timer
          if(e.spr&&e.spr.active) e.spr.setTintFill(0xff5a3a);
          this.floatText(e.x,e.y-84,'!','#ff8a6a'); this.spark(e.x,e.y,0xff5a3a,4); }
        else e.heavyT=0.5; } }
    // --- ground slam (Phase II and beyond) ---
    if((e.bossPhase||1)>=2){
      if(e.slam){ e.slam.t-=dt;
        if(e.slam.t<=0){ const s=e.slam; e.slam=null; e.slamT=BOSS.slamEvery; this.bossSlamImpact(e,s); } }
      else { e.slamT-=dt;
        if(e.slamT<=0){ const pos=this.bossSlamTarget(e);
          if(pos){ e.slam={x:pos.x,y:pos.y,t:BOSS.slamDelay}; SFX.bossWarn(BOSS.slamDelay); this.spark(pos.x,pos.y,0xff8a3a,4); }
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
    // Upgrade 15: a piece he is chewing also engages him — the wind-up
    // gathers while he is held at a fence, as it does at a defender.
    for(const pc of (this.builds||[])){ if(pc.hp>0&&Phaser.Math.Distance.Between(e.x,e.y,pc.x,pc.y)-BUILD.bodyR<=90) return true; }
    return this.campHp>0&&Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y)<=e.range+34; } // Camp-Falls: rubble does not engage him — no wind-up is spent on a fallen camp
  // The slam falls where the prey stands when the champion commits: the
  // nearest defender within 150px, else the camp if the champion is on it.
  bossSlamTarget(e){ let best=null,bd=150; const h=this.hero;
    if(h&&h.down<=0){ const d=Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y); if(d<bd){ bd=d; best={x:h.x,y:h.y}; } }
    for(const s of this.squads){ if(s.dead) continue; const d=Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y); if(d<bd){ bd=d; best={x:s.x,y:s.y}; } }
    if(best) return best;
    if(this.campHp>0&&Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y)<=e.range+74) return {x:this.campPos.x,y:this.campPos.y}; // Camp-Falls: the slam is never spent on rubble
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
    SFX.bossBoom(1); this.cameras.main.shake(160,0.006); this.spark(e.x,e.y,0xff8a6a,8); }
  // The slam lands: slamMul x damage to everyone still inside the marked
  // circle; the camp, if the circle covers it, takes one normal camp blow.
  bossSlamImpact(e,s){ const dmg=e.dmg*BOSS.slamMul, h=this.hero;
    if(h&&h.down<=0&&Phaser.Math.Distance.Between(s.x,s.y,h.x,h.y)<=BOSS.slamRadius) this.hurtHero(dmg,true);
    this.squads.slice().forEach(q=>{ if(!q.dead&&Phaser.Math.Distance.Between(s.x,s.y,q.x,q.y)<=BOSS.slamRadius) this.hurtSquad(q,dmg); });
    if(Phaser.Math.Distance.Between(s.x,s.y,this.campPos.x,this.campPos.y)<=BOSS.slamRadius) this.hitCamp(e.dmg,e);
    SFX.bossBoom(1.2); this.cameras.main.shake(220,0.008);
    const c=this.add.circle(s.x,s.y,BOSS.slamRadius,0xff8a3a,0.3).setDepth(6); this.tweens.add({targets:c,alpha:0,scale:1.15,duration:320,onComplete:()=>c.destroy()}); }
  // --- combat core ---
  damage(e,amt,type,opt){ if(e.dead) return; opt=opt||{};
    let m=(DATA.armorTable[e.armorType]||{})[type]||1; if(opt.crit&&Math.random()<opt.crit){ m*=(e.boss?2.5:2)*(opt.critMul||1); this.floatText(e.x,e.y-20,'CRIT','#f2c14e'); }
    e.hp-=amt*m; SFX.enemyHit(amt); if(e.def&&e.def.sprite==='golem') SFX.golemGroan(); // Upgrade 13: stone complains when it is struck
    if(e.boss&&e.hp>0) this.bossPhaseSync(e); // Upgrade 7: crossing a phase line changes the champion NOW, once
    if(opt.slow){ e.slow=Math.max(e.slow||0,opt.slow); e.slowT=Math.max(e.slowT||0,1.2); }
    if(opt.stun){ e.stun=Math.max(e.stun||0,opt.stun*(e.boss?0.3:1)); }
    if(opt.burn){ e.burn=Math.max(e.burn||0,opt.burn[0]); e.burnT=Math.max(e.burnT||0,opt.burn[1]); }
    if(e.spr.active){ e.spr.setTintFill(0xffffff); this.time.delayedCall(60,()=>{ if(!e.dead&&e.spr.active){ e.spr.clearTint(); applyTint(e.spr,e.def); } }); }
    if(e.hp<=0) this.kill(e); }
  kill(e){ e.dead=true; this.kills++; this.manna+=e.def.bounty||5; this.tr('kills'); if(e.def.sprite==='locust') this.tr('flyKills');
    if(e.boss){ this.tr('bossKills'); this.clearBoss(); this.toast(e.def.name+' has fallen!',2400); } this.gx(DATA_P().xp.kill); if(e.def&&e.def.sprite==='golem') SFX.golemDie(); else SFX.enemyDie(); this.spark(e.x,e.y,0xcdbd95,8);
    // Upgrade 18: the chest roll — the ONLY road to new weapons. A
    // champion always leaves one; an elite (the non-champion Idol
    // Golem) at a real chance; an ordinary enemy rarely. The tutorial
    // drops none: its economy firewall stays sealed.
    if(!this.tutorial){ const kind=e.boss?'champion':(e.def.id==='idol_golem'?'elite':'normal');
      const grade=rollChestDrop(kind); if(grade) this.dropChest(grade,e.x,e.y,kind!=='normal');
      // Upgrade 19: in its season, the seasonal chest ALSO falls —
      // elites at its real chance, champions always — beside the U18
      // chest, a step apart so the two never hide each other.
      const sv=liveSeason(); if(sv&&rollSeasonalDrop(sv,kind)) this.dropChest(sv.id,e.x+22,e.y+14,kind!=='normal'); }
    this.tweens.add({targets:e.spr,alpha:0,scale:0.3,duration:250,onComplete:()=>e.spr.destroy()}); e.bar.destroy(); this.refreshHUD(); }
  // A chest on the field: it lies where the foe fell until the hero
  // walks over it and banks it. Unbanked chests belong to the field and
  // end with the run; banked ones wait in the Rack (see openShop).
  dropChest(grade,x,y,announce){ if(!this.fieldChests) this.fieldChests=[];
    const spr=this.add.image(x,y,'chest_'+grade).setDepth(6);
    if(this.tweens) this.tweens.add({targets:spr,y:y-6,duration:800,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    this.fieldChests.push({grade:grade,x:x,y:y,spr:spr});
    if(announce) this.floatText(x,y-34,grade==='gold'?'A golden chest!':(SEASON_BY_ID[grade]?('The '+chestDisplay(grade).name+' falls!'):'A chest!'),chestDisplay(grade).css);
    return grade; }
  collectChests(){ if(!this.fieldChests||!this.fieldChests.length||!this.hero||this.hero.down>0) return; const h=this.hero;
    this.fieldChests=this.fieldChests.filter(c=>{ if(Math.hypot(c.x-h.x,c.y-h.y)>=30) return true;
      if(c.spr) c.spr.destroy(); this.pendingChests.push(c.grade); Rack.setPending(this.pendingChests);
      this.floatText(c.x,c.y-18,'Chest banked — it opens after the wave',GOLD); SFX.chest(); return false; }); }
  shoot(x,y,target,key,opt,speed){ const s=this.add.image(x,y,key).setDepth(13); const sh={s,target,opt,speed:speed||560,lx:target.x,ly:target.y};
    // Upgrade 18: a piercing shot (the rifle) remembers where it was
    // fired from, whom it has already struck, and how far it may fly.
    if(opt&&opt.pierce){ sh.hitSet=new Set(); sh.ox=x; sh.oy=y; sh.pc=0; }
    this.shots.push(sh); }
  spark(x,y,col,n){ for(let i=0;i<(n||4);i++){ const p=this.add.image(x,y,'spark').setTint(col).setDepth(16).setScale(0.8); this.tweens.add({targets:p,x:x+Phaser.Math.Between(-24,24),y:y+Phaser.Math.Between(-24,24),alpha:0,scale:0.2,duration:350,onComplete:()=>p.destroy()}); } }
  floatText(x,y,s,c){ const t=txt(this,x,y,s,14,c).setOrigin(0.5).setDepth(25); this.tweens.add({targets:t,y:y-26,alpha:0,duration:700,onComplete:()=>t.destroy()}); }
  // Upgrade 16: the press float — a battle button's press floats its NAME
  // above the button for a breath, so the symbol on its face teaches its
  // meaning in the moment. One float at a time; a new press replaces it.
  floatBtnName(c,name){ if(!c||!name) return;
    if(this._nf){ try{ this._nf.destroy(); }catch(e){} this._nf=null; }
    const t=txt(this,c.x,c.y-46,name,15,'#f2c14e').setOrigin(0.5).setDepth(45); if(t.setScrollFactor) t.setScrollFactor(0); this._nf=t;
    if(this.tweens&&this.tweens.add) this.tweens.add({targets:t,y:c.y-64,alpha:0,duration:950,onComplete:()=>{ try{ t.destroy(); }catch(e){} if(this._nf===t) this._nf=null; }}); }
  nearestEnemy(x,y,r){ let best=null,bd=r; for(const e of this.enemies){ if(e.dead) continue; const d=Phaser.Math.Distance.Between(x,y,e.x,e.y); if(d<bd){ bd=d; best=e; } } return best; }
  useSkill(i,aimPt){ const b=this.skillBtns[i]; if(this.over||b.cd>0||this.shopOpen) return; const k=b.def, h=this.hero, E=this.enemies.filter(e=>!e.dead);
    // Upgrade 20: an AIMED cast (a held power, released on the reticle)
    // moves the cast's CENTER to the aim point: area effects bloom
    // there, and targeted moves choose their marks around there.
    // Projectiles still fly from the hero's hand, buffs still bless
    // the whole army (Psalm's ring blooms where it is aimed; the
    // blessing was never local), and a tap cast passes no point at
    // all — byte-for-byte the cast it has always been. An aimed cast
    // whose point holds no mark answers 'No target' and consumes
    // nothing, exactly like a tap cast with no mark.
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
    const C=aimPt||h; // the cast's center: the hero, or the reticle's point
    const near=(r)=>E.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,C.x,C.y)<r);
    const strongest=(n,list)=>(list||E).slice().sort((a,b2)=>b2.hp-a.hp).slice(0,n);
    const ring=(r,col)=>{ const c=this.add.circle(C.x,C.y,10,col,0.3).setDepth(15); this.tweens.add({targets:c,radius:r,alpha:0,duration:500,onComplete:()=>c.destroy()}); };
    const buffSquads=(rate,dmg)=>this.squads.forEach(s=>{ if(rate) s.buffRateT=rate; if(dmg) s.buffDmgT=dmg; });
    switch(k.id){
      case 'stone': { const t=strongest(1,near(h.def.range*2))[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:120,type:'physical',stun:1.5,crit:0.2},700); SFX.smoothStone(); break; }
      case 'psalm': buffS(6,0); ring(240,0xd9a441); SFX.psalm(); break;
      case 'five': { const ts=aimPt?strongest(5,near(280)):strongest(5); if(!ts.length) return this.toast('No target'); ts.forEach((t,j)=>this.time.delayedCall(j*120,()=>shootS(h.x,h.y,t,'stone',{dmg:250*(t.boss?3:1),type:'physical',stun:0.5},800))); SFX.fiveStones(); this.cameras.main.flash(200,217,164,65); break; }
      case 'rally': buffS(0,8); ring(400,0xd9a441); break;
      case 'palm': near(170).forEach(e=>e.stun=Math.max(e.stun||0,ctrlS(2))); ring(170,0x8a6a9a); break;
      case 'song': E.forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=6*mul; dmgS(e,60,'holy'); }); this.cameras.main.flash(250,200,180,230); break;
      case 'lamp': near(180).forEach(e=>{ if(!e.boss) e.confuse=3*mul; }); ring(180,0xf2c14e); break;
      case 'three': { if(aimPt&&!near(320).length) return this.toast('No target'); for(let j=0;j<12;j++) this.time.delayedCall(j*70,()=>{ const L=this.enemies.filter(e=>!e.dead&&(!aimPt||Phaser.Math.Distance.Between(e.x,e.y,C.x,C.y)<320)); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,40,'holy'); this.spark(t.x,t.y,0xf2c14e); } }); break; }
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
      case 'pair': { if(aimPt&&!near(320).length) return this.toast('No target'); for(let j=0;j<6;j++) this.time.delayedCall(j*120,()=>{ const L=this.enemies.filter(e=>!e.dead&&(!aimPt||Phaser.Math.Distance.Between(e.x,e.y,C.x,C.y)<320)); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,45,'physical'); this.spark(t.x,t.y,0xcdbd95,3); } }); break; }
      case 'rain': near(220).forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=5*mul; }); ring(220,0xdfe6ee); break;
      case 'ark': { const mend=Math.round(50*mul); this.campHp=Math.min(this.campMax,this.campHp+mend); E.forEach(e=>dmgS(e,100,'holy')); this.floatText(this.campPos.x,this.campPos.y-70,'Camp +'+mend,'#8fd06a'); this.toast('The Ark: the camp is mended (+'+mend+')'); this.refreshHUD(); break; }
      case 'kite': { let src=aimPt?{x:C.x,y:C.y}:h, hit=[]; for(let j=0;j<4;j++){ const c=E.filter(e=>!hit.includes(e)&&Phaser.Math.Distance.Between(e.x,e.y,src.x,src.y)<220).sort((a,b2)=>Phaser.Math.Distance.Between(a.x,a.y,src.x,src.y)-Phaser.Math.Distance.Between(b2.x,b2.y,src.x,src.y))[0]; if(!c) break; this.fx.lineStyle(3,0xf2e07a,1).lineBetween(src.x,src.y,c.x,c.y); dmgS(c,90,'sonic',{stun:0.5}); hit.push(c); src=c; } this.time.delayedCall(150,()=>this.fx.clear()); if(!hit.length) return this.toast('No target'); break; }
      case 'bifocal': buffS(0,8); ring(260,0xf2e07a); break;
      case 'almanac': { if(aimPt&&!near(320).length) return this.toast('No target'); for(let j=0;j<10;j++) this.time.delayedCall(j*110,()=>{ const L=this.enemies.filter(e=>!e.dead&&(!aimPt||Phaser.Math.Distance.Between(e.x,e.y,C.x,C.y)<320)); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); dmgS(t,120,'sonic',{stun:0.4}); this.spark(t.x,t.y,0xf2e07a,5); } }); this.cameras.main.flash(200,240,230,150); break; }
      case 'crossing': { const t=(aimPt?strongest(1,near(320)):strongest(1))[0]; if(!t) return this.toast('No target'); h.x=h.tx=t.x; h.y=h.ty=t.y; near(110).forEach(e=>dmgS(e,100,'physical')); ring(110,0x3a5a9a); break; }
      case 'cherry': { const t=strongest(1,near(160))[0]; if(!t) return this.toast('No target'); dmgS(t,220,'physical',{stun:1}); break; }
      case 'forge': h.hp=h.def.hp; buffS(10,0); this.cameras.main.flash(250,200,210,240); break;
      case 'log': near(140).forEach(e=>e.stun=Math.max(e.stun||0,ctrlS(2.5))); ring(140,0x8a5a2a); break;
      case 'speech': buffS(0,10); ring(400,0xd9a441); break;
      case 'union': this.shieldT=10*mul; this.toast('Union Shield: the camp takes no damage for '+Math.round(10*mul)+'s'); break;
      case 'trick': strongest(3,near(260)).forEach(t=>shootS(h.x,h.y,t,'stone',{dmg:100,type:'physical',crit:0.5},900)); break;
      case 'sharp': { const t=strongest(1,near(320))[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:180,type:'physical',crit:0.5},1100); break; }
      case 'show': { if(aimPt&&!near(320).length) return this.toast('No target'); for(let j=0;j<15;j++) this.time.delayedCall(j*80,()=>{ const L=this.enemies.filter(e=>!e.dead&&(!aimPt||Phaser.Math.Distance.Between(e.x,e.y,C.x,C.y)<320)); if(L.length) shootS(h.x,h.y,Phaser.Utils.Array.GetRandom(L),'stone',{dmg:60,type:'physical',crit:0.3},1000); }); break; }
      case 'pillars': E.forEach(e=>{ dmgS(e,300,'physical'); e.stun=Math.max(e.stun||0,ctrlS(2)); }); this.cameras.main.shake(400,0.012); SFX.stomp(); break;
      default: { const t=(aimPt?strongest(1,near(320)):strongest(1))[0]; if(!t) return this.toast('No target'); shootS(h.x,h.y,t,'stone',{dmg:100,type:'physical'},700); break; }
    }
    this.floatText(h.x,h.y-56,k.name+'!','#f2c14e');
    if(tier>0) this.floatText(h.x,h.y-74,HELD.names[tier]+'!','#ffe98a');
    if(k.id!=='five'&&k.id!=='psalm'&&k.id!=='stone') SFX.skill(); if(i===2){ this.tr('ults'); if(k.id!=='five') SFX.ult(); } // Upgrade 13: stone/psalm/five carry signatures above — the generic skill chirp steps aside for them
    // Upgrade 8: the cast spends the charge and is tallied at its tier.
    this.heldSpent[tier]++; b.held=0; b._tierShown=0; b.buffered=false; b.cd=k.cd; b.cdMax=k.cd;
    if(this.tutorial){ this.tutEvent('power'); if(aimPt) this.tutEvent('aimed'); } } // Upgrade 11: a real cast — reached only past every 'No target' return, so it always counts. Upgrade 20: an aimed cast also proves the aim
  // --- between-wave shop ---
  // Upgrade 6: the intermission deadline is a wall-clock moment, set ONCE
  // here. It lives on the scene, not on any shop widget, so buying, paging
  // and the re-renders they cause never reset or pause it. shopT is the
  // remaining-seconds mirror update() maintains from that deadline.
  // Upgrade 15: openShop takes an optional second word — keepT. From the
  // field bar's Shop button, the intermission's deadline is KEPT, not
  // re-armed: the minute belongs to the intermission, not to whichever
  // room the player is standing in, so stepping in and out of the shop
  // can never farm time. Every other caller arms the full minute, as ever.
  openShop(first,keepT){ if(this.campPanelOpen) this.closeCampPanel(); this.closeFan(); this.exitBuildMode(); this.interField=false; this.clearInterBar(); this.shopOpen=true; this.shopFirst=!!first; this.shopPage=0;
    if(keepT&&this.shopEndsAt>Date.now()) this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000);
    else { this.shopT=SHOP_COUNTDOWN; this.shopEndsAt=Date.now()+SHOP_COUNTDOWN*1000; }
    // squads and hero mend between waves
    this.squads.forEach(s=>{ s.hp=s.max; }); this.hero.hp=this.heroDef.hp;
    this.renderShop(first);
    // Upgrade 18: banked chests open HERE, in the intermission, on the
    // reveal panel — on this same honest clock, never in the fight.
    this.openRevealIfAny(); }
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
    // Camp-Falls rider (2026-10-31): the head reads the RUN's own count,
    // never the caller's flag — a re-render of the OPENING shop (a camp
    // purchase, a page turn) used to announce "Wave 0 survived!".
    const head=this.wavesCleared>0?('Wave '+this.wavesCleared+' survived!  +'+(this.lastBonus||0)+' manna'):'Prepare your squads';
    this.shopAdd(txt(this,W/2,50,head,26,GOLD).setOrigin(0.5).setDepth(51));
    // Upgrade 15: the field door — step out of the shop and spend the
    // rest of the intermission gathering and building. The deadline
    // keeps running out there (update's interField branch); the bar
    // that appears carries the same countdown and the way back in.
    const fb=button(this,1085,50,170,42,'To the Field ▶',()=>this.leaveShopToField(),{size:15}); fb.setDepth(52); this.shopAdd(fb);
    this.shopHead2=this.shopAdd(txt(this,W/2,76,'',19,PARCH).setOrigin(0.5).setDepth(51)); this.updateShopHead();
    // Upgrade 4: the camp strip lives on page 1 only, and pushes that page's
    // unit grid down by 24px; pages 2+ keep the original geometry untouched.
    const gridY=this.shopPage===0?136:112;
    if(this.shopPage===0) this.renderCampStrip();
    if(this.shopFirst) this.shopAdd(txt(this,W/2,635,'While the camp stands, the fallen hero returns to it. If the camp falls, the fight goes on — but then the hero must not fall.',13,'#cdbd95').setOrigin(0.5).setDepth(51));
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
  closeShop(){ this.shopOpen=false;
    // Upgrade 18: a chest mid-reveal holds the wave — the shop simply
    // stays open behind the reveal panel (its deadline is held by
    // update() while the panel stands; see the shop branch there).
    if(this.revealPanel){ this.shopOpen=true; this.toast('The chest first — what it holds may change your plans'); return; }
    this.shopFirst=false; this.shopEndsAt=0; this.clearShop(); this.startWave(); }
  // --- Upgrade 18: the intermission reveal ---
  // The reveal is a panel (panels stay panels, U17) standing over the
  // shop at depth 60/61. Its law is one line: a chest opens only while
  // the shop stands (revealOpenChest refuses otherwise) — loot never
  // interrupts a battle. The queue lives in the Rack as it drains, so
  // quitting mid-reveal loses nothing: what was not opened is still
  // waiting at the next intermission.
  openRevealIfAny(){ if(this.tutorial||this.revealPanel||!this.pendingChests||!this.pendingChests.length) return false;
    this.revealQueue=this.pendingChests.slice(); this.pendingChests=[]; Rack.setPending(this.revealQueue);
    this.revealPanel=true; this.renderRevealCard(); return true; }
  revealAdd(o){ if(!this.revealItems) this.revealItems=[]; this.revealItems.push(o); if(o&&o.setScrollFactor) o.setScrollFactor(0); return o; }
  clearReveal(){ (this.revealItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.revealItems=[]; }
  renderRevealCard(){ this.clearReveal(); const grade=this.revealQueue[0]; if(!grade){ this.closeReveal(); return; }
    const G=chestDisplay(grade), sv=SEASON_BY_ID[grade]||null;
    const g=this.add.graphics().setDepth(60); g.fillStyle(0x140c07,0.97); g.fillRoundedRect(W/2-320,170,640,380,12); g.lineStyle(3,G.color,1); g.strokeRoundedRect(W/2-320,170,640,380,12); this.revealAdd(g);
    this.revealAdd(txt(this,W/2,208,sv?G.name:'A chest from the field',26,GOLD).setOrigin(0.5).setDepth(61));
    this.revealAdd(txt(this,W/2,240,sv?sv.tagline:(G.name+(this.revealQueue.length>1?'  •  '+this.revealQueue.length+' waiting':'')),16,G.css,{align:'center',wordWrap:{width:600}}).setOrigin(0.5).setDepth(61));
    const im=this.add.image(W/2,326,'chest_'+grade).setDepth(61); if(im.setScale) im.setScale(2.2); this.revealAdd(im);
    this.revealAdd(txt(this,W/2,392,sv?'Cards, arms and treats wait inside. It opens here, between waves —\nnever in the middle of the fight.':'What the field gave up is opened here, between waves —\nnever in the middle of the fight.',15,PARCH,{align:'center'}).setOrigin(0.5).setDepth(61));
    const b=button(this,W/2,486,280,52,'Open the chest',()=>this.revealOpenChest(),{size:19}); b.setDepth(61); this.revealAdd(b);
    this.fixUI(); }
  revealOpenChest(){ if(!this.shopOpen||!this.revealPanel) return false; // intermission only — the reveal's whole law
    const grade=this.revealQueue[0]; if(!grade) return false;
    // Upgrade 19: a seasonal chest opens on the seasonal roll — the
    // same panel, the same law, another table of gifts.
    if(SEASON_BY_ID[grade]) return this.revealOpenSeasonal(SEASON_BY_ID[grade]);
    SFX.chestOpen();
    const loot=rollLoot(grade,null,Rack.owns('bible'));
    this.revealQueue.shift(); Rack.setPending(this.revealQueue);
    if(loot.bible){ Rack.grant('bible'); this.lootFound.push('The Bible'); this.renderRevealResult(resolveWeapon('bible',-1),'new'); return true; }
    const w=resolveWeapon(loot.family,loot.tier), res=Rack.grant(w.key);
    if(res==='dup'){ const gain=WEAPON_TIERS[w.tier].dupManna; this.manna+=gain;
      this.lootFound.push(w.name+' (already held → +'+gain+' Manna)'); this.renderRevealResult(w,'dup',gain); }
    else { this.lootFound.push(w.name); this.renderRevealResult(w,'new'); }
    this.refreshHUD(); return true; }
  renderRevealResult(w,kind,gain){ this.clearReveal();
    const isB=w.family==='bible', T=isB?null:WEAPON_TIERS[w.tier], col=isB?'#fff3c0':T.css, colN=isB?0xfff3c0:T.color;
    const g=this.add.graphics().setDepth(60); g.fillStyle(0x140c07,0.97); g.fillRoundedRect(W/2-320,170,640,380,12); g.lineStyle(3,colN,1); g.strokeRoundedRect(W/2-320,170,640,380,12); this.revealAdd(g);
    this.revealAdd(txt(this,W/2,204,isB?'THE WORD':(kind==='dup'?'Already on your Rack':w.tierName+' '+w.familyName),24,col).setOrigin(0.5).setDepth(61));
    const im=this.add.image(W/2,282,'wpn_'+w.family).setDepth(61); if(im.setScale) im.setScale(0.92); this.revealAdd(im);
    this.revealAdd(txt(this,W/2,352,isB?BIBLE_WEAPON.display:w.name,22,col).setOrigin(0.5).setDepth(61));
    let stats='DMG '+w.dmg+'  ·  every '+w.rate+'s  ·  range '+w.range+(w.arc?'  ·  arc '+w.arc+'°':'')+(w.pierce?'  ·  pierces '+(w.pierce>=99?'the line':(w.pierce+1)):'')+(w.pellets?'  ·  '+w.pellets+' pellets':'');
    this.revealAdd(txt(this,W/2,384,stats,16,PARCH).setOrigin(0.5).setDepth(61));
    if(kind==='dup') this.revealAdd(txt(this,W/2,416,'Your Rack already holds this one. It melts down to +'+gain+' Manna —\nno chest is ever wasted.',15,'#f2c14e',{align:'center'}).setOrigin(0.5).setDepth(61));
    else { this.revealAdd(txt(this,W/2,412,w.traitName+' — '+w.trait,14,'#cdbd95',{align:'center',wordWrap:{width:580}}).setOrigin(0.5).setDepth(61));
      if(isB) this.revealAdd(txt(this,W/2,452,'Found, not bought — it cannot be purchased, not with Manna, not with Grokonians.',14,'#fff3c0').setOrigin(0.5).setDepth(61));
      else if(this.weapon) this.revealAdd(txt(this,W/2,452,'Carrying now: '+this.weapon.name+' — DMG '+this.weapon.dmg+' · range '+this.weapon.range,14,'#cdbd95').setOrigin(0.5).setDepth(61)); }
    if(kind==='new'){ const eb=button(this,W/2-150,506,270,46,'Equip it now',()=>this.revealEquip(w.key),{size:17}); eb.setDepth(61); this.revealAdd(eb);
      const kb=button(this,W/2+150,506,270,46,'Keep in the Rack',()=>this.revealNext(),{size:17}); kb.setDepth(61); this.revealAdd(kb); }
    else { const cb=button(this,W/2,506,270,46,'Continue',()=>this.revealNext(),{size:17}); cb.setDepth(61); this.revealAdd(cb); }
    this.fixUI(); }
  revealEquip(key){ if(Rack.equip(key)){ const p=parseWeaponKey(key); this.weaponKey=key; this.weapon=resolveWeapon(p.family,p.tier,p.variant); this.bibleT=null;
      if(this.hero){ if(this.hero.ring&&this.hero.ring.setRadius) this.hero.ring.setRadius(this.weapon.range);
        if(this.hero.wpn){ this.hero.wpnShown=true; if(this.hero.wpn.setVisible) this.hero.wpn.setVisible(true); if(this.hero.wpn.setTexture) this.hero.wpn.setTexture('wpn_'+this.weapon.family);
          if(this.hero.wpn.setTint){ if(this.weapon.flame) this.hero.wpn.setTint(0xf28c3c); else if(this.hero.wpn.clearTint) this.hero.wpn.clearTint(); } } }
      this.toast('Carrying: '+this.weapon.name); }
    this.revealNext(); }
  revealNext(){ if(this.revealQueue&&this.revealQueue.length) this.renderRevealCard(); else this.closeReveal(); }
  closeReveal(){ this.revealPanel=false; this.revealQueue=[]; this.clearReveal(); Rack.setPending(this.pendingChests||[]); }
  persistChests(){ Rack.setPending((this.pendingChests||[]).concat(this.revealQueue||[])); }
  // --- Upgrade 19: the seasonal reveal ---
  // A seasonal chest opens on rollSeasonalGift and its gift lands in
  // the keeping built for it: a CARD into the Album (a duplicate melts
  // to Manna; the card that finishes a set pays the set's gift at this
  // very reveal — Manna here, Grokonians through the earn path), a
  // WEAPON onto the Rack under U18's exact rules (the shared weapon
  // result panel, Equip-it-now included), a TREAT straight into the
  // run (Manna to the purse, Grokonians earned, an orb treat banked
  // as a free orb touch). No branch here can deal the Bible — the
  // seasonal roll has no such outcome, at any weight.
  revealOpenSeasonal(sv){ SFX.chestOpen();
    const gift=rollSeasonalGift(sv,null);
    this.revealQueue.shift(); Rack.setPending(this.revealQueue);
    if(gift.kind==='card'){ const res=Album.grantCard(gift.card.id), set=CARD_SETS[gift.card.set];
      if(res==='dup'){ const gain=CARD_DUP_MANNA[gift.card.tier]; this.manna+=gain;
        this.lootFound.push(gift.card.name+' card (already in the Album → +'+gain+' Manna)');
        this.renderRevealGift({season:sv,gift:gift,kind:'dup',gain:gain}); }
      else { this.lootFound.push(gift.card.name+' — a card for the Album');
        let done=null;
        if(Album.setComplete(set.id)&&Album.claimSetGift(set.id)){ done=set; this.manna+=set.giftManna; this.earn('setgift:'+set.id,set.giftGrok);
          this.lootFound.push(set.name+' complete! +'+set.giftManna+' Manna, +'+set.giftGrok+' Grokonians'); }
        this.renderRevealGift({season:sv,gift:gift,kind:'new',setDone:done}); } }
    else if(gift.kind==='weapon'){ const w=resolveWeapon(gift.family,gift.tier,gift.variant), res=Rack.grant(w.key);
      if(res==='dup'){ const gain=WEAPON_TIERS[w.tier].dupManna; this.manna+=gain;
        this.lootFound.push(w.name+' (already held → +'+gain+' Manna)'); this.renderRevealResult(w,'dup',gain); }
      else { this.lootFound.push(w.name); this.renderRevealResult(w,'new'); } }
    else { const b=gift.bundle;
      if(b.kind==='manna'){ this.manna+=b.amount; this.lootFound.push('Treat: +'+b.amount+' Manna'); }
      else if(b.kind==='grok'){ this.earn('treat',b.amount); this.lootFound.push('Treat: +'+b.amount+' Grokonians'); }
      else if(b.kind==='orbs'){ this.freeOrbs=(this.freeOrbs||0)+b.amount; this.lootFound.push('Treat: a free orb at any station, this run'); }
      this.renderRevealGift({season:sv,gift:gift,kind:'bundle'}); }
    this.refreshHUD(); return true; }
  renderRevealGift(o){ this.clearReveal(); const gift=o.gift, sv=o.season;
    const g=this.add.graphics().setDepth(60); g.fillStyle(0x140c07,0.97); g.fillRoundedRect(W/2-320,170,640,380,12); g.lineStyle(3,sv.color,1); g.strokeRoundedRect(W/2-320,170,640,380,12); this.revealAdd(g);
    if(gift.kind==='card'){ const c=gift.card, T=WEAPON_TIERS[c.tier], set=CARD_SETS[c.set], pr=Album.setProgress(c.set);
      this.revealAdd(txt(this,W/2,204,o.kind==='dup'?'Already in your Album':(T.name+' Card'),24,T.css).setOrigin(0.5).setDepth(61));
      const im=this.add.image(W/2,282,c.glyph).setDepth(61); if(im.setScale) im.setScale(0.92); this.revealAdd(im);
      this.revealAdd(txt(this,W/2,352,c.name,22,T.css).setOrigin(0.5).setDepth(61));
      this.revealAdd(txt(this,W/2,384,set.name+'  •  '+pr.owned+' of '+pr.total+' gathered',15,PARCH).setOrigin(0.5).setDepth(61));
      if(o.kind==='dup') this.revealAdd(txt(this,W/2,424,'Your Album already holds this card. It melts down to +'+o.gain+' Manna —\nno opening is ever wasted.',15,'#f2c14e',{align:'center'}).setOrigin(0.5).setDepth(61));
      else { this.revealAdd(txt(this,W/2,416,c.epithet,15,'#cdbd95',{align:'center',wordWrap:{width:580}}).setOrigin(0.5).setDepth(61));
        this.revealAdd(txt(this,W/2,446,'The Scripture: '+c.ref,14,'#a08a6a').setOrigin(0.5).setDepth(61));
        if(o.setDone) this.revealAdd(txt(this,W/2,472,'THE SET IS COMPLETE — its gift is paid: +'+o.setDone.giftManna+' Manna, +'+o.setDone.giftGrok+' Grokonians.',14,'#fff3c0',{align:'center',wordWrap:{width:600}}).setOrigin(0.5).setDepth(61)); } }
    else { const b=gift.bundle, icon=b.kind==='manna'?'ico_bowl':(b.kind==='grok'?'coing':'orb_thunder');
      this.revealAdd(txt(this,W/2,204,'A Treat from the '+sv.name,24,sv.css).setOrigin(0.5).setDepth(61));
      const im=this.add.image(W/2,282,icon).setDepth(61); if(im.setScale) im.setScale(b.kind==='grok'?2.4:0.92); this.revealAdd(im);
      const line=b.kind==='manna'?('+'+b.amount+' Manna for the war purse'):b.kind==='grok'?('+'+b.amount+' Grokonians, earned through the Hub\'s path'):('A free orb at any station — the treat pays the touch, this run.');
      this.revealAdd(txt(this,W/2,352,line,18,PARCH,{align:'center',wordWrap:{width:580}}).setOrigin(0.5).setDepth(61));
      this.revealAdd(txt(this,W/2,392,'Treats are spent where they land — the purse, the wallet, the run.',14,'#cdbd95').setOrigin(0.5).setDepth(61)); }
    const cb=button(this,W/2,516,270,46,'Continue',()=>this.revealNext(),{size:17}); cb.setDepth(61); this.revealAdd(cb);
    this.fixUI(); }
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
    // Camp-Falls stars fork (first pass, kennin's to tune): a camp
    // STANDING at victory earns stars exactly as it always has; a camp
    // FALLEN at victory caps the run at one star, and the panel says
    // why in plain words below.
    const stars=this.campDown()?1:(campFrac>=0.85?3:(campFrac>=0.45?2:1));
    const bg=this.add.graphics().setDepth(55); bg.fillStyle(0x140c07,0.94); bg.fillRect(340,180,600,330); bg.lineStyle(3,0xd9a441); bg.strokeRect(340,180,600,330); s.push(bg);
    s.push(txt(this,W/2,225,this.era.name+': Held!',38,GOLD).setOrigin(0.5).setDepth(56));
    s.push(txt(this,W/2,275,'★'.repeat(stars)+'☆'.repeat(3-stars),36,GOLD).setOrigin(0.5).setDepth(56));
    s.push(txt(this,W/2,325,'Goal wave '+this.goalWave+' survived. Endless waves go on from here —\nhow deep can your squads march?',18,PARCH,{align:'center'}).setOrigin(0.5).setDepth(56));
    if(this.campDown()) s.push(txt(this,W/2,378,'The field was held, but the camp was lost — one star.',15,'#cdbd95',{align:'center'}).setOrigin(0.5).setDepth(56));
    const c=button(this,W/2-160,440,290,56,'Continue Endless',()=>{ s.forEach(o=>{try{o.destroy();}catch(e){}}); this.victoryOpen=false; this.endless=true; this.flush(); this.openShop(false); },{size:19}); c.setDepth(56); s.push(c);
    const f=button(this,W/2+160,440,290,56,'Finish run',()=>{ s.forEach(o=>{try{o.destroy();}catch(e){}}); this.victoryOpen=false; this.end(true); },{size:19}); f.setDepth(56); s.push(f); this.fixUI(); }
  // --- main loop ---
  update(time,delta){ if(this.over) return;
    this.syncCampRubble(); // Camp-Falls: the rubble read follows campHp wherever it changed — including a Repair bought in the shop below
    if(this.shopOpen){ // Upgrade 6: every shop counts the same honest minute
      // down from the wall-clock deadline set in openShop. Phaser stops
      // calling update() while the tab is hidden, so a returning player
      // simply finds the minute elapsed and the wave beginning — the timer
      // never grants hidden bonus time and never freezes mid-shop. At zero,
      // closeShop() flips shopOpen off before startWave(), so the wave can
      // only ever start once.
      // Upgrade 18: ONE exception, named — while the chest reveal panel
      // stands, the deadline is HELD (shifted by exactly the elapsed
      // frame, never more): the reveal is the intermission's first
      // business, and a player reading what the field gave up is not
      // idle time the wave should eat.
      if(this.revealPanel){ this.shopEndsAt+=delta; this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000); if(this.shopTimerTxt) this.shopTimerTxt.setText(this.shopTimerLabel()); return; }
      this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000);
      if(this.shopTimerTxt) this.shopTimerTxt.setText(this.shopTimerLabel());
      if(this.shopT<=0) this.closeShop();
      return; }
    if(this.victoryOpen) return;
    // Upgrade 12: the pause (and the layout editing inside it) holds the
    // whole battle — no timer, no timer's cousin, runs behind it.
    if(this.paused||this.layoutEdit) return;
    const dt=Math.min(0.05,delta/1000)*this.speed; if(this.shieldT>0) this.shieldT-=delta/1000*this.speed;
    // Upgrade 15: the intermission can also be spent ON THE FIELD — the
    // shop's "To the Field" door steps out with the shop's OWN deadline
    // still running. One clock, two rooms: leaving and returning never
    // move it, reopening the shop (openShop's keep-deadline path) never
    // resets it, and at zero the wave starts exactly once from here,
    // the same way closeShop starts it from the shop. The pause above
    // holds this clock too, as it holds everything.
    if(this.interField){ this.shopT=Math.max(0,(this.shopEndsAt-Date.now())/1000);
      if(this.interTxt) this.interTxt.setText(this.shopTimerLabel());
      if(this.shopT<=0) this.beginInterWave(); }
    this._pulse=(this._pulse||0)+dt; // Upgrade 8: drives the Perfect glow pulse in drawSkillSweep
    if(this.tutorial) this.tutTick(); // Upgrade 11: the highlight ring breathes here
    if(this.volleyCd>0){ this.volleyCd-=dt;
      if(this.volleyCd<=0){ this.volleyCd=0; this.refreshHUD();
        // Upgrade 8: a Volley press buffered in its last breath fires now.
        if(this._volleyBuf){ this._volleyBuf=false; this.volleyMode=true; this.toast('Volley: tap a target spot'); } } }
    { const vb=this.cmdBtns&&this.cmdBtns.volley; // Volley's cooldown sweep
      if(vb&&vb.sweep){ vb.sweep.clear(); if(this.volleyCd>0){ const f=Math.min(1,this.volleyCd/12), r=(vb.sw||56)/2; vb.sweep.fillStyle(0x000000,0.45); vb.sweep.fillCircle(vb.sx,vb.sy,r-2); arcSegs(vb.sweep,vb.sx,vb.sy,r-4,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-f),4,0xf2c14e,0.9); } } }
    this.orbTick(dt);
    this.bibleTick(dt); // Upgrade 18: the Word, while the Bible is carried
    this.tickPresses(); // Upgrade 20: presses cross into their HOLD verbs here (performance.now-based, like the press records)
    this.fightTick(dt); // Upgrade 8: recovery, buffers, wind-ups, stamina
    // spawns
    if(this.waveActive){ this.waveClock+=dt; while(this.spawnQ.length&&this.spawnQ[0].at<=this.waveClock) this.spawn(this.spawnQ.shift()); }
    // field coins (Upgrade 3): one every ~6s of an active wave, max 8 out
    if(this.waveActive){ this.coinT-=dt; if(this.coinT<=0){ this.coinT=6; if(this.coins.length<8) this.spawnCoin(); } }
    this.collectCoins();
    this.collectChests(); // Upgrade 18: walk over a chest to bank it
    // Upgrade 14: the Seventh Day's manna rain — while the held-back
    // wave waits out its rest, manna drips onto the camp at the twist's
    // rate (150 across the ten seconds). Whole-manna steps only; the
    // fraction carries in seventhAcc so the total is exact.
    if(this.seventhT>0&&this.waveActive){ const step=Math.min(dt,this.seventhT); this.seventhT-=step; this.seventhAcc+=step*TWIST.seventhMannaPerSec;
      const whole=Math.floor(this.seventhAcc); if(whole>0){ this.seventhAcc-=whole; this.manna+=whole; }
      if(this.seventhT<=0) this.floatText(this.campPos.x,this.campPos.y-70,'The Seventh Day — manna has rained','#f2c14e'); }
    const night=this.isNightWave(this.wave);
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
    // Upgrade 14: Samson's strength announces itself when it wakes —
    // he stands alone, and the field should know why he suddenly hits
    // like a falling gate.
    if(this.heroDef.id==='samson'){ const al=this.samsonAlone(); if(al&&!this._samAlone) this.floatText(h.x,h.y-84,'Strength alone!','#ffe98a'); this._samAlone=al; }
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
    this.gatherTick(dt); // Upgrade 15: standing at a tree or rock gathers — mid-wave and in the field intermission alike
    h.spr.setOrigin(0.5,0.9).setPosition(h.x,h.y+18).setDepth(8+h.y/1000); h.ring.setPosition(h.x,h.y);
    if(h.wpn&&h.wpnShown) h.wpn.setPosition(h.x+26,h.y-26).setAlpha(h.down>0?0.35:1); // Upgrade 18: the carried weapon rides at his shoulder
    h.hpBar.clear(); h.hpBar.fillStyle(0x000000,0.7); h.hpBar.fillRect(h.x-22,h.y-48,44,5); h.hpBar.fillStyle(0x5aa33b,1); h.hpBar.fillRect(h.x-22,h.y-48,44*Math.max(0,h.hp)/hd.hp,5);
    // Upgrade 8: a raised guard shows as an arc on the hero's facing side.
    if(h.guardFx){ const g=h.guardFx; g.clear();
      if(h.blocking&&h.down<=0&&g.arc){ const a=Math.atan2(h.faceY,h.faceX); g.lineStyle(4,0x9ae8f2,0.9); g.beginPath(); g.arc(h.x,h.y,30,a-1.1,a+1.1,false); g.strokePath(); } }
    this.drawCampBar();
    this.drawMoveFx(); // Upgrade 12: the stick and the follow arrow, drawn from live state
    this.drawAimFx(); // Upgrade 20: the aimed cast's reticle, while a power is held
    this.drawPressFx(); // Upgrade 20: the hold-fill rims on ORDERS and CAMP
    this.campFireTick(dt);
    // Upgrade 9: the selection ring — a breathing gold circle under whoever
    // the marching hand currently directs: the selected squad, or the hero
    // when the hero is selected (the default).
    if(this.selFx){ const sg=this.selFx; sg.clear();
      const st=this.selSquad&&!this.selSquad.dead?this.selSquad:(h.down<=0?h:null);
      if(st){ const sr=(this.selSquad?27:31)*(1+0.07*Math.sin((this._pulse||0)*5)); sg.lineStyle(2,0xf2c14e,0.95); sg.strokeCircle(st.x,st.y+8,sr); } }
    this.drawRallyBanners(); // Upgrade 10: a banner flies only while someone holds it
    this.drawBuildGhost(); // Upgrade 15: the placement ghost, green where the tool in hand may land
    // squads
    this.squads=this.squads.filter(s=>!s.dead);
    if(this.selSquad&&this.selSquad.dead) this.selSquad=null;
    this.squads.forEach((s,idx)=>{ if(s.buffRateT>0) s.buffRateT-=dt; if(s.buffDmgT>0) s.buffDmgT-=dt;
      const rangeMul=(night&&s.def.role==='ranged')?(this.twist==='torches'?TWIST.torchRangeMul:1.1):1, range=s.range*rangeMul;
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
      if(foe&&s.cd<=0){ s.cd=s.rate; const dmg=s.dmg*(s.buffDmgT>0?1.3:1)*this.bibleAuraMul(s); this.squadAtkSfx(s);
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
      if(e.def.heals){ e.healCd=(e.healCd||1.5)-dt; if(e.healCd<=0){ e.healCd=2.5; let healed=false;
        for(const o of this.enemies){ if(o!==e&&!o.dead&&o.hp<o.max&&Phaser.Math.Distance.Between(e.x,e.y,o.x,o.y)<110){ o.hp=Math.min(o.max,o.hp+15); healed=true; this.spark(o.x,o.y-10,0x8fd06a,1); } }
        if(healed) SFX.priestChant(); } } // Upgrade 13: the Baal Priest's heal has a voice — an eerie, beating chant
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
        // the camp and, on arrival, stays and attacks it. It never vanishes.
        // Camp-Falls: the prize was only ever the respawn. Once the camp is
        // rubble the host stops marching on it — the defender scan widens
        // to the whole field and the enemy hunts whoever still stands,
        // because now the player has to die to lose.
        let def=null,bd=this.campHp>0?90:Infinity;
        if(h.down<=0){ const d=Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y); if(d<bd){ bd=d; def={x:h.x,y:h.y,kind:'hero'}; } }
        for(const s of this.squads){ if(s.dead) continue; const d=Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y); if(d<bd){ bd=d; def={x:s.x,y:s.y,kind:'squad',s}; } }
        const dc=Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y);
        // Upgrade 15: a built piece standing on the road is a blocker
        // like any defender — it joins this same scan, measured to its
        // body (center distance minus BUILD.bodyR), and only when it
        // truly stands between the enemy and the camp: its own distance
        // to the camp no greater than the enemy's, plus a shoulder's
        // width. A fence behind the enemy's line blocks nothing, and a
        // defender standing closer is still fought first.
        for(const pc of (this.builds||[])){ if(pc.hp<=0) continue;
          const dp=Phaser.Math.Distance.Between(e.x,e.y,pc.x,pc.y)-BUILD.bodyR;
          if(dp<bd&&Phaser.Math.Distance.Between(pc.x,pc.y,this.campPos.x,this.campPos.y)<dc+BUILD.behindPad){ bd=dp; def={x:pc.x,y:pc.y,kind:'build',pc}; } }
        if(def){ const dx=def.x-e.x, dy=def.y-e.y, dl=Math.hypot(dx,dy)||1;
          if(bd>e.range+6){ const sp=e.speed*(1-(e.slow||0))*this.enemySpdMul()*(e.boss?this.bossMoveMul(e):1); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0); }
          else { e.cd-=dt; if(e.cd<=0){ e.cd=e.boss?this.bossAtkRate(e):e.rate;
            if(def.kind==='hero') this.hurtHero(e.dmg); else if(def.kind==='build') this.damageBuild(def.pc,e.dmg); else this.hurtSquad(def.s,e.dmg);
            SFX.enemyAttack(e); this.spark(def.x,def.y,0xc0392b,2); } }
        } else if(this.campHp>0){ if(dc>e.range+34){ const dx=this.campPos.x-e.x, dy=this.campPos.y-e.y, dl=Math.hypot(dx,dy)||1;
          const sp=e.speed*(1-(e.slow||0))*this.enemySpdMul()*(e.boss?this.bossMoveMul(e):1); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0);
        } else { e.cd-=dt; if(e.cd<=0){ e.cd=e.boss?this.bossAtkRate(e):e.rate; this.hitCamp(e.dmg,e); this.spark(this.campPos.x+30,this.campPos.y-10,0xc0392b,2); } } }
        // Camp-Falls: rubble, and no defender anywhere for the widened
        // scan to find — the foe simply holds its ground. (With the hero
        // alive the scan always finds him; this is only the held breath
        // when he is already down and the run is ending.)
      }
      const p={x:e.x,y:e.y}; e.spr.setOrigin(0.5,0.9).setPosition(p.x,p.y+(e.def.size||18)).setDepth((e.boss?9:7)+p.y/1000);
      e.bar.clear(); if(e.hp<e.max){ e.bar.fillStyle(0x000000,0.7); e.bar.fillRect(e.x-16,e.y-36,32,4); e.bar.fillStyle(0xa33b20,1); e.bar.fillRect(e.x-16,e.y-36,32*Math.max(0,e.hp)/e.max,4); }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.bossTick(dt);
    // shots
    for(const s of this.shots){ const tg=s.target; if(tg&&!tg.dead&&tg.x!==undefined){ s.lx=tg.x; s.ly=tg.y; }
      const a=Phaser.Math.Angle.Between(s.s.x,s.s.y,s.lx,s.ly), step=s.speed*dt;
      if(Phaser.Math.Distance.Between(s.s.x,s.s.y,s.lx,s.ly)<=step+4){
        // Upgrade 18: a piercing shot does not die at its mark — it
        // strikes the mark (once) and flies on, straight, until its
        // pierce count or fly range runs out.
        if(s.opt&&s.opt.pierce&&s.hitSet){ if(tg&&!tg.dead&&!s.hitSet.has(tg)){ s.hitSet.add(tg); s.pc++; this.damage(tg,s.opt.dmg,s.opt.type,s.opt); SFX.hit(); }
          const flown=Math.hypot(s.s.x-s.ox,s.s.y-s.oy);
          if(s.pc>s.opt.pierce||flown>=(s.opt.flyRange||9999)){ s.done=true; s.s.destroy(); }
          else { const a2=Math.atan2(s.ly-s.oy,s.lx-s.ox), fr=(s.opt.flyRange||9999)+80; s.lx=s.ox+Math.cos(a2)*fr; s.ly=s.oy+Math.sin(a2)*fr; s.target=null; } }
        else { s.done=true; s.s.destroy(); SFX.hit();
          if(s.opt.splash){ const at=s.opt.splashAt||{x:s.lx,y:s.ly}; this.enemies.forEach(e=>{ if(!e.dead&&Phaser.Math.Distance.Between(e.x,e.y,at.x,at.y)<s.opt.splash) this.damage(e,s.opt.dmg,s.opt.type,s.opt); });
            const c=this.add.circle(at.x,at.y,s.opt.splash,0xd9a441,0.22).setDepth(4); this.tweens.add({targets:c,alpha:0,duration:350,onComplete:()=>c.destroy()}); }
          else if(tg&&!tg.dead&&!(s.hitSet&&s.hitSet.has(tg))) this.damage(tg,s.opt.dmg,s.opt.type,s.opt); } }
      else { const px=s.s.x, py=s.s.y; s.s.x+=Math.cos(a)*step; s.s.y+=Math.sin(a)*step; s.s.rotation+=0.3;
        // Upgrade 18: a piercing shot strikes every foe its flight
        // segment crosses (segment distance, so a fast shot cannot
        // jump over a foe between frames), each foe once, until its
        // pierce count or its fly range runs out.
        if(s.opt&&s.opt.pierce&&s.hitSet){ const vx=s.s.x-px, vy=s.s.y-py, vv=vx*vx+vy*vy||1;
          for(const e of this.enemies){ if(e.dead||s.hitSet.has(e)) continue;
            const tt=Math.max(0,Math.min(1,((e.x-px)*vx+(e.y-py)*vy)/vv));
            if(Math.hypot(e.x-(px+vx*tt),e.y-(py+vy*tt))<=22){ s.hitSet.add(e); s.pc++; this.damage(e,s.opt.dmg,s.opt.type,s.opt); if(s.pc>s.opt.pierce) break; } }
          if(s.pc>s.opt.pierce||Math.hypot(s.s.x-s.ox,s.s.y-s.oy)>(s.opt.flyRange||9999)){ s.done=true; s.s.destroy(); } } } }
    this.shots=this.shots.filter(s=>!s.done);
    // Upgrade 8: skill buttons live here — cooldown drains, a buffered press
    // fires the moment its move is ready, and a ready move accrues Held
    // charge (battle time only: this loop never runs while the shop is
    // open, so patience cannot be farmed in the intermission). Crossing a
    // tier floats the tier name over the hero; the button's face — label,
    // colour and sweep — is redrawn from the same state.
    this.skillBtns.forEach((b,bi)=>{ const wasCd=b.cd>0; if(b.cd>0){ b.cd-=dt;
        if(b.cd<=0){ b.cd=0; if(b.buffered){ b.buffered=false; this.useSkill(bi); } } }
      if(b.cd>0){ if(b.label&&b.label._t) b.label.setText(''); if(b.icon) b.icon.setTint(0x777777); b.alpha=0.5; }
      else { // Upgrade 15: patience is earned in the fight — the field
        // intermission is the shop's time wherever the player stands, so
        // Held charge does not accrue while it runs.
        if(!this.interField) b.held=(b.held||0)+dt; const t=this.heldTierOf(b);
        if(t>(b._tierShown||0)){ b._tierShown=t; this.floatText(h.x,h.y-72,b.def.name+' — '+HELD.names[t]+'!','#ffe98a'); }
        // Upgrade 16: the face stays a symbol — cooldown rides the sweep
        // and the dimmed icon, Held tiers ride the sweep's bar and rim,
        // and a Perfect power tints its symbol gold. The NAME appears
        // only in the tier float above the hero and in the press float.
        if(b.label&&b.label._t) b.label.setText(''); if(b.icon) b.icon.setTint(t===2?0xffe98a:0xffffff); b.alpha=1; }
      // Upgrade 10: the power-ready whisper — the crossing tick only,
      // and only for the two great powers (second skill and ult).
      if(wasCd&&b.cd<=0&&bi>=1) this.powerReady(b);
      if(b.readyPulse>0) b.readyPulse=Math.max(0,b.readyPulse-dt*1.6);
      this.drawSkillSweep(b); });
    // wave end
    if(this.waveActive&&!this.spawnQ.length&&!this.enemies.length) this.waveClear();
    this.refreshHUD();
  }
  end(win){ if(this.over) return; this.over=true; this.clearShop(); this.shopOpen=false; this.closeCampPanel(); this.closeFan();
    // Upgrade 18: unopened chests are never lost with the run — what
    // was banked (or mid-reveal) waits in the Rack for the next
    // intermission, and the end screen says so.
    this.persistChests(); if(this.revealPanel){ this.revealPanel=false; this.clearReveal(); }
    this.interField=false; this.clearInterBar(); this.exitBuildMode(); // Upgrade 15: the field furniture leaves with the run
    const XP=DATA_P().xp;
    if(win){ this.tr('clears'); this.gx(XP.clear); this.earn('clear',DATA.grokonians.clear);
      if(!this.campHurtTotal){ this.earn('perfectClear',DATA.grokonians.perfectClear); this.tr('perfectClears'); this.gx(XP.perfectClear); }
      if(this.eraId==='bible'){ const first=!Tokens.milestone('clearCh1'); Tokens.setMilestone('clearCh1'); this.newUnlock=first; }
      SFX.win(); } else SFX.lose();
    // Upgrade 3: stars and score now read from the camp the player kept standing.
    // Upgrade 4: the fraction divides by the CURRENT max, so Fortify tiers
    // neither gift nor steal stars — keeping 85% of a bigger camp is the same feat.
    // Camp-Falls stars fork (first pass, kennin's to tune): camp standing
    // at victory -> the fraction rules above, untouched; camp FALLEN at
    // victory -> one star, and the end screen carries the reason
    // (campLost). The score's camp term already reads the fraction, so
    // a lost camp scores its honest zero there without new arithmetic.
    const campFrac=Math.max(0,this.campHp/this.campMax);
    const stars=win?(this.campDown()?1:(campFrac>=0.85?3:(campFrac>=0.45?2:1))):0;
    if(win) cqRecordStars(this.eraId,stars);
    this.flush(); const ev=Progress.takeEvents();
    const rec={score:this.kills*10+Math.round(campFrac*20)*50+this.wavesCleared*100+stars*500};
    if(window.GXHub&&GXHub.submitScore) GXHub.submitScore(rec.score,this.wavesCleared); // GX Hub leaderboard (no-op standalone)
    this.time.delayedCall(800,()=>this.scene.start('End',{win,earned:this.earned,newUnlock:this.newUnlock,perfect:!this.campHurtTotal,xp:this.runXp,hero:this.heroDef.id,ev,stars,rec,waves:this.wavesCleared,era:this.eraId,eraName:this.era.name,endless:this.endless,held:this.heldSpent?this.heldSpent.slice():[0,0,0],loot:this.lootFound?this.lootFound.slice():[],chestsWaiting:Rack.pending().length,campLost:win&&this.campDown(),heroFell:!win&&!!this._heroFell})); } }

class End extends Phaser.Scene{ constructor(){super('End');}
  create(d){ backdrop(this,0.7);
    txt(this,W/2,150,d.win?(d.eraName||'Era')+': Held':(d.heroFell?'The Hero has Fallen':'The Camp has Fallen'),52,d.win?GOLD:'#c0392b').setOrigin(0.5);
    if(d.win) txt(this,W/2,212,'★'.repeat(d.stars)+'☆'.repeat(3-d.stars),40,GOLD).setOrigin(0.5);
    if(d.win&&d.campLost) txt(this,W/2,240,'The field was held, but the camp was lost.',16,'#cdbd95').setOrigin(0.5); // Camp-Falls: the one star explains itself
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
    // Upgrade 18: the run's findings, and any chest still waiting.
    if(d.loot&&d.loot.length) txt(this,W/2,566,'Found: '+d.loot.join('  ·  '),15,'#f2c14e',{align:'center',wordWrap:{width:1100}}).setOrigin(0.5);
    if(d.chestsWaiting) txt(this,W/2,590,d.chestsWaiting+' chest'+(d.chestsWaiting>1?'s':'')+' waiting in your Rack — '+(d.chestsWaiting>1?'they open':'it opens')+' at your next intermission.',14,'#cdbd95').setOrigin(0.5);
    button(this,W/2-280,600,250,58,'Play again',()=>this.scene.start('HeroSelect',{level:{era:d.era||'bible'}}),{size:22});
    button(this,W/2,600,250,58,'Battle Pass',()=>this.scene.start('BattlePass'),{size:22});
    button(this,W/2+280,600,250,58,'Era select',()=>this.scene.start('EraSelect'),{size:22}); } }

// ---------- The Rack: the Armory (Upgrade 18) ----------
// A panel scene, reached from the Menu and from Hero Select: every
// weapon the player has found, by family and tier, with its stats and
// its trait — and the one carried into the next run chosen here. The
// Bible's card stands first and gilt when it has been found. Nothing
// here is for sale: the Rack holds only what the field gave up.
class Armory extends Phaser.Scene{ constructor(){super('Armory');}
  init(d){ this.from=(d&&d.from)||'Menu'; this.fromData=(d&&d.fromData)||null; this.page=(d&&d.page)||0; }
  create(){ backdrop(this,0.78); Music.play(this,'menu');
    txt(this,W/2,40,'The Rack — Armory',38,GOLD).setOrigin(0.5);
    txt(this,W/2,78,'Weapons come out of chests — found on the field, or seasonal chests bought with Grokonians. The Bible is found, never sold.',16,'#cdbd95').setOrigin(0.5);
    // Upgrade 19: the Armory's other doors — the Chests calendar and
    // the card Album stand beside the Rack.
    button(this,1005,42,180,40,'Chests',()=>this.scene.start('Chests',{from:'Armory',fromData:{from:this.from,fromData:this.fromData,page:this.page}}),{size:15});
    button(this,1195,42,150,40,'Album',()=>this.scene.start('Album',{from:'Armory',fromData:{from:this.from,fromData:this.fromData,page:this.page}}),{size:15});
    const eq=Rack.equippedKey(), ew=Rack.equippedWeapon();
    txt(this,W/2,108,eq==='sling:0'?'Carrying: the starter — every hero fights with his own hand until a found weapon is carried':'Carrying: '+ew.name,18,'#f2c14e').setOrigin(0.5);
    const pend=Rack.pending();
    if(pend.length) txt(this,W/2,134,pend.length+' chest'+(pend.length>1?'s':'')+' waiting — '+(pend.length>1?'they open':'it opens')+' at your next intermission',14,GOLD).setOrigin(0.5);
    const list=Rack.list(), pages=Math.max(1,Math.ceil(list.length/12));
    if(this.page>=pages) this.page=pages-1;
    list.slice(this.page*12,this.page*12+12).forEach((w,i)=>{ const col=i%6,row=Math.floor(i/6),x=113+col*211,y=290+row*230;
      const isB=w.family==='bible', T=isB?null:WEAPON_TIERS[w.tier], equipped=w.key===eq;
      const g=this.add.graphics(); g.fillStyle(isB?0x2a2410:0x2a1a10,0.93); g.fillRoundedRect(x-100,y-100,200,200,10); g.lineStyle(equipped?4:2,equipped?0xf2c14e:(isB?0xfff3c0:T.color)); g.strokeRoundedRect(x-100,y-100,200,200,10);
      const im=this.add.image(x,y-52,'wpn_'+w.family); if(im.setScale) im.setScale(0.62);
      txt(this,x,y+2,isB?'The Bible':w.name,14,isB?'#fff3c0':T.css,{align:'center',wordWrap:{width:188}}).setOrigin(0.5);
      txt(this,x,y+28,(isB?'Unique':w.tierName+' '+w.familyName)+'  ·  DMG '+w.dmg+'  ·  '+w.rate+'s  ·  rng '+w.range,12,PARCH,{align:'center',wordWrap:{width:188}}).setOrigin(0.5);
      txt(this,x,y+54,w.traitName,12,'#cdbd95',{align:'center',wordWrap:{width:188}}).setOrigin(0.5);
      if(equipped) txt(this,x,y+82,'✓ Carried',15,'#8fd06a').setOrigin(0.5);
      else button(this,x,y+82,150,34,'Carry it',()=>{ if(Rack.equip(w.key)){ SFX.build(); this.scene.restart({from:this.from,fromData:this.fromData,page:this.page}); } },{size:14});
    });
    txt(this,W/2,648,ew.traitName+' — '+ew.trait,14,'#cdbd95',{align:'center',wordWrap:{width:1050}}).setOrigin(0.5);
    if(pages>1){ button(this,520,680,56,42,'◀',()=>this.scene.restart({from:this.from,fromData:this.fromData,page:(this.page+pages-1)%pages}),{size:16});
      txt(this,W/2,680,(this.page+1)+'/'+pages,16,PARCH).setOrigin(0.5);
      button(this,760,680,56,42,'▶',()=>this.scene.restart({from:this.from,fromData:this.fromData,page:(this.page+1)%pages}),{size:16}); }
    button(this,90,680,140,46,'Back',()=>this.scene.start(this.from,this.fromData||undefined));
  } }

// ---------- Chests & Seasons (Upgrade 19) ----------
// The calendar panel: what season stands open, what its chest holds,
// its price in Grokonians, and when the year brings the next one. The
// standing U18 chests are shown for what they are — found on the
// field, never sold — and every defined season stands on the calendar
// with its window, in season or greyed until it returns. Buying spends
// through Tokens and queues the chest in the Rack: it opens at the
// next intermission, in the one reveal flow, bought or found alike.
class Chests extends Phaser.Scene{ constructor(){super('Chests');}
  init(d){ this.from=(d&&d.from)||'Menu'; this.fromData=(d&&d.fromData)||null; this.msg=(d&&d.msg)||null; }
  create(){ backdrop(this,0.78); Music.play(this,'menu');
    txt(this,W/2,40,'Chests & Seasons',38,GOLD).setOrigin(0.5);
    txt(this,W/2,76,'Grokonians: '+Tokens.balance()+'   •   Seasonal chests open at your next intermission — never mid-battle',16,GOLD).setOrigin(0.5);
    const now=new Date(), live=liveSeason(now);
    const pend=Rack.pending().filter(g=>SEASON_BY_ID[g]).length;
    if(pend) txt(this,W/2,104,pend+' seasonal chest'+(pend>1?'s':'')+' waiting in your Rack',14,'#f2c14e').setOrigin(0.5);
    if(this.msg) txt(this,W/2,104,this.msg,14,'#f2c14e',{align:'center',wordWrap:{width:1000}}).setOrigin(0.5);
    let y=176;
    if(live){ const st=seasonState(live,now);
      const g=this.add.graphics(); g.fillStyle(0x2a1a10,0.95); g.fillRoundedRect(170,y-62,940,158,12); g.lineStyle(3,live.color,1); g.strokeRoundedRect(170,y-62,940,158,12);
      const im=this.add.image(252,y+16,'chest_'+live.id); if(im.setScale) im.setScale(1.7);
      txt(this,336,y-40,live.name+' — in season',24,live.css);
      txt(this,336,y-10,live.tagline,14,PARCH,{wordWrap:{width:520}});
      txt(this,336,y+52,'Gift cards, arms and treats inside  •  ends in '+st.daysLeft+' day'+(st.daysLeft===1?'':'s'),14,'#cdbd95');
      const afford=Tokens.balance()>=live.price;
      button(this,995,y+16,190,54,afford?('Buy — '+live.price+' G'):('Short — '+live.price+' G'),()=>{ const r=purchaseSeasonalChest(live.id);
        const m=r==='ok'?('A '+live.name+' waits in your Rack — it opens at your next intermission.'):r==='funds'?('Not enough Grokonians — the chest costs '+live.price+'.'):('The season has turned — the chest is gone until it returns.');
        this.scene.restart({from:this.from,fromData:this.fromData,msg:m}); },{size:16,disabled:!afford});
      y+=136;
    } else { txt(this,W/2,y,'No seasonal chest stands open today — the year turns, and each returns in its season.',16,PARCH).setOrigin(0.5); y+=30; }
    txt(this,W/2,y,'From the field — the standing chests',20,GOLD).setOrigin(0.5); y+=46;
    [['wood','Wooden','Fallen foes leave them rarely; elites, often; champions, always.'],['iron','Iron','Champions leave Iron or Gold — and even Iron can hide a Mythic.'],['gold','Golden','Gold alone may hold the Bible — found on the field, never sold.']].forEach(([gr,nm,line],i)=>{ const x=250+i*390;
      const im=this.add.image(x,y,'chest_'+gr); if(im.setScale) im.setScale(1.3);
      txt(this,x,y+46,nm+' Chest',16,CHEST_GRADES[gr].css).setOrigin(0.5);
      txt(this,x,y+78,line,12,PARCH,{align:'center',wordWrap:{width:340}}).setOrigin(0.5); });
    y+=140;
    txt(this,W/2,y,'The year of chests',20,GOLD).setOrigin(0.5); y+=38;
    SEASONS.forEach(sv=>{ const st=seasonState(sv,now);
      txt(this,W/2,y,sv.name+'  •  '+seasonWindowLabel(sv)+'  •  '+(st.live?('in season — '+st.daysLeft+' day'+(st.daysLeft===1?'':'s')+' left'):('opens '+seasonDateLabel(st.nextStart)))+'  •  '+sv.price+' Grokonians in season',15,st.live?sv.css:'#8a7a6a').setOrigin(0.5); y+=27; });
    const nx=nextSeason(now);
    if(nx) txt(this,W/2,y+8,'Next to open: '+nx.season.name+' — '+seasonDateLabel(nx.state.nextStart),15,'#f2c14e').setOrigin(0.5);
    button(this,W/2+170,680,300,46,'The Card Album',()=>this.scene.start('Album',{from:'Chests',fromData:{from:this.from,fromData:this.fromData}}),{size:17});
    button(this,90,680,140,46,'Back',()=>this.scene.start(this.from,this.fromData||undefined));
  } }

// ---------- The Card Album (Upgrade 19) ----------
// The gift cards' gallery: one set to a page, owned cards standing in
// their tier colors with their epithet and Scripture reference, the
// unfound as dark silhouettes — the chase made visible. Set progress
// is counted at the top; a finished set's gift is named here and paid
// at the reveal that completes it (Album.claimSetGift guards the once).
class CardAlbum extends Phaser.Scene{ constructor(){super('Album');}
  init(d){ this.from=(d&&d.from)||'Armory'; this.fromData=(d&&d.fromData)||null; this.setId=(d&&d.set)||CARD_SET_ORDER[0]; }
  create(){ backdrop(this,0.78); Music.play(this,'menu');
    txt(this,W/2,40,'The Card Album',38,GOLD).setOrigin(0.5);
    txt(this,W/2,76,'Gift cards from the seasonal chests, kept set by set. A duplicate melts into Manna; a finished set pays its gift, once.',14,'#cdbd95').setOrigin(0.5);
    CARD_SET_ORDER.forEach((sid,i)=>{ const set=CARD_SETS[sid], pr=Album.setProgress(sid);
      button(this,W/2+(i-(CARD_SET_ORDER.length-1)/2)*340,118,320,42,set.name+'  •  '+pr.owned+'/'+pr.total,()=>this.scene.restart({from:this.from,fromData:this.fromData,set:sid}),{size:15,disabled:this.setId===sid}); });
    const set=CARD_SETS[this.setId];
    txt(this,W/2,156,set.blurb,14,PARCH,{align:'center',wordWrap:{width:1000}}).setOrigin(0.5);
    txt(this,W/2,184,Album.setComplete(this.setId)?('✓ The set is complete — its gift of '+set.giftManna+' Manna + '+set.giftGrok+' Grokonians '+(Album.giftClaimed(this.setId)?'has been paid.':'pays at the reveal that completes it.')):('Finish the set: '+set.giftManna+' Manna + '+set.giftGrok+' Grokonians, paid once at the completing reveal.'),14,'#f2c14e').setOrigin(0.5);
    set.cards.forEach((c,i)=>{ const col=i%4,row=Math.floor(i/4),x=170+col*315,y=300+row*196;
      const own=Album.owns(c.id), T=WEAPON_TIERS[c.tier];
      const g=this.add.graphics(); g.fillStyle(own?0x2a1a10:0x171008,0.95); g.fillRoundedRect(x-148,y-86,296,172,10); g.lineStyle(own?3:2,own?T.color:0x4a3a28); g.strokeRoundedRect(x-148,y-86,296,172,10);
      if(own){ const im=this.add.image(x,y-40,c.glyph); if(im.setScale) im.setScale(0.5);
        txt(this,x,y+10,c.name,17,T.css,{align:'center',wordWrap:{width:280}}).setOrigin(0.5);
        txt(this,x,y+34,T.name+'  •  '+set.name,12,'#cdbd95').setOrigin(0.5);
        txt(this,x,y+54,c.epithet,12,PARCH,{align:'center',wordWrap:{width:280}}).setOrigin(0.5);
        txt(this,x,y+76,c.ref,12,'#a08a6a').setOrigin(0.5);
        const n=Album.count(c.id); if(n>1) txt(this,x+120,y-68,'×'+n,13,'#f2c14e').setOrigin(0.5);
      } else { txt(this,x,y-18,'?',34,'#5a4a3a').setOrigin(0.5);
        txt(this,x,y+26,'Not yet found',14,'#8a7a6a').setOrigin(0.5);
        txt(this,x,y+50,T.name+' card of '+set.name,12,'#6a5a4a').setOrigin(0.5); }
    });
    button(this,90,680,140,46,'Back',()=>this.scene.start(this.from,this.fromData||undefined));
  } }

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
    // Upgrade 13: the SOUND setting — the one master level for every
    // effect in the game (music keeps its own toggle, on the Menu).
    // Quieter/Louder step by 25; Mute folds into the same setting (0),
    // and unmuting restores the level the player had.
    keep(txt(this,90,478,'Sound',20,GOLD));
    keep(button(this,330,512,200,36,'Quieter',()=>{ SFX.setVolume((SFX.volume()||0)-25); this.refreshSnd(); },{size:15}));
    keep(button(this,830,512,200,36,'Louder',()=>{ SFX.setVolume((SFX.volume()||0)+25); this.refreshSnd(); },{size:15}));
    this.muteBtn=keep(button(this,1080,512,170,36,'Mute',()=>{ SFX.toggle(); this.refreshSnd(); },{size:15}));
    this.sndTxt=keep(txt(this,595,512,'',16,'#f2c14e').setOrigin(0.5));
    this.refreshSnd();
    // Upgrade 17 → 20: the Battle buttons face. FEW stands a few
    // circles and the presses do more (tap / hold); FULL stands every
    // circle always — the pre-Upgrade-20 layout. The choice is an
    // ACTIVE one (saveFaceChoice stamps it, so it wins over the
    // Upgrade-20 migration); it applies to the next battle, and at
    // once from the ⚙ pause in battle.
    keep(txt(this,90,434,'Battle buttons',20,GOLD));
    this.face=loadFace(); this.faceBtns={};
    [['few','Few',300],['full','Full',560]].forEach(([id,label,x])=>{ const b=button(this,x,456,200,34,label,()=>{ this.face=id; saveFaceChoice(id); this.markFace(); this.bindStatus.setText(id==='few'?'Buttons: Few — a few circles stand, and a press does more: tap for one thing, hold for another.':'Buttons: Full — every circle stands, always.'); },{size:15}); keep(b); this.faceBtns[id]=b; });
    this.markFace();
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
  refreshSnd(){ const v=SFX.volume?SFX.volume():100; // Upgrade 13
    if(this.sndTxt) this.sndTxt.setText('Sound: '+(v==null?100:v)+'%');
    if(this.muteBtn) this.muteBtn.label.setText(v>0?'Mute':'Unmute'); }
  markMove(){ if(!this.moveBtns) return;
    Object.entries(this.moveBtns).forEach(([id,b])=>{ b.label.setText((id==='tap'?'Tap to move':id==='stick'?'Joystick':'Follow (hold)')+(this.moveScheme===id?' ✓':'')); }); }
  markFace(){ if(!this.faceBtns) return; const f=this.face||loadFace();
    Object.entries(this.faceBtns).forEach(([id,b])=>{ b.label.setText((id==='few'?'Few':'Full')+(f===id?' ✓':'')); }); }
  renderBinds(){ (this.bindItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} }); this.bindItems=[];
    // Upgrade 15: seventeen actions no longer fit two columns of eight —
    // the list now runs three columns of six, same rows, same capture.
    BIND_ACTIONS.forEach(([id,label],i)=>{ const col=i%3, row=Math.floor(i/3), x=90+col*390, y=252+row*30;
      const t=txt(this,x,y,label,15,PARCH); this.bindItems.push(t);
      const kb=button(this,x+272,y+13,170,26,this._cap===id?'press a key…':keyName(this.binds[id]),()=>this.beginBindCapture(id),{size:13}); this.bindItems.push(kb); }); }
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
    // Upgrade 17 → 20: the ghosts are the CIRCLES now, and the editor
    // edits the player's own face. In FEW the fan's members stand OPEN
    // at their group positions above the bar and CAMP stands on its
    // rail above ORDERS — all dimmed and not draggable: the group is
    // positioned by dragging ORDERS, its one anchor; the members' own
    // seats belong to the Full face and are untouched here. In FULL
    // every command ghost stands at its own seat, and there is no
    // ORDERS ghost (it is not a Full control). A save writes every
    // seat it was not asked to move, unchanged.
    const face=loadFace(), fanGhosts={};
    const placeFan=()=>{ const og=items.find(it=>it.id==='orders'); if(!og) return;
      Object.entries(fanGhosts).forEach(([id,b])=>{ const f=id==='cmd_camp'?CAMP_RAIL:FAN_OFFSETS[id]; if(f) b.setPosition(og.obj.x+f.dx,og.obj.y+f.dy); }); };
    LAYOUT_DEFS.forEach(d=>{ const p=pos[d[0]];
      if(face==='full'&&d[0]==='orders') return;
      // Upgrade 16: the ghosts wear the same symbols as the real buttons,
      // with the name kept as a caption beneath — the Controls screen is
      // where symbol and name are learned together.
      const b=button(this,p.x,p.y,d[2],d[3],d[1],()=>{},{size:13,icon:LAYOUT_ICONS[d[0]],caption:true,circle:d[3]}); b.setDepth(40);
      this.ghostObjs.push(b);
      if(face==='few'&&(FAN_MEMBERS.includes(d[0])||d[0]==='cmd_camp')){ fanGhosts[d[0]]=b; b.setAlpha(0.55); if(b.disableInteractive) b.disableInteractive(); }
      else items.push({id:d[0],obj:b,w:d[2],h:d[3],sync:d[0]==='orders'?()=>placeFan():null}); }); // dragging ORDERS carries the open group with it, live
    placeFan();
    const g=this.add.graphics().setDepth(41); g.fillStyle(0x140c07,0.92); g.fillRoundedRect(W/2-330,10,660,44,10); g.lineStyle(2,0xf2c14e,1); g.strokeRoundedRect(W/2-330,10,660,44,10); this.ghostItems.push(g);
    this.ghostItems.push(txt(this,W/2,32,face==='few'?'EDITING LAYOUT — drag any button; the open rank and CAMP follow ORDERS':'EDITING LAYOUT — drag any button into place',17,'#f2c14e').setOrigin(0.5).setDepth(42));
    const dn=button(this,W/2-100,580,170,44,'Done',()=>this.exitGhostEdit(),{size:16}); dn.setDepth(42); this.ghostItems.push(dn);
    const rs=button(this,W/2+100,580,190,44,'Reset layout',()=>{ resetLayout(); const dp=defaultLayoutPos(); items.forEach(it=>{ it.obj.setPosition(dp[it.id].x,dp[it.id].y); }); placeFan(); },{size:15}); rs.setDepth(42); this.ghostItems.push(rs);
    this._ghostEd=layoutEditor(this,()=>{ const out=layoutPositions(); items.forEach(it=>{ out[it.id]={x:Math.round(it.obj.x),y:Math.round(it.obj.y)}; }); saveLayout(out); });
    this._ghostEd.setItems(items); this._ghostEd.enter(); }
  exitGhostEdit(){ if(!this._ghostEd) return; this._ghostEd.exit(); this._ghostEd=null;
    (this.ghostObjs||[]).concat(this.ghostItems||[]).forEach(o=>{ try{o.destroy();}catch(e){} });
    this.ghostObjs=[]; this.ghostItems=[]; this.setSectionVisible(true); } }

window.__game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#0d0906',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:3},
  scene:[Boot,Menu,Settings,EraSelect,HeroSelect,Unlocks,Armory,BattlePass,Chests,CardAlbum,Profile,Game,End]});
