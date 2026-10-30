// GX Hub adapter. Matches xhub/TOKENS.md + xhub/app/src/sdk/grokonians-sdk.js:
//  - The game is sandboxed (connect-src 'none'): it NEVER calls the network.
//  - Inside the hub: postMessage {type:'grokonians:earn', amount, reason} (or Grokonians.earn(n) if the hub SDK is loaded);
//    hub replies {type:'grokonians:balance', balance}.
//  - Standalone: no-op; tokens.js keeps the wallet in localStorage.
// Caps (server): 1-10 per event, >=1 s apart, 300 per session, 200 per player per game per day.
// Big payouts are split into <=10 chunks and kept in a PERSISTED queue (localStorage) so nothing is lost on close
// or dropped by caps: when the session/day budget is used up, the rest waits for the next session/day.
window.GXHub=(function(){
  const inHub=(()=>{ try{ return window.parent!==window; }catch(e){ return true; } })();
  const sdk=()=>window.Grokonians&&window.Grokonians.earn?window.Grokonians:null;
  const KEY='gxhub_conquest_pending_v1', CAP={event:10,session:300,day:200,gapMs:1100};
  const today=()=>new Date().toISOString().slice(0,10);
  let st={q:[],day:today(),daySent:0}; try{ const r=JSON.parse(localStorage.getItem(KEY)||'null'); if(r) st=Object.assign(st,r); }catch(e){}
  const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(st)); }catch(e){} };
  let sessionSent=0, timer=null, hubBalance=null; const listeners=[];
  function post(msg){ try{ window.parent.postMessage(msg,'*'); }catch(e){} }
  function pump(){ timer=null; if(!inHub||!st.q.length) return; if(st.day!==today()){ st.day=today(); st.daySent=0; }
    const it=st.q[0], room=Math.min(CAP.session-sessionSent,CAP.day-st.daySent); if(room<=0){ save(); return; } // wait for next session/day
    const n=Math.min(it.amount,room,CAP.event); const S=sdk(); if(S) S.earn(n,it.reason); else post({type:'grokonians:earn',amount:n,reason:it.reason});
    it.amount-=n; if(it.amount<=0) st.q.shift(); sessionSent+=n; st.daySent+=n; save(); timer=setTimeout(pump,CAP.gapMs); }
  window.addEventListener('message',e=>{ if(e.source===window.parent&&e.data&&e.data.type==='grokonians:balance'){ hubBalance=e.data.balance; listeners.forEach(f=>f(hubBalance)); } });
  if(inHub&&st.q.length) setTimeout(pump,1500); // resume a queue left from a previous session
  return {
    mode: inHub?'hub':'local', pending:()=>st.q.reduce((a,i)=>a+i.amount,0), get hubBalance(){ return hubBalance; },
    earn(amount,reason){ if(!inHub) return; amount=Math.floor(amount); while(amount>0){ const n=Math.min(CAP.event,amount); st.q.push({amount:n,reason:String(reason||'play')}); amount-=n; } save(); if(!timer) pump(); },
    spend(item,cost){ if(inHub) post({type:'grokonians:spend',item:String(item),amount:Math.floor(cost)}); },
    onBalance(f){ listeners.push(f); }, _state:()=>st
  };
})();
