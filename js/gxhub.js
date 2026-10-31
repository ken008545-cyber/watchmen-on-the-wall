// GX Hub adapter. Matches xhub/TOKENS.md + xhub/app/src/sdk/grokonians-sdk.js:
//  - The game is sandboxed (connect-src 'none') when HOSTED by the hub: it
//    NEVER calls the network there. Inside the hub (window.parent !== window):
//    postMessage {type:'grokonians:earn', amount, reason} to the hub page,
//    which holds the signed session and calls /api/grokonians/earn, then
//    replies {type:'grokonians:balance', balance}.
//  - Upgrade 21: standalone (the installed app, the direct link), the game
//    can sign in to GX Hub itself. The player types the hub's own username
//    + password once (Menu -> GX Account); the hub answers with a 30-day
//    bearer token, kept in localStorage. Earns/spends/scores then route to
//    the hub API with that token — the hub runs the same handlers and the
//    same caps behind that door, so frame play and standalone play write
//    ONE balance. The password is sent once over HTTPS and never stored,
//    never logged; only the token is kept, and a token the hub refuses
//    (expired, revoked, password changed) clears itself and says so.
//  - Neither door open: no-op here; tokens.js keeps the wallet in
//    localStorage, exactly as before.
// Mode law: frame wins, token second, local third — one door at a time,
// so no earn is ever counted twice.
// Server caps: whole numbers 1-10 per event, >=1 s apart, so large earns
// are split and queued (both doors — the API enforces the same caps).
// Spends: the hub is earn-only through the frame in v1, so there
// 'grokonians:spend' is a forward-compatible notice the hub can ignore;
// through the token door the spend is real (/api/game/spend).
window.GXHub=(function(){
  const HUB_API='https://hub.gxhub.workers.dev';
  const GAME_ID='watchmen-on-the-wall';
  const TKEY='gxhub_wotw_gametoken_v1';
  const inHub=(()=>{ try{ return window.parent!==window; }catch(e){ return true; } })();
  const sdk=window.Grokonians&&window.Grokonians.earn?window.Grokonians:null; // hub-served SDK, if the page included it
  const q=[]; let timer=null, hubBalance=null; const listeners=[];
  let welcomed=false, helloTries=0, helloTimer=null;
  // ---- Upgrade 21: the token door's state ----
  let gtok=null, sessionNote=null; const endedListeners=[];
  try{ const raw=localStorage.getItem(TKEY); if(raw){ const o=JSON.parse(raw);
    if(o&&typeof o.token==='string'&&o.token&&typeof o.exp==='number'&&o.exp>Date.now()) gtok=o;
    else if(o){ localStorage.removeItem(TKEY); sessionNote='Your GX Hub sign-in had expired. Sign in again to reconnect your account.'; } } }catch(e){}
  const direct=()=>!inHub&&!!gtok;
  function saveToken(o){ gtok=o; try{ if(o) localStorage.setItem(TKEY,JSON.stringify(o)); else localStorage.removeItem(TKEY); }catch(e){} }
  function endSession(note){ if(!gtok) return; saveToken(null);
    sessionNote=note||'Your GX Hub sign-in ended (expired or revoked). Sign in again to reconnect your account.';
    endedListeners.forEach(f=>{ try{ f(sessionNote); }catch(e){} }); }
  async function api(path,body,method){ if(!gtok) return null;
    try{ const r=await fetch(HUB_API+path,{method:method||(body?'POST':'GET'),
      headers:{authorization:'Bearer '+gtok.token,'content-type':'application/json'},
      body:body?JSON.stringify(body):undefined});
      if(r.status===401){ endSession(); return null; }
      return await r.json().catch(()=>null); }
    catch(e){ return null; } }
  function post(msg){ try{ window.parent.postMessage(msg,'*'); }catch(e){} }
  // The hub's bridge (hub.js) waits for the game to say hello: it answers {type:'grokonians:welcome'},
  // runs its session handshake, and only then is the Grokonian connection live. Retry until welcomed.
  function hello(){ if(!inHub||welcomed) return; helloTries++; post({type:'grokonians:hello'});
    if(helloTries<10) helloTimer=setTimeout(hello,1500); }
  function pump(){ if(!q.length){ timer=null; return; } const it=q.shift();
    if(inHub){ if(sdk) sdk.earn(it.amount,it.reason); else post({type:'grokonians:earn',amount:it.amount,reason:it.reason}); }
    else if(direct()){ api('/api/game/earn',{amount:it.amount,reason:it.reason}).then(j=>{ if(j&&typeof j.balance==='number'){ hubBalance=j.balance; listeners.forEach(f=>f(hubBalance)); } }); }
    timer=setTimeout(pump,1100); }
  window.addEventListener('message',e=>{ if(e.source!==window.parent||!e.data) return;
    if(e.data.type==='grokonians:welcome'){ welcomed=true; if(helloTimer){ clearTimeout(helloTimer); helloTimer=null; } }
    if(e.data.type==='grokonians:balance'){ hubBalance=e.data.balance; listeners.forEach(f=>f(hubBalance)); } });
  if(inHub) hello();
  return {
    get mode(){ return inHub?'hub':(gtok?'direct':'local'); }, pending:()=>q.length, get hubBalance(){ return hubBalance; }, get connected(){ return welcomed||direct(); },
    get account(){ return gtok?{username:gtok.username,player:gtok.player}:null; },
    get sessionNote(){ return sessionNote; },
    onSessionEnded(f){ endedListeners.push(f); },
    earn(amount,reason){ amount=Math.floor(amount); if(amount<=0) return;
      if(!inHub&&!direct()) return;
      while(amount>0){ const n=Math.min(10,amount); q.push({amount:n,reason:String(reason||'play')}); amount-=n; } if(!timer) pump(); },
    spend(item,cost){ cost=Math.floor(cost);
      if(inHub) post({type:'grokonians:spend',item:String(item),amount:cost});
      else if(direct()) api('/api/game/spend',{item:String(item),amount:cost}).then(j=>{ if(j&&typeof j.balance==='number'){ hubBalance=j.balance; listeners.forEach(f=>f(hubBalance)); } }); },
    // Hub leaderboard: the frame path relays this to POST /api/scores under
    // the same signed session as earn; the token door posts it directly.
    submitScore(score,waves){ score=Math.floor(Number(score)||0); waves=Math.floor(Number(waves)||0); if(score<0||waves<0) return;
      if(inHub) post({type:'scores:submit',score:score,waves:waves});
      else if(direct()) api('/api/game/score',{score:score,waves:waves}); },
    // ---- Upgrade 21: sign-in surface ----
    async signIn(username,password){ let r;
      try{ r=await fetch(HUB_API+'/api/game-login',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({username:String(username||''),password:String(password||''),game:GAME_ID,label:'Watchmen on the Wall'})}); }
      catch(e){ return {ok:false,error:'Could not reach GX Hub — check your connection and try again.'}; }
      const j=await r.json().catch(()=>null);
      if(!r.ok||!j||!j.ok||!j.token) return {ok:false,error:(j&&j.error)||'Sign-in failed — try again.'};
      saveToken({token:j.token,username:j.username,player:j.player,exp:j.expires_ms});
      sessionNote=null; hubBalance=j.balance;
      listeners.forEach(f=>f(hubBalance));
      if(window.Tokens&&Tokens.syncTo) Tokens.syncTo(j.balance);
      return {ok:true,username:j.username,balance:j.balance}; },
    async signOut(){ if(gtok){ try{ await fetch(HUB_API+'/api/game/logout',{method:'POST',headers:{authorization:'Bearer '+gtok.token,'content-type':'application/json'},body:'{}'}); }catch(e){} }
      saveToken(null); sessionNote=null; },
    fetchMe(){ return api('/api/game/me').then(j=>{ if(j&&typeof j.balance==='number'){ hubBalance=j.balance; listeners.forEach(f=>f(hubBalance)); } return j; }); },
    // Multiplayer (js/net.js): the token door's answer to the frame's
    // ticket relay — the hub issues the same single-use ticket.
    fetchTicket(){ if(!direct()) return Promise.resolve({ok:false,error:'sign-in'});
      return api('/api/game/ticket',{}).then(j=>j&&j.ok?{ok:true,ticket:j.ticket,player:j.player,username:j.username}:{ok:false,error:'sign-in'}); },
    onBalance(f){ listeners.push(f); }
  };
})();
