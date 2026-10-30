// Legacy campaign smoke test (1280x720): PW=/path/to/playwright node tests/smoke.js  (serves on :8777)
const {chromium}=require(process.env.PW||'playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'); const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{ if(q.url.startsWith('/hubtest')){ r.writeHead(200,{'content-type':'text/html'}); return r.end('<script>window.got=[];addEventListener("message",e=>{ if(e.data&&e.data.type==="grokonians:earn") got.push(e.data.amount); });</script><iframe id=g src="/index.html" width=1280 height=720></iframe>'); } const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,u==='/'?'index.html':u); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); r.end(d);}); }).listen(8777);
const out={}; const W=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ let b; try{ b=await chromium.launch(); }catch(e){ b=await chromium.launch({executablePath:'/usr/bin/google-chrome'}); }
  const p=await b.newPage({viewport:{width:1280,height:720}}); const errs=[]; p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8777/'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(1800); await p.screenshot({path:root+'/tests/shot_menu.png'});
  const go=async(k,d)=>{ await p.evaluate(([k,d])=>{ __game.scene.getScenes(true).forEach(x=>__game.scene.stop(x.scene.key)); __game.scene.start(k,d); },[k,d]); await p.waitForTimeout(700); };
  await go('WorldMap'); await p.screenshot({path:root+'/tests/shot_worlds.png'});
  await p.mouse.click(225,235); await p.waitForTimeout(700); out.newScene=await p.evaluate(()=>__scene.scene.key);
  await p.mouse.click(340,320); await p.waitForTimeout(700); // Normal
  out.camp=await p.evaluate(()=>{ const c=Conq.camp('elah'); return {terr:c.terr.length,turn:c.turn,gold:c.gold}; });
  // tap own capital, recruit via panel
  const cap=await p.evaluate(()=>{ const c=Conq.camp('elah'); const t=c.terr.find(t=>t.owner==='p'); return {x:t.x,y:t.y,id:t.id}; });
  await p.mouse.click(cap.x,cap.y); await p.waitForTimeout(300); await p.mouse.click(520,665); await p.waitForTimeout(400); await p.mouse.click(430,670); await p.waitForTimeout(600);
  out.afterRecruit=await p.evaluate(id=>Conq.camp('elah').terr[id].army.length,cap.id);
  await p.screenshot({path:root+'/tests/shot_campaign.png'});
  // end a few turns
  await p.evaluate(()=>{ __scene.scene.restart({world:'elah'}); }); await p.waitForTimeout(500);
  for(let i=0;i<3;i++){ await p.mouse.click(1190,665); await p.waitForTimeout(500); await p.evaluate(()=>{ const c=Conq.camp('elah'); if(c.pendingDefense){ c.pendingDefense=null; Conq.save(); __scene.scene.restart({world:'elah'}); } }); await p.waitForTimeout(300); }
  out.turns=await p.evaluate(()=>{ const c=Conq.camp('elah'); return {turn:c.turn,owners:c.terr.map(t=>t.owner).join('')}; });
  // attack a neighbor via taps
  const tgt=await p.evaluate(()=>{ const c=Conq.camp('elah'); c.moved={}; const f=c.terr.find(t=>t.owner==='p'&&t.army.length); const n=Conq.adj(c,f.id).map(i=>c.terr[i]).find(t=>t.owner!=='p'); return {f:[f.x,f.y],n:[n.x,n.y]}; });
  await p.evaluate(()=>__scene.scene.restart({world:'elah'})); await p.waitForTimeout(500);
  await p.mouse.click(...tgt.f); await p.waitForTimeout(250); await p.mouse.click(...tgt.n); await p.waitForTimeout(1200);
  out.battle=await p.evaluate(()=>({key:__scene.scene.key,mine:__scene.alive(0).length,foe:__scene.alive(1).length}));
  // tap-to-move hero, commands, squad select
  await p.mouse.click(420,250); await p.waitForTimeout(1500); const h1=await p.evaluate(()=>({x:Math.round(__scene.hero.x),y:Math.round(__scene.hero.y)}));
  await p.mouse.click(72+6*136,637); await p.waitForTimeout(300); // shield wall
  await p.mouse.click(72+1*136,637); await p.waitForTimeout(2500); // charge
  await p.mouse.click(72+7*136,637); await p.mouse.click(900,330); await p.waitForTimeout(300); // volley
  const st=await p.evaluate(()=>__scene.alive(0).map(s=>s.type+':'+s.state).join(','));
  await p.mouse.click(905,692); await p.waitForTimeout(300);
  await p.screenshot({path:root+'/tests/shot_battle.png'});
  out.cmd={hero:h1,states:st};
  await p.evaluate(()=>{ __scene.time.timeScale=1; }); await p.waitForTimeout(6000); await p.screenshot({path:root+'/tests/shot_battle2.png'});
  out.mid=await p.evaluate(()=>({t:Math.round(__scene.clock),mine:Math.round(__scene.strength(0)*100),foe:Math.round(__scene.strength(1)*100),kills:__scene.kills,routs:__scene.routs}));
  // fast-forward simulation
  out.sim=await p.evaluate(()=>{ const s=__scene; let n=0; while(!s.over&&n<6000){ s.update(0,50); n++; } return {over:s.over,secs:Math.round(s.clock),mine:Math.round(s.strength(0)*100),foe:Math.round(s.strength(1)*100)}; });
  await p.waitForTimeout(1500); out.end=await p.evaluate(()=>__scene.scene.key); await p.screenshot({path:root+'/tests/shot_end.png'});
  out.after=await p.evaluate(()=>{ const c=Conq.camp('elah'); return {owners:c.terr.map(t=>t.owner).join(''),bal:Tokens.balance(),q:GXHub.pending()}; });
  // daily
  await go('Battle',{spec:await p.evaluate(()=>Object.assign(Conq.dailySpec(),{hero:'deborah'}))}); out.daily=await p.evaluate(()=>{ const s=__scene; let n=0; while(!s.over&&n<6000){ s.update(0,50); n++; } return {over:s.over,secs:Math.round(s.clock),mine:Math.round(s.strength(0)*100),foe:Math.round(s.strength(1)*100)}; }); await p.waitForTimeout(1500);
  // champion battle (Jericho)
  await go('Battle',{spec:{mode:'skirmish',world:'jericho',diff:'normal',hero:'moses',player:['shield','sword','spear','archer','horse'],drill:{},enemy:['sword','archer'],enemyColor:'0x3a6ea5',enemyName:'Jericho Garrison',champion:'gatekeeper',terrain:'x',land:'Jericho'}});
  await p.waitForTimeout(2500); await p.screenshot({path:root+'/tests/shot_champion.png'}); out.champ=await p.evaluate(()=>!!__scene.sq.find(s=>s.def.champ));
  for(const k of ['BattlePass','Profile','HeroSelect','Unlocks']){ await go(k,k==='HeroSelect'?{level:{mode:'conquest',world:'elah'}}:undefined); }
  // GXHub persisted queue
  out.hub=await p.evaluate(()=>{ for(let i=0;i<5;i++) GXHub.earn(40,'test'); return {pending:GXHub.pending(),stored:!!localStorage.getItem('gxhub_conquest_pending_v1')}; });
  await p.reload(); await p.waitForTimeout(800); out.hubReload=await p.evaluate(()=>GXHub.pending());
  // inside a simulated hub iframe: earns are chunked <=10, spaced, persisted
  await p.goto('http://localhost:8777/hubtest'); await p.waitForTimeout(2500);
  out.hubIframe=await p.evaluate(async()=>{ const g=document.getElementById('g').contentWindow; g.GXHub.earn(35,'test'); const pend0=g.GXHub.pending(); const stored=JSON.parse(g.localStorage.getItem('gxhub_conquest_pending_v1')).q.length; await new Promise(r=>setTimeout(r,2500)); return {mode:g.GXHub.mode,pend0,stored,got:window.got.slice(),pendAfter:g.GXHub.pending()}; });
  await p.reload(); await p.waitForTimeout(4500); out.hubResume=await p.evaluate(()=>({got:window.got.slice(),pend:document.getElementById('g').contentWindow.GXHub.pending()}));
  out.errors=errs; console.log(JSON.stringify(out,null,1)); await b.close(); srv.close(); process.exit(errs.length?1:0); })().catch(e=>{ console.error(e); console.log(JSON.stringify(out)); process.exit(2); });
