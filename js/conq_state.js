// Conquest campaign state: seeded territory maps per world, economy, AI factions, counter-picking army builder.
// Saved locally only (localStorage). Grokonians still go through Tokens.earn -> GXHub (persisted queue).
window.Conq=(function(){
  const KEY='gxhub_conquest_campaign_v1', RKEY='gxhub_conquest_records_v1', DKEY='gxhub_conquest_daily_v1';
  let C=null, camps={}, recs={}, daily={};
  try{ camps=JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){} try{ recs=JSON.parse(localStorage.getItem(RKEY)||'{}'); }catch(e){} try{ daily=JSON.parse(localStorage.getItem(DKEY)||'{}'); }catch(e){}
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(camps)); localStorage.setItem(RKEY,JSON.stringify(recs)); localStorage.setItem(DKEY,JSON.stringify(daily)); }catch(e){} };
  function hash(str){ let h=2166136261; for(const c of String(str)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
  function rng(seed){ let a=hash(seed); return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const U=()=>C.units, cost=t=>C.units[t].gold, dayKey=()=>new Date().toISOString().slice(0,10);
  const TYPES=['sword','shield','spear','archer','horse','slinger','chariot','healer'];
  function tierTypes(bar){ return TYPES.filter(t=>C.units[t].bar<=bar); }
  // ---- counter-picking army builder (the AI looks at YOUR composition) ----
  function buildArmy(budget,playerComp,diff,R,bar,maxN){ R=R||Math.random; const D=C.difficulty[diff]||C.difficulty.normal, ok=tierTypes(bar||3);
    const base=['sword','spear','archer','sword','shield','horse','archer','spear','slinger','healer','chariot'].filter(t=>ok.includes(t));
    const out=[]; let left=budget*D.budget, guard=0; const pc=(playerComp&&playerComp.length)?playerComp:['sword'];
    while(left>=30&&out.length<(maxN||C.maxSquads)&&guard++<60){ let t;
      if(R()<D.counter){ const victim=pc[Math.floor(R()*pc.length)], opts=(C.counter[victim]||['sword']).filter(x=>ok.includes(x)); t=opts.length?opts[Math.floor(R()*opts.length)]:'sword'; }
      else t=base[Math.floor(R()*base.length)];
      if(t==='healer'&&out.filter(x=>x==='healer').length>=1) t='sword';
      if(cost(t)>left) t=ok.filter(x=>cost(x)<=left).sort((a,b)=>cost(b)-cost(a))[0]; if(!t) break;
      out.push(t); left-=cost(t); }
    if(!out.length) out.push('sword'); return out; }
  // ---- territory graph ----
  function genMap(world,seed){ const R=rng(seed), names=C.names[world]||C.names.elah, n=12+Math.floor(R()*2), pts=[];
    let tries=0; while(pts.length<n&&tries++<4000){ const x=110+R()*1060, y=110+R()*420; if(pts.every(p=>Math.hypot(p.x-x,p.y-y)>150)) pts.push({x:Math.round(x),y:Math.round(y)}); }
    pts.sort((a,b)=>a.x-b.x); const T=pts.map((p,i)=>({id:i,x:p.x,y:p.y,name:names[i%names.length],owner:'n',gold:8+Math.floor(R()*10),food:4+Math.floor(R()*8),bar:0,army:[],str:0}));
    const E=new Set(), key=(a,b)=>a<b?a+'-'+b:b+'-'+a;
    T.forEach(t=>{ T.filter(o=>o!==t).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y)).slice(0,2+(R()<0.4?1:0)).forEach(o=>{ if(Math.hypot(o.x-t.x,o.y-t.y)<420) E.add(key(t.id,o.id)); }); });
    // connectivity (union by nearest pair)
    const comp=T.map((_,i)=>i), f=i=>comp[i]===i?i:(comp[i]=f(comp[i])); E.forEach(k=>{ const [a,b]=k.split('-').map(Number); comp[f(a)]=f(b); });
    for(let guard=0;guard<30;guard++){ const roots=[...new Set(T.map(t=>f(t.id)))]; if(roots.length<2) break; let best=null;
      T.forEach(a=>T.forEach(b=>{ if(f(a.id)!==f(b.id)){ const d=Math.hypot(a.x-b.x,a.y-b.y); if(!best||d<best[2]) best=[a.id,b.id,d]; } })); E.add(key(best[0],best[1])); comp[f(best[0])]=f(best[1]); }
    // owners: player far left, rival A far right top, rival B far right bottom
    const P=T[0], right=T.slice(-4), A=right.sort((a,b)=>a.y-b.y)[0], B=right.filter(t=>t!==A).sort((a,b)=>b.y-a.y)[0];
    P.owner='p'; P.bar=1; P.capital=true; A.owner='a'; A.capital=true; A.bar=3; B.owner='b'; B.capital=true; B.bar=2;
    T.forEach(t=>{ const d=Math.hypot(t.x-P.x,t.y-P.y); if(t.owner==='n') t.str=Math.round(150+d*0.28+R()*60); if(t.owner==='a'||t.owner==='b'){ t.str=t.capital?520:300; } });
    A.str=620; return {terr:T,edges:[...E].map(k=>k.split('-').map(Number))}; }
  function adj(cp,id){ return cp.edges.filter(e=>e[0]===id||e[1]===id).map(e=>e[0]===id?e[1]:e[0]); }
  function strOf(cp,t){ return t.owner==='p'?t.army.reduce((a,u)=>a+cost(u)*(1+0.1*(cp.drill[u]||0)),0):t.str; }
  function playerComp(cp){ return cp.terr.filter(t=>t.owner==='p').flatMap(t=>t.army); }
  const api={
    init(c){ C=c; }, get data(){ return C; }, rng, hash, buildArmy, TYPES, adj, strOf, tierTypes,
    camp(world){ return camps[world]; },
    newCampaign(world,diff,hero){ const seed=world+':'+diff+':'+Date.now(); const m=genMap(world,seed);
      m.terr[0].army=C.start.army.slice(); camps[world]={world,diff,seed,hero:hero||'david',turn:1,gold:C.start.gold,food:C.start.food,drill:{},moved:{},log:['Turn 1: your army gathers at '+m.terr[0].name+'.'],terr:m.terr,edges:m.edges,done:null,pendingDefense:null,battles:0,champDown:false};
      save(); return camps[world]; },
    setHero(world,h){ if(camps[world]){ camps[world].hero=h; save(); } },
    income(cp){ const own=cp.terr.filter(t=>t.owner==='p'), sq=own.reduce((a,t)=>a+t.army.length,0); return {gold:own.reduce((a,t)=>a+t.gold,0),food:own.reduce((a,t)=>a+t.food,0)-sq*2}; },
    canRecruit(cp,t,type){ const u=C.units[type]; return t.owner==='p'&&t.bar>=u.bar&&cp.gold>=u.gold&&cp.food>=u.food&&t.army.length<C.maxSquads; },
    recruit(cp,t,type){ if(!api.canRecruit(cp,t,type)) return false; const u=C.units[type]; cp.gold-=u.gold; cp.food-=u.food; t.army.push(type); Progress.track('recruits'); save(); return true; },
    barCost(t){ return C.barracks[t.bar+1]; },
    build(cp,t){ const c=api.barCost(t); if(t.owner!=='p'||t.bar>=3||cp.gold<c) return false; cp.gold-=c; t.bar++; save(); return true; },
    drillCost(cp,type){ return C.drill.cost[cp.drill[type]||0]; },
    drill(cp,type){ const c=api.drillCost(cp,type); if(c==null||cp.gold<c) return false; cp.gold-=c; cp.drill[type]=(cp.drill[type]||0)+1; Progress.track('drills'); save(); return true; },
    move(cp,from,to,types){ if(from.owner!=='p'||to.owner!=='p'||cp.moved[from.id]) return false; const n=Math.min(types.length,C.maxSquads-to.army.length); const go=types.slice(0,n); go.forEach(g=>{ const i=from.army.indexOf(g); if(i>=0) from.army.splice(i,1); }); to.army.push(...go); cp.moved[to.id]=true; save(); return true; },
    // Battle spec for an attack or a defense.
    battleSpec(cp,from,to,defense){ const R=rng(cp.seed+':b'+cp.turn+':'+to.id+':'+cp.battles), fac=C.factions[cp.world]||C.factions.elah;
      const enemyOwner=defense?from.owner:to.owner, playerTerr=defense?to:from, pc=playerTerr.army.slice();
      const bud=defense?Math.round(from.str*0.6):to.str, bar=enemyOwner==='n'?1:(cp.turn>6?3:2);
      const champ=!defense&&to.capital&&enemyOwner==='a'&&!cp.champDown?(fac[0].champion):null;
      return {mode:'campaign',world:cp.world,diff:cp.diff,hero:cp.hero,from:from.id,to:to.id,defense:!!defense,player:pc,drill:Object.assign({},cp.drill),
        enemy:buildArmy(bud,pc,cp.diff,R,bar),enemyOwner,enemyColor:enemyOwner==='n'?'0x8a8070':(fac.find(f=>f.id===enemyOwner)||fac[0]).color,
        enemyName:enemyOwner==='n'?'Local militia':(fac.find(f=>f.id===enemyOwner)||fac[0]).name,champion:champ,terrain:cp.seed+':t'+to.id+':'+cp.turn,land:to.name}; },
    // Apply a finished battle. res={win, survivors:[types], champion:bool}
    applyBattle(cp,spec,res){ const from=cp.terr[spec.from], to=cp.terr[spec.to]; cp.battles++;
      if(spec.defense){ if(res.win){ to.army=res.survivors; from.str=Math.round(from.str*0.5); cp.log.push('You held '+to.name+'!'); } else { to.owner=from.owner; to.army=[]; to.str=Math.round(from.str*0.4); from.str=Math.round(from.str*0.6); cp.log.push(to.name+' has fallen to '+spec.enemyName+'.'); } }
      else { if(res.win){ to.owner='p'; to.army=res.survivors.slice(0,C.maxSquads); from.army=[]; to.str=0; cp.moved[to.id]=true; Progress.track('lands'); cp.log.push('Conquered '+to.name+'!'); if(res.champion) cp.champDown=true; }
        else { from.army=res.survivors; cp.moved[from.id]=true; cp.log.push('Repulsed at '+to.name+'.'); } }
      api.checkEnd(cp); save(); },
    checkEnd(cp){ const own=cp.terr.filter(t=>t.owner==='p').length; if(!own) cp.done='lost'; else if(own===cp.terr.length) { cp.done='won'; const st=cp.turn<=16?3:cp.turn<=24?2:1; const r=(recs[cp.world]=recs[cp.world]||{}), prev=r[cp.diff]||{stars:0}; cp.stars=st; cp.firstWin=!prev.stars; r[cp.diff]={stars:Math.max(prev.stars,st),turns:Math.min(prev.turns||999,cp.turn)}; } },
    // End turn: income, AI growth/expansion, maybe an AI attack on you (returns a defense battle spec or null).
    endTurn(cp){ const inc=api.income(cp), D=C.difficulty[cp.diff]||C.difficulty.normal; cp.gold+=inc.gold; cp.food+=inc.food; cp.log=[];
      if(cp.food<0){ cp.food=0; const t=cp.terr.filter(x=>x.owner==='p'&&x.army.length).sort((a,b)=>b.army.length-a.army.length)[0]; if(t){ t.army.pop(); cp.log.push('Hunger! A squad deserted at '+t.name+'.'); } }
      cp.turn++; cp.moved={}; const R=rng(cp.seed+':ai'+cp.turn); let defense=null;
      cp.terr.forEach(t=>{ if(t.owner==='a'||t.owner==='b') t.str=Math.min(1500,Math.round(t.str*(1+D.growth)+t.gold*1.5+20)); else if(t.owner==='n') t.str=Math.round(t.str*1.02); });
      ['a','b'].forEach(f=>{ const mine=cp.terr.filter(t=>t.owner===f); let best=null;
        mine.forEach(t=>adj(cp,t.id).forEach(o=>{ const T=cp.terr[o]; if(T.owner===f) return; const def=T.owner==='p'?strOf(cp,T)*1.15:T.str, ratio=t.str*0.6/Math.max(40,def);
          if(T.owner==='p'&&cp.turn<D.aiAttackFrom) return; const score=ratio+(T.owner==='p'?0.25:0)+R()*0.2; if(ratio>1.05&&(!best||score>best.s)) best={s:score,from:t,to:T}; }));
        if(!best) return; const fac=(C.factions[cp.world]||C.factions.elah).find(x=>x.id===f);
        if(best.to.owner==='p'){ if(defense) return; if(!best.to.army.length){ best.to.owner=f; best.to.str=Math.round(best.from.str*0.4); best.from.str=Math.round(best.from.str*0.6); cp.log.push(fac.name+' took undefended '+best.to.name+'!'); }
          else { defense=api.battleSpec(cp,best.from,best.to,true); cp.log.push(fac.name+' attacks '+best.to.name+'!'); } }
        else { const prev=best.to.owner; best.to.owner=f; best.to.str=Math.round(best.from.str*0.6-(prev==='n'?best.to.str*0.3:best.to.str*0.5)); best.to.str=Math.max(120,best.to.str); best.from.str=Math.round(best.from.str*0.5); cp.log.push(fac.name+' seized '+best.to.name+'.'); } });
      cp.pendingDefense=defense; api.checkEnd(cp); save(); return defense; },
    abandon(world){ delete camps[world]; save(); },
    save, stars(world,diff){ const r=recs[world]||{}; return diff?((r[diff]||{}).stars||0):Object.values(r).reduce((a,x)=>Math.max(a,x.stars||0),0); },
    totalStars(){ return Object.values(recs).reduce((a,r)=>a+Object.values(r).reduce((b,x)=>b+(x.stars||0),0),0); },
    diffOpen(world,d){ return d==='normal'||(d==='hard'&&api.stars(world,'normal')>0)||(d==='nightmare'&&api.stars(world,'hard')>0); },
    // Daily skirmish: same armies for everyone on a date.
    dailySpec(){ const d=dayKey(), R=rng('daily:'+d), worlds=['elah','jericho'], w=worlds[Math.floor(R()*2)], pa=[];
      for(let i=0;i<7;i++) pa.push(TYPES[Math.floor(R()*7)]); return {mode:'daily',day:d,world:w,diff:'hard',player:pa,drill:{},enemy:buildArmy(560,pa,'hard',R,3),enemyColor:'0xb8432f',enemyName:'Daily Rivals',terrain:'daily:'+d,land:'Daily Skirmish'}; },
    dailyBest(){ return daily[dayKey()]||null; },
    dailyRecord(score){ const k=dayKey(), b=daily[k]; const best=!b||score>b.score; if(best) daily[k]={score}; save(); return best; }
  };
  return api;
})();
