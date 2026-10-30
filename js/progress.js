// Progression: player XP/level, account level (gates chapters), hero mastery, achievements,
// daily/weekly challenges and the free Battle Pass. Grokonian rewards go through Tokens.earn only.
window.Progress=(function(){
  const KEY='gxhub_wotw_progress_v1'; let P=null,G=null,s=null,events=[];
  const base=()=>({xp:0,seasonId:null,bpXp:0,bpClaimed:{},stats:{},mastery:{},ach:{},titles:{},title:null,day:null,week:null,daily:{},weekly:{},dailyDone:{},weeklyDone:{}});
  function load(){ try{ return Object.assign(base(),JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){ return base(); } }
  function save(){ try{ localStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  const dayKey=(d)=>(d||new Date()).toISOString().slice(0,10);
  function weekKey(d){ d=new Date(d||Date.now()); const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const y=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return t.getUTCFullYear()+'-W'+Math.ceil(((t-y)/864e5+1)/7); }
  function hash(str){ let h=2166136261; for(const c of str){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
  function pick(pool,n,seed){ const a=pool.slice(); let h=hash(seed); const out=[]; while(out.length<n&&a.length){ h=Math.imul(h^(h>>>13),2654435761)>>>0; out.push(a.splice(h%a.length,1)[0]); } return out; }
  function rollover(){ const d=dayKey(), w=weekKey();
    if(s.day!==d){ s.day=d; s.daily={}; s.dailyDone={}; } if(s.week!==w){ s.week=w; s.weekly={}; s.weeklyDone={}; }
    if(s.seasonId!==P.season.id){ s.seasonId=P.season.id; s.bpXp=0; s.bpClaimed={}; } }
  function lvlFromXp(xp){ const L=P.playerLevel; let lv=1,need=L.base; while(xp>=need&&lv<L.max){ xp-=need; lv++; need=L.base+L.step*(lv-1); } return {lv,into:xp,need}; }
  const api={
    init(p,g){ P=p; G=g; s=load(); rollover(); api.checkAch(); save(); },
    get data(){ return P; }, get state(){ return s; },
    takeEvents(){ const e=events; events=[]; return e; },
    level(){ return lvlFromXp(s.xp); },
    stat(k){ if(k==='level') return api.level().lv; if(k==='bpTier') return api.bpTier(); if(k==='heroesOwned') return G.heroes.filter(h=>api.heroUnlocked(h)).length;
      if(k==='bestMastery') return Math.max(0,...G.heroes.map(h=>api.mastery(h.id).lv)); if(k==='dailiesDone') return s.stats.dailiesDone||0; return s.stats[k]||0; },
    totalMastery(){ return G.heroes.reduce((a,h)=>a+api.mastery(h.id).lv,0); },
    achCount(){ return Object.keys(s.ach).length; },
    accountLevel(){ return 1+Math.floor((api.level().lv-1)/2)+Math.floor(api.achCount()/3)+Math.floor(api.totalMastery()/5); },
    chapterOpen(c){ return api.accountLevel()>=c.reqAccount; },
    mastery(id){ const M=P.mastery, xp=s.mastery[id]||0; const lv=Math.min(M.max,Math.floor(xp/M.xpPerLevel)); return {lv,xp,into:xp-lv*M.xpPerLevel,need:M.xpPerLevel,max:lv>=M.max}; },
    perks(id){ const m=api.mastery(id).lv, K=P.mastery.perks; return {dmg:1+K.dmgPerLevel*m,hp:1+K.hpPerLevel*m,cd:m>=5?1-K.cdAt5:1}; },
    addXP(n,heroId,why){ if(!(n>0)) return; rollover(); const before=api.level().lv, tb=api.bpTier(); s.xp+=n; s.bpXp+=n;
      if(heroId){ const mb=api.mastery(heroId).lv; s.mastery[heroId]=(s.mastery[heroId]||0)+n; const ma=api.mastery(heroId).lv; if(ma>mb){ events.push('Mastery '+ma+' with '+((G.heroes.find(h=>h.id===heroId)||{}).name||heroId)); if(ma>=P.mastery.max) s.titles['m_'+heroId]=true; } }
      const after=api.level().lv; if(after>before) events.push('Player level '+after+'!'); const ta=api.bpTier(); if(ta>tb) events.push('Battle Pass tier '+ta+' reached'); api.checkAch(); save(); },
    track(k,n){ rollover(); n=n||1; s.stats[k]=(s.stats[k]||0)+n;
      [['daily','dailyDone',P.challenges.daily],['weekly','weeklyDone',P.challenges.weekly]].forEach(([bk,dk,C])=>{
        api.challenges(bk).forEach(c=>{ if(c.stat!==k||s[dk][c.id]) return; s[bk][c.id]=(s[bk][c.id]||0)+n; if(s[bk][c.id]>=c.goal){ s[dk][c.id]=true; if(bk==='daily') s.stats.dailiesDone=(s.stats.dailiesDone||0)+1; events.push('Challenge done: '+c.text+' (+'+C.xp+' XP)'); api.addXP(C.xp,null,'challenge'); } }); });
      api.checkAch(); save(); },
    challenges(kind){ rollover(); const C=P.challenges[kind]; return pick(C.pool,C.count,(kind==='daily'?s.day:s.week)+P.season.id).map(c=>Object.assign({},c,{have:Math.min(c.goal,(s[kind][c.id]||0)),done:!!s[kind==='daily'?'dailyDone':'weeklyDone'][c.id]})); },
    checkAch(){ if(!P) return; P.achievements.forEach(a=>{ if(!s.ach[a.id]&&api.stat(a.stat)>=a.goal){ s.ach[a.id]=Date.now(); events.push('Achievement: '+a.name); if(a.grok) Tokens.earn('achievement:'+a.id,a.grok); s.xp+=P.xp.achievement; s.bpXp+=P.xp.achievement; } }); },
    // --- battle pass (free track only; paid track reserved in data, disabled)
    bpTier(){ return Math.min(P.season.free.length,Math.floor(s.bpXp/P.season.xpPerTier)); },
    bpDaysLeft(){ const end=new Date(P.season.start+'T00:00:00').getTime()+P.season.lengthDays*864e5; return Math.max(0,Math.ceil((end-Date.now())/864e5)); },
    bpClaimed(t){ return !!s.bpClaimed[t]; },
    bpClaim(t){ const r=P.season.free.find(x=>x.tier===t); if(!r||s.bpClaimed[t]||api.bpTier()<t) return false; s.bpClaimed[t]=true;
      if(r.type==='grok') Tokens.earn('battlepass:tier'+t,r.value);
      else if(r.type==='hero') Tokens.grant(r.value);
      else if(r.type==='skin') Tokens.grant('skin:'+r.value);
      else if(r.type==='title') s.titles[r.value]=true;
      if(t===P.season.free.length) s.titles[P.season.tier30Title]=true;
      api.checkAch(); save(); return true; },
    bpClaimAll(){ let n=0; P.season.free.forEach(r=>{ if(api.bpClaim(r.tier)) n++; }); return n; },
    titleName(id){ if(id&&id.startsWith('m_')){ const h=G.heroes.find(x=>x.id===id.slice(2)); return P.mastery.perks.titleAt10+' '+(h?h.name:''); } return P.titles[id]||id; },
    ownedTitles(){ return Object.keys(s.titles); }, setTitle(id){ s.title=id; save(); },
    heroUnlocked(h){ const u=h.unlock; return u.type==='free'||Tokens.owns(h.id)||(u.type==='milestone'&&Tokens.milestone(u.key))||(u.type==='level'&&api.accountLevel()>=u.level); },
    reset(){ localStorage.removeItem(KEY); s=load(); rollover(); }
  };
  return api;
})();
