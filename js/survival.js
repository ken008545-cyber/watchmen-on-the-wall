// Survival: endless seeded waves (Radix roster/waves/progression), shop between waves, boss every 10.
// Fight resolution runs on a fixed 1/30 s step with a seeded RNG (no Math.random, no frame deltas).
const SV=()=>window.__SV;
// Horde toughness: waves.json budgets grow 4%/wave but the bank compounds, so enemy hp & dmg also scale (fixed curve, same for everyone).
const svScale=n=>window.SV_SCALE?window.SV_SCALE(n):1.5+0.05*n;            // data/survival.json
const SV_KEY='gxhub_survival_v1', STEP=1/30, MAXP=8, MAXE_ON=9, SQ_MEN=3;
const SVsave={ load(){ try{ return JSON.parse(localStorage.getItem(SV_KEY))||{}; }catch(e){ return {}; } },
  get(){ const s=this.load(); s.best=s.best||0; s.daily=s.daily||{}; s.runs=s.runs||0; s.ms=s.ms||{}; return s; },
  put(s){ try{ localStorage.setItem(SV_KEY,JSON.stringify(s)); }catch(e){} } };
const svDay=()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
// atlas frame lookup: painted tiers for player units, flat Formara atlas, else the old 'spr' atlas
function svFrame(s,id,tier,pose){ const T=s.textures; pose=pose?'_'+pose:'';
  if(tier&&T.exists('up')&&T.get('up').has(id+'_t'+tier+pose)) return ['up',id+'_t'+tier+pose];
  if(T.exists('ua')&&T.get('ua').has(id+pose)) return ['ua',id+pose];
  if(T.exists('ua')&&T.get('ua').has(id)) return ['ua',id];
  return ['spr',id]; }
const SVCOST={}; // shop cost cache
function svWaveInfo(n){ const L=SV().waveList; if(n<=L.length) return L[n-1];
  const last=L[L.length-1], b=Math.round(SV().waves.endless.budget100*Math.pow(1.04,n-100)); return {wave:n,budget:b,pool:last.pool,boss:n%10===0?(n%20===0?'gatekeeper':'goliath'):null}; }

class Survival extends Battle{
  constructor(){ super('Survival'); }
  init(d){ d=d||{}; const day=svDay(); this.daily=!!d.daily; this.seed=d.seed||(this.daily?'surv:'+day:'surv:free:'+(SVsave.get().runs+1)+':'+day);
    this.R=Conq.rng(this.seed); this.spec={world:'elah',diff:'normal',player:[],enemy:[],terrain:this.seed+':t',enemyColor:'0xa33b20',enemyName:'The Horde',land:'the Valley',hero:d.hero,mode:'survival'}; }
  rand(){ return this.R(); }
  later(ms,fn){ this.q.push({t:this.simT+ms/1000,fn}); }
  get FL(){ return {side:1.25,rear:1.5}; } // STRATEGY flank +25%, rear +50%
  multOf(a,d,o){ const S=SV(); if(a.isHero||!a.def||!d.def||d.isHero) return 1.6;
    let m=((S.counters[a.def.cls]||{})[d.def.cls])||1; m*=1-(d.def.armor||0)*S.armorPerPoint; m*=2.5; // pace: roster dmg per sec vs BMUL
    if(this.night&&a.def.cls==='cavalry') m*=1+S.mechanics.night.cavalryAmbushBonus;
    if(d.side===0&&this.form==='scatter'&&(a.def.trample||a.def.champ)) m*=0.6;
    if(d.side===0&&this.form==='shieldwall'&&o&&o.ranged) m*=S.mechanics.formations.shieldWall.arrowDamageMul;
    if(a.side===0&&this.form==='wedge'&&a.def.mounted&&a.chargeReady) m*=1.25;
    return m; }
  rangeOf(s){ return super.rangeOf(s)*(this.night&&s.def.range?1-SV().mechanics.night.archerRangeLoss:1); }
  // ---------- unit defs from Radix roster ----------
  defOf(id,side,w,tier){ const S=SV(), u=side?S.enemies[id]:S.units[id], up=side?{}:this.upStat(id), k=x=>1+Math.min(S.upgradeCap,up[x]||0);
    const boss=u.class==='giant'||id==='goliath'||id==='gatekeeper', men=side?(boss?1:Math.max(1,Math.min(4,w))):SQ_MEN, wt=side?(boss?w:w/men):w;
    const es=side?svScale(this.run?this.run.wave:1):1;
    const ranged=u.range>=100, heal=u.healPerSec?u.healPerSec*k('healPerSec'):0;
    return {id,name:u.name,short:u.name.split(' ').pop(),cls:u.class,armor:(u.armor||0)*k('armor'),hp:u.hp*k('hp')*wt*es,dmg:u.damage*k('damage')*k('chargeDamage')*wt*es,rate:1/(u.attackSpeed*k('attackSpeed')),
      range:ranged?u.range*1.1*k('range'):0,reach:ranged?0:Math.max(0,(u.range-40)*0.5),speed:u.moveSpeed*0.55*k('moveSpeed'),men,mounted:u.class==='cavalry',charge:u.class==='cavalry'?1.5:0,heal,trample:u.class==='giant'||!!u.trample,
      champ:id==='goliath'||id==='gatekeeper',pierce:!!u.armorBreak,h:boss?(id==='golem'?90:130):u.class==='cavalry'?56:46,frame:svFrame(this,id,side?0:this.tierOf(id)),cost:u.cost,bud:u.budgetCost,split:u.split,w}; }
  addSquad(side,id,w){ const def=this.defOf(id,side,w||1);
    const s={side,type:id,def,drill:0,men:def.men,maxMen:def.men,manHp:def.hp,x:0,y:0,face:side?Math.PI:0,state:side?'ai':'follow',cd:this.rand(),morale:100,stun:0,buff:0,slow:0,moved:0,chargeReady:!!def.charge,spr:[],gone:false,dead:false,routing:false,slot:{d:0,l:0},id:this.sq.length};
    s.hp=s.manHp*s.men; s.max=s.hp;
    for(let i=0;i<def.men;i++){ const im=this.add.image(0,0,def.frame[0],def.frame[1]); im.setScale(def.h/im.height); im.baseScale=im.scaleX; im.setFlipX(!!side); im.ph=this.rand()*6; s.spr.push(im); }
    s.flag=this.add.rectangle(0,0,14,9,side?0xa33b20:0xd9a441).setStrokeStyle(1,0x140c07).setDepth(11); s.pole=this.add.rectangle(0,0,2,24,0x3a2a14).setDepth(11);
    this.sq.push(s); return s; }
  layout(side){ if(side) return; const L=this.alive(0); L.forEach((s,i)=>{ s.x=200+(s.def.range?-60:s.def.heal?-110:30); s.y=200+((i*83)%300); }); }
  assignSlots(){ const L=this.alive(0), f=this.form||'line', sp=f==='scatter'?1.6:1, front=L.filter(s=>!s.def.range&&!s.def.heal&&!s.def.mounted).sort((a,b)=>(a.def.cls==='shield'?-1:0)-(b.def.cls==='shield'?-1:0)), back=L.filter(s=>s.def.range), wing=L.filter(s=>s.def.mounted), rear=L.filter(s=>s.def.heal&&!s.def.range);
    const row=(a,d)=>a.forEach((s,i)=>s.slot={d,l:(i-(a.length-1)/2)*66*sp}); row(front,60); row(back,-55*sp); row(rear,-115*sp); const fw=Math.max(1,front.length)*33*sp+70;
    if(f==='wedge') wing.forEach((s,i)=>s.slot={d:130+(i>>1)*-40,l:(i%2?1:-1)*(20+(i>>1)*40)}); else wing.forEach((s,i)=>s.slot={d:10-Math.floor(i/2)*55,l:(i%2?1:-1)*fw}); }
  // ---------- run state ----------
  create(){ window.__scene=this; window.__SV=window.__SV||this.cache.json.get('surv'); this.q=[]; this.simT=0; this.acc=0; this.pending=[];
    this.run={wave:0,manna:SV().waves.income.startManna,owned:{},tiers:{},grok:0,xp:0,kills:0};
    this.form='line'; this.phase='shop'; this.limit=1e9;
    super.create(); this.over=false; this._toast&&this._toast.destroy();
    this.nightFx=this.add.rectangle(W/2,HUD_Y/2,W,HUD_Y,0x0a1430,0.38).setDepth(20).setVisible(false);
    this.add.image(20,HUD_Y-24,'food').setDisplaySize(1,1).setVisible(false);
    this.buy('militia'); this.mountDOM(); this.openShop(true);
    this.events.once('shutdown',()=>this.unmountDOM()); }
  upStat(id){ const t=(this.run&&this.run.tiers[id])||{}, U=(SV().upgrades||{})[id]||{}, o={}; const add=x=>Object.entries(x||{}).forEach(([k,v])=>{ if(typeof v==='number') o[k]=(o[k]||0)+v; });
    if(t.t>=1) add(U.t1); if(t.t>=2) add((U.t2||{})[t.b||'A']); if(t.t>=3) add(U.t3); return o; }
  tierOf(id){ const t=((this.run&&this.run.tiers[id])||{}).t||0; return Math.max(1,Math.min(3,t)); }
  unlockedUnits(){ const n=Math.max(1,this.run.wave+1); return Object.values(SV().units).filter(u=>(u.unlockLevel-1)*3+1<=n).map(u=>u.id); }
  priceOf(id){ const own=this.alive(0).filter(s=>s.type===id).length; return Math.round(SV().units[id].cost*SQ_MEN*Math.pow(1.15,own)); } // repeats cost +15%
  buy(id,free){ const P=this.alive(0), c=this.priceOf(id); if(!free&&this.run.manna<c) return this.toast('Not enough manna');
    if(!free) this.run.manna-=c;
    if(P.length>=MAXP){ const t=P.filter(s=>s.type===id).sort((a,b)=>a.def.w-b.def.w)[0]||P.sort((a,b)=>a.def.w-b.def.w)[0]; this.reweight(t,t.def.w+1); this.toast(t.def.name+' reinforced (x'+t.def.w+')',900); }
    else { const s=this.addSquad(0,id,1); s.x=170+this.rand()*60; s.y=150+this.rand()*320; s.state='follow'; }
    this.assignSlots(); return true; }
  reweight(s,w){ const f=s.hp/s.max, d=this.defOf(s.type,0,w); Object.assign(s.def,d); s.manHp=d.hp; s.max=d.hp*s.maxMen; s.hp=s.max*f; this.syncMen(s); }
  retier(id){ this.alive(0).filter(s=>s.type===id).forEach(s=>{ this.reweight(s,s.def.w); const fr=s.def.frame; s.spr.forEach(im=>{ im.setTexture(fr[0],fr[1]); im.setScale(s.def.h/im.height); im.baseScale=im.scaleX; }); }); }
  // ---------- waves ----------
  buildWave(n){ const S=SV(), info=svWaveInfo(n), R=Conq.rng(this.seed+':w'+n), counts={}; let bud=info.budget;
    const pool=info.pool.filter(id=>S.enemies[id]&&id!=='goliath'&&id!=='gatekeeper');
    if(info.boss){ const b=S.enemies[info.boss]; const nb=Math.max(1,Math.floor(bud*0.8/b.budgetCost)); counts[info.boss]=Math.min(info.boss==='goliath'||info.boss==='gatekeeper'?1:nb,nb); bud-=counts[info.boss]*b.budgetCost; if(n>=50&&info.boss!=='goliath'&&info.boss!=='gatekeeper') {} }
    const mine=this.alive(0).map(s=>s.def.cls), top=mine.sort((a,b)=>mine.filter(x=>x===b).length-mine.filter(x=>x===a).length)[0];
    const counterers=pool.filter(id=>((S.counters[S.enemies[id].class]||{})[top]||1)>1);
    let guard=0; while(bud>=Math.min(...pool.map(id=>S.enemies[id].budgetCost))&&guard++<5000){ const use=counterers.length&&R()<0.3?counterers:pool, id=use[Math.floor(R()*use.length)], c=S.enemies[id].budgetCost; if(c>bud) continue; counts[id]=(counts[id]||0)+1; bud-=c; }
    const total=Object.values(counts).reduce((a,b)=>a+b,0), per=Math.max(4,Math.ceil(total/14)), out=[];
    Object.entries(counts).forEach(([id,c])=>{ const big=S.enemies[id].class==='giant'||id==='goliath'||id==='gatekeeper'; const per2=big?Math.max(1,Math.ceil(c/3)):per; for(let left=c;left>0;left-=per2) out.push([id,Math.min(per2,left)]); });
    for(let i=out.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
    return {info,squads:out,total}; }
  startWave(){ const n=++this.run.wave; this.closeShop(); this.night=n%4===0; this.nightFx.setVisible(this.night);
    this.sq=this.sq.filter(s=>{ if(s.side===1||s.dead){ s.spr.forEach(i=>i.destroy()); s.flag.destroy&&s.flag.destroy(); s.pole.destroy&&s.pole.destroy(); return false; } return true; });
    this.alive(0).forEach(s=>{ s.state='follow'; s.routing=false; s.morale=100; });
    const W8=this.buildWave(n); this.pending=W8.squads; this.waveTotal=W8.total; this.waveBoss=W8.info.boss; this.clock=0; this.aiT=1.5; this.phase='fight';
    this.spawnTick(true); this.toast('Wave '+n+(this.night?' — NIGHT (archers −30% range, cavalry +25%)':'')+(W8.info.boss?'\nBOSS: '+SV().enemies[W8.info.boss].name:''),2200); SFX.trumpet(); this.assignSlots(); }
  spawnTick(first){ let k=0; while(this.pending.length&&this.fighting(1).length<MAXE_ON&&(first||k<1)){ const [id,c]=this.pending.shift(), s=this.addSquad(1,id,c); s.x=W+30+(first?this.rand()*80:0); s.y=90+this.rand()*(HUD_Y-170); s.state='ai'; k++; } }
  kill(s){ super.kill(s); if(s.side===1){ this.run.kills+=s.def.w*(s.def.men?1:1); if(s.def.split&&SV().enemies[s.def.split]){ const c=Math.max(1,Math.round(s.def.w*s.def.men)); const f=this.addSquad(1,s.def.split,Math.min(c*2,12)); f.x=s.x; f.y=s.y; f.state='ai'; } } }
  rout(s){ if(s.side===1){ s.morale=45; s.stun=Math.max(s.stun,0.6); return; } return super.rout(s); } // the horde does not flee; it staggers
  waveCleared(){ const S=SV(), n=this.run.wave, info=svWaveInfo(n), inc=S.waves.income; this.phase='shop';
    const gain=Math.round(inc.perWaveBase+info.budget*3*inc.bountyFraction); this.run.manna+=gain; this.run.xp+=10+(info.boss?40:0);
    const sv=SVsave.get(); if(n>sv.best) sv.best=n; if(this.daily) sv.daily[svDay()]=Math.max(sv.daily[svDay()]||0,n);
    let note='+'+gain+' manna';
    if(n%5===0&&this.run.grok<10){ this.run.grok++; Tokens.earn('survival:wave',1); note+='  •  +1 Grokonian'; }   // PROGRESSION §11: 1 per 5 waves, max 10/run
    if(n%5===0&&!sv.ms[n]){ sv.ms[n]=1; this.run.xp+=50; note+='  •  Milestone: wave '+n+'!'; }
    SVsave.put(sv); this.sq.forEach(s=>{ if(s.side===0&&s.gone&&!s.dead){ s.gone=false; s.routing=false; s.hp=Math.max(s.hp,s.max*0.3); s.x=120; s.y=330; s.spr.forEach(i=>i.setVisible(true)); s.flag.setVisible(true); s.pole.setVisible(true); this.syncMen(s); } });
    this.alive(0).forEach(s=>{ s.hp=Math.min(s.max,s.hp+s.max*0.25); this.syncMen(s); }); this.hero.hp=this.hero.max; if(this.hero.down>0){ this.hero.down=0; this.hero.spr.setAlpha(1); }
    SFX.win&&SFX.win(); this.openShop(false,'Wave '+n+' survived!  '+note); }
  // ---------- shop ----------
  openShop(first,head){ this.closeShop(); const c=this.shop=this.add.container(0,0).setDepth(60), sv=SVsave.get(), nx=this.run.wave+1, ni=svWaveInfo(nx);
    const g=this.add.graphics(); g.fillStyle(0x140c07,0.93).fillRoundedRect(60,70,W-120,530,14).lineStyle(3,0xd9a441).strokeRoundedRect(60,70,W-120,530,14); c.add(g);
    c.add(txt(this,W/2,84,head||(this.daily?'Daily Survival — seed '+svDay():'Survival')+'   •   Best wave '+sv.best,24,GOLD).setOrigin(0.5,0));
    c.add(txt(this,W/2,118,'Manna '+this.run.manna+'   •   Squads '+this.alive(0).length+'/'+MAXP+'   •   Next: wave '+nx+(nx%10===0?' (BOSS)':'')+(nx%4===0?' (night)':'')+'   •   Goal: wave '+(Math.floor(sv.best/5)+1)*5,18,'#efe2bf').setOrigin(0.5,0));
    this.shopManna=c.list[c.list.length-1];
    const U=this.unlockedUnits(); U.forEach((id,i)=>{ const u=SV().units[id], x=150+(i%5)*245, y=200+Math.floor(i/5)*150, fr=svFrame(this,id,this.tierOf(id));
      const im=this.add.image(x-80,y,fr[0],fr[1]); im.setScale(54/im.height); c.add(im);
      c.add(txt(this,x-45,y-40,u.name,15,GOLD)); c.add(txt(this,x-45,y-20,u.class+'  hp '+u.hp+'  dmg '+u.damage,12,'#efe2bf'));
      const b=button(this,x+5,y+12,110,34,'Buy '+this.priceOf(id),()=>{ if(this.buy(id)) this.openShop(first,head); },{size:14,disabled:this.run.manna<this.priceOf(id)}); c.add(b);
      const T=(this.run.tiers[id]||{}).t||0, owned=this.alive(0).some(s=>s.type===id), UP=SV().upgrades[id];
      if(owned&&UP&&T<3){ const cost=Math.round(u.cost*SQ_MEN*(T+1)); if(T===1){ ['A','B'].forEach((k,j)=>c.add(button(this,x-55+j*115,y+52,110,32,UP.t2[k].name+' '+cost,()=>this.upgrade(id,cost,k,first,head),{size:12,disabled:this.run.manna<cost}))); }
        else c.add(button(this,x+5,y+52,220,32,(T===0?'Drill t1':UP.t3.name)+'  '+cost,()=>this.upgrade(id,cost,null,first,head),{size:13,disabled:this.run.manna<cost})); }
      else if(owned&&T>=3) c.add(txt(this,x-45,y+44,'Max tier',13,'#8fd06a')); });
    const go=button(this,W/2,555,300,54,first?'Start wave 1 ▶':'Next wave ▶',()=>this.startWave(),{size:22}); c.add(go); this.goBtn=go;
    c.add(button(this,180,555,200,46,'Quit run',()=>this.end(false,true),{size:16}));
    this.shopT=first?0:20; this.shopTxt=txt(this,W-200,555,'',16,'#efe2bf').setOrigin(0.5); c.add(this.shopTxt); this.domShow(false); }
  upgrade(id,cost,branch,first,head){ if(this.run.manna<cost) return; this.run.manna-=cost; const t=this.run.tiers[id]=this.run.tiers[id]||{t:0}; t.t++; if(branch) t.b=branch; this.retier(id); SFX.build&&SFX.build(); this.openShop(first,head); }
  closeShop(){ if(this.shop){ this.shop.destroy(); this.shop=null; } this.domShow(true); }
  // ---------- DOM command rails (Formara) ----------
  mountDOM(){ const el=document.getElementById('wcui'); if(!el) return; document.body.classList.add('wc-on'); this.ui=window.WCUI&&window.WCUI();
    this._wc=e=>{ const d=e.detail||{}; if(this.phase!=='fight') return; if(d.cmd==='move') this.command('follow'); else if(d.cmd==='attack') this.command('charge'); else if(d.cmd==='hold') this.command('hold'); else if(d.cmd==='retreat') this.command('fallback'); else if(d.cmd==='formation'&&d.form) this.setForm(d.form); };
    window.addEventListener('wc:command',this._wc); }
  unmountDOM(){ document.body.classList.remove('wc-on','wc-shop'); if(this._wc) window.removeEventListener('wc:command',this._wc); }
  domShow(on){ document.body.classList.toggle('wc-shop',!on); }
  setForm(f){ this.form=f; const G=this.alive(0); G.forEach(s=>s.wall=false);
    if(f==='shieldwall') this.command('wall'); else { this.command('follow'); } this.assignSlots(); this.toast('Formation: '+({line:'Line',wedge:'Wedge (cavalry charge +25%)',shieldwall:'Shield Wall (arrows −50%, slow)',scatter:'Scatter (area/trample −40%)'})[f],1200); }
  buildHUD(){ const bar=this.add.graphics().setDepth(40); bar.fillStyle(0x1a110a,0.95).fillRect(0,HUD_Y,W,H-HUD_Y).lineStyle(3,0xd9a441).lineBetween(0,HUD_Y,W,HUD_Y);
    this.top=this.add.graphics().setDepth(40); this.stat=txt(this,W/2,HUD_Y-26,'',17).setOrigin(0.5,0).setDepth(41); this.ordTxt=txt(this,12,HUD_Y-26,'',15,'#f2c14e').setDepth(41);
    this.cmdBtn={}; [['flankL','Flank ↑'],['flankR','Flank ↓'],['volley','Volley'],['ride','Ride Down']].forEach(([id,n],i)=>{ const b=button(this,95+i*180,HUD_Y+55,170,84,n,()=>this.command(id),{size:20}); b.setDepth(41); this.cmdBtn[id]=b; });
    this.chips={}; const h=this.hero.def; this.skillBtns=[]; [...h.skills,h.ult].forEach((k,i)=>{ const b=button(this,820+i*170,HUD_Y+55,160,84,k.name,()=>this.useSkill(i),{size:16}); b.setDepth(41); b.cd=i===2?20:4; b.def=k; this.skillBtns.push(b); }); this.refreshHUD(); }
  refreshHUD(){ const g=this.group(), st=g.length?g[0].state:'-'; Object.entries(this.cmdBtn).forEach(([id,b])=>b.redraw(this.pend===id||(id==='flankL'&&st==='flank'&&g[0].flankDir<0)||(id==='flankR'&&st==='flank'&&g[0].flankDir>0)));
    this.ordTxt&&this.ordTxt.setText(this.pend?(this.pend==='volley'?'Tap where to volley':'Tap the enemy to ride down'):(this.selSq?'Selected: '+this.selSq.def.name:'')); }
  command(id){ if(this.phase!=='fight'||id==='wall'&&false) return; return super.command(id); }
  onTap(p){ if(this.phase!=='fight') return; return super.onTap(p); }
  // ---------- fixed-step loop ----------
  step(){ const dt=STEP, h=this.hero; this.simT+=dt; this.clock+=dt;
    if(this.q.length){ const due=this.q.filter(e=>e.t<=this.simT); this.q=this.q.filter(e=>e.t>this.simT); due.forEach(e=>e.fn()); }
    if(h.down>0){ h.down-=dt; if(h.down<=0){ h.hp=h.max*0.6; h.spr.setAlpha(1); h.x=h.tx=90; h.y=h.ty=330; } }
    else { const dx=h.tx-h.x, dy=h.ty-h.y, dl=Math.hypot(dx,dy); if(dl>3){ const T=this.terr(h.x,h.y), st=Math.min(dl,h.def.speed*0.75*(T.river?0.5:1)*dt); h.x+=dx/dl*st; h.y+=dy/dl*st; if(dl>20) h.face=Math.atan2(dy,dx); }
      h.hp=Math.min(h.max,h.hp+h.max*0.008*dt); h.cd-=dt; if(h.cd<=0){ const E=this.alive(1).filter(e=>dist(e,h)<Math.max(70,h.def.range)).sort((a,b)=>dist(a,h)-dist(b,h))[0];
        if(E){ h.cd=h.def.rate; if(h.def.range<80) this.damage(h,E,h.dmg*1.4); else this.missile(h,E,'stone',()=>this.damage(h,E,h.dmg,{ranged:true})); } } }
    this.aiT-=dt; if(this.aiT<=0){ this.aiT=this.D.react; this.think(); }
    this.sq.forEach(s=>this.tickSquad(s,dt)); this.separate();
    this.skillBtns.forEach(b=>{ if(b.cd>0) b.cd-=dt; });
    if(this.clock>90) this.alive(1).forEach(s=>{ s.morale=Math.max(s.morale,60); });
    if((this._st=(this._st||0)+1)%15===0) this.spawnTick(false);
    if(this.fighting(1).length===0&&!this.pending.length){ this.alive(1).forEach(s=>{ s.gone=true; s.spr.forEach(i=>i.setVisible(false)); s.flag.setVisible(false); s.pole.setVisible(false); }); return this.waveCleared(); }
    if(this.fighting(0).length===0&&h.down>0) return this.end(false); }
  fast(n){ for(let i=0;i<n&&this.phase==='fight'&&!this.over;i++) this.step(); }   // test hook: n fixed steps
  hashState(){ return Conq.hash(this.sq.filter(s=>!s.dead).map(s=>s.type+':'+Math.round(s.x)+':'+Math.round(s.y)+':'+Math.round(s.hp)).join('|')+'#'+this.run.wave); }
  update(time,delta){ if(this.over) return;
    if(this.phase==='fight'){ this.acc+=Math.min(delta,250)/1000; while(this.acc>=STEP&&this.phase==='fight'&&!this.over){ this.acc-=STEP; this.step(); } }
    else if(this.shopT>0&&this.shop){ this.shopT-=delta/1000; this.shopTxt.setText('Auto-start in '+Math.ceil(this.shopT)+'s'); if(this.shopT<=0) return this.startWave(); }
    this.render(time); this.walkFrames(time);
    this.skillBtns.forEach(b=>{ if(b.cd>0){ b.label.setText(b.def.name+' '+Math.ceil(b.cd)+'s'); b.alpha=0.5; } else { b.label.setText(b.def.name); b.alpha=1; } });
    const E=this.alive(1), foes=Math.round(E.reduce((a,s)=>a+s.def.w*s.men,0)+this.pending.reduce((a,p)=>a+p[1],0)), P=this.alive(0);
    const mor=P.length?P.reduce((a,s)=>a+s.morale,0)/P.length:0, sv=SVsave.get();
    this.stat.setText('Wave '+this.run.wave+(this.night?' (night)':'')+'   •   Foes '+foes+'   •   Manna '+this.run.manna+'   •   Best '+sv.best);
    this._uiT=(this._uiT||0)+1; if(this.ui&&this._uiT%6===0){ this.ui.setArmy({all:Math.round(P.reduce((a,s)=>a+s.men*s.def.w,0))},foes); this.ui.setMorale(mor); this.ui.setFood(P.length,MAXP); const w=document.getElementById('wcWave'); if(w) w.textContent=this.run.wave; } }
  walkFrames(time){ const f=Math.floor(time/180)%2; this.sq.forEach(s=>{ if(s.dead||s.gone) return; const fr=s.def.frame; if(fr[0]==='spr') return; const base=fr[1]; const pose=s.engaged?'_atk_'+f:(s.moved>0.1||s.state!=='hold'?'_walk_'+f:'');
      const k=base+pose, tex=this.textures.get(fr[0]); if(!tex.has(k)) return; s.spr.forEach(im=>{ if(im.frame.name!==k) im.setFrame(k); }); }); }
  end(win,quit){ if(this.over) return; this.over=true; this.phase='over'; const n=this.run.wave, reached=Math.max(0,n-(quit?0:1)), sv=SVsave.get(); sv.runs++; if(reached>sv.best) sv.best=reached; SVsave.put(sv);
    Progress.track('kills',this.run.kills|0); Progress.addXP(this.run.xp+reached*5,this.hero.def.id); Progress.takeEvents(); SFX.lose&&SFX.lose(); this.unmountDOM();
    const c=this.add.container(0,0).setDepth(80), g=this.add.graphics(); g.fillStyle(0x000000,0.7).fillRect(0,0,W,H); g.fillStyle(0x1a110a,0.97).fillRoundedRect(W/2-330,160,660,360,14).lineStyle(3,0xd9a441).strokeRoundedRect(W/2-330,160,660,360,14); c.add(g);
    c.add(txt(this,W/2,190,quit?'Run ended':'Your army has fallen',34,GOLD).setOrigin(0.5,0));
    c.add(txt(this,W/2,250,'Waves survived: '+reached+'\nBest wave: '+sv.best+(this.daily?'\nDaily best today: '+(sv.daily[svDay()]||0):'')+'\nGrokonians this run: '+this.run.grok+'   Kills: '+Math.round(this.run.kills),20,'#efe2bf',{align:'center'}).setOrigin(0.5,0));
    c.add(button(this,W/2-150,460,260,56,'Try again',()=>this.scene.restart({daily:this.daily,hero:this.spec.hero}),{size:20}));
    c.add(button(this,W/2+150,460,260,56,'Menu',()=>this.scene.start('Menu'),{size:20})); }
}
window.Survival=Survival; window.SVsave=SVsave;
