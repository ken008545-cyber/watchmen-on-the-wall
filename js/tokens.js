// Grokonians token module (GX Hub). EVERY Grokonian earn/spend in the game goes through Tokens.earn/Tokens.spend.
// Local wallet in localStorage; every change is mirrored to the GX Hub through js/gxhub.js (postMessage, no network).
window.Tokens=(function(){
  const KEY='gxhub_wotw_save_v2', OLD='wotw_save_v1';
  const base=()=>({grokonians:0,owned:{david:true},milestones:{},perk:0,skin:null,log:[]});
  function load(){ try{
    let raw=localStorage.getItem(KEY);
    if(!raw){ const old=localStorage.getItem(OLD); if(old){ const o=JSON.parse(old); if(o.shekels!=null&&o.grokonians==null){o.grokonians=o.shekels;} delete o.shekels; raw=JSON.stringify(o); localStorage.setItem(KEY,raw); localStorage.removeItem(OLD);} }
    const o=JSON.parse(raw||'{}'); if(o.shekels!=null){ o.grokonians=(o.grokonians||0)+o.shekels; delete o.shekels; }
    return Object.assign(base(),o); }catch(e){ return base(); } }
  let s=load();
  function save(){ s.log=s.log.slice(-50); try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){} }
  // Upgrade 21: in direct mode (standalone, signed in with a GX game
  // token) the hub balance is the truth this wallet mirrors. Reconcile
  // once at boot; signing in reconciles too (GXHub.signIn calls syncTo).
  // Frame and local modes never take this path — their behavior is
  // exactly what it was.
  if(window.GXHub&&GXHub.mode==='direct'&&GXHub.fetchMe) GXHub.fetchMe().then(j=>{ if(j&&typeof j.balance==='number'){ s.grokonians=Math.max(0,Math.floor(j.balance)); save(); } });
  return {
    label:'Grokonians', hub:'GX Hub',
    balance:()=>s.grokonians,
    earn(reason,amount){ amount=Math.max(0,Math.floor(amount)); s.grokonians+=amount; s.log.push({t:Date.now(),reason,amount}); save(); if(window.GXHub) GXHub.earn(amount,reason); return s.grokonians; },
    spend(item,cost){ if(cost<0||s.grokonians<cost) return false; s.grokonians-=cost; s.log.push({t:Date.now(),reason:'spend:'+item,amount:-cost}); save(); if(window.GXHub) GXHub.spend(item,cost); return true; },
    get mode(){ return window.GXHub?GXHub.mode:'local'; },
    syncTo(n){ if(typeof n==='number'&&isFinite(n)){ s.grokonians=Math.max(0,Math.floor(n)); save(); } return s.grokonians; },
    owns:(id)=>!!s.owned[id], grant(id){ s.owned[id]=true; save(); },
    milestone:(k)=>!!s.milestones[k], setMilestone(k){ s.milestones[k]=true; save(); },
    get perk(){return s.perk;}, set perk(v){s.perk=v;save();},
    get skin(){return s.skin;}, set skin(v){s.skin=v;save();},
    reset(){ localStorage.removeItem(KEY); localStorage.removeItem(OLD); s=load(); }
  };
})();
