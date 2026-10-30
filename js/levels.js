// Levels: seeded, data-driven level generation + local stars/best scores.
// A level spec is {world, index, diff, mode:'level'|'endless'|'daily'}; build() turns it into
// {path, ark, waves, lives, startManna, mods, boss, ...}. Same spec => same level (seeded RNG).
(function(){
  const KEY='gxhub_wotw_levels_v1'; let s={stars:{},best:{},endless:{},daily:{}}, WD=null, ED=null;
  try{ const r=JSON.parse(localStorage.getItem(KEY)||'null'); if(r) s=Object.assign(s,r); }catch(e){}
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} };
  function hash(str){ let h=2166136261; for(const c of String(str)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
  function rng(seed){ let a=hash(seed); return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const pickW=(R,pool)=>{ const e=Object.entries(pool), tot=e.reduce((a,[,w])=>a+w,0); let r=R()*tot; for(const [k,w] of e){ if((r-=w)<0) return k; } return e[0][0]; };
  const dayKey=()=>{ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  // Serpentine path: alternating horizontal runs and vertical turns, left edge -> camp at right.
  function genPath(R){ const cols=3+Math.floor(R()*3), xs=[]; let x=-40, y=120+Math.floor(R()*420); const pts=[[x,y]];
    for(let i=0;i<cols;i++){ xs.push(Math.round(170+(i+0.15+R()*0.7)*(900/cols))); }
    xs.forEach(cx=>{ pts.push([cx,y]); let ny; do{ ny=100+Math.floor(R()*460); }while(Math.abs(ny-y)<170); y=ny; pts.push([cx,y]); });
    const ay=Math.max(140,Math.min(520,y)); if(ay!==y){ pts.push([1130,y]); pts.push([1130,ay]); } pts.push([1320,ay]); return {path:pts,ark:[1235,ay]}; }
  function enemyMix(R,world,budget,flyMul,countMul){ const groups={}; let left=budget;
    while(left>0){ const k=pickW(R,world.pool), d=ED[k]; const cost=Math.max(6,d.hp/6); left-=cost; groups[k]=(groups[k]||0)+1; }
    return Object.entries(groups).map(([k,n])=>{ const d=ED[k]; n=Math.max(1,Math.round(n*countMul*(d.flying?flyMul:1))); const gap=d.flying?0.35:(d.hp>300?2.4:1.0); return [k,n,gap]; }); }
  const api={
    init(wd,ed){ WD=wd; ED=ed; }, get data(){ return WD; }, dayKey,
    world(id){ return WD.worlds.find(w=>w.id===id); },
    worldOpen(w){ return w.playable&&Progress.accountLevel()>=w.reqAccount; },
    unlockedIndex(wid,diff){ let i=0; while(api.stars(wid,i,diff)>0) i++; return i; }, // next playable node
    stars(wid,i,diff){ return s.stars[wid+':'+i+':'+(diff||'normal')]||0; },
    worldStars(wid){ return Object.entries(s.stars).filter(([k])=>k.startsWith(wid+':')).reduce((a,[,v])=>a+v,0); },
    totalStars(){ return Object.values(s.stars).reduce((a,v)=>a+v,0); },
    best(key){ return s.best[key]||0; }, endlessBest(wid){ return s.endless[wid]||{wave:0,score:0}; }, dailyBest(){ return s.daily[dayKey()]||null; },
    diffOpen(wid,diff){ const D=WD.difficulties[diff]; if(!D.reqStars) return true; return api.worldStars(wid)>=1&&Object.keys(s.stars).some(k=>k.startsWith(wid+':')&&k.endsWith(':'+(diff==='hard'?'normal':'hard'))); },
    dailySpec(){ const R=rng('daily'+dayKey()), ws=WD.worlds.filter(w=>w.playable); const w=ws[Math.floor(R()*ws.length)]; return {mode:'daily',world:w.id,index:4+Math.floor(R()*6),diff:'hard',seed:'daily'+dayKey()}; },
    build(spec){ const w=api.world(spec.world), D=WD.difficulties[spec.diff||'normal'], mode=spec.mode||'level', idx=spec.index||0;
      const seed=spec.seed||(w.id+':'+idx), R=rng(seed);
      const L={spec,world:w,diff:D,mode,name:mode==='endless'?w.name+' — Endless':mode==='daily'?'Daily Challenge — '+w.name+' '+(idx+1):w.name+' — Level '+(idx+1),verse:w.verse,bg:'bg_'+w.id};
      const P=(w.handPath&&idx===0&&mode==='level')?{path:DATA.chapter.path,ark:DATA.chapter.ark}:genPath(R); L.path=P.path; L.ark=P.ark;
      // modifiers: none on level 1, more as you go; daily always 2
      const MK=Object.keys(WD.modifiers), nm=mode==='daily'?2:mode==='endless'?1:(idx===0?0:idx<4?(R()<0.5?1:0):idx<8?1:2); const mods=[];
      while(mods.length<nm){ const m=MK[Math.floor(R()*MK.length)]; if(!mods.includes(m)) mods.push(m); } L.mods=mods;
      const M=mods.map(m=>WD.modifiers[m]), mul=(k)=>M.reduce((a,m)=>a*(m[k]||1),1);
      L.hpMul=D.hp*mul('hpMul'); L.speedMul=D.speed*mul('speedMul'); L.rangeMul=mul('rangeMul'); L.flyMul=mul('flyerMul'); L.countMul=D.count*mul('countMul');
      L.lives=D.lives; L.startManna=Math.round((w.startManna||220)*D.manna); L.xpMul=D.xp;
      L.boss=w.boss; const last=w.levels-1;
      L.bossLevel=mode==='level'&&(idx===last||idx%4===3)||mode==='daily';
      L.nWaves=mode==='endless'?Infinity:(idx===0&&w.handPath&&mode==='level'?DATA.waves.length:Math.min(14,6+Math.floor(idx/2)));
      L.waves=[]; if(idx===0&&w.handPath&&mode==='level'){ L.waves=DATA.waves.map(x=>x.slice()); } else for(let i=0;i<Math.min(L.nWaves,200);i++) L.waves.push(api.wave(L,i,R));
      return L; },
    // wave i (0-based). For endless, the Game asks for waves on demand.
    wave(L,i,R){ R=R||rng(L.spec.world+':w'+i+':'+(L.spec.seed||'')); const w=L.world, E=WD.endless, idx=L.spec.index||0;
      const grow=L.mode==='endless'?(1+E.hpGrowth*i):(1+0.06*idx); const budget=(60+i*45)*grow;
      const g=enemyMix(R,w,budget,L.flyMul,L.countMul*(L.mode==='endless'?1+E.countGrowth*i:1));
      const isLast=L.mode!=='endless'&&i===L.nWaves-1, endBoss=L.mode==='endless'&&(i+1)%E.bossEvery===0;
      if((isLast&&L.bossLevel)||endBoss) g.unshift([w.boss.enemy,1,0]);
      return g; },
    starsFor(lives,max){ return lives>=max?3:(lives>=max/2?2:1); },
    score(r){ const S=WD.score; return r.kills*S.kill+Math.max(0,r.lives)*S.life+r.waves*S.wave+(r.stars||0)*S.star; },
    record(L,r){ const sp=L.spec, sc=api.score(r); let best=false;
      if(L.mode==='level'&&r.win){ const k=sp.world+':'+sp.index+':'+(sp.diff||'normal'); if(r.stars>(s.stars[k]||0)) s.stars[k]=r.stars; }
      if(L.mode==='level'){ const k=sp.world+':'+sp.index+':'+(sp.diff||'normal'); if(sc>(s.best[k]||0)){ s.best[k]=sc; best=true; } }
      if(L.mode==='endless'){ const b=s.endless[sp.world]||{wave:0,score:0}; if(sc>b.score){ s.endless[sp.world]={wave:r.waves,score:sc,diff:sp.diff}; best=true; } }
      if(L.mode==='daily'){ const k=dayKey(), b=s.daily[k]; if(!b||sc>b.score){ s.daily[k]={score:sc,waves:r.waves,stars:r.stars||0,win:r.win}; best=true; } }
      s.lastScore={mode:L.mode,world:sp.world,score:sc,at:Date.now()}; save(); return {score:sc,best}; },
    reset(){ s={stars:{},best:{},endless:{},daily:{}}; save(); }
  };
  window.Levels=api;
})();
