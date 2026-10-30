// Survival smoke test at 844x390 landscape: PW=/path/to/playwright node tests/smoke.js  (serves on :8777)
// Old campaign smoke test lives in tests/smoke_campaign.js.
const {chromium}=require(process.env.PW||'playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'); const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.css':'text/css'};
const srv=http.createServer((q,r)=>{ const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join(root,u==='/'?'index.html':u); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'}); r.end(d);}); }).listen(8777);
const out={}; const fail=[]; const ok=(c,m)=>{ if(!c) fail.push(m); };
(async()=>{ let b; try{ b=await chromium.launch(); }catch(e){ b=await chromium.launch({executablePath:'/usr/bin/google-chrome'}); }
  const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}); const p=await ctx.newPage();
  const errs=[]; p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('http://localhost:8777/'); await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(2200);
  const tap=async(x,y)=>{ const r=await p.evaluate(()=>{ const c=document.querySelector('#game canvas').getBoundingClientRect(); return {l:c.left,t:c.top,s:c.width/1280}; }); await p.mouse.click(r.l+x*r.s,r.t+y*r.s); await p.waitForTimeout(250); };
  await p.screenshot({path:root+'/tests/surv_menu_844.png'});
  out.vp=await p.evaluate(()=>document.querySelector('meta[name=viewport]').content.includes('viewport-fit=cover'));
  await tap(640-160,352); await p.waitForTimeout(900);   // ⚔ Survival
  out.scene=await p.evaluate(()=>__scene.scene.key); ok(out.scene==='Survival','survival did not start');
  await p.screenshot({path:root+'/tests/surv_shop_844.png'});
  const waves=[];
  for(let w=1;w<=4;w++){
    // buy one squad in shop via a real tap on the first Buy button (if affordable), then Next wave
    if(w>1) await tap(150+5,200+12);
    await tap(640,555); await p.waitForTimeout(400);
    const st=await p.evaluate(()=>({phase:__scene.phase,wave:__scene.run.wave}));
    ok(st.phase==='fight','wave '+w+' did not start');
    await tap(500,260); await p.waitForTimeout(500);            // move hero by tapping the field
    await p.click('#wcui [data-cmd=attack]'); await p.waitForTimeout(200);   // DOM rail: attack
    if(w===2){ await p.click('#wcui [data-cmd=formation]'); await p.click('#wcui [data-form=shieldwall]'); }
    if(w===3) await p.screenshot({path:root+'/tests/surv_fight_844.png'});
    await p.waitForTimeout(1500);
    const r=await p.evaluate(()=>{ __scene.fast(30*240); return {phase:__scene.phase,wave:__scene.run.wave,over:__scene.over,form:__scene.form,squads:__scene.alive(0).length,manna:__scene.run.manna,onE:__scene.alive(1).length}; });
    waves.push(r); if(r.over) break; await p.waitForTimeout(300);
  }
  out.waves=waves; ok(waves.length>=3&&waves[waves.length-1].wave>waves[0].wave,'wave counter did not increase');
  out.dom=await p.evaluate(()=>({wave:document.getElementById('wcWave').textContent,food:document.getElementById('wcFoodVal').textContent,form:document.querySelector('#wcFormNow b').textContent}));
  await p.screenshot({path:root+'/tests/surv_between_844.png'});
  out.maxOnScreen=await p.evaluate(()=>{ const s=__scene; s.startWave(); let m=0; for(let i=0;i<600;i++){ s.fast(1); m=Math.max(m,s.alive(1).length); } return m; });
  ok(out.maxOnScreen<=9+4,'too many enemy squads on screen: '+out.maxOnScreen);
  out.bestBefore=await p.evaluate(()=>SVsave.get().best);
  await p.reload(); await p.waitForTimeout(2000); out.bestAfterReload=await p.evaluate(()=>SVsave.get().best);
  ok(out.bestAfterReload>=3&&out.bestAfterReload===out.bestBefore,'best wave not persisted');
  // determinism: same daily seed + same (scripted) inputs => same hash
  out.det=await p.evaluate(async()=>{ const run=()=>new Promise(res=>{ __game.scene.getScenes(true).forEach(x=>__game.scene.stop(x.scene.key)); __game.scene.start('Survival',{seed:'det-test',hero:'david'});
      setTimeout(()=>{ const s=__scene; s.buy('slinger'); s.startWave(); s.hero.tx=500; s.hero.ty=300; s.fast(900); res(s.hashState()); },400); });
    const a=await run(), b=await run(); return {a,b,same:a===b}; });
  ok(out.det.same,'survival sim not deterministic');
  // boss + rotate checks
  out.boss=await p.evaluate(()=>{ const s=__scene; const w50=s.buildWave(50), w60=s.buildWave(60), w10=s.buildWave(10); return {w10:w10.squads.filter(q=>q[0]===w10.info.boss).length+':'+w10.info.boss,w50:w50.info.boss,w60:w60.info.boss,w50squads:w50.squads.length}; });
  await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(400); out.rotate=await p.evaluate(()=>getComputedStyle(document.querySelector('.wc-rotate')).display);
  await p.screenshot({path:root+'/tests/surv_portrait_rotate.png'}); ok(out.rotate==='flex','rotate overlay missing in portrait');
  out.errors=errs; out.fail=fail; console.log(JSON.stringify(out,null,1)); await b.close(); srv.close(); process.exit(errs.length||fail.length?1:0); })().catch(e=>{ console.error(e); console.log(JSON.stringify(out)); process.exit(2); });
