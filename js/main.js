// Watchmen on the Wall — Chapter 1 (Valley of Elah). Plain JS + Phaser 3.
const W=1280,H=720,HUD_Y=610;
// display heights (px) for atlas sprites
const SZ={moses:60,elijah:58,esther:58,noah:60,franklite:56,washingtoon:60,lincolnlog:64,oakley:58,david:58,deborah:58,gideon:58,samson:66,locust:34,frog:38,froglet:22,spearman:52,priest:52,golem:66,bearer:56,goliath:140,tower:66};
function spr(s,x,y,key,h){ const im=s.add.image(x,y,'spr',key); im.setScale((h||SZ[key]||50)/im.height); im.baseScale=im.scaleX; return im; }
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

class Boot extends Phaser.Scene{ constructor(){super('Boot');}
  preload(){ this.load.json('data','data/game.json'); this.load.json('prog','data/progression.json'); this.load.image('bg','assets/bg_elah.jpg'); this.load.json('worlds','data/worlds.json'); this.load.json('conq','data/conquest.json'); ['elah','jericho','egypt','babylon','liberty','toon'].forEach(w=>this.load.image('bg_'+w,'assets/bg_'+w+'.jpg')); this.load.image('logo','assets/logo-512.png'); this.load.image('food','assets/food-icon.png'); this.load.json('surv','data/survival.json'); this.load.atlas('ua','assets/units_atlas.png','assets/units_atlas.json'); this.load.atlas('up','assets/units_painted_atlas.png','assets/units_painted_atlas.json'); this.load.atlas('spr','assets/sprites.png','assets/sprites.json'); }
  create(){ DATA=this.cache.json.get('data'); Progress.init(this.cache.json.get('prog'),DATA); Levels.init(this.cache.json.get('worlds'),DATA.enemies); makeArt(this); makeArt2(this); Conq.init(this.cache.json.get('conq')); window.__SV=this.cache.json.get('surv'); this.scene.start('Menu'); } }

function backdrop(s,dim,key){ s.add.image(W/2,H/2,key||'bg').setDisplaySize(W,H); s.add.rectangle(W/2,H/2,W,H,0x0d0906,dim); }

class Menu extends Phaser.Scene{ constructor(){super('Menu');}
  create(){ backdrop(this,0.55);
    const lg=this.add.image(W/2,128,'logo'); lg.setScale(232/lg.height); this.tweens.add({targets:lg,scale:lg.scale*1.03,duration:1800,yoyo:true,repeat:-1,ease:'Sine.inOut'});
    txt(this,W/2,262,'"I have set watchmen upon thy walls, O Jerusalem" Isaiah 62:6',20).setOrigin(0.5);
    const sv=SVsave.get(), dk=new Date(), dd=dk.getFullYear()+'-'+String(dk.getMonth()+1).padStart(2,'0')+'-'+String(dk.getDate()).padStart(2,'0');
    txt(this,W/2,296,'Survive as many waves as you can  •  Best wave '+sv.best+'  •  Today\'s daily best '+(sv.daily[dd]||0),22).setOrigin(0.5);
    const hero=()=>{ for(const k of ['elah','jericho']){ const c=Conq.camp(k); if(c) return c.hero; } return 'david'; };
    button(this,W/2-160,352,300,62,'⚔ Survival',()=>this.scene.start('Survival',{hero:hero()}),{size:30});
    button(this,W/2+160,352,300,62,'Daily Survival',()=>this.scene.start('Survival',{daily:true,hero:hero()}),{size:26});
    button(this,W/2-160,420,300,52,'Conquer (campaign)',()=>this.scene.start('WorldMap'),{size:22});
    button(this,W/2+160,420,300,52,'Heroes',()=>this.scene.start('HeroSelect',{browse:true}),{size:22});
    button(this,W/2-160,480,300,50,'Battle Pass',()=>this.scene.start('BattlePass'),{size:22});
    button(this,W/2+160,480,300,50,'Profile & Level',()=>this.scene.start('Profile'),{size:22});
    button(this,W/2-160,538,300,48,'Unlocks',()=>this.scene.start('Unlocks'),{size:20});
    const m=button(this,W/2+160,538,300,48,'Sound: on',()=>{ m.label.setText('Sound: '+(SFX.toggle()?'off':'on')); });
    const L=Progress.level(), T=Progress.state.title;
    txt(this,W/2,585,'Level '+L.lv+'  •  Account '+Progress.accountLevel()+'  •  Battle Pass tier '+Progress.bpTier()+'/30'+(T?'  •  "'+Progress.titleName(T)+'"':''),20).setOrigin(0.5);
    txt(this,W/2,630,'Grokonians: '+Tokens.balance(),24,GOLD).setOrigin(0.5); txt(this,W/2,680,'A GX Hub game'+(Tokens.mode==='hub'?'  (connected to GX Hub)':''),18).setOrigin(0.5);
  } }

function heroUnlocked(h){ return Progress.heroUnlocked(h); }
function lockLabel(h){ const u=h.unlock; return u.type==='grokonians'?u.cost+' Grokonians':(u.label||u.type); }

class HeroSelect extends Phaser.Scene{ constructor(){super('HeroSelect');}
  init(d){ this.browse=!!(d&&d.browse); this.level=(d&&d.level)||{world:'elah',index:0,diff:'normal',mode:'level'}; }
  create(){ backdrop(this,0.7);
    txt(this,W/2,36,this.browse?'Heroes':'Choose your Hero',38,GOLD).setOrigin(0.5);
    txt(this,W/2,76,'Grokonians: '+Tokens.balance()+'   •   Mastery gives +2% damage and HP per level, and faster skills at level 5',17,GOLD).setOrigin(0.5);
    DATA.heroes.forEach((h,i)=>{ const col=i%6,row=Math.floor(i/6),x=113+col*211,y=230+row*286, ok=heroUnlocked(h), M=Progress.mastery(h.id);
      const g=this.add.graphics(); g.fillStyle(h.theme==='liberty'?0x1a1e26:0x2a1a10,0.93); g.fillRoundedRect(x-100,y-134,200,272,10); g.lineStyle(3,ok?0xd9a441:0x5a4a3a); g.strokeRoundedRect(x-100,y-134,200,272,10);
      const im=spr(this,x,y-72,h.id,104); if(ok) this.tweens.add({targets:im,scaleY:im.scaleY*1.04,y:im.y-3,yoyo:true,repeat:-1,duration:900+i*37,ease:'Sine.inOut'}); else im.setTint(0x222222);
      txt(this,x,y-6,h.name,16,ok?PARCH:'#8a7a6a',{align:'center',wordWrap:{width:190}}).setOrigin(0.5);
      txt(this,x,y+20,h.role+' • HP '+h.hp+(ok?' • M'+M.lv:''),14).setOrigin(0.5);
      txt(this,x,y+56,h.skills.map(k=>k.name).join(', ')+'\nUlt: '+h.ult.name,13,'#cdbd95',{align:'center',wordWrap:{width:186}}).setOrigin(0.5);
      if(ok) button(this,x,y+108,170,40,this.browse?'Mastery '+M.lv+(M.max?' (max)':''):'Lead',()=>{ if(!this.browse) this.lead(h.id); },{size:16,disabled:this.browse});
      else if(h.unlock.type==='grokonians') button(this,x,y+108,186,40,'Unlock '+h.unlock.cost+' G',()=>{ if(Tokens.spend('hero:'+h.id,h.unlock.cost)){Tokens.grant(h.id);Progress.checkAch();SFX.build();this.scene.restart({browse:this.browse,level:this.level});} },{disabled:Tokens.balance()<h.unlock.cost,size:15});
      else txt(this,x,y+108,'🔒 '+lockLabel(h),14,'#a08a6a',{align:'center',wordWrap:{width:186}}).setOrigin(0.5);
    });
    button(this,90,680,140,46,'Back',()=>this.browse?this.scene.start('Menu'):this.back());
    }
  lead(id){ const L=this.level; if(L.mode==='cdaily') this.scene.start('Battle',{spec:Object.assign(Conq.dailySpec(),{hero:id})}); else this.scene.start('Campaign',{world:L.world,setHero:id}); }
  back(){ const L=this.level; if(L.mode==='cdaily') this.scene.start('WorldMap'); else this.scene.start('Campaign',{world:L.world});
  } }

class Unlocks extends Phaser.Scene{ constructor(){super('Unlocks');}
  create(){ backdrop(this,0.7); const U=DATA.unlocks;
    txt(this,W/2,60,'Unlocks',44,GOLD).setOrigin(0.5);
    txt(this,W/2,110,'Grokonians: '+Tokens.balance()+'   (earned by playing only — no store, no real money)',20,GOLD).setOrigin(0.5);
    let y=150; txt(this,200,y,'Heroes (more in Battle Pass and Heroes)',24); y+=44;
    DATA.heroes.filter(h=>h.unlock.type==='grokonians').forEach(h=>{ const ok=heroUnlocked(h);
      txt(this,220,y,h.name+' ('+h.role+')',22); const lbl=ok?'Owned':(h.unlock.type==='grokonians'?h.unlock.cost+' Grokonians':h.unlock.label);
      button(this,820,y+12,260,42,lbl,()=>{ if(Tokens.spend('hero:'+h.id,h.unlock.cost)){Tokens.grant(h.id);SFX.build();this.scene.restart();} },{disabled:ok||h.unlock.type!=='grokonians'||Tokens.balance()<h.unlock.cost,size:18}); y+=46; });
    y+=6; txt(this,200,y,'Tower styles',24); y+=40; const skinsAll=U.skins;
    skinsAll.forEach((k,si)=>{ const own=Tokens.owns('skin:'+k.id), on=Tokens.skin===k.id; txt(this,220,y,k.name,22);
      button(this,820,y+12,260,34,on?'Equipped (tap to remove)':own?'Equip':k.bpOnly?'Battle Pass reward':k.cost+' Grokonians',()=>{ if(on){Tokens.skin=null;} else if(own){Tokens.skin=k.id;} else if(!k.bpOnly&&Tokens.spend('skin:'+k.id,k.cost)){Tokens.grant('skin:'+k.id);Tokens.skin=k.id;} this.scene.restart(); },{disabled:!own&&(k.bpOnly||Tokens.balance()<k.cost),size:15}); y+=38; });
    y+=6; const p=U.perk; txt(this,200,y,'Perk',24); y+=36; txt(this,220,y,p.name+'  rank '+Tokens.perk+'/'+p.max,20);
    button(this,820,y+12,260,42,Tokens.perk>=p.max?'Maxed':p.cost+' Grokonians',()=>{ if(Tokens.spend('perk:manna',p.cost)){Tokens.perk=Tokens.perk+1;this.scene.restart();} },{disabled:Tokens.perk>=p.max||Tokens.balance()<p.cost,size:18});
    button(this,90,670,140,46,'Back',()=>this.scene.start('Menu'));
  } }

// ---------- Worlds + level node map ----------
class WorldMap extends Phaser.Scene{ constructor(){super('WorldMap');}
  create(){ backdrop(this,0.72); const WD=Levels.data, acc=Progress.accountLevel();
    txt(this,W/2,40,'Choose a World',40,GOLD).setOrigin(0.5);
    txt(this,W/2,84,'Account level '+acc+'   •   Conquest stars '+Conq.totalStars(),19).setOrigin(0.5);
    WD.worlds.forEach((w,i)=>{ const x=225+(i%3)*415, y=235+Math.floor(i/3)*250, open=Levels.worldOpen(w);
      const im=this.add.image(x,y,'bg_'+w.id).setDisplaySize(380,214); if(!open) im.setTint(0x555555);
      const g=this.add.graphics(); g.lineStyle(3,open?0xd9a441:0x5a4a3a); g.strokeRoundedRect(x-190,y-107,380,214,8); g.fillStyle(0x140c07,0.8); g.fillRect(x-188,y+44,376,61);
      txt(this,x,y+60,w.name,22,open?PARCH:'#9a8a7a').setOrigin(0.5);
      txt(this,x,y+88,open?('Conquest ★ '+['normal','hard','nightmare'].reduce((a,d)=>a+Conq.stars(w.id,d),0)+'/9'+(Conq.camp(w.id)?'  •  campaign turn '+Conq.camp(w.id).turn:'')+'  •  Champion: '+w.boss.name):(!w.playable?'🔒 Coming soon (account '+w.reqAccount+')  •  '+w.boss.name:'🔒 Reach account level '+w.reqAccount),14,open?'#cdbd95':'#a08a6a').setOrigin(0.5);
      const z=this.add.zone(x,y,380,214).setInteractive({useHandCursor:open}); z.on('pointerup',()=>{ SFX.unlock(); if(open) this.scene.start('Campaign',{world:w.id}); else this.toast(w.playable?'Reach account level '+w.reqAccount+' to open '+w.name:w.name+' is coming in a later update'); }); });
    const ds=Conq.dailySpec(), db=Conq.dailyBest();
    button(this,W/2,680,420,50,'Daily Skirmish: '+Levels.world(ds.world).name+(db?'  (best '+db.score+')':''),()=>this.scene.start('HeroSelect',{level:{mode:'cdaily'}}),{size:17});
    button(this,90,680,140,46,'Back',()=>this.scene.start('Menu'));
    this.msg=txt(this,W/2,620,'',18,'#f2c14e').setOrigin(0.5); }
  toast(m){ this.msg.setText(m); } }

class LevelMap extends Phaser.Scene{ constructor(){super('LevelMap');}
  init(d){ this.wid=(d&&d.world)||'elah'; this.diff=(d&&d.diff)||'normal'; }
  create(){ const w=Levels.world(this.wid), WD=Levels.data; backdrop(this,0.45,'bg_'+w.id);
    txt(this,W/2,36,w.name,38,GOLD).setOrigin(0.5);
    // difficulty tabs
    Object.entries(WD.difficulties).forEach(([k,D],i)=>{ const open=Levels.diffOpen(w.id,k); button(this,W/2-230+i*230,92,210,42,(this.diff===k?'▶ ':'')+D.name+(open?'':' 🔒'),()=>{ if(open) this.scene.restart({world:w.id,diff:k}); },{size:17,disabled:!open}); });
    const n=w.levels, pts=[]; for(let i=0;i<n;i++) pts.push([110+i*(1060/(n-1)),360+Math.sin(i*0.95)*140]);
    const g=this.add.graphics(); g.lineStyle(8,0x140c07,0.8); g.strokePoints(pts.map(p=>({x:p[0],y:p[1]}))); g.lineStyle(4,0xd9a441,0.6); g.strokePoints(pts.map(p=>({x:p[0],y:p[1]})));
    const next=Levels.unlockedIndex(w.id,this.diff);
    pts.forEach(([x,y],i)=>{ const L=Levels.build({world:w.id,index:i,diff:this.diff}), st=Levels.stars(w.id,i,this.diff), open=i<=next, boss=L.bossLevel;
      const c=this.add.circle(x,y,boss?34:26,open?(st?0x5a3a1e:0x8a5a1e):0x2a2018,0.95).setStrokeStyle(3,open?0xd9a441:0x5a4a3a);
      txt(this,x,y,boss?'⚔':String(i+1),boss?26:20,open?PARCH:'#7a6a5a').setOrigin(0.5);
      txt(this,x,y+(boss?48:40),'★'.repeat(st)+'☆'.repeat(3-st),16,GOLD).setOrigin(0.5);
      if(L.mods.length) txt(this,x,y-(boss?50:42),L.mods.map(m=>WD.modifiers[m].name).join('\n'),12,'#cdbd95',{align:'center'}).setOrigin(0.5,1);
      if(open){ c.setInteractive({useHandCursor:true}); c.on('pointerup',()=>{ SFX.unlock(); this.scene.start('HeroSelect',{level:{world:w.id,index:i,diff:this.diff,mode:'level'}}); }); } });
    const eb=Levels.endlessBest(w.id);
    button(this,W/2+250,665,380,52,'Endless Survival'+(eb.wave?'  (best wave '+eb.wave+', '+eb.score+')':''),()=>this.scene.start('HeroSelect',{level:{world:w.id,index:0,diff:this.diff,mode:'endless',seed:w.id+':endless'}}),{size:17});
    txt(this,W/2-130,665,'Stars: 3 = no lives lost, 2 = keep half, 1 = clear.  Nodes with ⚔ have a boss.',15).setOrigin(0.5);
    button(this,90,665,140,46,'Back',()=>this.scene.start('WorldMap')); } }

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

// ---------- Core game ----------
class Game extends Phaser.Scene{ constructor(){super('Game');}
  init(d){ const b=DATA.heroes.find(h=>h.id===(d&&d.hero))||DATA.heroes[0]; this.perk=Progress.perks(b.id); const pk=this.perk; this.heroDef=Object.assign({},b,{hp:Math.round(b.hp*pk.hp),dmg:b.dmg*pk.dmg,skills:b.skills.map(k=>Object.assign({},k,{cd:Math.round(k.cd*pk.cd)})),ult:Object.assign({},b.ult,{cd:Math.round(b.ult.cd*pk.cd)})}); this.L=Levels.build((d&&d.level)||{world:'elah',index:0,diff:'normal',mode:'level'}); this.runXp=0; this.kills=0; this.pend={}; this.shieldT=0; this.banquet=false; }
  gx(n){ n=Math.round(n*this.L.xpMul); this.runXp+=n; this.pendXp=(this.pendXp||0)+n; }
  tr(k,n){ this.pend[k]=(this.pend[k]||0)+(n||1); }
  flush(){ const id=this.heroDef.id; Object.entries(this.pend).forEach(([k,n])=>Progress.track(k,n)); this.pend={}; if(this.pendXp){ Progress.addXP(this.pendXp,id); this.pendXp=0; } if(!this.over) Progress.takeEvents().forEach((m,i)=>this.time.delayedCall(i*1300,()=>this.toast(m,1600))); }
  create(){ const C=this.L; window.__scene=this;
    backdrop(this,0.15,C.bg);
    this.pts=C.path.map(p=>new Phaser.Math.Vector2(p[0],p[1])); this.segLen=[]; this.total=0;
    for(let i=0;i<this.pts.length-1;i++){const l=this.pts[i].distance(this.pts[i+1]); this.segLen.push(l); this.total+=l;}
    const g=this.add.graphics(); g.lineStyle(58,0x140c07,0.55); g.strokePoints(this.pts); g.lineStyle(46,0x6b5236,0.9); g.strokePoints(this.pts); g.lineStyle(30,0x8a6c46,0.5); g.strokePoints(this.pts);
    this.add.image(C.ark[0],C.ark[1]-10,'camp').setDepth(2);
    this.manna=Math.round(C.startManna*(1+0.02*Tokens.perk)); this.lives=C.lives; this.maxLives=C.lives; this.wave=0; this.waveActive=false; this.spawnQ=[]; this.leakedThisWave=0; this.leakedTotal=0; this.earned=0; this.over=false; this.speed=1;
    this.enemies=[]; this.towers=[]; this.shots=[]; this.selected=null; this.panel=null; this.boss=null; this.time.timeScale=1;
    this.skinTint=Tokens.skin?parseInt(DATA.unlocks.skins.find(k=>k.id===Tokens.skin).tint):null;
    this.fx=this.add.graphics().setDepth(20);
    this.buildHero(); this.buildHUD();
    this.input.on('pointerdown',p=>this.onTap(p));
    this.toast(C.name+(C.mods.length?'  •  '+C.mods.map(m=>Levels.data.modifiers[m].name).join(', '):'')+(C.verse?'\n'+C.verse:''),4000); if(C.mods.includes('fog')) this.add.rectangle(W/2,HUD_Y/2,W,HUD_Y,0xb8b0a0,0.16).setDepth(18);
    this.input.keyboard&&this.input.keyboard.on('keydown-SPACE',()=>this.startWave());
  }
  // --- path helpers
  posAt(d){ for(let i=0;i<this.segLen.length;i++){ if(d<=this.segLen[i]) return this.pts[i].clone().lerp(this.pts[i+1],d/this.segLen[i]); d-=this.segLen[i]; } return this.pts[this.pts.length-1].clone(); }
  distToPath(x,y){ let m=1e9; for(let i=0;i<this.pts.length-1;i++){ const A=this.pts[i],B=this.pts[i+1],vx=B.x-A.x,vy=B.y-A.y,L=vx*vx+vy*vy; let t=L?((x-A.x)*vx+(y-A.y)*vy)/L:0; t=Math.max(0,Math.min(1,t)); m=Math.min(m,Math.hypot(x-(A.x+vx*t),y-(A.y+vy*t))); } return m; }
  // --- HUD
  buildHUD(){ const s=this; const bar=this.add.graphics().setDepth(30); bar.fillStyle(0x1a110a,0.94); bar.fillRect(0,HUD_Y,W,H-HUD_Y); bar.lineStyle(3,0xd9a441); bar.lineBetween(0,HUD_Y,W,HUD_Y);
    this.stat=txt(this,12,8,'',22,PARCH).setDepth(31);
    this.towerBtns={}; let x=76;
    Object.entries(DATA.towers).forEach(([id,t])=>{ const b=button(this,x,HUD_Y+55,142,96,'',()=>{ this.closePanel(); this.selected=this.selected===id?null:id; this.refreshHUD(); },{size:16}); b.setDepth(31);
      const ic=spr(this,-40,0,'t_'+id+'0',60); b.add(ic); b.label.setText(t.name.replace('Trumpets of ','Trumpets\n').replace("Shepherd's Sling","Shepherd's\nSling").replace('Altar of Fire','Altar\nof Fire').replace('Pillar of Cloud','Pillar of\nCloud')+'\n'+t.tiers[0].cost).setX(24).setFontSize(16).setAlign('center');
      this.towerBtns[id]=b; x+=150; });
    const h=this.heroDef; this.skillBtns=[];
    [...h.skills,h.ult].forEach((k,i)=>{ const b=button(this,688+i*140,HUD_Y+55,132,96,k.name,()=>this.useSkill(i),{size:17}); b.setDepth(31); b.cd=0; b.def=k; this.skillBtns.push(b); });
    this.waveBtn=button(this,1104,HUD_Y+55,104,96,'Wave ▶',()=>this.startWave(),{size:20}).setDepth(31);
    this.spdBtn=button(this,1221,HUD_Y+55,110,96,'x1',()=>{ this.speed=this.speed===1?2:1; this.spdBtn.label.setText('x'+this.speed); },{size:20}).setDepth(31);
    this.ghost=this.add.circle(0,0,10,0xffffff,0.12).setStrokeStyle(2,0xd9a441).setVisible(false).setDepth(19);
    this.input.on('pointermove',p=>{ if(this.selected&&p.y<HUD_Y){ const t=DATA.towers[this.selected].tiers[0]; this.ghost.setPosition(p.x,p.y).setRadius(t.range).setVisible(true).setStrokeStyle(2,this.canBuild(p.x,p.y)?0xd9a441:0xc0392b);} else this.ghost.setVisible(false); });
    this.refreshHUD(); }
  refreshHUD(){ this.stat.setText('Manna '+this.manna+'   Lives '+this.lives+'   Wave '+this.wave+'/'+this.waveTotal()+'   Grokonians +'+this.earned+'   '+this.heroDef.name);
    Object.entries(this.towerBtns).forEach(([id,b])=>{ b.redraw(this.selected===id); b.alpha=this.manna>=DATA.towers[id].tiers[0].cost?1:0.5; });
    this.waveBtn.alpha=(this.waveActive||this.over)?0.4:1; }
  toast(m,ms){ if(this._toast) this._toast.destroy(); const t=txt(this,W/2,HUD_Y-70,m,22,GOLD,{backgroundColor:'#140c07cc',padding:{x:10,y:4},wordWrap:{width:900},align:'center'}).setOrigin(0.5).setDepth(40); this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||1800,duration:600,onComplete:()=>t.destroy()}); }
  canBuild(x,y){ return y<HUD_Y-30&&y>40&&this.distToPath(x,y)>42&&this.towers.every(t=>Phaser.Math.Distance.Between(x,y,t.x,t.y)>52)&&x>30&&x<W-30; }
  onTap(p){ if(this.over||p.y>=HUD_Y) return;
    const hit=this.towers.find(t=>Phaser.Math.Distance.Between(p.x,p.y,t.x,t.y)<28);
    if(this.panel&&this.panelHit) { this.panelHit=false; return; }
    if(hit){ this.selected=null; this.openPanel(hit); this.refreshHUD(); return; }
    this.closePanel();
    if(this.selected){ const d=DATA.towers[this.selected], c=d.tiers[0].cost;
      if(this.manna>=c&&this.canBuild(p.x,p.y)){ this.manna-=c; this.placeTower(this.selected,p.x,p.y); this.tr('towersBuilt'); SFX.build(); } else this.toast(this.manna<c?'Not enough Manna':'Cannot build there');
      this.selected=null; this.ghost.setVisible(false); this.refreshHUD(); return; }
    this.hero.tx=p.x; this.hero.ty=p.y; }
  placeTower(id,x,y){ const t={id,x,y,tier:0,branch:null,cd:0,stun:0,spent:DATA.towers[id].tiers[0].cost,buffRate:0,buffDmg:0};
    t.spr=spr(this,x,y+20,'t_'+id+'0',SZ.tower).setOrigin(0.5,0.85).setDepth(5+y/1000); if(this.skinTint) t.spr.setTint(this.skinTint);
    t.pips=this.add.text(x,y+26,'I',Object.assign({},FONT,{fontSize:'14px',color:GOLD,stroke:'#000',strokeThickness:3})).setOrigin(0.5).setDepth(6);
    this.towers.push(t); return t; }
  stats(t){ const d=DATA.towers[t.id]; return t.tier>=3?d.branches[t.branch]:d.tiers[t.tier]; }
  closePanel(){ if(this.panel){this.panel.destroy();this.panel=null;} if(this.rangeC){this.rangeC.destroy();this.rangeC=null;} }
  openPanel(t){ this.closePanel(); const d=DATA.towers[t.id], st=this.stats(t);
    this.rangeC=this.add.circle(t.x,t.y,st.range,0xffffff,0.08).setStrokeStyle(2,0xd9a441).setDepth(4);
    const c=this.add.container(0,HUD_Y).setDepth(35); const g=this.add.graphics(); g.fillStyle(0x1a110a,1); g.fillRect(0,0,612,H-HUD_Y); g.lineStyle(3,0xd9a441); g.strokeRect(2,2,608,H-HUD_Y-4); c.add(g);
    c.add(txt(this,12,8,d.name+(st.name?' — '+st.name:' — Tier '+(t.tier+1)),19,GOLD));
    c.add(txt(this,12,34,d.dmgType+'  dmg '+st.dmg+'  range '+st.range+(st.special?'  •  '+st.special:''),14,PARCH,{wordWrap:{width:440}}));
    const mk=(x,w,label,cost,fn)=>{ const b=button(this,x,80,w,48,label,()=>{ this.panelHit=true; if(this.manna>=cost){ this.manna-=cost; t.spent+=cost; fn(); SFX.build(); this.refreshPips(t); this.refreshHUD(); this.openPanel(t);} else this.toast('Not enough Manna'); },{size:14,disabled:this.manna<cost}); c.add(b); return b; };
    if(t.tier<2) mk(110,200,'Upgrade  '+d.tiers[t.tier+1].cost,d.tiers[t.tier+1].cost,()=>t.tier++);
    else if(t.tier===2) d.branches.forEach((b,i)=>mk(105+i*205,198,b.name+'  '+b.cost,b.cost,()=>{t.tier=3;t.branch=i;this.tr('branches');}));
    const sell=button(this,t.tier===2?505:330,t.tier===2?28:80,t.tier===2?190:200,t.tier===2?40:48,'Sell '+Math.floor(t.spent*0.6),()=>{ this.panelHit=true; this.manna+=Math.floor(t.spent*0.6); t.spr.destroy(); t.pips.destroy(); this.towers.splice(this.towers.indexOf(t),1); this.closePanel(); this.refreshHUD(); },{size:14}); c.add(sell);
    const cl=button(this,t.tier===2?560:530,80,t.tier===2?80:120,48,'Close',()=>{ this.panelHit=true; this.closePanel(); },{size:14}); c.add(cl);
    this.panel=c; }
  hurtHero(n){ const h=this.hero; if(h.down>0) return; h.hp-=n; h.spr.setTint(0xff6a5a); this.time.delayedCall(80,()=>h.spr.clearTint());
    if(h.hp<=0){ h.down=10; h.hp=0; h.spr.setAlpha(0.35); this.toast(h.def.name+' is down! Back in 10s'); } }
  refreshPips(t){ t.pips.setText(t.tier>=3?this.stats(t).name:['I','II','III'][t.tier]); const k=Math.min(t.tier,2); t.spr.setTexture('spr','t_'+t.id+k); const h=SZ.tower+k*8+(t.tier>=3?8:0); t.spr.setScale(h/t.spr.height); t.spr.baseScale=t.spr.scaleX; if(t.tier>=3&&!this.skinTint) t.spr.setTint(t.branch?0xbfd0ff:0xffd08a); }
  // --- hero
  buildHero(){ const h=this.heroDef; this.hero={def:h,x:150,y:300,tx:150,ty:300,cd:0}; this.hero.spr=spr(this,150,300,h.id).setDepth(8); this.hero.hp=h.hp; this.hero.down=0; this.hero.hpBar=this.add.graphics().setDepth(12);
    this.hero.ring=this.add.circle(150,300,h.range,0xffffff,0.04).setStrokeStyle(1,0xd9a441,0.4).setDepth(3); }
  useSkill(i){ const b=this.skillBtns[i]; if(this.over||b.cd>0) return; const k=b.def, h=this.hero, E=this.enemies.filter(e=>!e.dead);
    const near=(r)=>E.filter(e=>Phaser.Math.Distance.Between(e.x,e.y,h.x,h.y)<r);
    const strongest=(n,list)=>(list||E).slice().sort((a,b)=>b.hp-a.hp).slice(0,n);
    const ring=(r,col)=>{ const c=this.add.circle(h.x,h.y,10,col,0.3).setDepth(15); this.tweens.add({targets:c,radius:r,alpha:0,duration:500,onComplete:()=>c.destroy()}); };
    switch(k.id){
      case 'stone': { const t=strongest(1,near(h.def.range*2))[0]; if(!t) return this.toast('No target'); this.shoot(h.x,h.y,t,'stone',{dmg:120,type:'physical',stun:1.5,crit:0.2},700); break; }
      case 'psalm': this.towers.forEach(t=>{ if(Phaser.Math.Distance.Between(t.x,t.y,h.x,h.y)<240) t.buffRate=6; }); ring(240,0xd9a441); break;
      case 'five': { const ts=strongest(5); if(!ts.length) return this.toast('No target'); ts.forEach((t,j)=>this.time.delayedCall(j*120,()=>this.shoot(h.x,h.y,t,'stone',{dmg:250*(t.def.giant?3:1),type:'physical',stun:0.5},800))); SFX.ult(); this.cameras.main.flash(200,217,164,65); break; }
      case 'rally': this.towers.forEach(t=>t.buffDmg=8); ring(400,0xd9a441); break;
      case 'palm': near(170).forEach(e=>e.stun=Math.max(e.stun,2)); ring(170,0x8a6a9a); break;
      case 'song': E.forEach(e=>{ e.slow=Math.max(e.slow,0.5); e.slowT=6; this.damage(e,60,'holy'); }); this.cameras.main.flash(250,200,180,230); break;
      case 'lamp': near(180).forEach(e=>{ if(!e.def.boss) e.confuse=3; }); ring(180,0xf2c14e); break;
      case 'three': for(let j=0;j<12;j++) this.time.delayedCall(j*70,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,40,'holy'); this.spark(t.x,t.y,0xf2c14e);} }); break;
      case 'sword': E.forEach(e=>this.damage(e,150,'holy')); this.cameras.main.flash(250,242,193,78); break;
      case 'jaw': near(90).forEach(e=>this.damage(e,90,'physical')); ring(90,0xe8e0c8); break;
      case 'roar': near(150).forEach(e=>{ e.stun=Math.max(e.stun,1.5); e.ab=5; }); ring(150,0xd8572a); this.cameras.main.shake(150,0.004); break;
      case 'geyser': near(150).forEach(e=>this.damage(e,80,'holy',{slow:0.4})); ring(150,0x6a9ad8); break;
      case 'manna': this.manna+=40; this.floatText(h.x,h.y-30,'+40 Manna',GOLD); this.refreshHUD(); break;
      case 'sea': E.forEach(e=>{ if(!e.def.boss){ e.d=Math.max(0,e.d-300); e.stun=Math.max(e.stun,1); } else this.damage(e,200,'holy'); }); this.cameras.main.flash(300,120,170,220); break;
      case 'altarflame': near(160).forEach(e=>this.damage(e,30,'fire',{burn:[22,4]})); ring(160,0xd8572a); break;
      case 'ravens': h.hp=Math.min(h.def.hp,h.hp+h.def.hp*0.5); this.floatText(h.x,h.y-30,'+HP','#8fd06a'); break;
      case 'chariot': E.forEach(e=>this.damage(e,120,'fire',{burn:[20,4]})); this.cameras.main.flash(300,242,140,60); break;
      case 'banquet': this.banquet=true; this.toast('Royal Banquet: +50% Manna for the next wave clear'); break;
      case 'plea': E.forEach(e=>{ e.slow=Math.max(e.slow,0.4); e.slowT=6; }); ring(400,0x8a6a9a); break;
      case 'time': this.towers.forEach(t=>{ t.cd=0; t.stun=0; t.buffRate=10; t.buffDmg=10; }); this.cameras.main.flash(250,230,200,240); break;
      case 'pair': for(let j=0;j<6;j++) this.time.delayedCall(j*120,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,45,'physical'); this.spark(t.x,t.y,0xcdbd95,3);} }); break;
      case 'rain': near(220).forEach(e=>{ e.slow=Math.max(e.slow,0.5); e.slowT=5; }); ring(220,0xdfe6ee); break;
      case 'ark': this.lives+=5; E.forEach(e=>this.damage(e,100,'holy')); this.toast('The Ark: +5 lives'); this.refreshHUD(); break;
      case 'kite': { let src=h, hit=[]; for(let j=0;j<4;j++){ const c=E.filter(e=>!hit.includes(e)&&Phaser.Math.Distance.Between(e.x,e.y,src.x,src.y)<220).sort((a,b)=>Phaser.Math.Distance.Between(a.x,a.y,src.x,src.y)-Phaser.Math.Distance.Between(b.x,b.y,src.x,src.y))[0]; if(!c) break; this.fx.lineStyle(3,0xf2e07a,1).lineBetween(src.x,src.y,c.x,c.y); this.damage(c,90,'sonic',{stun:0.5}); hit.push(c); src=c; } this.time.delayedCall(150,()=>this.fx.clear()); if(!hit.length) return this.toast('No target'); break; }
      case 'bifocal': this.towers.forEach(t=>{ if(Phaser.Math.Distance.Between(t.x,t.y,h.x,h.y)<260) t.buffDmg=8; }); ring(260,0xf2e07a); break;
      case 'almanac': for(let j=0;j<10;j++) this.time.delayedCall(j*110,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length){ const t=Phaser.Utils.Array.GetRandom(L); this.damage(t,120,'sonic',{stun:0.4}); this.spark(t.x,t.y,0xf2e07a,5);} }); this.cameras.main.flash(200,240,230,150); break;
      case 'crossing': { const t=strongest(1)[0]; if(!t) return this.toast('No target'); h.x=h.tx=t.x; h.y=h.ty=t.y; near(110).forEach(e=>this.damage(e,100,'physical')); ring(110,0x3a5a9a); break; }
      case 'cherry': { const t=strongest(1,near(160))[0]; if(!t) return this.toast('No target'); this.damage(t,220,'physical',{stun:1}); break; }
      case 'forge': h.hp=h.def.hp; this.towers.forEach(t=>{ t.buffRate=10; t.stun=0; }); this.cameras.main.flash(250,200,210,240); break;
      case 'log': near(140).forEach(e=>e.stun=Math.max(e.stun,2.5)); ring(140,0x8a5a2a); break;
      case 'speech': this.towers.forEach(t=>t.buffDmg=10); ring(400,0xd9a441); break;
      case 'union': this.shieldT=10; this.toast('Union Shield: no lives lost for 10s'); break;
      case 'trick': strongest(3,near(260)).forEach(t=>this.shoot(h.x,h.y,t,'stone',{dmg:100,type:'physical',crit:0.5},900)); break;
      case 'sharp': { const t=strongest(1,near(320))[0]; if(!t) return this.toast('No target'); this.shoot(h.x,h.y,t,'stone',{dmg:180,type:'physical',crit:0.5,giantCrit:3},1100); break; }
      case 'show': for(let j=0;j<15;j++) this.time.delayedCall(j*80,()=>{ const L=this.enemies.filter(e=>!e.dead); if(L.length) this.shoot(h.x,h.y,Phaser.Utils.Array.GetRandom(L),'stone',{dmg:60,type:'physical',crit:0.3},1000); }); break;
      case 'pillars': E.forEach(e=>{ this.damage(e,300,'physical'); e.stun=Math.max(e.stun,2); }); this.cameras.main.shake(400,0.012); SFX.stomp(); break;
    }
    if(k.id!=='five') SFX.skill(); if(i===2){ this.tr('ults'); if(k.id!=='five') SFX.ult(); } b.cd=k.cd; }
  // --- waves
  waveTotal(){ return this.L.nWaves===Infinity?'∞':this.L.nWaves; }
  waveDef(i){ if(!this.L.waves[i]) this.L.waves[i]=Levels.wave(this.L,i); return this.L.waves[i]; }
  startWave(){ if(this.waveActive||this.over||this.wave>=this.L.nWaves) return;
    const w=this.waveDef(this.wave); this.wave++; this.waveActive=true; this.leakedThisWave=0; let t=0.5;
    w.forEach(([type,n,gap])=>{ for(let i=0;i<n;i++) this.spawnQ.push({type,at:t+i*gap}); t+=n*gap*0.5; });
    this.spawnQ.sort((a,b)=>a.at-b.at); this.waveClock=0; SFX.wave(); const hasB=w.some(g=>DATA.enemies[g[0]].boss); this.toast('Wave '+this.wave+(hasB?': '+this.L.boss.name.toUpperCase():'')); this.refreshHUD(); }
  spawn(type,dist,hpMul){ const d=DATA.enemies[type]; const scale=1+0.08*(this.wave-1);
    const e={type,def:d,hp:d.hp*(d.boss?1:scale)*(hpMul||1)*this.L.hpMul,d:dist||0,stun:0,slow:0,slowT:0,burn:0,burnT:0,ab:0,confuse:0,healCd:2,x:0,y:0};
    e.max=e.hp; e.spr=spr(this,0,0,d.sprite||type,d.h).setDepth(d.boss?9:7); if(d.tint){ e.tint=parseInt(d.tint); e.spr.setTint(e.tint); } e.ph=Math.random()*6; if(d.boss) this.setupBoss(e);
    e.bar=this.add.graphics().setDepth(12); this.enemies.push(e); return e; }
  setupBoss(e){ this.boss=e; e.phase=0; e.spearCd=6; e.stompCd=6; e.stagCd=0;
    this.bossBar=this.add.graphics().setDepth(32); this.bossName=txt(this,W/2,HUD_Y-30,this.L.boss.name+' — '+this.L.boss.phases[0].name,20,GOLD).setOrigin(0.5).setDepth(32);
    this.cameras.main.shake(500,0.01); SFX.stomp(); }
  bossTick(e,dt){ const f=e.hp/e.max, P=this.L.boss.phases;
    if(e.phase===0&&f<=P[1].at){ e.phase=1; if(this.L.world.id==='elah'){ this.bearer=this.spawn('spearman',e.d+60,4); this.bearer.spr.setTexture('spr','bearer'); this.bearer.spr.setScale(SZ.bearer/this.bearer.spr.height); this.bearer.spr.baseScale=this.bearer.spr.scaleX; } else this.bearer=this.spawn('wallguard',e.d+60,4); this.bearer.isBearer=true; this.toast(P[1].name+': '+P[1].desc,3000); }
    if(e.phase===1&&f<=P[2].at){ e.phase=2; this.toast(P[2].name+': '+P[2].desc,3000); this.cameras.main.shake(400,0.01); SFX.stomp(); }
    this.bossName.setText(this.L.boss.name+' — '+P[e.phase].name);
    e.spearCd-=dt; if(e.spearCd<=0&&this.towers.length){ e.spearCd=8; const t=Phaser.Utils.Array.GetRandom(this.towers); const sp=this.add.image(e.x,e.y,'spear').setDepth(14).setRotation(Phaser.Math.Angle.Between(e.x,e.y,t.x,t.y));
      this.tweens.add({targets:sp,x:t.x,y:t.y,duration:600,onComplete:()=>{ sp.destroy(); t.stun=4; this.spark(t.x,t.y,0xc0392b); SFX.hit(); }}); }
    if(e.phase===2){ e.stompCd-=dt; if(e.stompCd<=0){ e.stompCd=6; SFX.stomp(); this.cameras.main.shake(250,0.008); this.towers.forEach(t=>{ if(Phaser.Math.Distance.Between(t.x,t.y,e.x,e.y)<220) t.stun=Math.max(t.stun,2); }); if(Phaser.Math.Distance.Between(this.hero.x,this.hero.y,e.x,e.y)<220) this.hurtHero(60); const c=this.add.circle(e.x,e.y,20,0x6b5236,0.4).setDepth(4); this.tweens.add({targets:c,radius:220,alpha:0,duration:500,onComplete:()=>c.destroy()}); } }
    e.stagCd-=dt;
    const bb=this.bossBar; bb.clear(); bb.fillStyle(0x000000,0.7); bb.fillRect(W/2-250,HUD_Y-16,500,12); bb.fillStyle(0xa33b20,1); bb.fillRect(W/2-250,HUD_Y-16,500*f,12); bb.lineStyle(2,0xd9a441); bb.strokeRect(W/2-250,HUD_Y-16,500,12); }
  // --- combat
  damage(e,amt,type,opt){ if(e.dead) return; opt=opt||{};
    let m=(DATA.armorTable[e.def.armor]||{})[type]||1; if(e.ab>0) m*=1.25; if(opt.refiner&&e.slowT>0) m*=1.5;
    if(e.def.boss&&this.bearer&&!this.bearer.dead) m*=0.5;
    if(opt.crit&&Math.random()<opt.crit){ m*=e.def.giant?(opt.giantCrit||2.5):2; this.floatText(e.x,e.y-20,'CRIT','#f2c14e'); if(e.def.boss&&e.phase===2&&e.stagCd<=0){ e.stun=1.2; e.stagCd=5; this.floatText(e.x,e.y-40,'STAGGER!','#ffffff'); } }
    e.hp-=amt*m; if(opt.stun) e.stun=Math.max(e.stun,opt.stun*((opt.wallStun&&e.def.armor==='bronze')?2:1)*(e.def.boss?0.3:1));
    if(opt.burn){ e.burn=Math.max(e.burn,opt.burn[0]); e.burnT=Math.max(e.burnT,opt.burn[1]); }
    if(opt.slow){ e.slow=Math.max(e.slow,opt.slow); e.slowT=Math.max(e.slowT,1.2); }
    if(opt.ab) e.ab=Math.max(e.ab,opt.ab);
    e.spr.setTintFill(0xffffff); this.time.delayedCall(60,()=>{ if(!e.dead){ e.spr.clearTint(); if(e.tint) e.spr.setTint(e.tint); } });
    if(e.hp<=0) this.kill(e); }
  kill(e){ e.dead=true; this.kills++; this.manna+=e.def.manna; this.tr('kills'); if(e.def.flying) this.tr('flyKills'); this.gx(DATA_P().xp.kill); SFX.die(); this.spark(e.x,e.y,0xcdbd95,8);
    this.tweens.add({targets:e.spr,alpha:0,scale:0.3,duration:250,onComplete:()=>e.spr.destroy()}); e.bar.destroy();
    if(e.def.split) for(let i=0;i<2;i++) this.spawn(e.def.split,Math.max(0,e.d-10-i*14));
    if(e.def.boss){ this.bossBar.destroy(); this.bossName.destroy(); this.earn('boss',DATA.grokonians.boss); this.tr('bossKills'); this.gx(DATA_P().xp.boss); this.toast(this.L.boss.fallen||(this.L.boss.name+' has fallen!'),2500); this.cameras.main.flash(400,242,220,170); }
    this.refreshHUD(); }
  shoot(x,y,target,key,opt,speed){ const s=this.add.image(x,y,key).setDepth(13); this.shots.push({s,target,opt,speed:speed||500,lx:target.x,ly:target.y}); }
  spark(x,y,col,n){ for(let i=0;i<(n||4);i++){ const p=this.add.image(x,y,'spark').setTint(col).setDepth(16).setScale(0.8); this.tweens.add({targets:p,x:x+Phaser.Math.Between(-24,24),y:y+Phaser.Math.Between(-24,24),alpha:0,scale:0.2,duration:350,onComplete:()=>p.destroy()}); } }
  floatText(x,y,s,c){ const t=txt(this,x,y,s,14,c).setOrigin(0.5).setDepth(25); this.tweens.add({targets:t,y:y-26,alpha:0,duration:700,onComplete:()=>t.destroy()}); }
  inRange(t,r){ return this.enemies.filter(e=>!e.dead&&Phaser.Math.Distance.Between(e.x,e.y,t.x,t.y)<=r); }
  towerTick(t,dt){ if(t.buffRate>0) t.buffRate-=dt; if(t.buffDmg>0) t.buffDmg-=dt;
    if(t.stun>0){ t.stun-=dt; t.spr.setTint(0x555555); t.wasStun=true; return; } else if(t.wasStun){ t.wasStun=false; t.spr.clearTint(); if(this.skinTint) t.spr.setTint(this.skinTint); else if(t.tier>=3) t.spr.setTint(t.branch?0xbfd0ff:0xffd08a); }
    t.cd-=dt*(t.buffRate>0?1.4:1); if(t.cd>0) return; const st=this.stats(t); const list=this.inRange(t,st.range*this.L.rangeMul); if(!list.length) return;
    const dm=st.dmg*(t.buffDmg>0?1.3:1); const first=list.sort((a,b)=>b.d-a.d); t.cd=st.rate; const type=DATA.towers[t.id].dmgType; const bs=t.spr.baseScale; this.tweens.add({targets:t.spr,scaleX:bs*1.08,scaleY:bs*0.9,duration:70,yoyo:true,onComplete:()=>t.spr.setScale(bs)});
    if(t.id==='sling'){ first.slice(0,st.multishot||1).forEach(e=>this.shoot(t.x,t.y-24,e,'stone',{dmg:dm,type,crit:st.crit,giantCrit:t.tier>=2?4:2.5},650)); SFX.sling(); }
    else if(t.id==='altar'){ this.shoot(t.x,t.y-20,first[0],'ember',{dmg:dm,type,splash:st.splash,burn:st.burn,refiner:t.tier>=2},380); SFX.fire(); }
    else if(t.id==='trumpet'){ list.forEach(e=>this.damage(e,dm,type,{stun:st.stun,ab:st.armorBreak,wallStun:t.tier>=2})); const c=this.add.circle(t.x,t.y,10,0xe0c25a,0).setStrokeStyle(4,0xe0c25a,0.8).setDepth(14); this.tweens.add({targets:c,radius:st.range,alpha:0,duration:400,onComplete:()=>c.destroy()}); SFX.trumpet(); }
    else if(t.id==='cloud'){ list.forEach(e=>this.damage(e,dm,type,{slow:st.slow,burn:st.burn})); const c=this.add.circle(t.x,t.y,st.range,0xdfe6ee,0.12).setDepth(3); this.tweens.add({targets:c,alpha:0,duration:450,onComplete:()=>c.destroy()}); SFX.cloud(); } }
  earn(reason,n){ this.earned+=n; Tokens.earn(reason,n); }
  update(time,delta){ if(this.over) return; const dt=Math.min(0.05,delta/1000)*this.speed; if(this.shieldT>0) this.shieldT-=dt;
    // spawns
    if(this.waveActive){ this.waveClock+=dt; while(this.spawnQ.length&&this.spawnQ[0].at<=this.waveClock) this.spawn(this.spawnQ.shift().type); }
    // enemies
    for(const e of this.enemies){ if(e.dead) continue;
      if(e.burnT>0){ e.burnT-=dt; e.hp-=e.burn*dt*((DATA.armorTable[e.def.armor]||{}).fire||1); if(Math.random()<0.15) this.spark(e.x,e.y,0xd8572a,1); if(e.hp<=0){ this.kill(e); continue; } }
      if(e.slowT>0) e.slowT-=dt; else e.slow=0; if(e.ab>0) e.ab-=dt;
      if(e.def.heals){ e.healCd-=dt; if(e.healCd<=0){ e.healCd=2; this.enemies.forEach(o=>{ if(!o.dead&&o!==e&&Phaser.Math.Distance.Between(o.x,o.y,e.x,e.y)<100){ o.hp=Math.min(o.max,o.hp+15); this.spark(o.x,o.y,0x8a7a2a,1);} }); } }
      if(e.def.boss) this.bossTick(e,dt);
      let sp=e.def.speed*this.L.speedMul*(1-e.slow)*(e.def.boss&&e.phase===2?1.6:1);
      const hh=this.hero, near=hh.down<=0&&Phaser.Math.Distance.Between(hh.x,hh.y,e.x,e.y)<(e.def.boss?60:34);
      if(near&&e.stun<=0){ this.hurtHero((e.def.boss?40:(e.def.size>20?12:5))*dt); if(!e.def.flying&&!e.def.boss) sp=0; }
      if(e.stun>0){ e.stun-=dt; sp=0; } if(e.confuse>0){ e.confuse-=dt; sp=-sp*0.6; }
      if(e.isBearer&&this.boss&&!this.boss.dead) e.d=Math.max(e.d,this.boss.d+50);
      e.d=Math.max(0,e.d+sp*dt); const p=this.posAt(e.d); const bob=e.def.flying?Math.sin(time/90+e.max)*4:Math.sin(time/160+e.d/10)*1.5;
      if(Math.abs(p.x-e.x)>0.01) e.spr.setFlipX(p.x<e.x); e.x=p.x; e.y=p.y; const ph=time/(e.def.flying?60:140)+e.ph, moving=sp!==0, k=e.spr.baseScale;
      if(e.def.flying) e.spr.setScale(k*(1+0.12*Math.sin(ph)),k*(1-0.05*Math.sin(ph)));
      else e.spr.setScale(k*(1-(moving?0.05:0.02)*Math.sin(ph)),k*(1+(moving?0.07:0.03)*Math.sin(ph))).setRotation(moving?0.06*Math.sin(ph*0.5):0);
      e.spr.setOrigin(0.5,0.9).setPosition(p.x,p.y+bob+e.def.size*0.5).setDepth((e.def.boss?9:7)+p.y/1000);
      e.spr.setAlpha(e.stun>0?0.7:1);
      if(!e.def.boss){ e.bar.clear(); if(e.hp<e.max){ e.bar.fillStyle(0x000000,0.7); e.bar.fillRect(e.x-14,e.y-e.def.size*1.6,28,4); e.bar.fillStyle(0xa33b20,1); e.bar.fillRect(e.x-14,e.y-e.def.size*1.6,28*Math.max(0,e.hp/e.max),4);} }
      if(e.d>=this.total){ e.dead=true; e.spr.destroy(); e.bar.destroy(); const loss=this.shieldT>0?0:(e.def.boss?10:1); this.lives-=loss; this.leakedThisWave+=loss; this.leakedTotal+=loss; SFX.leak(); this.cameras.main.shake(120,0.005);
        if(e.def.boss){ this.bossBar.destroy(); this.bossName.destroy(); } this.refreshHUD(); if(this.lives<=0) return this.end(false); } }
    this.enemies=this.enemies.filter(e=>!e.dead);
    // towers
    this.towers.forEach(t=>this.towerTick(t,dt));
    // shots
    for(const s of this.shots){ const tg=s.target; if(!tg.dead){ s.lx=tg.x; s.ly=tg.y; } const a=Phaser.Math.Angle.Between(s.s.x,s.s.y,s.lx,s.ly); const step=s.speed*dt;
      if(Phaser.Math.Distance.Between(s.s.x,s.s.y,s.lx,s.ly)<=step+4){ s.done=true; s.s.destroy(); SFX.hit();
        if(s.opt.splash){ this.enemies.forEach(e=>{ if(!e.dead&&Phaser.Math.Distance.Between(e.x,e.y,s.lx,s.ly)<s.opt.splash) this.damage(e,s.opt.dmg,s.opt.type,s.opt); }); const c=this.add.circle(s.lx,s.ly,s.opt.splash,0xd8572a,0.25).setDepth(4); this.tweens.add({targets:c,alpha:0,duration:350,onComplete:()=>c.destroy()}); }
        else if(!tg.dead) this.damage(tg,s.opt.dmg,s.opt.type,s.opt); }
      else { s.s.x+=Math.cos(a)*step; s.s.y+=Math.sin(a)*step; s.s.rotation+=0.3; } }
    this.shots=this.shots.filter(s=>!s.done);
    // hero
    const h=this.hero, hd=h.def; const dx=h.tx-h.x, dy=h.ty-h.y, dl=Math.hypot(dx,dy); if(dl>3){ const st=Math.min(dl,hd.speed*dt); h.x+=dx/dl*st; h.y+=dy/dl*st; h.spr.setFlipX(dx<0); }
    const walking=dl>3, hk=h.spr.baseScale, hp2=time/(walking?90:400);
    h.spr.setOrigin(0.5,0.9).setPosition(h.x,h.y+18).setScale(hk*(1-(walking?0.05:0.02)*Math.sin(hp2)),hk*(1+(walking?0.06:0.025)*Math.sin(hp2))).setRotation(walking?0.08*Math.sin(hp2*0.5):0).setDepth(8+h.y/1000); h.ring.setPosition(h.x,h.y);
    if(h.down>0){ h.down-=dt; if(h.down<=0){ h.hp=hd.hp; h.spr.setAlpha(1); h.x=h.tx=this.L.ark[0]-60; h.y=h.ty=this.L.ark[1]; this.toast(hd.name+' returns!'); } } else h.hp=Math.min(hd.hp,h.hp+hd.hp*0.01*dt);
    h.hpBar.clear(); h.hpBar.fillStyle(0x000000,0.7); h.hpBar.fillRect(h.x-22,h.y-48,44,5); h.hpBar.fillStyle(0x5aa33b,1); h.hpBar.fillRect(h.x-22,h.y-48,44*h.hp/hd.hp,5);
    h.cd-=dt; if(h.cd<=0&&h.down<=0){ const L=this.inRange(h,hd.range).sort((a,b)=>b.d-a.d); if(L.length){ h.cd=hd.rate; if(hd.range<80){ L.slice(0,3).forEach(e=>this.damage(e,hd.dmg,hd.dmgType)); this.spark(h.x+10,h.y,0xe8e0c8,3); } else this.shoot(h.x,h.y,L[0],hd.dmgType==='holy'?'ember':'stone',{dmg:hd.dmg,type:hd.dmgType,crit:0.1},600); } }
    this.skillBtns.forEach(b=>{ if(b.cd>0){ b.cd-=dt; b.label.setText(b.def.name+'\n'+Math.ceil(b.cd)+'s'); b.alpha=0.5; } else { b.label.setText(b.def.name); b.alpha=1; } });
    // wave end
    if(this.waveActive&&!this.spawnQ.length&&!this.enemies.length){ this.waveActive=false; let bonus=20+this.wave*5; if(this.banquet){ bonus=Math.round(bonus*1.5); this.banquet=false; } this.manna+=bonus; const XP=DATA_P().xp; this.tr('waves'); this.gx(XP.wave); if(this.leakedThisWave===0){ this.tr('perfectWaves'); this.gx(XP.perfectWave); }
      this.earn('wave',DATA.grokonians.perWave+(this.leakedThisWave===0?DATA.grokonians.perfectWaveBonus:0));
      this.toast('Wave '+this.wave+' cleared  +'+bonus+' Manna'+(this.leakedThisWave===0?'  (perfect)':'')); this.refreshHUD(); this.flush();
      if(this.wave>=this.L.nWaves) this.end(true); }
    this.stat.setText('Manna '+this.manna+'   Lives '+this.lives+'   Wave '+this.wave+'/'+this.waveTotal()+'   Grokonians +'+this.earned+'   '+hd.name);
  }
  end(win){ if(this.over) return; this.over=true; this.closePanel();
    const XP=DATA_P().xp; if(win){ this.tr('clears'); this.gx(XP.clear); this.earn('clear',DATA.grokonians.clear); if(this.leakedTotal===0){ this.earn('perfectClear',DATA.grokonians.perfectClear); this.tr('perfectClears'); this.gx(XP.perfectClear); } if(this.L.world.id==='elah'){ const first=!Tokens.milestone('clearCh1'); Tokens.setMilestone('clearCh1'); this.newUnlock=first; } SFX.win(); } else SFX.lose();
    const stars=win?Levels.starsFor(this.lives,this.maxLives):0, waves=win?this.wave:Math.max(0,this.wave-1); const rec=Levels.record(this.L,{win,stars,lives:win?this.lives:0,kills:this.kills,waves}); const lv0=this.lv0; this.flush(); const ev=Progress.takeEvents();
    this.time.delayedCall(800,()=>this.scene.start('End',{win,earned:this.earned,newUnlock:this.newUnlock,perfect:this.leakedTotal===0,xp:this.runXp,hero:this.heroDef.id,ev,stars,rec,waves,spec:this.L.spec,mode:this.L.mode,wname:this.L.world.name})); } }

class End extends Phaser.Scene{ constructor(){super('End');}
  create(d){ backdrop(this,0.7);
    const endl=d.mode==='endless'; txt(this,W/2,150,endl?'Survived '+d.waves+' waves':(d.win?d.wname+': Held':'The Camp has Fallen'),52,d.win||endl?GOLD:'#c0392b').setOrigin(0.5);
    if(d.win&&!endl) txt(this,W/2,212,'★'.repeat(d.stars)+'☆'.repeat(3-d.stars),40,GOLD).setOrigin(0.5);
    txt(this,W/2,305,'Score '+(d.rec?d.rec.score:0)+(d.rec&&d.rec.best?'  •  NEW BEST':''),22,'#f2c14e').setOrigin(0.5);
    txt(this,W/2,262,d.win?'"The battle is the LORD\'s." 1 Samuel 17:47':'"Be strong and of a good courage." Joshua 1:9',22).setOrigin(0.5);
    txt(this,W/2,340,'Grokonians earned this run: '+d.earned+(d.perfect&&d.win?'  (perfect clear!)':''),28,GOLD).setOrigin(0.5);
    txt(this,W/2,385,'Total Grokonians: '+Tokens.balance(),22).setOrigin(0.5);
    const L=Progress.level(), M=Progress.mastery(d.hero);
    txt(this,W/2,425,'+'+d.xp+' XP   •   Level '+L.lv+' ('+L.into+'/'+L.need+')   •   Mastery '+M.lv+'   •   Battle Pass tier '+Progress.bpTier(),20).setOrigin(0.5);
    const notes=(d.newUnlock?['New hero unlocked: Gideon!']:[]).concat(d.ev||[]).slice(0,4); notes.forEach((n,i)=>txt(this,W/2,460+i*26,n,19,'#f2c14e').setOrigin(0.5));
    const sp=d.spec||{world:'elah',index:0,diff:'normal',mode:'level'}, W0=Levels.world(sp.world);
    if(d.win&&sp.mode==='level'&&sp.index<W0.levels-1) button(this,W/2-280,600,250,58,'Next level',()=>this.scene.start('HeroSelect',{level:Object.assign({},sp,{index:sp.index+1})}),{size:22});
    else button(this,W/2-280,600,250,58,'Play again',()=>this.scene.start('HeroSelect',{level:sp}),{size:22});
    button(this,W/2,600,250,58,'Battle Pass',()=>this.scene.start('BattlePass'),{size:22});
    button(this,W/2+280,600,250,58,'World map',()=>this.scene.start('LevelMap',{world:sp.world,diff:sp.diff}),{size:22}); } }

window.__game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:W,height:H,backgroundColor:'#0d0906',
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:3},
  scene:[Boot,Menu,WorldMap,LevelMap,HeroSelect,Unlocks,BattlePass,Profile,Game,End,Campaign,Battle,BattleEnd,Survival]});
