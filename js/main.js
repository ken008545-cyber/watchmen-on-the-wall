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
  {id:'strength', name:'Orb of Strength', short:'Strength', color:0xd83a2a, css:'#ff9a86', cost:15, dur:60},
  {id:'swiftness', name:'Orb of Swiftness', short:'Swiftness', color:0x3ac8d8, css:'#9ae8f2', cost:12, dur:60},
  {id:'mending', name:'Orb of Mending', short:'Mending', color:0x63c74d, css:'#a8e89a', cost:20, dur:0},
  {id:'iron', name:'Orb of Iron', short:'Iron', color:0xc8ccd4, css:'#e8ecf2', cost:18, dur:30},
  {id:'thunder', name:'Orb of Thunder', short:'Thunder', color:0xf2c14e, css:'#ffe08a', cost:25, dur:0},
];
const ORB_CD=15; // seconds an orb sleeps after a purchase
const ORB_RANGE=90; // the hero must stand this close to touch an orb
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
  c.on('pointerover',()=>draw(true)); c.on('pointerout',()=>draw(false));
  c.on('pointerup',(p,lx,ly,e)=>{ if(e) e.stopPropagation(); SFX.unlock(); if(!opt.disabled) cb(); });
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
  'Tip: Glowing orbs in the field sell powers for Grokonians — walk your hero up and tap one, even mid-wave.'
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
    button(this,1150,42,220,46,'Fullscreen',()=>{ try{ this.scale.startFullscreen(); }catch(e){} },{size:17});
    const L=Progress.level(), T=Progress.state.title;
    txt(this,W/2,585,'Level '+L.lv+'  •  Account '+Progress.accountLevel()+'  •  Battle Pass tier '+Progress.bpTier()+'/30'+(T?'  •  "'+Progress.titleName(T)+'"':''),20).setOrigin(0.5);
    txt(this,W/2,630,'Grokonians: '+Tokens.balance(),24,GOLD).setOrigin(0.5); txt(this,W/2,680,'A GX Hub game'+(Tokens.mode==='hub'?'  (connected to GX Hub)':''),18).setOrigin(0.5);
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
      if(ok) button(this,x,y+108,170,40,this.browse?'Mastery '+M.lv+(M.max?' (max)':''):'Lead',()=>{ if(!this.browse) this.scene.start('Game',{hero:h.id,level:this.level}); },{size:16,disabled:this.browse});
      else if(h.unlock.type==='grokonians') button(this,x,y+108,186,40,'Unlock '+h.unlock.cost+' G',()=>{ if(Tokens.spend('hero:'+h.id,h.unlock.cost)){Tokens.grant(h.id);Progress.checkAch();SFX.build();this.scene.restart({browse:this.browse,level:this.level});} },{disabled:Tokens.balance()<h.unlock.cost,size:15});
      else txt(this,x,y+108,'🔒 '+lockLabel(h),14,'#a08a6a',{align:'center',wordWrap:{width:186}}).setOrigin(0.5);
    });
    button(this,90,680,140,46,'Back',()=>this.browse?this.scene.start('Menu'):this.scene.start('EraSelect'));
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
    this.wave=0; this.wavesCleared=0; this.endless=false; this.cleared=false; this.over=false;
    this.coins=[]; this.coinT=3; this.coinSeq=0; this.coinCount=0;
    this.order='follow'; this.volleyMode=false; this.volleyCd=0; }
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
    this.enemies=[]; this.squads=[]; this.shots=[]; this.spawnQ=[]; this.waveActive=false; this.shopOpen=false; this.victoryOpen=false; this.shopT=0; this.shopPage=0; this.shopItems=[]; this.nightRect=null;
    this.fx=this.add.graphics().setDepth(20);
    this.buildHero(); this.buildOrbs(); this.buildHUD();
    this.cameras.main.setBounds(0,0,this.worldW,this.worldH);
    this.cameras.main.startFollow(this.hero.spr,true,0.08,0.08);
    this.fixUI();
    this.input.on('pointerdown',p=>this.onTap(p));
    this.toast(this.era.name+' — Goal: survive wave '+this.goalWave+(this.era.verse?'\n'+this.era.verse:''),4200);
    this.openShop(true);
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
    const cmds=[['charge','Charge'],['hold','Hold'],['follow','Follow Me'],['flank','Flank'],['fallback','Fall Back'],['shieldwall','Shield Wall']];
    this.cmdBtns={};
    cmds.forEach(([id,label],i)=>{ const b=button(this,330+i*118,HUD_Y+26,112,36,label,()=>{ this.order=id; this.volleyMode=false; this.refreshHUD(); this.toast('Order: '+label); },{size:15}); b.setDepth(31); this.cmdBtns[id]=b; });
    const vb=button(this,330+6*118,HUD_Y+26,112,36,'Volley',()=>{ if(this.volleyCd>0){ this.toast('Volley ready in '+Math.ceil(this.volleyCd)+'s'); return; } this.volleyMode=true; this.toast('Volley: tap a target spot'); },{size:15}); vb.setDepth(31); this.cmdBtns.volley=vb;
    const h=this.heroDef; this.skillBtns=[];
    [...h.skills,h.ult].forEach((k,i)=>{ const b=button(this,110+i*185,HUD_Y+80,175,44,k.name,()=>this.useSkill(i),{size:16}); b.setDepth(31); b.cd=0; b.def=k; this.skillBtns.push(b); });
    this.spdBtn=button(this,1221,HUD_Y+80,110,44,'x1',()=>{ this.speed=this.speed===1?2:1; this.spdBtn.label.setText('x'+this.speed); },{size:18}).setDepth(31);
    const fsb=button(this,1221,HUD_Y+26,110,36,'Fullscreen',()=>{ try{ this.scale.startFullscreen(); }catch(e){} },{size:13}); fsb.setDepth(31);
    this.refreshHUD(); this.fixUI(); }
  phaseName(){ return this.wave%2===0&&this.wave>0?'Night':'Day'; }
  refreshHUD(){ const goalTxt=this.endless?'∞ (goal cleared)':String(this.goalWave);
    this.stat.setText('Manna '+Math.floor(this.manna)+'   Camp '+Math.max(0,Math.ceil(this.campHp))+'/'+this.campMax+'   Wave '+this.wave+'/'+goalTxt+'   '+(this.waveActive?this.phaseName():'')+'   Grokonians +'+this.earned+'   '+this.heroDef.name+'   Squads '+this.squads.length+'/'+this.squadCap);
    this.orderTxt.setText('Order: '+({charge:'Charge',hold:'Hold',follow:'Follow Me',flank:'Flank',fallback:'Fall Back',shieldwall:'Shield Wall'})[this.order]+(this.volleyMode?'   •   VOLLEY: tap a spot':''));
    if(this.buffTxt){ const bp=[]; if(this.buffStrT>0) bp.push('STR '+Math.ceil(this.buffStrT)+'s'); if(this.buffSpdT>0) bp.push('SPD '+Math.ceil(this.buffSpdT)+'s'); if(this.buffIronT>0) bp.push('IRON '+Math.ceil(this.buffIronT)+'s'); this.buffTxt.setText(bp.join('    ·    ')); }
    if(this._lastOrder!==this.order){ this._lastOrder=this.order; Object.entries(this.cmdBtns).forEach(([id,b])=>{ if(b.redraw) b.redraw(id===this.order); }); }
    Object.entries(this.cmdBtns).forEach(([id,b])=>{ b.alpha=(id==='volley'&&this.volleyCd>0)?0.5:1; }); }
  toast(m,ms){ if(this._toast) this._toast.destroy(); const t=txt(this,W/2,HUD_Y-70,m,22,GOLD,{backgroundColor:'#140c07cc',padding:{x:10,y:4},wordWrap:{width:900},align:'center'}).setOrigin(0.5).setDepth(40).setScrollFactor(0); this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||1800,duration:600,onComplete:()=>t.destroy()}); }
  onTap(p){ if(this.over||this.shopOpen||this.victoryOpen||p.y>=HUD_Y) return;
    // p.y is a screen coordinate (the HUD check); the tap itself lands in the world.
    const wx=(p.worldX!==undefined?p.worldX:p.x), wy=(p.worldY!==undefined?p.worldY:p.y);
    if(this.volleyMode){ this.doVolley(wx,wy); return; }
    // Upgrade 5: a tap on an orb is a purchase attempt, not a move order.
    const orb=(this.orbs||[]).find(o=>Math.hypot(wx-o.x,wy-o.y)<=42);
    if(orb){ this.tryBuyOrb(orb); return; }
    this.hero.tx=Math.max(20,Math.min(this.worldW-20,wx)); this.hero.ty=Math.max(40,Math.min(this.worldH-20,wy)); }
  doVolley(x,y){ this.volleyMode=false; this.volleyCd=12; let n=0;
    this.squads.filter(s=>s.def.role==='ranged'&&!s.dead).forEach((s,i)=>{ n++; this.time.delayedCall(i*90,()=>{ this.shoot(s.x,s.y-20,{x,y,dead:false},'stone',{dmg:s.dmg*3,type:'physical',splash:90,splashAt:{x,y}},800); }); });
    if(!n){ this.toast('No ranged squads for a volley'); this.volleyCd=0; } else { SFX.sling(); this.toast('Volley away!'); }
    this.refreshHUD(); }
  // --- hero ---
  buildHero(){ const h=this.heroDef, hx=this.campPos.x+60, hy=this.campPos.y; this.hero={def:h,x:hx,y:hy,tx:hx,ty:hy,cd:0,hp:h.hp,down:0};
    this.hero.spr=spr(this,hx,hy,h.id).setDepth(8); this.hero.hpBar=this.add.graphics().setDepth(12);
    this.hero.ring=this.add.circle(hx,hy,h.range,0xffffff,0.04).setStrokeStyle(1,0xd9a441,0.4).setDepth(3); }
  hurtHero(n){ const h=this.hero; if(h.down>0) return; h.hp-=n; h.spr.setTint(0xff6a5a); this.time.delayedCall(80,()=>{ if(h.spr.active) h.spr.clearTint(); });
    if(h.hp<=0){ h.down=this.respawnTime||8; h.hp=0; h.spr.setAlpha(0.35); this.toast(h.def.name+' is down! Returns in '+Math.round(this.respawnTime||8)+'s — while the camp stands',3000); } }
  // Upgrade 3: the hero returns only while the camp stands. If the camp has
  // fallen the run is already over, so a downed hero simply stays down.
  tickHeroDown(dt){ const h=this.hero; if(h.down<=0) return; h.down-=dt;
    if(h.down<=0&&this.campHp>0){ h.hp=h.def.hp; h.down=0; h.spr.setAlpha(1); h.x=h.tx=this.campPos.x+60; h.y=h.ty=this.campPos.y; this.toast(h.def.name+' returns!'); } }
  // Upgrade 3: camp damage. Union Shield (shieldT) turns every blow aside.
  // The goal-wave champion hits the camp three times as hard.
  hitCamp(amt,e){ if(this.over) return; if(this.shieldT>0) return;
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
    SFX.build(); this.renderShop(false); this.refreshHUD(); return true; }
  buyCampRepair(){ if(this.campHp>=this.campMax||this.manna<CAMP_REPAIR.cost) return false;
    this.manna-=CAMP_REPAIR.cost; this.campHp=Math.min(this.campMax,this.campHp+CAMP_REPAIR.heal);
    SFX.build(); this.renderShop(false); this.refreshHUD(); return true; }
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
      this.orbs.push({def,x,y,img,glow,label,cd:0,hinted:false}); }); }
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
      return 'far'; }
    if(!Tokens.spend('orb:'+o.def.id,o.def.cost)){ this.toast('Not enough Grokonians (have '+Tokens.balance()+')'); return 'funds'; }
    o.cd=ORB_CD; o._cdShown=null;
    this.applyOrb(o); SFX.orbBuy(); this.spark(o.x,o.y-8,o.def.color,10); this.refreshHUD();
    return 'bought'; }
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
      if(!o.hinted&&this.hero&&this.hero.down<=0&&Math.hypot(this.hero.x-o.x,this.hero.y-o.y)<140){ o.hinted=true; this.toast(o.def.name+' — '+o.def.cost+' Grokonians. Tap the orb to buy its power.',2400); } } }
  // --- squads ---
  addSquad(def,x,y){ const s={def,x:x||(this.campPos?this.campPos.x+60:170),y:y||(this.campPos?this.campPos.y:360),hp:def.hp,max:def.hp,dmg:def.dmg,range:def.range,rate:def.rate,speed:def.speed,
      armor:def.role==='shield'?0.2:0,cd:0,buffRateT:0,buffDmgT:0,dead:false,upgrades:{}};
    s.spr=uspr(this,s.x,s.y,def,def.img?58:54); applyTint(s.spr,def);
    s.bar=this.add.graphics().setDepth(12); this.squads.push(s); return s; }
  hurtSquad(s,amt){ if(s.dead) return; let m=1-(s.armor||0); if(this.order==='shieldwall') m*=0.55; s.hp-=amt*m;
    s.spr.setTint(0xff6a5a); this.time.delayedCall(60,()=>{ if(!s.dead&&s.spr.active){ s.spr.clearTint(); applyTint(s.spr,s.def); } });
    if(s.hp<=0){ s.dead=true; s.spr.destroy(); s.bar.destroy(); this.toast(s.def.name+' has fallen. Squad lost — the fallen do not return this run',2800); } }
  formationOffset(i){ const col=Math.floor(i/3), row=i%3;
    if(this.order==='flank') return {dx:-16-col*30,dy:(row-1)*74};
    if(this.order==='shieldwall') return {dx:(this.squads[i]&&this.squads[i].def.role==='shield'?26:-30-col*30),dy:(row-1)*40};
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
    this.cameras.main.shake(400,0.008); SFX.stomp(); this.toast(e.def.name+' has come out to fight!',2600); }
  bossTick(){ if(!this.bossBar) return; const e=this.boss; if(!e||e.dead){ this.clearBoss(); return; }
    const f=Math.max(0,e.hp/e.max), bb=this.bossBar; bb.clear();
    bb.fillStyle(0x000000,0.7); bb.fillRect(W/2-250,HUD_Y-16,500,12); bb.fillStyle(0xa33b20,1); bb.fillRect(W/2-250,HUD_Y-16,500*f,12);
    bb.lineStyle(2,0xd9a441); bb.strokeRect(W/2-250,HUD_Y-16,500,12); }
  clearBoss(){ if(this.bossBar){ this.bossBar.destroy(); this.bossBar=null; } if(this.bossName){ this.bossName.destroy(); this.bossName=null; } this.boss=null; }
  // --- combat core ---
  damage(e,amt,type,opt){ if(e.dead) return; opt=opt||{};
    let m=(DATA.armorTable[e.armorType]||{})[type]||1; if(opt.crit&&Math.random()<opt.crit){ m*=e.boss?2.5:2; this.floatText(e.x,e.y-20,'CRIT','#f2c14e'); }
    e.hp-=amt*m; SFX.enemyHit();
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
    const near=(r)=>E.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y)<r);
    const strongest=(n,list)=>(list||E).slice().sort((a,b2)=>b2.hp-a.hp).slice(0,n);
    const ring=(r,col)=>{ const c=this.add.circle(h.x,h.y,10,col,0.3).setDepth(15); this.tweens.add({targets:c,radius:r,alpha:0,duration:500,onComplete:()=>c.destroy()}); };
    const buffSquads=(rate,dmg)=>this.squads.forEach(s=>{ if(rate) s.buffRateT=rate; if(dmg) s.buffDmgT=dmg; });
    switch(k.id){
      case 'stone': { const t=strongest(1,near(h.def.range*2))[0]; if(!t) return this.toast('No target'); this.shoot(h.x,h.y,t,'stone',{dmg:120,type:'physical',stun:1.5,crit:0.2},700); break; }
      case 'psalm': buffSquads(6,0); ring(240,0xd9a441); break;
      case 'five': { const ts=strongest(5); if(!ts.length) return this.toast('No target'); ts.forEach((t,j)=>this.time.delayedCall(j*120,()=>this.shoot(h.x,h.y,t,'stone',{dmg:250*(t.boss?3:1),type:'physical',stun:0.5},800))); SFX.ult(); this.cameras.main.flash(200,217,164,65); break; }
      case 'rally': buffSquads(0,8); ring(400,0xd9a441); break;
      case 'palm': near(170).forEach(e=>e.stun=Math.max(e.stun||0,2)); ring(170,0x8a6a9a); break;
      case 'song': E.forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=6; this.damage(e,60,'holy'); }); this.cameras.main.flash(250,200,180,230); break;
      case 'lamp': near(180).forEach(e=>{ if(!e.boss) e.confuse=3; }); ring(180,0xf2c14e); break;
      case 'three': for(let j=0;j<12;j++) this.time.delayedCall(j*70,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,40,'holy'); this.spark(t.x,t.y,0xf2c14e); } }); break;
      case 'sword': E.forEach(e=>this.damage(e,150,'holy')); this.cameras.main.flash(250,242,193,78); break;
      case 'jaw': near(90).forEach(e=>this.damage(e,90,'physical')); ring(90,0xe8e0c8); break;
      case 'roar': near(150).forEach(e=>{ e.stun=Math.max(e.stun||0,1.5); }); ring(150,0xd8572a); this.cameras.main.shake(150,0.004); break;
      case 'geyser': near(150).forEach(e=>this.damage(e,80,'holy',{slow:0.4})); ring(150,0x6a9ad8); break;
      case 'manna': this.manna+=40; this.floatText(h.x,h.y-30,'+40 Manna',GOLD); this.refreshHUD(); break;
      case 'sea': E.forEach(e=>{ if(!e.boss){ e.x=Math.min(this.worldW+10,e.x+260); e.stun=Math.max(e.stun||0,1); } else this.damage(e,200,'holy'); }); this.cameras.main.flash(300,120,170,220); break;
      case 'altarflame': near(160).forEach(e=>this.damage(e,30,'fire',{burn:[22,4]})); ring(160,0xd8572a); break;
      case 'ravens': h.hp=Math.min(h.def.hp,h.hp+h.def.hp*0.5); this.floatText(h.x,h.y-30,'+HP','#8fd06a'); break;
      case 'chariot': E.forEach(e=>this.damage(e,120,'fire',{burn:[20,4]})); this.cameras.main.flash(300,242,140,60); break;
      case 'banquet': this.banquet=true; this.toast('Royal Banquet: +50% Manna for the next wave clear'); break;
      case 'plea': E.forEach(e=>{ e.slow=Math.max(e.slow||0,0.4); e.slowT=6; }); ring(400,0x8a6a9a); break;
      case 'time': this.squads.forEach(s=>{ s.cd=0; s.buffRateT=10; s.buffDmgT=10; }); this.cameras.main.flash(250,230,200,240); break;
      case 'pair': for(let j=0;j<6;j++) this.time.delayedCall(j*120,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,45,'physical'); this.spark(t.x,t.y,0xcdbd95,3); } }); break;
      case 'rain': near(220).forEach(e=>{ e.slow=Math.max(e.slow||0,0.5); e.slowT=5; }); ring(220,0xdfe6ee); break;
      case 'ark': this.campHp=Math.min(this.campMax,this.campHp+50); E.forEach(e=>this.damage(e,100,'holy')); this.floatText(this.campPos.x,this.campPos.y-70,'Camp +50','#8fd06a'); this.toast('The Ark: the camp is mended (+50)'); this.refreshHUD(); break;
      case 'kite': { let src=h, hit=[]; for(let j=0;j<4;j++){ const c=E.filter(e=>!hit.includes(e)&&Phaser.Math.Distance.Between(e.x,e.y,src.x,src.y)<220).sort((a,b2)=>Phaser.Math.Distance.Between(a.x,a.y,src.x,src.y)-Phaser.Math.Distance.Between(b2.x,b2.y,src.x,src.y))[0]; if(!c) break; this.fx.lineStyle(3,0xf2e07a,1).lineBetween(src.x,src.y,c.x,c.y); this.damage(c,90,'sonic',{stun:0.5}); hit.push(c); src=c; } this.time.delayedCall(150,()=>this.fx.clear()); if(!hit.length) return this.toast('No target'); break; }
      case 'bifocal': buffSquads(0,8); ring(260,0xf2e07a); break;
      case 'almanac': for(let j=0;j<10;j++) this.time.delayedCall(j*110,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,120,'sonic',{stun:0.4}); this.spark(t.x,t.y,0xf2e07a,5); } }); this.cameras.main.flash(200,240,230,150); break;
      case 'crossing': { const t=strongest(1)[0]; if(!t) return this.toast('No target'); h.x=h.tx=t.x; h.y=h.ty=t.y; near(110).forEach(e=>this.damage(e,100,'physical')); ring(110,0x3a5a9a); break; }
      case 'cherry': { const t=strongest(1,near(160))[0]; if(!t) return this.toast('No target'); this.damage(t,220,'physical',{stun:1}); break; }
      case 'forge': h.hp=h.def.hp; buffSquads(10,0); this.cameras.main.flash(250,200,210,240); break;
      case 'log': near(140).forEach(e=>e.stun=Math.max(e.stun||0,2.5)); ring(140,0x8a5a2a); break;
      case 'speech': buffSquads(0,10); ring(400,0xd9a441); break;
      case 'union': this.shieldT=10; this.toast('Union Shield: the camp takes no damage for 10s'); break;
      case 'trick': strongest(3,near(260)).forEach(t=>this.shoot(h.x,h.y,t,'stone',{dmg:100,type:'physical',crit:0.5},900)); break;
      case 'sharp': { const t=strongest(1,near(320))[0]; if(!t) return this.toast('No target'); this.shoot(h.x,h.y,t,'stone',{dmg:180,type:'physical',crit:0.5},1100); break; }
      case 'show': for(let j=0;j<15;j++) this.time.delayedCall(j*80,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length) this.shoot(h.x,h.y,Phaser.Utils.Array.GetRandom(L),'stone',{dmg:60,type:'physical',crit:0.3},1000); }); break;
      case 'pillars': E.forEach(e=>{ this.damage(e,300,'physical'); e.stun=Math.max(e.stun||0,2); }); this.cameras.main.shake(400,0.012); SFX.stomp(); break;
      default: { const t=strongest(1)[0]; if(!t) return this.toast('No target'); this.shoot(h.x,h.y,t,'stone',{dmg:100,type:'physical'},700); break; }
    }
    this.floatText(h.x,h.y-56,k.name+'!','#f2c14e');
    if(k.id!=='five') SFX.skill(); if(i===2){ this.tr('ults'); if(k.id!=='five') SFX.ult(); } b.cd=k.cd; }
  // --- between-wave shop ---
  openShop(first){ this.shopOpen=true; this.shopFirst=!!first; this.shopT=20; this.shopPage=0;
    // squads and hero mend between waves
    this.squads.forEach(s=>{ s.hp=s.max; }); this.hero.hp=this.heroDef.hp;
    this.renderShop(first); }
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
    const go=button(this,820,668,300,54,'Next wave ▶',()=>this.closeShop(),{size:22}); go.setDepth(52); this.shopAdd(go);
    this.shopTimerTxt=this.shopAdd(txt(this,1090,668,this.shopFirst?'Auto-start off — take your time':'Auto-start in 20s',16,'#cdbd95').setOrigin(0.5).setDepth(52));
    this.fixUI();
  }
  updateShopHead(){ if(this.shopHead2) this.shopHead2.setText('Manna '+Math.floor(this.manna)+'  •  Squads '+this.squads.length+'/'+this.squadCap+'  •  Next: wave '+(this.wave+1)+' ('+((this.wave+1)%2===0?'night':'day')+')  •  Goal: wave '+this.goalWave+(this.endless?' (cleared — Endless)':'')); }
  closeShop(){ this.shopOpen=false; this.shopFirst=false; this.clearShop(); this.startWave(); }
  waveClear(){ this.waveActive=false; this.wavesCleared=this.wave;
    let bonus=60+this.wave*8; if(this.banquet){ bonus=Math.round(bonus*1.5); this.banquet=false; }
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
    if(this.shopOpen){ if(this.shopFirst){ if(this.shopTimerTxt) this.shopTimerTxt.setText('Auto-start off — take your time'); }
      else { this.shopT-=delta/1000; if(this.shopTimerTxt) this.shopTimerTxt.setText('Auto-start in '+Math.max(0,Math.ceil(this.shopT))+'s');
        if(this.shopT<=0) this.closeShop(); } return; }
    if(this.victoryOpen) return;
    const dt=Math.min(0.05,delta/1000)*this.speed; if(this.shieldT>0) this.shieldT-=delta/1000*this.speed;
    if(this.volleyCd>0){ this.volleyCd-=dt; if(this.volleyCd<=0) this.refreshHUD(); }
    this.orbTick(dt);
    // spawns
    if(this.waveActive){ this.waveClock+=dt; while(this.spawnQ.length&&this.spawnQ[0].at<=this.waveClock) this.spawn(this.spawnQ.shift()); }
    // field coins (Upgrade 3): one every ~6s of an active wave, max 8 out
    if(this.waveActive){ this.coinT-=dt; if(this.coinT<=0){ this.coinT=6; if(this.coins.length<8) this.spawnCoin(); } }
    this.collectCoins();
    const night=this.wave%2===0;
    // hero movement + combat
    const h=this.hero, hd=h.def;
    if(h.down>0){ this.tickHeroDown(dt); }
    else { const dx=h.tx-h.x, dy=h.ty-h.y, dl=Math.hypot(dx,dy);
      if(dl>3){ const st=Math.min(dl,hd.speed*this.orbSpdMul()*dt); h.x+=dx/dl*st; h.y+=dy/dl*st; h.spr.setFlipX(dx<0); }
      h.hp=Math.min(hd.hp,h.hp+hd.hp*0.01*dt);
      h.cd-=dt; if(h.cd<=0){ const t=this.nearestEnemy(h.x,h.y,hd.range); if(t){ h.cd=hd.rate;
        if(hd.range<80){ this.damage(t,hd.dmg*this.orbDmgMul(),hd.dmgType,{crit:0.1}); this.spark(h.x+10,h.y,0xe8e0c8,3); }
        else this.shoot(h.x,h.y,t,hd.dmgType==='holy'?'ember':'stone',{dmg:hd.dmg*this.orbDmgMul(),type:hd.dmgType,crit:0.1},600); } } }
    h.spr.setOrigin(0.5,0.9).setPosition(h.x,h.y+18).setDepth(8+h.y/1000); h.ring.setPosition(h.x,h.y);
    h.hpBar.clear(); h.hpBar.fillStyle(0x000000,0.7); h.hpBar.fillRect(h.x-22,h.y-48,44,5); h.hpBar.fillStyle(0x5aa33b,1); h.hpBar.fillRect(h.x-22,h.y-48,44*Math.max(0,h.hp)/hd.hp,5);
    this.drawCampBar();
    this.campFireTick(dt);
    // squads
    this.squads=this.squads.filter(s=>!s.dead);
    this.squads.forEach((s,idx)=>{ if(s.buffRateT>0) s.buffRateT-=dt; if(s.buffDmgT>0) s.buffDmgT-=dt;
      const rangeMul=(night&&s.def.role==='ranged')?1.1:1, range=s.range*rangeMul;
      const foe=this.nearestEnemy(s.x,s.y,range);
      let tx,ty;
      if(this.order==='charge'){ const e2=this.nearestEnemy(s.x,s.y,9999); if(e2){ tx=e2.x; ty=e2.y; } else { tx=h.x; ty=h.y; } }
      else if(this.order==='hold'){ tx=s.x; ty=s.y; }
      else if(this.order==='fallback'){ tx=this.campPos.x+70+Math.floor(idx/3)*30; ty=this.campPos.y+(idx%3-1)*40; }
      else { const o=this.formationOffset(idx); tx=h.x+o.dx; ty=h.y+o.dy; }
      const dx=tx-s.x, dy=ty-s.y, dl=Math.hypot(dx,dy), spd=s.speed*(this.order==='shieldwall'?0.6:1)*this.orbSpdMul();
      if(!foe&&dl>8){ const st=Math.min(dl,spd*dt); s.x+=dx/dl*st; s.y+=dy/dl*st; s.spr.setFlipX(dx<0); }
      else if(foe&&dl>range*0.9&&this.order!=='hold'){ const st=Math.min(dl,spd*dt); s.x+=dx/dl*st; s.y+=dy/dl*st; }
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
      else { // Upgrade 3: the camp is the prize. A defender within 90px blocks
        // the road and the enemy stops to fight it; otherwise it marches on
        // the camp and, on arrival, stays and attacks it. It never vanishes,
        // and the run ends only when the camp itself falls.
        let def=null,bd=90;
        if(h.down<=0){ const d=Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y); if(d<bd){ bd=d; def={x:h.x,y:h.y,kind:'hero'}; } }
        for(const s of this.squads){ if(s.dead) continue; const d=Phaser.Math.Distance.Between(e.x,e.y,s.x,s.y); if(d<bd){ bd=d; def={x:s.x,y:s.y,kind:'squad',s}; } }
        const dc=Phaser.Math.Distance.Between(e.x,e.y,this.campPos.x,this.campPos.y);
        if(def){ const dx=def.x-e.x, dy=def.y-e.y, dl=Math.hypot(dx,dy)||1;
          if(bd>e.range+6){ const sp=e.speed*(1-(e.slow||0)); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0); }
          else { e.cd-=dt; if(e.cd<=0){ e.cd=e.rate;
            if(def.kind==='hero') this.hurtHero(e.dmg); else this.hurtSquad(def.s,e.dmg);
            SFX.enemyAttack(); this.spark(def.x,def.y,0xc0392b,2); } }
        } else if(dc>e.range+34){ const dx=this.campPos.x-e.x, dy=this.campPos.y-e.y, dl=Math.hypot(dx,dy)||1;
          const sp=e.speed*(1-(e.slow||0)); e.x+=dx/dl*sp*dt; e.y+=dy/dl*sp*dt; e.spr.setFlipX(dx<0);
        } else { e.cd-=dt; if(e.cd<=0){ e.cd=e.rate; this.hitCamp(e.dmg,e); this.spark(this.campPos.x+30,this.campPos.y-10,0xc0392b,2); } }
      }
      const p={x:e.x,y:e.y}; e.spr.setOrigin(0.5,0.9).setPosition(p.x,p.y+(e.def.size||18)).setDepth((e.boss?9:7)+p.y/1000);
      e.bar.clear(); if(e.hp<e.max){ e.bar.fillStyle(0x000000,0.7); e.bar.fillRect(e.x-16,e.y-36,32,4); e.bar.fillStyle(0xa33b20,1); e.bar.fillRect(e.x-16,e.y-36,32*Math.max(0,e.hp)/e.max,4); }
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.bossTick();
    // shots
    for(const s of this.shots){ const tg=s.target; if(tg&&!tg.dead&&tg.x!==undefined){ s.lx=tg.x; s.ly=tg.y; }
      const a=Phaser.Math.Angle.Between(s.s.x,s.s.y,s.lx,s.ly), step=s.speed*dt;
      if(Phaser.Math.Distance.Between(s.s.x,s.s.y,s.lx,s.ly)<=step+4){ s.done=true; s.s.destroy(); SFX.hit();
        if(s.opt.splash){ const at=s.opt.splashAt||{x:s.lx,y:s.ly}; this.enemies.forEach(e=>{ if(!e.dead&&Phaser.Math.Distance.Between(e.x,e.y,at.x,at.y)<s.opt.splash) this.damage(e,s.opt.dmg,s.opt.type,s.opt); });
          const c=this.add.circle(at.x,at.y,s.opt.splash,0xd9a441,0.22).setDepth(4); this.tweens.add({targets:c,alpha:0,duration:350,onComplete:()=>c.destroy()}); }
        else if(tg&&!tg.dead) this.damage(tg,s.opt.dmg,s.opt.type,s.opt); }
      else { s.s.x+=Math.cos(a)*step; s.s.y+=Math.sin(a)*step; s.s.rotation+=0.3; } }
    this.shots=this.shots.filter(s=>!s.done);
    this.skillBtns.forEach(b=>{ if(b.cd>0){ b.cd-=dt; b.label.setText(b.def.name+'\n'+Math.ceil(b.cd)+'s'); b.alpha=0.5; } else { b.label.setText(b.def.name); b.alpha=1; } });
    // wave end
    if(this.waveActive&&!this.spawnQ.length&&!this.enemies.length) this.waveClear();
    this.refreshHUD();
  }
  end(win){ if(this.over) return; this.over=true; this.clearShop(); this.shopOpen=false;
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
    this.time.delayedCall(800,()=>this.scene.start('End',{win,earned:this.earned,newUnlock:this.newUnlock,perfect:!this.campHurtTotal,xp:this.runXp,hero:this.heroDef.id,ev,stars,rec,waves:this.wavesCleared,era:this.eraId,eraName:this.era.name,endless:this.endless})); } }

class End extends Phaser.Scene{ constructor(){super('End');}
  create(d){ backdrop(this,0.7);
    txt(this,W/2,150,d.win?(d.eraName||'Era')+': Held':'The Camp has Fallen',52,d.win?GOLD:'#c0392b').setOrigin(0.5);
    if(d.win) txt(this,W/2,212,'★'.repeat(d.stars)+'☆'.repeat(3-d.stars),40,GOLD).setOrigin(0.5);
    txt(this,W/2,262,d.win?'"The battle is the LORD\'s." 1 Samuel 17:47':'"Be strong and of a good courage." Joshua 1:9',22).setOrigin(0.5);
    txt(this,W/2,305,'Score '+(d.rec?d.rec.score:0)+(d.endless?'  •  Endless run — waves survived: '+d.waves:''),22,'#f2c14e').setOrigin(0.5);
    txt(this,W/2,340,'Grokonians earned this run: '+d.earned+(d.perfect&&d.win?'  (perfect clear!)':''),28,GOLD).setOrigin(0.5);
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


window.__game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#0d0906',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:3},
  scene:[Boot,Menu,EraSelect,HeroSelect,Unlocks,BattlePass,Profile,Game,End]});
