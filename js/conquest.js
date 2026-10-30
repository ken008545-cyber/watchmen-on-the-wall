// Conquest scenes: Campaign (territory map), Battle (real-time army field), BattleEnd.
// Uses helpers from main.js: W,H,HUD_Y,txt,button,spr,backdrop,PARCH,GOLD,DATA.
const CQ=()=>Conq.data; const BMUL=0.2; // global battle pace (2-4 min fights)
const OWNER_COL={p:0xd9a441,n:0x8a8070};
function facCol(cp,o){ if(OWNER_COL[o]) return OWNER_COL[o]; const f=(CQ().factions[cp.world]||[]).find(x=>x.id===o); return f?parseInt(f.color):0x888888; }
function facName(cp,o){ if(o==='p') return 'You'; if(o==='n') return 'Free villages'; const f=(CQ().factions[cp.world]||[]).find(x=>x.id===o); return f?f.name:o; }
const UICON=t=>'u_'+t;

// ======================= CAMPAIGN =======================
class Campaign extends Phaser.Scene{ constructor(){super('Campaign');}
  init(d){ this.wid=(d&&d.world)||'elah'; if(d&&d.setHero) Conq.setHero(this.wid,d.setHero); this.sel=null; this.mode=null; }
  create(){ window.__scene=this; const w=Levels.world(this.wid); backdrop(this,0.38,'bg_'+w.id); const cp=this.cp=Conq.camp(this.wid);
    if(!cp) return this.newPanel(w);
    if(cp.done) return this.donePanel(w,cp);
    const g=this.add.graphics(); this.links=g;
    cp.edges.forEach(([a,b])=>{ const A=cp.terr[a],B=cp.terr[b]; g.lineStyle(9,0x140c07,0.7).lineBetween(A.x,A.y,B.x,B.y); g.lineStyle(4,0x8a6c46,0.9).lineBetween(A.x,A.y,B.x,B.y); });
    this.hl=this.add.graphics().setDepth(3); this.nodes=[];
    cp.terr.forEach(t=>{ const r=t.capital?32:26, col=facCol(cp,t.owner);
      const c=this.add.circle(t.x,t.y,r,0x1a110a,0.92).setStrokeStyle(5,col).setDepth(4).setInteractive({useHandCursor:true});
      const lbl=t.owner==='p'?(t.army.length+'⚑'):('⚔'+t.str); const tx=txt(this,t.x,t.y,lbl,t.owner==='p'?20:15,t.owner==='p'?GOLD:PARCH).setOrigin(0.5).setDepth(5);
      txt(this,t.x,t.y+r+12,t.name+(t.capital?' ♜':'')+(t.bar?'  B'+t.bar:''),14,'#efe2bf').setOrigin(0.5).setDepth(5);
      if(t.owner==='p'&&t.army.length) spr(this,t.x-r-6,t.y-6,UICON(t.army[0]),34).setDepth(5);
      c.on('pointerup',()=>{ SFX.unlock(); this.tapTerr(t); }); this.nodes.push({t,c,tx}); });
    const inc=Conq.income(cp), H0=DATA.heroes.find(h=>h.id===cp.hero)||DATA.heroes[0];
    this.add.rectangle(W/2,26,W,52,0x140c07,0.85).setDepth(8);
    txt(this,16,10,w.name+'  •  '+Levels.data.difficulties[cp.diff].name+'  •  Turn '+cp.turn,20,GOLD).setDepth(9);
    txt(this,470,10,'Gold '+cp.gold+' ('+(inc.gold>=0?'+':'')+inc.gold+')   Food '+cp.food+' ('+(inc.food>=0?'+':'')+inc.food+')   Lands '+cp.terr.filter(t=>t.owner==='p').length+'/'+cp.terr.length,20).setDepth(9);
    spr(this,1000,26,H0.id,44).setDepth(9); button(this,1080,26,110,40,'General',()=>this.scene.start('HeroSelect',{level:{mode:'conquest',world:this.wid}}),{size:16}).setDepth(9);
    button(this,1200,26,140,40,'Menu',()=>this.scene.start('WorldMap'),{size:16}).setDepth(9);
    this.panel=this.add.container(0,0).setDepth(20); this.drawPanel();
    if(cp.log&&cp.log.length) this.toast(cp.log.join('\n'),3800);
    if(cp.pendingDefense) this.defensePanel(cp); }
  toast(m,ms){ if(this._toast) this._toast.destroy(); const t=txt(this,W/2,84,m,19,GOLD,{backgroundColor:'#140c07dd',padding:{x:12,y:6},align:'center',wordWrap:{width:900}}).setOrigin(0.5,0).setDepth(40); this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||2200,duration:600,onComplete:()=>t.destroy()}); }
  newPanel(w){ const fac=CQ().factions[w.id]||CQ().factions.elah;
    txt(this,W/2,90,w.name+': Conquest',42,GOLD).setOrigin(0.5);
    txt(this,W/2,150,'Rivals: '+fac.map(f=>f.name).join(' and ')+'.   Champion: '+w.boss.name,20).setOrigin(0.5);
    txt(this,W/2,190,'Take every land on the map. Tap your land, then a neighbor, to march. Recruit, build barracks, drill your troops.\nRivals grow every turn and will come for you. Stars: 3 = win by turn 16, 2 = by turn 24, 1 = win.',17,'#cdbd95',{align:'center'}).setOrigin(0.5);
    Object.entries(Levels.data.difficulties).forEach(([k,D],i)=>{ const open=Conq.diffOpen(w.id,k), st=Conq.stars(w.id,k);
      button(this,W/2-300+i*300,320,270,90,D.name+(open?'':' 🔒')+'\n'+'★'.repeat(st)+'☆'.repeat(3-st),()=>{ if(!open) return; Conq.newCampaign(w.id,k,this.lastHero()); SFX.trumpet(); this.scene.restart({world:w.id}); },{size:22,disabled:!open}); });
    txt(this,W/2,400,'Hard opens after a Normal win here; Nightmare after a Hard win.',15,'#a08a6a').setOrigin(0.5);
    button(this,90,680,140,46,'Back',()=>this.scene.start('WorldMap')); }
  lastHero(){ for(const k of ['elah','jericho']){ const c=Conq.camp(k); if(c) return c.hero; } return 'david'; }
  donePanel(w,cp){ this.add.rectangle(W/2,H/2,W,H,0x0d0906,0.5);
    if(cp.done==='won'&&!cp.rewarded){ cp.rewarded=true; const R=CQ().rewards; Tokens.earn('conquest:'+cp.world,R.conquest+R.perStar*cp.stars); Progress.track('clears'); Progress.addXP(CQ().xp.conquest,cp.hero); Conq.save(); SFX.win(); }
    txt(this,W/2,180,cp.done==='won'?w.name+' is yours!':'Your banner has fallen',52,cp.done==='won'?GOLD:'#c0392b').setOrigin(0.5);
    if(cp.done==='won'){ txt(this,W/2,250,'★'.repeat(cp.stars)+'☆'.repeat(3-cp.stars)+'   in '+cp.turn+' turns',36,GOLD).setOrigin(0.5); txt(this,W/2,310,'+'+(CQ().rewards.conquest+CQ().rewards.perStar*cp.stars)+' Grokonians   •   +'+CQ().xp.conquest+' XP',24).setOrigin(0.5); }
    txt(this,W/2,360,'"Be strong and of a good courage." Joshua 1:9',20).setOrigin(0.5);
    button(this,W/2-160,460,280,60,'New campaign',()=>{ Conq.abandon(this.wid); this.scene.restart({world:this.wid}); },{size:22});
    button(this,W/2+160,460,280,60,'World map',()=>this.scene.start('WorldMap'),{size:22}); }
  defensePanel(cp){ const d=cp.pendingDefense, to=cp.terr[d.to], c=this.add.container(0,0).setDepth(50);
    c.add(this.add.rectangle(W/2,H/2,W,H,0x000000,0.55)); const g=this.add.graphics(); g.fillStyle(0x1a110a,0.97).fillRoundedRect(W/2-330,200,660,260,12).lineStyle(3,0xd9a441).strokeRoundedRect(W/2-330,200,660,260,12); c.add(g);
    c.add(txt(this,W/2,240,d.enemyName+' attacks '+to.name+'!',28,'#f2c14e').setOrigin(0.5));
    c.add(txt(this,W/2,290,'Your garrison: '+to.army.map(u=>CQ().units[u].short).join(', ')+'\nScouts count '+d.enemy.length+' enemy squads.',18,PARCH,{align:'center'}).setOrigin(0.5));
    c.add(button(this,W/2-150,390,260,60,'Defend!',()=>{ cp.pendingDefense=null; Conq.save(); this.scene.start('Battle',{spec:d}); },{size:24}));
    c.add(button(this,W/2+150,390,260,60,'Abandon the land',()=>{ cp.pendingDefense=null; const back=Conq.adj(cp,to.id).map(i=>cp.terr[i]).find(t=>t.owner==='p'&&t.army.length+to.army.length<=CQ().maxSquads);
      if(back) back.army.push(...to.army); to.army=[]; to.owner=d.enemyOwner; to.str=Math.round(cp.terr[d.from].str*0.4); Conq.checkEnd(cp); Conq.save(); this.scene.restart({world:this.wid}); },{size:18})); }
  tapTerr(t){ const cp=this.cp;
    if(this.sel&&this.sel!==t&&Conq.adj(cp,this.sel.id).includes(t.id)){ const from=this.sel;
      if(cp.moved[from.id]) return this.toast('That army already marched this turn');
      if(!from.army.length) return this.toast('No army here. Recruit first.');
      if(t.owner==='p'){ if(Conq.move(cp,from,t,from.army.slice())){ SFX.build(); this.scene.restart({world:this.wid}); } else this.toast('Cannot move there'); return; }
      const spec=Conq.battleSpec(cp,from,t,false); SFX.trumpet(); this.scene.start('Battle',{spec}); return; }
    this.sel=(this.sel===t)?null:t; this.mode=null; this.drawPanel(); }
  drawPanel(){ const cp=this.cp, P=this.panel; P.removeAll(true); this.hl.clear(); const t=this.sel;
    const bg=this.add.graphics(); bg.fillStyle(0x1a110a,0.94).fillRect(0,HUD_Y,W,H-HUD_Y).lineStyle(3,0xd9a441).lineBetween(0,HUD_Y,W,HUD_Y); P.add(bg);
    P.add(button(this,1190,HUD_Y+55,150,80,'End turn ▶',()=>{ const d=Conq.endTurn(cp); SFX.wave(); this.scene.restart({world:this.wid}); },{size:20}));
    if(!t){ P.add(txt(this,20,HUD_Y+20,'Tap one of your lands (gold ring) to see its army, then tap a neighbor to march or attack.\nRed and blue are rival factions; grey are free villages. ⚔ = defending strength. B = barracks level.',17)); return; }
    this.hl.lineStyle(4,0xffffff,0.9).strokeCircle(t.x,t.y,t.capital?38:32);
    if(t.owner==='p') Conq.adj(cp,t.id).forEach(i=>{ const o=cp.terr[i]; this.hl.lineStyle(3,o.owner==='p'?0x8fd06a:0xf2c14e,0.9).strokeCircle(o.x,o.y,(o.capital?32:26)+10); });
    if(t.owner!=='p'){ P.add(txt(this,20,HUD_Y+16,t.name+'  —  '+facName(cp,t.owner)+'   •   strength ⚔'+t.str+'   •   yields '+t.gold+' gold, '+t.food+' food',19,GOLD)); P.add(txt(this,20,HUD_Y+50,'Select one of your neighboring lands first, then tap this land to attack.'+(t.capital&&t.owner==='a'&&!cp.champDown?'  Their champion defends this stronghold!':''),16)); return; }
    P.add(txt(this,14,HUD_Y+8,t.name+(t.capital?' (capital)':'')+'  •  +'+t.gold+'g +'+t.food+'f  •  Barracks '+t.bar+(cp.moved[t.id]?'  •  marched':''),17,GOLD));
    t.army.forEach((u,i)=>{ P.add(spr(this,30+i*40,HUD_Y+70,UICON(u),46)); P.add(txt(this,30+i*40,HUD_Y+98,CQ().units[u].short,11).setOrigin(0.5)); });
    if(!t.army.length) P.add(txt(this,14,HUD_Y+60,'No army. Recruit some squads →',16,'#a08a6a'));
    const bx=430; if(this.mode==='recruit'){ Conq.tierTypes(3).forEach((u,i)=>{ const U=CQ().units[u], ok=Conq.canRecruit(cp,t,u), lock=t.bar<U.bar;
        const b=button(this,bx+i*84,HUD_Y+60,80,92,'',()=>{ if(Conq.recruit(cp,t,u)){ SFX.build(); this.refreshTop(); } else this.toast(lock?'Needs barracks level '+U.bar:'Not enough gold/food or army full'); },{size:12,disabled:!ok}); P.add(b);
        b.add(spr(this,0,-14,UICON(u),44)); b.label.setText(lock?'B'+U.bar+' 🔒':U.gold+'g '+U.food+'f').setY(32).setFontSize(12); if(lock) b.list[2].setTint(0x333333); });
      P.add(button(this,1080,HUD_Y+55,60,80,'✕',()=>{ this.mode=null; this.drawPanel(); },{size:20})); return; }
    if(this.mode==='drill'){ Conq.TYPES.forEach((u,i)=>{ const c=Conq.drillCost(cp,u), lv=cp.drill[u]||0; const b=button(this,bx+i*84,HUD_Y+60,80,92,'',()=>{ if(Conq.drill(cp,u)){ SFX.build(); this.refreshTop(); } else this.toast(c==null?'Max drill':'Not enough gold'); },{size:12,disabled:c==null||cp.gold<c}); P.add(b);
        b.add(spr(this,0,-14,UICON(u),44)); b.label.setText('Lv'+lv+(c!=null?' '+c+'g':' max')).setY(32).setFontSize(12); });
      P.add(button(this,1080,HUD_Y+55,60,80,'✕',()=>{ this.mode=null; this.drawPanel(); },{size:20})); return; }
    P.add(button(this,bx+90,HUD_Y+55,170,74,'Recruit',()=>{ this.mode='recruit'; this.drawPanel(); },{size:20}));
    const bc=Conq.barCost(t); P.add(button(this,bx+270,HUD_Y+55,170,74,t.bar>=3?'Barracks max':'Barracks '+(t.bar+1)+'\n'+bc+' gold',()=>{ if(Conq.build(cp,t)){ SFX.build(); this.scene.restart({world:this.wid}); } else this.toast('Not enough gold'); },{size:16,disabled:t.bar>=3||cp.gold<bc}));
    P.add(button(this,bx+450,HUD_Y+55,170,74,'Drill troops',()=>{ this.mode='drill'; this.drawPanel(); },{size:18}));
    P.add(txt(this,bx+560,HUD_Y+30,'Tap a ringed\nneighbor to\nmarch/attack',14,'#cdbd95')); }
  refreshTop(){ this.scene.restart({world:this.wid}); this.events.once('create',()=>{}); }
}
// keep selection + mode across refreshes
Campaign.prototype._restart=null;
(function(){ const orig=Campaign.prototype.refreshTop; Campaign.prototype.refreshTop=function(){ const id=this.sel&&this.sel.id, m=this.mode; this.scene.restart({world:this.wid,keepSel:id,keepMode:m}); }; const oi=Campaign.prototype.init; Campaign.prototype.init=function(d){ oi.call(this,d); this._keep=d&&d.keepSel!=null?d:null; }; const oc=Campaign.prototype.create; Campaign.prototype.create=function(){ oc.call(this); if(this._keep&&this.cp&&!this.cp.done){ this.sel=this.cp.terr[this._keep.keepSel]; this.mode=this._keep.keepMode; this.drawPanel(); } }; })();

// ======================= BATTLE =======================

const SKILLFX={stone:'strike',cherry:'strike',sharp:'strike',crossing:'strike',kite:'strike',jaw:'aoe',geyser:'aoe',altarflame:'aoe',three:'aoe',pair:'aoe',trick:'aoe',palm:'stun',roar:'stun',lamp:'stun',log:'stun',psalm:'buff',rally:'buff',bifocal:'buff',speech:'buff',manna:'buff',banquet:'buff',ravens:'heal',union:'heal',ark:'heal',forge:'heal',time:'buff',song:'slow',plea:'slow',rain:'slow',sea:'ult',five:'ult',sword:'ult',chariot:'ult',almanac:'ult',show:'ult',pillars:'ult'};
const SKILLDESC={strike:'Big hit + stun on the nearest foe',aoe:'Damages foes around your hero',stun:'Stuns foes around your hero',buff:'Army +30% damage, morale up',heal:'Heals your squads, morale up',slow:'Slows every enemy squad',ult:'Smites every enemy squad'};
const CMDS=[['follow','Follow Me'],['charge','Charge!'],['hold','Hold'],['flankL','Flank Left'],['flankR','Flank Right'],['fallback','Fall Back'],['wall','Shield Wall'],['volley','Volley'],['ride','Ride Down']];
const ang=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), adiff=(a,b)=>{ let d=Math.abs(a-b)%(Math.PI*2); return d>Math.PI?Math.PI*2-d:d; };

class Battle extends Phaser.Scene{ constructor(k){super(k||'Battle');}
  rand(){ return Math.random(); }
  later(ms,fn){ return this.time.delayedCall(ms,fn); }
  multOf(a,d){ return (CQ().mult[a.type]||{})[d.type]||1; }
  get FL(){ return {side:1.5,rear:2}; }
  init(d){ this.spec=(d&&d.spec)||Conq.dailySpec(); }
  create(){ const S=this.spec; window.__scene=this; this.D=CQ().difficulty[S.diff]||CQ().difficulty.normal; this.over=false; this.clock=0; this.limit=240; this.kills=0; this.routs=0; this.pend=null; this.selSq=null; this.chip='all'; this.order={all:'follow'};
    backdrop(this,0.25,'bg_'+S.world); this.genTerrain(); this.fx=this.add.graphics().setDepth(30); this.rings=this.add.graphics().setDepth(2);
    const b=DATA.heroes.find(h=>h.id===S.hero)||DATA.heroes.find(h=>Progress.heroUnlocked(h)&&h.id===(Conq.camp(S.world)||{}).hero)||DATA.heroes[0], pk=Progress.perks(b.id);
    this.hero={side:0,isHero:true,def:b,x:190,y:330,tx:190,ty:330,face:0,hp:b.hp*3*pk.hp,max:b.hp*3*pk.hp,cd:0,down:0,dmg:b.dmg*2.2*pk.dmg,type:'hero'};
    this.hero.spr=spr(this,190,330,b.id,58).setDepth(9); this.hero.bar=this.add.graphics().setDepth(12);
    this.sq=[]; S.player.forEach(t=>this.addSquad(0,t,S.drill&&S.drill[t]||0)); S.enemy.forEach(t=>this.addSquad(1,t,0));
    if(S.champion) this.addSquad(1,'champ',0,S.champion);
    this.layout(0); this.layout(1); this.assignSlots();
    this.buildHUD(); this.input.on('pointerdown',p=>this.onTap(p));
    this.aiT=2.5+(S.diff==='normal'?2:0); this.toast((S.defense?'Defend ':'Battle for ')+S.land+'  vs  '+S.enemyName+'\nTap the field to lead your army. The army follows you.',3500); SFX.trumpet(); }
  // ---------- terrain ----------
  genTerrain(){ const R=Conq.rng(this.spec.terrain||'t'), g=this.add.graphics().setDepth(1); this.hills=[]; this.forests=[]; this.river=null;
    const nh=1+Math.floor(R()*3), nf=1+Math.floor(R()*3);
    for(let i=0;i<nh;i++) this.hills.push({x:330+R()*620,y:110+R()*400,r:70+R()*45});
    for(let i=0;i<nf;i++) this.forests.push({x:300+R()*680,y:100+R()*420,r:55+R()*40});
    if(this.spec.world==='elah'||R()<0.5){ const x=560+R()*160; this.river={x,w:46,fords:[100+R()*120,330+R()*180].map(y=>({y,h:70}))}; }
    this.hills.forEach(h=>{ g.fillStyle(0x7a6a44,0.55).fillEllipse(h.x,h.y,h.r*2,h.r*1.5); g.lineStyle(2,0x3a2a14,0.6).strokeEllipse(h.x,h.y,h.r*2,h.r*1.5).strokeEllipse(h.x,h.y,h.r*1.3,h.r); txt(this,h.x,h.y,'hill',13,'#efe2bf').setOrigin(0.5).setAlpha(0.7).setDepth(1); });
    if(this.river){ const r=this.river; g.fillStyle(0x2f5a78,0.75).fillRect(r.x-r.w/2,0,r.w,HUD_Y); r.fords.forEach(f=>{ g.fillStyle(0xa89060,0.9).fillRect(r.x-r.w/2-4,f.y-f.h/2,r.w+8,f.h); txt(this,r.x,f.y,'ford',12,'#1a110a').setOrigin(0.5).setDepth(1); }); }
    this.forests.forEach(f=>{ for(let k=0;k<9;k++){ const a=k*0.7, rr=f.r*(0.25+0.6*((k*37)%10)/10); g.fillStyle(0x23361c,0.85).fillCircle(f.x+Math.cos(a)*rr,f.y+Math.sin(a)*rr*0.8,16+((k*13)%9)); g.fillStyle(0x3a5a2a,0.7).fillCircle(f.x+Math.cos(a)*rr-4,f.y+Math.sin(a)*rr*0.8-5,8); } }); }
  terr(x,y){ const o={hill:false,forest:false,river:false}; this.hills.forEach(h=>{ if(((x-h.x)/h.r)**2+((y-h.y)/(h.r*0.75))**2<1) o.hill=true; }); this.forests.forEach(f=>{ if(Math.hypot(x-f.x,y-f.y)<f.r) o.forest=true; });
    const r=this.river; if(r&&Math.abs(x-r.x)<r.w/2&&!r.fords.some(f=>Math.abs(y-f.y)<f.h/2)) o.river=true; return o; }
  // ---------- squads ----------
  addSquad(side,type,drill,champ){ let def;
    if(type==='champ'){ const isG=champ==='goliath'; def={name:this.spec.world==='elah'?'Goliath of Gath':'The Gatekeeper Colossus',short:'Champion',hp:1500*this.D.hp,dmg:46,rate:1.5,range:0,speed:40,men:1,h:isG?120:100,sprite:isG?'goliath':'golem',tint:isG?null:0xc9a070,champ:true}; }
    else def=CQ().units[type];
    const s={side,type,def,drill,men:def.men,maxMen:def.men,manHp:def.hp*(side?this.D.hp:1)*(1+0.1*drill),x:0,y:0,face:side?Math.PI:0,state:side?'ai':'follow',cd:this.rand(),morale:100,stun:0,buff:0,slow:0,moved:0,chargeReady:!!def.charge,spr:[],gone:false,dead:false,routing:false,slot:{d:0,l:0},id:this.sq.length};
    s.hp=s.manHp*s.men; s.max=s.hp;
    for(let i=0;i<def.men;i++){ const im=spr(this,0,0,def.sprite||('u_'+type),def.h||34); if(def.tint) im.setTint(def.tint); im.setFlipX(!!side); im.ph=this.rand()*6; s.spr.push(im); }
    s.flag=this.add.rectangle(0,0,14,9,side?parseInt(this.spec.enemyColor):0xd9a441).setStrokeStyle(1,0x140c07).setDepth(11); s.pole=this.add.rectangle(0,0,2,24,0x3a2a14).setDepth(11);
    this.sq.push(s); return s; }
  layout(side){ const L=this.sq.filter(s=>s.side===side), rows={front:[],back:[],wing:[],rear:[]};
    L.forEach(s=>{ const t=s.type; (t==='archer'||t==='slinger'?rows.back:t==='horse'||t==='chariot'?rows.wing:s.def.heal?rows.rear:rows.front).push(s); });
    const bx=side?1090:280, dir=side?-1:1, place=(arr,x)=>arr.forEach((s,i)=>{ s.x=x; s.y=325+(i-(arr.length-1)/2)*72; });
    place(rows.front,bx+dir*40); place(rows.back,bx-dir*50); place(rows.rear,bx-dir*110); rows.wing.forEach((s,i)=>{ s.x=bx; s.y=i%2?120+Math.floor(i/2)*60:530-Math.floor(i/2)*60; }); }
  assignSlots(){ const L=this.sq.filter(s=>s.side===0&&!s.dead), front=L.filter(s=>['sword','shield','spear'].includes(s.type)).sort((a,b)=>(a.type==='shield'?-1:0)-(b.type==='shield'?-1:0)), back=L.filter(s=>s.type==='archer'||s.type==='slinger'), wing=L.filter(s=>s.def.mounted), rear=L.filter(s=>s.def.heal);
    const row=(a,d)=>a.forEach((s,i)=>s.slot={d,l:(i-(a.length-1)/2)*66}); row(front,60); row(back,-55); row(rear,-115); const fw=Math.max(1,front.length)*33+70; wing.forEach((s,i)=>s.slot={d:10-Math.floor(i/2)*55,l:(i%2?1:-1)*fw}); }
  alive(side){ return this.sq.filter(s=>s.side===side&&!s.dead&&!s.gone); }
  fighting(side){ return this.alive(side).filter(s=>!s.routing); }
  group(){ if(this.selSq&&!this.selSq.dead) return [this.selSq]; return this.alive(0).filter(s=>this.chip==='all'||s.type===this.chip); }
  // ---------- HUD ----------
  buildHUD(){ const bar=this.add.graphics().setDepth(40); bar.fillStyle(0x1a110a,0.95).fillRect(0,HUD_Y,W,H-HUD_Y).lineStyle(3,0xd9a441).lineBetween(0,HUD_Y,W,HUD_Y);
    this.top=this.add.graphics().setDepth(40); this.stat=txt(this,W/2,8,'',18).setOrigin(0.5,0).setDepth(41); this.ordTxt=txt(this,12,8,'',16,'#f2c14e').setDepth(41);
    this.cmdBtn={}; CMDS.forEach(([id,name],i)=>{ const b=button(this,72+i*136,HUD_Y+27,130,46,name,()=>this.command(id),{size:17}); b.setDepth(41); this.cmdBtn[id]=b; });
    const types=['all',...new Set(this.alive(0).map(s=>s.type))]; this.chips={};
    types.forEach((t,i)=>{ const b=button(this,48+i*90,HUD_Y+82,86,40,t==='all'?'All':CQ().units[t].short,()=>{ this.chip=t; this.selSq=null; this.refreshHUD(); },{size:15}); b.setDepth(41); this.chips[t]=b; });
    const h=this.hero.def; this.skillBtns=[]; [...h.skills,h.ult].forEach((k,i)=>{ const b=button(this,905+i*125,HUD_Y+82,120,44,k.name,()=>this.useSkill(i),{size:14}); b.setDepth(41); b.cd=i===2?20:4; b.def=k; this.skillBtns.push(b); });
    this.refreshHUD(); }
  refreshHUD(){ Object.entries(this.chips).forEach(([t,b])=>b.redraw(this.chip===t&&!this.selSq)); const g=this.group(), st=g.length?g[0].state:'-';
    Object.entries(this.cmdBtn).forEach(([id,b])=>b.redraw(this.pend===id||(id===st)||(id==='flankL'&&st==='flank'&&g[0].flankDir<0)||(id==='flankR'&&st==='flank'&&g[0].flankDir>0)));
    this.ordTxt.setText(this.pend?(this.pend==='volley'?'Tap where the archers should rain arrows':'Tap the enemy squad to ride down'):(this.selSq?'Selected: '+this.selSq.def.name+'. Tap a spot or an enemy':'Orders → '+(this.chip==='all'?'whole army':CQ().units[this.chip].name))); }
  toast(m,ms){ if(this._toast) this._toast.destroy(); const t=txt(this,W/2,HUD_Y-80,m,20,GOLD,{backgroundColor:'#140c07cc',padding:{x:10,y:4},wordWrap:{width:900},align:'center'}).setOrigin(0.5).setDepth(45); this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||1600,duration:600,onComplete:()=>t.destroy()}); }
  command(id){ if(this.over) return; const G=this.group(); if(!G.length) return this.toast('No troops of that type');
    if(id==='volley'){ if(!G.some(s=>s.def.range)&&!this.alive(0).some(s=>s.def.range)) return this.toast('No archers or slingers'); this.pend='volley'; return this.refreshHUD(); }
    if(id==='ride'){ if(!this.alive(0).some(s=>s.def.mounted)) return this.toast('No horsemen or chariots'); this.pend='ride'; return this.refreshHUD(); }
    const E=this.fighting(1); const C=E.length?{x:E.reduce((a,s)=>a+s.x,0)/E.length,y:E.reduce((a,s)=>a+s.y,0)/E.length}:{x:1000,y:325};
    G.forEach(s=>{ s.target=null; s.wall=false;
      if(id==='follow'){ s.state='follow'; }
      else if(id==='charge'){ s.state='charge'; s.chargeReady=!!s.def.charge; }
      else if(id==='hold'){ s.state='hold'; s.tx=s.x; s.ty=s.y; }
      else if(id==='flankL'||id==='flankR'){ const dir=id==='flankL'?-1:1; s.flankDir=dir; s.state='flank'; s.tx=Phaser.Math.Clamp(C.x+40,40,W-40); s.ty=Phaser.Math.Clamp(C.y+dir*210,50,HUD_Y-30); s.wx=Phaser.Math.Clamp((s.x+C.x)/2,40,W-40); s.wy=s.ty; }
      else if(id==='fallback'){ s.state='move'; s.tx=110+this.rand()*60; s.ty=s.y; s.routing=false; }
      else if(id==='wall'){ s.state='hold'; s.wall=true; const f=ang(s,C); if(s.type==='shield'){ s.tx=s.x+Math.cos(f)*50; s.ty=s.y+Math.sin(f)*50; } else { s.tx=s.x; s.ty=s.y; } s.face=f; } });
    if(id==='follow') this.assignSlots(); SFX.toggle&&SFX.toggle(true); SFX.unlock(); this.selSq=null; this.refreshHUD(); this.toast(CMDS.find(c=>c[0]===id)[1]+' — '+(G.length>1?G.length+' squads':G[0].def.name),900); }
  onTap(p){ if(this.over||p.y>=HUD_Y) return; const pt={x:p.x,y:p.y};
    const hitE=this.alive(1).filter(s=>dist(s,pt)<40).sort((a,b)=>dist(a,pt)-dist(b,pt))[0];
    if(this.pend==='volley'){ const G=this.alive(0).filter(s=>s.def.range&&(this.selSq?s===this.selSq:(this.chip==='all'||s.type===this.chip))); const A=G.length?G:this.alive(0).filter(s=>s.def.range); A.forEach(s=>{ s.state='volley'; s.vx=p.x; s.vy=p.y; s.volleys=3; s.cd=0; }); this.mark(p.x,p.y,0xf2c14e); this.pend=null; this.refreshHUD(); return; }
    if(this.pend==='ride'){ const tg=hitE||this.alive(1).sort((a,b)=>dist(a,pt)-dist(b,pt))[0]; if(tg) this.alive(0).filter(s=>s.def.mounted&&(this.selSq?s===this.selSq:true)).forEach(s=>{ s.state='charge'; s.target=tg; s.chargeReady=true; }); this.mark(p.x,p.y,0xc0392b); this.pend=null; this.refreshHUD(); return; }
    const own=this.alive(0).filter(s=>dist(s,pt)<30).sort((a,b)=>dist(a,pt)-dist(b,pt))[0];
    if(own){ this.selSq=this.selSq===own?null:own; this.refreshHUD(); return; }
    if(this.selSq){ const s=this.selSq; if(hitE){ s.state='charge'; s.target=hitE; } else { s.state='move'; s.tx=p.x; s.ty=p.y; } this.mark(p.x,p.y,hitE?0xc0392b:0xd9a441); this.selSq=null; this.refreshHUD(); return; }
    const h=this.hero; if(h.down>0) return; h.tx=p.x; h.ty=p.y; this.mark(p.x,p.y,0xd9a441); }
  mark(x,y,col){ const c=this.add.circle(x,y,6,col,0.2).setStrokeStyle(2,col).setDepth(25); this.tweens.add({targets:c,radius:26,alpha:0,duration:450,onComplete:()=>c.destroy()}); }
  // ---------- skills ----------
  useSkill(i){ const b=this.skillBtns[i], h=this.hero; if(this.over||b.cd>0||h.down>0) return; const k=b.def, kind=i===2?'ult':(SKILLFX[k.id]||['strike','buff'][i]);
    const E=this.alive(1), near=r=>E.filter(e=>dist(e,h)<r), F=this.alive(0), ring=(r,col)=>{ const c=this.add.circle(h.x,h.y,10,col,0.3).setDepth(15); this.tweens.add({targets:c,radius:r,alpha:0,duration:500,onComplete:()=>c.destroy()}); };
    if(kind==='strike'){ const t=near(280).sort((a,b)=>dist(a,h)-dist(b,h))[0]; if(!t) return this.toast('No foe in reach'); this.missile(h,t,'stone',()=>{ this.damage(null,t,170,{raw:true}); t.stun=1.6; t.morale-=10; }); }
    else if(kind==='aoe'){ near(170).forEach(t=>{ this.damage(null,t,95,{raw:true}); t.morale-=12; }); ring(170,0xd8572a); }
    else if(kind==='stun'){ near(190).forEach(t=>t.stun=2.5); ring(190,0x8a6a9a); }
    else if(kind==='buff'){ F.filter(s=>dist(s,h)<320).forEach(s=>{ s.buff=8; s.morale=Math.min(100,s.morale+25); }); ring(320,0xd9a441); }
    else if(kind==='heal'){ F.filter(s=>dist(s,h)<320).forEach(s=>{ s.hp=Math.min(s.max,s.hp+s.max*0.3); s.morale=Math.min(100,s.morale+20); this.syncMen(s); }); h.hp=Math.min(h.max,h.hp+h.max*0.3); ring(320,0x8fd06a); }
    else if(kind==='slow'){ E.forEach(t=>t.slow=6); ring(400,0xdfe6ee); }
    else { E.forEach(t=>{ this.damage(null,t,t.def.champ?260:130,{raw:true}); t.morale-=25; }); F.forEach(s=>s.morale=Math.min(100,s.morale+30)); this.cameras.main.flash(300,242,220,170); this.cameras.main.shake(250,0.006); Progress.track('ults'); SFX.ult(); }
    SFX.skill(); b.cd=Math.max(8,(k.cd||20)*(i===2?0.75:0.6)); this.toast(k.name+': '+SKILLDESC[kind],1400); }
  // ---------- combat ----------
  missile(a,t,key,cb){ const im=this.add.image(a.x,a.y-10,key).setDepth(14); if(key==='spear') im.setScale(0.45); im.setRotation(ang(a,t));
    const du=Math.min(650,dist(a,t)*2.2+120); this.tweens.add({targets:im,x:t.x+Phaser.Math.Between(-10,10),y:t.y+Phaser.Math.Between(-8,8),duration:du,onComplete:()=>im.destroy()}); this.later(du,cb); }
  damage(a,d,amt,o){ if(d.dead||d.gone) return 0; o=o||{}; let m=1;
    if(!o.raw&&a){ m*=this.multOf(a,d,o); m*=1+0.1*(a.drill||0); if(a.buff>0) m*=1.3; if(a.isHero) m*=1;
      if(!d.isHero){ const front=adiff(d.face,ang(d,a)), side=front>Math.PI*2/3?'rear':front>Math.PI/3?'side':'front';
        if(side!=='front'&&!o.ranged){ m*=this.FL[side]; if(!d.def.champ) d.morale-=side==='rear'?5:3; d.flanked=0.6; }
        if((d.type==='shield'||d.def.cls==='shield')&&side==='front'){ if(o.ranged&&!a.def.pierce) m*=1-(d.wall?0.9:0.7); else if(!o.ranged) m*=d.wall?0.6:0.8; }
        const T=this.terr(d.x,d.y); if(T.forest&&o.ranged) m*=0.5; if(T.hill) m*=0.8; if(T.river) m*=1.25; }
      if(a.chargeReady&&a.def.charge&&!o.ranged){ m*=a.def.charge; a.chargeReady=false; if(!d.isHero&&!d.def.champ) d.morale-=12; this.spark(d.x,d.y,0xf2e07a,6); SFX.stomp(); } }
    if(d.routing) m*=1.5; if(!o.raw) m*=BMUL; const dmg=amt*m;
    if(d.isHero){ d.hp-=dmg; d.spr.setTint(0xff8a7a); this.time.delayedCall(80,()=>d.spr.clearTint()); if(d.hp<=0) this.heroDown(); return dmg; }
    const men0=d.men; d.hp-=dmg; this.syncMen(d); const lost=men0-d.men;
    if(lost>0){ if(!d.def.champ) d.morale-=lost/d.maxMen*60; if(d.side===1) this.kills+=lost; SFX.hit(); }
    if(d.hp<=0) this.kill(d); else if(d.morale<20&&!d.routing&&!d.def.champ) this.rout(d); return dmg; }
  syncMen(s){ const n=Math.max(0,Math.ceil(s.hp/s.manHp-0.001)); s.men=Math.min(s.maxMen,n); s.spr.forEach((im,i)=>{ const on=i<s.men; if(on&&im.fading){ im.fading=false; im.setAlpha(1); } else if(!on&&!im.fading){ im.fading=true; this.tweens.add({targets:im,alpha:0,duration:400}); } }); }
  kill(s){ s.dead=true; s.hp=0; this.syncMen(s); s.flag.destroy(); s.pole.destroy(); SFX.die();
    this.alive(s.side).filter(o=>dist(o,s)<160&&!o.def.champ).forEach(o=>o.morale-=10);
    if(s.def.champ){ this.champDown=true; this.alive(1).forEach(o=>o.morale-=40); this.toast(s.def.name+' has fallen!',2500); this.cameras.main.flash(400,242,220,170); this.cameras.main.shake(400,0.01); }
    if(this.selSq===s) this.selSq=null; }
  rout(s){ s.routing=true; s.state=s.side?'ai':s.state; s.target=null; if(s.side===1){ this.routs++; } this.floatText(s.x,s.y-30,s.def.short+' ROUT!',s.side?'#8fd06a':'#e07a5a');
    this.alive(s.side).filter(o=>o!==s&&dist(o,s)<150&&!o.def.champ).forEach(o=>o.morale-=8); }
  heroDown(){ const h=this.hero; h.down=15; h.hp=0; h.spr.setAlpha(0.3); this.alive(0).forEach(s=>s.morale-=25); this.toast(h.def.name+' is down! Back in 15s — hold the line!',2200); SFX.lose&&0; }
  spark(x,y,col,n){ for(let i=0;i<(n||4);i++){ const p=this.add.image(x,y,'spark').setTint(col).setDepth(16).setScale(0.8); this.tweens.add({targets:p,x:x+Phaser.Math.Between(-24,24),y:y+Phaser.Math.Between(-24,24),alpha:0,scale:0.2,duration:350,onComplete:()=>p.destroy()}); } }
  floatText(x,y,s,c){ const t=txt(this,x,y,s,15,c).setOrigin(0.5).setDepth(25); this.tweens.add({targets:t,y:y-30,alpha:0,duration:1100,onComplete:()=>t.destroy()}); }
  foes(s){ const L=this.alive(1-s.side).filter(o=>!o.routing||dist(o,s)<60); if(s.side===1&&this.hero.down<=0) L.push(this.hero); return L; }
  nearest(s,L){ let b=null,bd=1e9; (L||this.foes(s)).forEach(o=>{ const d=dist(s,o); if(d<bd){ bd=d; b=o; } }); return b; }
  reach(s){ return 34+(s.def.reach||0)+(s.def.champ?20:0); }
  rangeOf(s){ return (s.def.range||0)*(this.terr(s.x,s.y).hill?1.3:1); }
  // ---------- AI brain (enemy side) ----------
  think(){ const D=this.D, P=this.fighting(0), A=this.fighting(1), opening=this.clock<(this.spec.diff==='normal'?2:5);
    A.forEach(s=>{ if(s.def.champ){ s.goal=this.nearest(s); return; }
      const t=s.type, melee=P.filter(p=>!p.def.range), byScore=(L)=>L.map(p=>({p,v:((CQ().mult[t]||{})[p.type]||1)/(60+dist(s,p))*(p.routing?0.5:1)})).sort((a,b)=>b.v-a.v)[0];
      if(s.morale<35&&!s.engaged){ s.goal={x:1180,y:s.y}; return; }
      if(s.def.range){ const threat=melee.filter(p=>dist(p,s)<120)[0]; if(threat&&!s.engaged){ const a=ang(threat,s); s.goal={x:s.x+Math.cos(a)*90,y:s.y+Math.sin(a)*90}; s.kite=true; return; } s.kite=false;
        const tg=byScore(P.filter(p=>dist(p,s)<this.rangeOf(s)*1.6))||{p:this.nearest(s)}; s.focus=tg&&tg.p; if(s.focus&&dist(s,s.focus)>this.rangeOf(s)*0.92){ const fr=A.filter(o=>!o.def.range); const fx=fr.length?fr.reduce((a,o)=>a+o.x,0)/fr.length:s.x; s.goal={x:Math.max(s.focus.x+this.rangeOf(s)*0.85,fx+30),y:s.focus.y}; } else s.goal=null; return; }
      if(opening&&!s.engaged){ s.goal=null; return; }
      if(t==='spear'||s.def.cls==='spear'){ const hs=P.filter(p=>p.def.mounted).sort((a,b)=>dist(a,s)-dist(b,s))[0]; if(hs&&dist(hs,s)<420){ s.goal=hs; return; } }
      if(s.def.heal){ const fr=A.filter(o=>o!==s); s.goal=fr.length?{x:fr.reduce((a,o)=>a+o.x,0)/fr.length+70,y:fr.reduce((a,o)=>a+o.y,0)/fr.length}:null; return; }
      if(s.def.mounted){ const tg=byScore(P); if(!tg){ s.goal=null; return; } const sp=P.filter(p=>p.type==='spear'&&dist(p,tg.p)<140)[0];
        if(sp&&!s.engaged&&this.rand()<D.counter){ const a=ang(sp,tg.p)+Math.PI/2*(s.y<tg.p.y?-1:1); s.goal={x:tg.p.x+Math.cos(a)*120,y:tg.p.y+Math.sin(a)*120}; s.flankPt=true; } else s.goal=tg.p; return; }
      if(D.focusHero&&this.hero.down<=0&&dist(this.hero,s)<260&&this.rand()<0.6){ s.goal=this.hero; return; }
      const tg=byScore(P); s.goal=tg?tg.p:(this.hero.down<=0?this.hero:null); }); }
  // ---------- per-squad tick ----------
  tickSquad(s,dt){ if(s.dead||s.gone) return; const h=this.hero; if(s.buff>0) s.buff-=dt; if(s.slow>0) s.slow-=dt; if(s.flanked>0) s.flanked-=dt; s.cd-=dt;
    if(s.stun>0){ s.stun-=dt; return; }
    const T=this.terr(s.x,s.y); let spd=s.def.speed*(T.forest?0.6:1)*(T.river?0.35:1)*(s.slow>0?0.5:1)*(s.wall?0.5:1);
    const foes=this.foes(s), E=this.nearest(s,foes), dE=E?dist(s,E):1e9;
    // morale regen
    if(!s.def.champ){ const safe=dE>150; s.morale+=dt*((safe?4:0)+(s.side===0&&h.down<=0&&dist(s,h)<160?5:0)+(s.side===1&&!s.routing?1:0)); s.morale=Math.min(100,s.morale); }
    if(s.routing){ if(s.morale>55&&(s.side===1||dist(s,h)<220)){ s.routing=false; this.floatText(s.x,s.y-30,'Rallied','#f2c14e'); if(s.side===0) s.state='follow'; } else { const ex=s.side?W+60:-60; this.moveTo(s,{x:ex,y:s.y},spd*1.15,dt); if(s.x<-40||s.x>W+40){ s.gone=true; s.spr.forEach(i=>i.setVisible(false)); s.flag.setVisible(false); s.pole.setVisible(false); } return; } }
    // engage: melee contact
    const contact=foes.filter(o=>dist(s,o)<this.reach(s)+(o.def&&o.def.champ?20:0)).sort((a,b)=>dist(s,a)-dist(s,b))[0]; s.engaged=!!contact;
    if(contact&&!s.def.range&&!s.def.heal){ s.face=ang(s,contact); if(s.cd<=0){ s.cd=s.def.rate; const base=s.def.dmg*s.men;
        if(s.def.trample||s.def.champ){ foes.filter(o=>dist(s,o)<this.reach(s)+16).forEach(o=>this.damage(s,o,base*(o===contact?1:0.5))); } else this.damage(s,contact,base);
        this.bump(s); } if(!s.def.mounted||s.state!=='charge') { s.moved=0; return; } }
    if(contact&&s.def.range){ s.face=ang(s,contact); if(s.cd<=0){ s.cd=s.def.rate; this.damage(s,contact,s.def.dmg*s.men*(s.def.melee||0.5)); this.bump(s); } if(!(s.side===1&&s.kite)){ return; } }
    // healer
    if(s.def.heal&&s.cd<=0){ s.cd=1; this.alive(s.side).filter(o=>o!==s&&dist(o,s)<130).forEach(o=>{ o.hp=Math.min(o.max,o.hp+s.def.heal*s.men); o.morale=Math.min(100,o.morale+3); this.syncMen(o); if(this.rand()<0.3) this.spark(o.x,o.y,0x8fd06a,1); }); }
    // ranged fire
    if(s.def.range&&s.state==='volley'&&s.side===0){ const sp={x:s.vx,y:s.vy}; if(dist(s,sp)>this.rangeOf(s)*1.1){ this.moveTo(s,sp,spd,dt); return; } s.face=ang(s,sp);
      if(s.cd<=0){ s.cd=1.0; s.volleys--; this.volley(s,sp); if(s.volleys<=0){ s.state='hold'; s.tx=s.x; s.ty=s.y; } } return; }
    if(s.def.range&&s.cd<=0){ const tgt=(s.side===1&&s.focus&&!s.focus.dead&&dist(s,s.focus)<=this.rangeOf(s))?s.focus:foes.filter(o=>dist(s,o)<=this.rangeOf(s)).sort((a,b)=>dist(s,a)-dist(s,b))[0];
      if(tgt){ s.cd=s.def.rate; s.face=ang(s,tgt); const n=Math.min(3,s.men); for(let k=0;k<n;k++) this.time.delayedCall(k*70,()=>{ if(!s.dead) this.missile(s.spr[k]||s,tgt,s.type==='archer'?'spear':'stone',()=>{}); });
        const dmg=s.def.dmg*s.men; this.later(Math.min(650,dist(s,tgt)*2.2+120),()=>{ if(!s.dead) this.damage(s,tgt,dmg,{ranged:true}); }); SFX.sling(); } }
    // movement by state
    let goal=null, sp=spd;
    if(s.side===1){ goal=s.goal&&!(s.goal.dead||s.goal.gone)?s.goal:null; if(goal&&goal.isHero&&goal.down>0) goal=null; if(s.def.range&&goal===s.focus) goal=null; }
    else if(s.state==='follow'){ const f=h.face, slot={x:h.x+Math.cos(f)*s.slot.d-Math.sin(f)*s.slot.l,y:h.y+Math.sin(f)*s.slot.d+Math.cos(f)*s.slot.l};
      const auto=!s.def.range&&!s.def.heal&&E&&dE<110&&dist(E,slot)<200; goal=auto?E:slot; if(!auto&&dist(s,slot)>60) sp=spd*1.25; }
    else if(s.state==='charge'){ if(s.target&&(s.target.dead||s.target.gone)) s.target=null; goal=s.target||(s.def.range?null:E); if(s.def.range&&E&&dE>this.rangeOf(s)*0.9) goal=E; }
    else if(s.state==='flank'){ if(s.wx!=null){ goal={x:s.wx,y:s.wy}; if(dist(s,goal)<30) s.wx=null; } else { goal={x:s.tx,y:s.ty}; if(dist(s,goal)<40){ s.state='charge'; s.chargeReady=!!s.def.charge; } } }
    else if(s.state==='move'||s.state==='hold'){ goal=s.tx!=null?{x:s.tx,y:s.ty}:null; if(s.state==='move'&&goal&&dist(s,goal)<12){ s.state='hold'; } if(s.state==='hold'&&!s.def.range&&!s.def.heal&&E&&dE<70&&!s.wall) goal=E; }
    if(goal&&s.def.range&&!goal.isHero&&goal.side!==undefined&&goal.side!==s.side&&dist(s,goal)<=this.rangeOf(s)*0.95) goal=null;
    if(goal) this.moveTo(s,goal,sp,dt,(goal.side!==undefined&&goal.side!==s.side)?this.reach(s)-6:6);
    else if(s.state==='hold'&&s.wall&&E) s.face=ang(s,E); }
  moveTo(s,g,sp,dt,stopAt){ const d=dist(s,g); if(d<=(stopAt||4)) return; const st=Math.min(d-(stopAt||0),sp*dt), a=ang(s,g); s.x+=Math.cos(a)*st; s.y+=Math.sin(a)*st; s.face=a; s.moved+=st; s.walking=true; if(s.def.charge&&s.moved>70) s.chargeReady=true;
    s.x=Phaser.Math.Clamp(s.x,-80,W+80); s.y=Phaser.Math.Clamp(s.y,40,HUD_Y-20); }
  volley(s,sp){ const r=70, n=Math.min(8,s.men); for(let k=0;k<n;k++){ const tx=sp.x+Phaser.Math.Between(-r,r)*0.8, ty=sp.y+Phaser.Math.Between(-r,r)*0.6; const im=this.add.image(s.x,s.y-12,s.type==='archer'?'spear':'stone').setDepth(14).setScale(s.type==='archer'?0.4:1).setRotation(ang(s,{x:tx,y:ty}));
      this.tweens.add({targets:im,x:tx,y:ty,duration:600+k*30,ease:'Quad.in',onComplete:()=>im.destroy()}); }
    this.later(650,()=>{ this.alive(1).filter(o=>dist(o,sp)<r+20).forEach(o=>this.damage(s,o,s.def.dmg*s.men*0.9,{ranged:true})); const c=this.add.circle(sp.x,sp.y,r,0xf2c14e,0.12).setDepth(3); this.tweens.add({targets:c,alpha:0,duration:400,onComplete:()=>c.destroy()}); }); SFX.sling(); }
  bump(s){ s.spr.forEach((im,i)=>{ if(i<s.men) im.lunge=0.15; }); }
  separate(){ const L=this.sq.filter(s=>!s.dead&&!s.gone);
    for(let i=0;i<L.length;i++) for(let j=i+1;j<L.length;j++){ const a=L[i],b=L[j], same=a.side===b.side, min=same?42:(a.def.champ||b.def.champ?44:26), d=dist(a,b);
      if(d<min&&d>0.01){ const push=(min-d)/2, ax=(a.x-b.x)/d, ay=(a.y-b.y)/d; a.x+=ax*push; a.y+=ay*push; b.x-=ax*push; b.y-=ay*push; } }
    const h=this.hero; if(h.down<=0) L.filter(s=>s.side===1).forEach(s=>{ const d=dist(s,h); if(d<26&&d>0.01){ s.x+=(s.x-h.x)/d*(26-d); s.y+=(s.y-h.y)/d*(26-d); } }); }
  render(time){ this.rings.clear(); const sel=this.selSq;
    this.sq.forEach(s=>{ if(s.dead&&s.spr.every(i=>i.alpha<=0.01)) return; if(s.gone) return;
      const col=s.side?parseInt(this.spec.enemyColor):0xd9a441, f=s.face, n=s.maxMen, cols=s.def.champ?1:Math.ceil(n/2), rows=s.def.champ?1:(n>3?2:1), spx=s.def.mounted?20:15, spd=s.def.mounted?20:14;
      if(!s.dead){ this.rings.fillStyle(col,s.routing?0.18:0.35).fillEllipse(s.x,s.y+10,cols*spx+18,rows*spd+16); if(sel===s) this.rings.lineStyle(3,0xffffff,1).strokeEllipse(s.x,s.y+10,cols*spx+28,rows*spd+24); if(s.flanked>0) this.rings.lineStyle(2,0xff5a3a,0.9).strokeEllipse(s.x,s.y+10,cols*spx+22,rows*spd+20); if(s.wall) this.rings.lineStyle(2,0xcdbd95,0.9).strokeEllipse(s.x,s.y+10,cols*spx+24,rows*spd+20); }
      const left=Math.cos(f)<-0.05;
      s.spr.forEach((im,i)=>{ const c=i%cols, r=Math.floor(i/cols), lat=(c-(cols-1)/2)*spx, dep=-r*spd+(r%2?0:0)+(c%2?3:0); const px=s.x+Math.cos(f)*dep-Math.sin(f)*lat, py=s.y+Math.sin(f)*dep+Math.cos(f)*lat*0.6;
        const ph=time/(s.walking?110:420)+im.ph, k=im.baseScale; let lx=0; if(im.lunge>0){ im.lunge-=0.016; lx=Math.cos(f)*6; }
        im.setOrigin(0.5,0.92).setPosition(px+lx,py+12).setFlipX(left).setScale(k*(1-0.04*Math.sin(ph)),k*(1+0.05*Math.sin(ph))).setRotation(s.walking?0.06*Math.sin(ph*0.5):0).setDepth(6+py/1000); if(s.routing&&!im.fading) im.setAlpha(0.75); else if(!im.fading) im.setAlpha(1); });
      if(!s.dead){ const fx=s.x+(left?12:-12), fy=s.y-(s.def.h||34)-8; s.pole.setPosition(fx,fy+10); s.flag.setPosition(fx+(left?-7:7),fy); s.flag.setAlpha(s.routing?0.4:1);
        const hb=this.rings; hb.fillStyle(0x000000,0.6).fillRect(s.x-16,fy-12,32,4); hb.fillStyle(s.side?0xa33b20:0x5aa33b,1).fillRect(s.x-16,fy-12,32*Math.max(0,s.hp/s.max),4); hb.fillStyle(0xf2c14e,1).fillRect(s.x-16,fy-7,32*Math.max(0,Math.min(1,s.morale/100)),2); }
      s.walking=false; });
    const h=this.hero, hk=h.spr.baseScale, walking=dist(h,{x:h.tx,y:h.ty})>3, ph=time/(walking?90:400);
    h.spr.setOrigin(0.5,0.9).setPosition(h.x,h.y+18).setFlipX(Math.cos(h.face)<-0.05).setScale(hk*(1-0.04*Math.sin(ph)),hk*(1+0.05*Math.sin(ph))).setDepth(7+h.y/1000);
    h.bar.clear(); if(h.down<=0){ this.rings.lineStyle(2,0xd9a441,0.5).strokeCircle(h.x,h.y+14,24); h.bar.fillStyle(0x000000,0.7).fillRect(h.x-24,h.y-50,48,5); h.bar.fillStyle(0x5aa33b,1).fillRect(h.x-24,h.y-50,48*h.hp/h.max,5); } }
  update(time,delta){ if(this.over) return; const dt=Math.min(0.05,delta/1000); this.clock+=dt; const h=this.hero;
    // hero movement + fighting
    if(h.down>0){ h.down-=dt; if(h.down<=0){ h.hp=h.max*0.6; h.spr.setAlpha(1); h.x=h.tx=90; h.y=h.ty=330; this.toast(h.def.name+' returns!'); } }
    else { const dx=h.tx-h.x, dy=h.ty-h.y, dl=Math.hypot(dx,dy); if(dl>3){ const T=this.terr(h.x,h.y), st=Math.min(dl,h.def.speed*0.75*(T.river?0.5:1)*dt); h.x+=dx/dl*st; h.y+=dy/dl*st; if(dl>20){ const na=Math.atan2(dy,dx); h.face=na; } }
      h.hp=Math.min(h.max,h.hp+h.max*0.008*dt); h.cd-=dt; if(h.cd<=0){ const E=this.alive(1).filter(e=>dist(e,h)<Math.max(70,h.def.range)).sort((a,b)=>dist(a,h)-dist(b,h))[0];
        if(E){ h.cd=h.def.rate; const dmg=h.dmg; if(h.def.range<80) { this.damage(h,E,dmg*1.4); this.spark(E.x,E.y,0xe8e0c8,2); } else this.missile(h,E,'stone',()=>this.damage(h,E,dmg,{ranged:true})); } } }
    // AI
    this.aiT-=dt; if(this.aiT<=0){ this.aiT=this.D.react; this.think(); }
    this.sq.forEach(s=>this.tickSquad(s,dt)); this.separate(); this.render(time);
    // skills
    this.skillBtns.forEach(b=>{ if(b.cd>0){ b.cd-=dt; b.label.setText(b.def.name+' '+Math.ceil(b.cd)+'s'); b.alpha=0.5; } else { b.label.setText(b.def.name); b.alpha=1; } });
    // status
    const pw=this.strength(0), ew=this.strength(1), left=Math.max(0,this.limit-this.clock), g=this.top; g.clear();
    g.fillStyle(0x140c07,0.8).fillRoundedRect(W/2-300,4,600,52,8); g.fillStyle(0xd9a441,1).fillRect(W/2-290,38,270*pw,10); g.fillStyle(parseInt(this.spec.enemyColor),1).fillRect(W/2+20+270*(1-ew),38,270*ew,10);
    this.stat.setText('Your army '+Math.round(pw*100)+'%     '+Math.floor(left/60)+':'+String(Math.floor(left%60)).padStart(2,'0')+'     '+this.spec.enemyName+' '+Math.round(ew*100)+'%');
    if(this.fighting(1).length===0) return this.end(true);
    if(this.fighting(0).length===0&&(h.down>0||this.alive(1).some(s=>dist(s,h)<200))) return this.end(false);
    if(this.fighting(0).length===0&&this.clock>5&&h.down>0) return this.end(false);
    if(left<=0) return this.end(pw>ew); }
  strength(side){ const L=this.sq.filter(s=>s.side===side); const m=L.reduce((a,s)=>a+s.max,0)||1; return L.filter(s=>!s.dead&&!s.gone&&!s.routing).reduce((a,s)=>a+s.hp,0)/m; }
  end(win){ if(this.over) return; this.over=true; const S=this.spec, R=CQ().rewards, X=CQ().xp, P=this.sq.filter(s=>s.side===0);
    const survivors=P.filter(s=>!s.dead&&s.men>=Math.max(1,Math.ceil(s.maxMen*0.25))).map(s=>s.type), lost=P.length-survivors.length, flawless=win&&lost===0;
    let earned=0, xp=this.kills*X.kill; const earn=(r,n)=>{ earned+=n; Tokens.earn(r,n); };
    if(win){ earn('battle',R.battleWin); xp+=X.battleWin; Progress.track('battles'); if(flawless){ earn('flawless',R.flawless); xp+=X.flawless; Progress.track('flawless'); } }
    if(this.champDown){ earn('champion',R.champion); xp+=X.champion; Progress.track('bossKills'); }
    if(this.kills) Progress.track('kills',this.kills); if(this.routs) Progress.track('routs',this.routs);
    let score=Math.round((win?1000:0)+this.strength(0)*800+this.kills*5+(win?Math.max(0,this.limit-this.clock)*2:0)), best=false;
    if(S.mode==='daily'){ best=Conq.dailyRecord(score); if(win&&!Tokens.milestone('cdaily:'+S.day)){ Tokens.setMilestone('cdaily:'+S.day); earn('daily',R.daily); } }
    Progress.addXP(xp,this.hero.def.id); const ev=Progress.takeEvents();
    if(S.mode==='campaign'){ const cp=Conq.camp(S.world); if(cp) Conq.applyBattle(cp,S,{win,survivors,champion:this.champDown}); }
    win?SFX.win():SFX.lose(); const stars=win?(this.strength(0)>0.6?3:this.strength(0)>0.3?2:1):0;
    this.time.delayedCall(900,()=>this.scene.start('BattleEnd',{win,stars,earned,xp,kills:this.kills,routs:this.routs,lost,survivors:survivors.length,spec:S,ev,score,best,hero:this.hero.def.id,champ:this.champDown})); }
}

class BattleEnd extends Phaser.Scene{ constructor(){super('BattleEnd');}
  create(d){ window.__scene=this; backdrop(this,0.7,'bg_'+d.spec.world); const S=d.spec;
    txt(this,W/2,130,d.win?(S.defense?S.land+' holds!':'Victory at '+S.land):(S.defense?S.land+' is lost':'Driven back from '+S.land),50,d.win?GOLD:'#c0392b').setOrigin(0.5);
    if(d.win) txt(this,W/2,192,'★'.repeat(d.stars)+'☆'.repeat(3-d.stars),40,GOLD).setOrigin(0.5);
    txt(this,W/2,248,d.win?'"The battle is the LORD\'s." 1 Samuel 17:47':'"Be strong and of a good courage." Joshua 1:9',21).setOrigin(0.5);
    txt(this,W/2,300,'Foes defeated '+d.kills+'   •   Squads routed '+d.routs+'   •   Your squads lost '+d.lost+'   •   Score '+d.score+(d.best&&S.mode==='daily'?' (NEW BEST)':''),20).setOrigin(0.5);
    txt(this,W/2,345,'Grokonians earned: '+d.earned+'   •   Total: '+Tokens.balance(),26,GOLD).setOrigin(0.5);
    const L=Progress.level(), M=Progress.mastery(d.hero); txt(this,W/2,388,'+'+d.xp+' XP   •   Level '+L.lv+'   •   Mastery '+M.lv+'   •   Battle Pass tier '+Progress.bpTier(),19).setOrigin(0.5);
    (d.ev||[]).slice(0,4).forEach((n,i)=>txt(this,W/2,425+i*26,n,18,'#f2c14e').setOrigin(0.5));
    if(S.mode==='campaign') button(this,W/2-160,600,280,60,'Continue campaign',()=>this.scene.start('Campaign',{world:S.world}),{size:22});
    else button(this,W/2-160,600,280,60,'Try again',()=>this.scene.start('Battle',{spec:Object.assign({},S,{hero:d.hero})}),{size:22});
    button(this,W/2+160,600,280,60,'Battle Pass',()=>this.scene.start('BattlePass'),{size:22}); }
}
