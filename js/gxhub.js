// GX Hub adapter stub. Matches xhub/TOKENS.md + xhub/app/src/sdk/grokonians-sdk.js:
//  - The game is sandboxed (connect-src 'none'): it NEVER calls the network.
//  - Inside the hub (window.parent !== window): postMessage {type:'grokonians:earn', amount, reason} to the hub page,
//    which holds the signed session and calls /api/grokonians/earn, then replies {type:'grokonians:balance', balance}.
//  - Standalone: no-op here; tokens.js keeps the wallet in localStorage.
// Server caps: whole numbers 1-10 per event, >=1 s apart, so large earns are split and queued.
// Spends: the hub is earn-only in v1, so 'grokonians:spend' is sent as a forward-compatible notice the hub can ignore.
window.GXHub=(function(){
  const inHub=(()=>{ try{ return window.parent!==window; }catch(e){ return true; } })();
  const sdk=window.Grokonians&&window.Grokonians.earn?window.Grokonians:null; // hub-served SDK, if the page included it
  const q=[]; let timer=null, hubBalance=null; const listeners=[];
  let welcomed=false, helloTries=0, helloTimer=null;
  function post(msg){ try{ window.parent.postMessage(msg,'*'); }catch(e){} }
  // The hub's bridge (hub.js) waits for the game to say hello: it answers {type:'grokonians:welcome'},
  // runs its session handshake, and only then is the Grokonian connection live. Retry until welcomed.
  function hello(){ if(!inHub||welcomed) return; helloTries++; post({type:'grokonians:hello'});
    if(helloTries<10) helloTimer=setTimeout(hello,1500); }
  function pump(){ if(!q.length){ timer=null; return; } const it=q.shift();
    if(sdk) sdk.earn(it.amount,it.reason); else post({type:'grokonians:earn',amount:it.amount,reason:it.reason});
    timer=setTimeout(pump,1100); }
  window.addEventListener('message',e=>{ if(e.source!==window.parent||!e.data) return;
    if(e.data.type==='grokonians:welcome'){ welcomed=true; if(helloTimer){ clearTimeout(helloTimer); helloTimer=null; } }
    if(e.data.type==='grokonians:balance'){ hubBalance=e.data.balance; listeners.forEach(f=>f(hubBalance)); } });
  if(inHub) hello();
  return {
    mode: inHub?'hub':'local', pending:()=>q.length, get hubBalance(){ return hubBalance; }, get connected(){ return welcomed; },
    earn(amount,reason){ if(!inHub) return; amount=Math.floor(amount); while(amount>0){ const n=Math.min(10,amount); q.push({amount:n,reason:String(reason||'play')}); amount-=n; } if(!timer) pump(); },
    spend(item,cost){ if(inHub) post({type:'grokonians:spend',item:String(item),amount:Math.floor(cost)}); },
    onBalance(f){ listeners.push(f); }
  };
})();
