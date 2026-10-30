// Original procedural sound effects (WebAudio synthesis, no external files). Public domain / CC0 by this project.
window.SFX = (function(){
  let ctx=null, muted=false;
  function ac(){ if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(ctx&&ctx.state==='suspended') ctx.resume(); return ctx; }
  function noise(dur){ const c=ac(); const b=c.createBuffer(1,c.sampleRate*dur,c.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; const s=c.createBufferSource(); s.buffer=b; return s; }
  function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); }
  function tone(type,f0,f1,dur,vol){ const c=ac(); if(!c||muted) return; const t=c.currentTime; const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur); env(g,t,0.005,vol,dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.05); }
  function nz(dur,fq,q,vol,type){ const c=ac(); if(!c||muted) return; const t=c.currentTime; const s=noise(dur), f=c.createBiquadFilter(), g=c.createGain(); f.type=type||'bandpass'; f.frequency.value=fq; f.Q.value=q; env(g,t,0.005,vol,dur); s.connect(f).connect(g).connect(c.destination); s.start(t); }
  const last={};
  function lim(k,ms){ const n=performance.now(); if(last[k]&&n-last[k]<ms) return false; last[k]=n; return true; }
  return {
    unlock: ac,
    toggle(){ muted=!muted; return muted; },
    sling(){ if(lim('sling',60)){ nz(0.12,1800,2,0.25); tone('triangle',900,200,0.1,0.08);} },
    fire(){ if(lim('fire',90)){ nz(0.35,500,0.7,0.25,'lowpass'); } },
    trumpet(){ if(lim('tr',120)){ tone('sawtooth',233,240,0.45,0.12); tone('sawtooth',350,355,0.45,0.07);} },
    cloud(){ if(lim('cl',400)) nz(0.5,300,0.5,0.06,'lowpass'); },
    hit(){ if(lim('hit',40)) nz(0.05,2500,3,0.08); },
    die(){ if(lim('die',50)) tone('square',300,60,0.12,0.06); },
    // Upgrade 3: enemy + camp + coin voices. Small random pitch so repeats never sound canned; all throttled.
    enemyHit(){ if(lim('ehit',45)){ const v=0.92+Math.random()*0.16; nz(0.04,3000*v,3,0.055); tone('square',640*v,300*v,0.045,0.035); } },
    enemyDie(){ if(lim('die',50)) tone('square',320*(0.9+Math.random()*0.2),55,0.14,0.06); },
    enemyAttack(){ if(lim('eatk',130)){ const v=0.92+Math.random()*0.16; tone('sine',150*v,70*v,0.12,0.11); nz(0.08,300,1,0.09,'lowpass'); } },
    campHit(){ if(lim('camp',260)){ tone('sine',92,44,0.3,0.3); nz(0.25,170,0.7,0.22,'lowpass'); } },
    campWarning(){ if(lim('campw',900)){ tone('sine',120,58,0.25,0.3); setTimeout(()=>tone('sine',120,58,0.3,0.3),190); } },
    coinPickup(grok){ if(lim('coin',70)){ const b=grok?1.25:1; tone('triangle',880*b,880*b,0.09,0.11); setTimeout(()=>tone('triangle',1318*b,1318*b,0.14,0.11),70); } },
    // Upgrade 5: an orb purchase — a low hum that swells and settles, crowned with the coin sparkle.
    orbBuy(){ if(lim('orb',120)){ tone('sine',174,87,0.55,0.16); tone('sine',261,130,0.5,0.07); tone('triangle',784,784,0.1,0.1); setTimeout(()=>tone('triangle',1175,1175,0.16,0.1),80); } },
    build(){ tone('triangle',440,660,0.12,0.15); setTimeout(()=>tone('triangle',660,880,0.12,0.12),90); },
    leak(){ tone('sine',200,80,0.4,0.25); },
    stomp(){ tone('sine',90,30,0.6,0.5); nz(0.4,150,0.5,0.4,'lowpass'); },
    skill(){ tone('triangle',523,1046,0.25,0.15); },
    ult(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone('triangle',f,f,0.3,0.15),i*90)); },
    wave(){ tone('sawtooth',196,196,0.6,0.1); setTimeout(()=>tone('sawtooth',294,294,0.8,0.1),300); },
    win(){ [392,494,587,784].forEach((f,i)=>setTimeout(()=>tone('triangle',f,f,0.5,0.15),i*180)); },
    lose(){ [300,250,200,150].forEach((f,i)=>setTimeout(()=>tone('sine',f,f*0.9,0.5,0.15),i*220)); }
  };
})();
