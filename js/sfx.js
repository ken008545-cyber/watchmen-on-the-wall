// Original procedural sound effects (WebAudio synthesis, no external files). Public domain / CC0 by this project.
// Upgrade 13 (kennin's ruling, 2026-10-30): THE SOUND PASS — "oomph the
// sound up." Everything still synthesized, still no audio files. What
// changed: (1) every voice now runs through ONE master gain, whose level
// is the player's SOUND setting (gxhub_wotw_sound, 0–100, default 100),
// set from Controls; the old mute toggle folds into it (0 = muted).
// (2) Attacks are LAYERED — a transient, a body, and a low thump for
// weight — and distinct per weapon kind, with the hero's blows mixed
// heavier than his squads'. (3) Named powers carry signatures (Psalm's
// harp swell, the Five Stones' five rising strikes, Smooth Stone's
// charged release). (4) The field has voices — golems rumble, groan and
// crumble; the Baal Priest chants when he heals; the fallen fall with
// different sounds per side. (5) A polyphony gate per family keeps a
// crowded wave from clipping into noise: when a family is full, the
// QUIETEST voice in the window is the one dropped. Music (js/music.js)
// is untouched and does NOT pass through this master — it has its own.
window.SFX = (function(){
  let ctx=null, master=null;
  const VOL_KEY='gxhub_wotw_sound';
  let vol=100; try{ const v=parseInt(localStorage.getItem(VOL_KEY),10); if(!isNaN(v)) vol=Math.max(0,Math.min(100,v)); }catch(e){}
  let lastVol=vol>0?vol:100;
  function ac(){ if(!ctx){ try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} 
      if(ctx){ try{ master=ctx.createGain(); master.gain.value=vol/100; master.connect(ctx.destination); }catch(e){ master=null; } } }
    if(ctx&&ctx.state==='suspended') ctx.resume(); return ctx; }
  function out(c){ return master||c.destination; }
  function noiseBuf(c,dur){ const b=c.createBuffer(1,Math.max(1,(c.sampleRate*dur)|0),c.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return b; }
  function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); }
  // Layered voice primitives. o = {type,f0,f1,dur,vol,att,delay} / {dur,fq,f1,q,vol,type,att,delay}.
  // Both return the scheduled start time (or null when silent), and both
  // stay silent — never throw — when audio is locked, absent, or at 0.
  function tone2(o){ const c=ac(); if(!c||vol<=0) return null; const t=c.currentTime+(o.delay||0);
    const osc=c.createOscillator(), g=c.createGain(); osc.type=o.type||'sine';
    osc.frequency.setValueAtTime(Math.max(1,o.f0),t); osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.f1==null?o.f0:o.f1),t+o.dur);
    env(g,t,o.att||0.005,o.vol||0.1,o.dur); osc.connect(g); g.connect(out(c)); osc.start(t); osc.stop(t+o.dur+0.05); return t; }
  function nz2(o){ const c=ac(); if(!c||vol<=0) return null; const t=c.currentTime+(o.delay||0);
    const s=c.createBufferSource(); s.buffer=noiseBuf(c,o.dur);
    const f=c.createBiquadFilter(), g=c.createGain(); f.type=o.type||'bandpass'; f.Q.value=o.q==null?1:o.q;
    f.frequency.setValueAtTime(o.fq,t); if(o.f1!=null) f.frequency.exponentialRampToValueAtTime(Math.max(10,o.f1),t+o.dur);
    env(g,t,o.att||0.005,o.vol||0.1,o.dur); s.connect(f); f.connect(g); g.connect(out(c)); s.start(t); return t; }
  function tone(type,f0,f1,dur,vol){ tone2({type:type,f0:f0,f1:f1,dur:dur,vol:vol}); }
  function nz(dur,fq,q,vol,type){ nz2({dur:dur,fq:fq,q:q,vol:vol,type:type}); }
  const last={};
  function lim(k,ms){ const n=performance.now(); if(last[k]&&n-last[k]<ms) return false; last[k]=n; return true; }
  // Polyphony gate: per family, at most max voices inside a sliding
  // window. A voice louder than the quietest in a full window takes its
  // place; a quieter one is dropped. Windows are 100ms — a 20-enemy wave
  // can shout, but it cannot clip.
  const FAMS={ atk:{max:6,win:100}, impact:{max:6,win:100}, voice:{max:4,win:100}, pow:{max:5,win:100}, camp:{max:3,win:100} };
  const famWin={};
  function gate(fam,v){ const F=FAMS[fam]; if(!F) return true; const now=performance.now();
    const arr=(famWin[fam]=(famWin[fam]||[]).filter(e=>now-e.t<F.win));
    if(arr.length>=F.max){ let mi=0; for(let i=1;i<arr.length;i++) if(arr[i].v<arr[mi].v) mi=i;
      if(!(v>arr[mi].v)) return false; arr.splice(mi,1); }
    arr.push({t:now,v:v}); return true; }
  const R=()=>0.92+Math.random()*0.16; // the field's small pitch wander
  return {
    unlock: ac,
    // --- the player's sound setting (Upgrade 13) ---
    volume(){ return vol; },
    setVolume(v){ v=Math.round(Math.max(0,Math.min(100,+v||0))); vol=v; if(v>0) lastVol=v;
      try{ localStorage.setItem(VOL_KEY,String(v)); }catch(e){}
      if(master&&ctx){ try{ master.gain.setTargetAtTime(v/100,ctx.currentTime,0.015); }catch(e){ try{ master.gain.value=v/100; }catch(e2){} } }
      return vol; },
    toggle(){ if(vol>0){ this.setVolume(0); return true; } this.setVolume(lastVol||100); return false; },
    // --- legacy voices (kept; several now route through the gate) ---
    sling(){ if(lim('sling',60)){ nz(0.12,1800,2,0.25); tone('triangle',900,200,0.1,0.08);} },
    fire(){ if(lim('fire',90)){ nz(0.35,500,0.7,0.25,'lowpass'); } },
    trumpet(){ if(lim('tr',120)){ tone('sawtooth',233,240,0.45,0.12); tone('sawtooth',350,355,0.45,0.07);} },
    cloud(){ if(lim('cl',400)) nz(0.5,300,0.5,0.06,'lowpass'); },
    hit(){ if(lim('hit',40)) nz(0.05,2500,3,0.08); },
    die(){ if(lim('die',50)) tone('square',300,60,0.12,0.06); },
    // Upgrade 13: the enemy hit IS the impact family now — a thock whose
    // body scales with the blow that landed (damage() passes its amount;
    // bare calls keep the old weight). The little square chirp stays, so
    // the ear keeps the sound it learned.
    enemyHit(amt){ if(lim('ehit',45)){ this.impact(amt==null?6:amt); const v=R(); tone('square',640*v,300*v,0.045,0.03); } },
    enemyDie(){ if(lim('die',50)) tone('square',320*(0.9+Math.random()*0.2),55,0.14,0.06); },
    // Upgrade 13: an enemy's blow — a golem (the caller passes the
    // attacker) lands with its fist, not the generic grunt.
    enemyAttack(e){ if(e&&(e.def&&(/golem/.test(e.def.id||'')||e.def.sprite==='golem'))){ this.atkBlunt(false); return; }
      if(lim('eatk',130)){ const v=R(); tone('sine',150*v,70*v,0.12,0.11); nz(0.08,300,1,0.09,'lowpass'); } },
    // Upgrade 13: the camp's crack — the deep thud gains a wooden snap
    // on top, so a blow on the camp reads as timber and stone, not drum.
    campHit(){ if(lim('camp',260)&&gate('camp',0.3)){ tone('sine',92,44,0.3,0.3); nz(0.25,170,0.7,0.22,'lowpass'); nz2({dur:0.06,fq:850,q:1.5,vol:0.1}); } },
    campWarning(){ if(lim('campw',900)){ tone('sine',120,58,0.25,0.3); setTimeout(()=>tone('sine',120,58,0.3,0.3),190); } },
    // Upgrade 13: the threshold drum — first blood, half, quarter. One
    // low strike per level crossed, struck in sequence: the deeper the
    // trouble, the more drums the player hears.
    campAlarm(n){ if(!gate('camp',0.3)) return; n=Math.max(1,Math.min(3,n|0));
      for(let j=0;j<n;j++){ tone2({type:'sine',f0:74,f1:38,dur:0.3,vol:0.3,delay:j*0.17}); nz2({dur:0.12,fq:200,q:0.7,vol:0.08,type:'lowpass',delay:j*0.17}); } },
    coinPickup(grok){ if(lim('coin',70)){ const b=grok?1.25:1; tone('triangle',880*b,880*b,0.09,0.11); setTimeout(()=>tone('triangle',1318*b,1318*b,0.14,0.11),70); } },
    // Upgrade 5: an orb purchase — a low hum that swells and settles, crowned with the coin sparkle.
    orbBuy(){ if(lim('orb',120)){ tone('sine',174,87,0.55,0.16); tone('sine',261,130,0.5,0.07); tone('triangle',784,784,0.1,0.1); setTimeout(()=>tone('triangle',1175,1175,0.16,0.1),80); } },
    // Upgrade 9: the potion moment — a DRINK: two gulps, a fizz, and the
    // sparkle of the power taking hold. Distinct from orbBuy's hum so the
    // ear learns "bought" and "drank" as two different events.
    orbDrink(){ if(lim('drink',120)){ tone('sine',300,170,0.09,0.13); setTimeout(()=>tone('sine',330,190,0.09,0.13),105); setTimeout(()=>tone('sine',370,230,0.1,0.11),210); nz(0.3,5200,0.7,0.045,'highpass'); setTimeout(()=>tone('triangle',1318,1318,0.15,0.09),250); } },
    // Upgrade 10 (approved addition): the POWER-READY WHISPER — one soft,
    // low chime (a gentle rising fifth, pure sine, a fraction of combat
    // volume) when a great power finishes cooling. Throttled per power
    // (the caller passes the power's id) so two powers completing on the
    // same tick each get their one cue. Nothing else in the kit speaks
    // this quietly — Upgrade 13 keeps it exactly so, under the master.
    ready(k){ if(lim('rdy'+(k||''),150)){ tone('sine',1318,1318,0.18,0.045); setTimeout(()=>tone('sine',1760,1760,0.22,0.035),70); } },
    build(){ tone('triangle',440,660,0.12,0.15); setTimeout(()=>tone('triangle',660,880,0.12,0.12),90); },
    leak(){ tone('sine',200,80,0.4,0.25); },
    stomp(){ tone('sine',90,30,0.6,0.5); nz(0.4,150,0.5,0.4,'lowpass'); },
    // Upgrade 7: a champion's roar — phase changes and the escort call.
    bossRoar(){ if(lim('roar',700)){ tone('sawtooth',82,41,0.7,0.28); tone('sawtooth',124,62,0.6,0.14); nz(0.5,220,0.6,0.2,'lowpass'); } },
    skill(){ tone('triangle',523,1046,0.25,0.15); },
    ult(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone('triangle',f,f,0.3,0.15),i*90)); },
    wave(){ tone('sawtooth',196,196,0.6,0.1); setTimeout(()=>tone('sawtooth',294,294,0.8,0.1),300); },
    win(){ [392,494,587,784].forEach((f,i)=>setTimeout(()=>tone('triangle',f,f,0.5,0.15),i*180)); },
    lose(){ [300,250,200,150].forEach((f,i)=>setTimeout(()=>tone('sine',f,f*0.9,0.5,0.15),i*220)); },
    // ============ Upgrade 13: the four families ============
    // --- 1. ATTACKS, layered: transient + body + low thump. The hero's
    // mix is roughly double his squads' — his blows are the ones the
    // player must feel in the hand. ---
    atkMelee(hero){ const v=hero?0.3:0.14; if(!gate('atk',v)) return;
      nz2({dur:0.08,fq:1500,f1:450,q:1.2,vol:hero?0.1:0.05});                       // the swing's swish
      tone2({type:'triangle',f0:190,f1:75,dur:0.09,vol:hero?0.16:0.08});           // the blade's body
      tone2({type:'sine',f0:105,f1:42,dur:0.13,vol:v}); },                         // the thump
    atkBlunt(hero){ const v=hero?0.42:0.26; if(!gate('atk',v)) return;
      tone2({type:'sine',f0:92,f1:30,dur:0.24,vol:v});                             // the fist's boom
      nz2({dur:0.2,fq:160,q:0.7,vol:hero?0.2:0.12,type:'lowpass'});
      tone2({type:'square',f0:60,f1:40,dur:0.12,vol:0.06}); },                     // the knock inside it
    atkSling(hero){ const v=hero?0.2:0.1; if(!gate('atk',v)) return;
      tone2({type:'sine',f0:850,f1:2300,dur:0.1,vol:hero?0.07:0.04});              // the stone's whistle, rising
      nz2({dur:0.045,fq:2800,q:0.8,vol:hero?0.17:0.09,type:'highpass'});           // the strap's snap
      tone2({type:'triangle',f0:500,f1:180,dur:0.06,vol:hero?0.09:0.045}); },
    atkBow(hero){ const v=hero?0.15:0.08; if(!gate('atk',v)) return;
      tone2({type:'triangle',f0:260,f1:150,dur:0.07,vol:hero?0.15:0.08});          // the string
      tone2({type:'square',f0:520,f1:380,dur:0.03,vol:0.04});                      // the pluck's tick
      nz2({dur:0.16,fq:1100,f1:2500,q:2,vol:hero?0.06:0.03}); },                   // the arrow's flight
    atkSpear(hero){ const v=hero?0.17:0.09; if(!gate('atk',v)) return;
      nz2({dur:0.05,fq:750,q:5,vol:hero?0.16:0.09});                               // the thrust's stab
      tone2({type:'sine',f0:210,f1:95,dur:0.07,vol:hero?0.13:0.07}); },
    // --- impacts: a thock that grows with the damage number ---
    impact(dmg){ dmg=+dmg||5; const v=0.05+Math.min(0.12,dmg*0.005); if(!gate('impact',v)) return;
      nz2({dur:0.05,fq:800+Math.min(1600,dmg*40),q:2,vol:v});
      if(dmg>=14) tone2({type:'sine',f0:150,f1:65,dur:0.08,vol:v*0.9}); },
    // --- 3. VOICES OF THE FIELD (quietest family, tightest cap) ---
    exert(){ if(lim('exert',110)&&gate('voice',0.04)){ const v=R(); tone2({type:'square',f0:170*v,f1:115*v,dur:0.05,vol:0.04}); } },
    golemSpawn(){ if(lim('gsp',350)&&gate('voice',0.22)){ tone2({type:'sine',f0:54,f1:36,dur:0.7,vol:0.22,att:0.05}); nz2({dur:0.6,fq:110,q:0.6,vol:0.16,type:'lowpass'}); tone2({type:'sine',f0:82,f1:55,dur:0.5,vol:0.08,delay:0.05}); } },
    golemGroan(){ if(lim('ggr',260)&&gate('voice',0.07)){ tone2({type:'sawtooth',f0:68,f1:48,dur:0.2,vol:0.06}); nz2({dur:0.15,fq:300,q:0.8,vol:0.04,type:'lowpass'}); } },
    golemDie(){ if(!gate('voice',0.26)) return; tone2({type:'sine',f0:85,f1:26,dur:0.5,vol:0.24});
      [500,320,180].forEach((fq,i)=>nz2({dur:0.12,fq:fq,q:0.7,vol:0.14-i*0.03,type:'lowpass',delay:i*0.09})); },
    priestChant(){ if(lim('chant',1900)){ tone2({type:'sine',f0:196,f1:185,dur:1.0,vol:0.045,att:0.3}); tone2({type:'sine',f0:208,f1:196,dur:1.0,vol:0.04,att:0.3}); tone2({type:'sine',f0:98,f1:92,dur:1.0,vol:0.03,att:0.3}); } },
    allyDie(){ if(!gate('voice',0.16)) return; tone2({type:'triangle',f0:300,f1:65,dur:0.3,vol:0.13}); tone2({type:'sine',f0:95,f1:38,dur:0.22,vol:0.15,delay:0.03}); },
    heroDown(){ if(!gate('voice',0.28)) return; tone2({type:'sine',f0:64,f1:30,dur:0.6,vol:0.28}); tone2({type:'triangle',f0:300,f1:65,dur:0.3,vol:0.12,delay:0.02}); tone2({type:'sine',f0:95,f1:38,dur:0.22,vol:0.14,delay:0.05}); },
    // --- 2. POWER SIGNATURES (the loudest family) ---
    // Psalm: a warm chord swells up (slow attack, pure sines — a harp's
    // body, not its pluck) while four plucked notes climb over it.
    psalm(){ if(!gate('pow',0.34)) return;
      [[261.63,0.11],[329.63,0.09],[392,0.09],[523.25,0.07]].forEach(([f,v])=>tone2({type:'sine',f0:f,f1:f,dur:1.0,vol:v,att:0.28}));
      [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone2({type:'triangle',f0:f,f1:f,dur:0.35,vol:0.07,delay:i*0.07})); },
    // Five Stones: five strikes, rising, on the move's own 120ms
    // cadence — the ear counts the stones as the hand throws them.
    fiveStones(){ if(!gate('pow',0.3)) return;
      for(let j=0;j<5;j++){ nz2({dur:0.05,fq:1600+j*250,q:2,vol:0.13,delay:j*0.12}); tone2({type:'triangle',f0:480+j*110,f1:190,dur:0.08,vol:0.15,delay:j*0.12}); } },
    // Smooth Stone: the sling winds up — a rising charge — and lets go.
    smoothStone(){ if(!gate('pow',0.3)) return;
      tone2({type:'sine',f0:240,f1:900,dur:0.22,vol:0.09,att:0.18});
      nz2({dur:0.05,fq:2800,q:0.8,vol:0.2,type:'highpass',delay:0.22}); tone2({type:'sine',f0:900,f1:2400,dur:0.1,vol:0.08,delay:0.22}); },
    // --- the champion's telegraphs (Upgrade 7's blows, Upgrade 13's voice) ---
    // The warning RISES for as long as the telegraph lasts — the pitch is
    // the timer. The boom lands after it, scaled to the blow.
    bossWarn(dur){ if(!gate('pow',0.12)) return; const d=Math.max(0.3,+dur||1);
      tone2({type:'sawtooth',f0:95,f1:185,dur:d,vol:0.09,att:d*0.7}); tone2({type:'sawtooth',f0:142,f1:278,dur:d,vol:0.045,att:d*0.7}); },
    bossBoom(scale){ const s=+scale||1; if(!gate('impact',0.34*s)) return; this.stomp();
      tone2({type:'sine',f0:58,f1:22,dur:0.55,vol:0.34*s}); nz2({dur:0.4,fq:130,q:0.6,vol:0.2*s,type:'lowpass'}); },
    // ============ Upgrade 18: the guns, the chests, the Bible ============
    // Gunfire is synthesized like everything else — a crack (broadband
    // burst), a body (the report's fall), and a low tail for weight.
    // The hero's mix is heavier than any squad's, as with every attack.
    atkPistol(hero){ const v=hero?0.3:0.15; if(!gate('atk',v)) return;
      nz2({dur:0.05,fq:3400,q:0.6,vol:hero?0.3:0.15,type:'highpass'});            // the crack
      tone2({type:'square',f0:320,f1:90,dur:0.07,vol:hero?0.12:0.06});            // the report
      tone2({type:'sine',f0:130,f1:55,dur:0.1,vol:hero?0.14:0.07}); },            // the tail
    atkRifle(hero){ const v=hero?0.42:0.22; if(!gate('atk',v)) return;
      nz2({dur:0.07,fq:2600,q:0.6,vol:hero?0.36:0.19,type:'highpass'});           // the crack, longer
      nz2({dur:0.22,fq:300,q:0.7,vol:hero?0.2:0.1,type:'lowpass'});               // the roll-off
      tone2({type:'sine',f0:105,f1:38,dur:0.24,vol:v}); },                        // the boom under it
    atkScatter(hero){ const v=hero?0.44:0.24; if(!gate('atk',v)) return;
      nz2({dur:0.09,fq:2000,q:0.5,vol:hero?0.34:0.18,type:'highpass'});
      nz2({dur:0.3,fq:220,q:0.6,vol:hero?0.26:0.14,type:'lowpass'});              // the broad roar
      tone2({type:'sine',f0:88,f1:30,dur:0.3,vol:v});
      nz2({dur:0.05,fq:1500,q:0.8,vol:hero?0.12:0.06,delay:0.03}); },             // the spread's second breath
    // A chest banked: wood knocked, a latch, a small sparkle of promise.
    chest(){ if(lim('chest',90)){ tone2({type:'sine',f0:210,f1:120,dur:0.07,vol:0.14}); nz2({dur:0.05,fq:900,q:1.5,vol:0.1});
      setTimeout(()=>tone('triangle',1175,1175,0.12,0.07),70); } },
    // A chest opened in the intermission: the lid, then the reveal chord.
    chestOpen(){ if(lim('chestopen',150)){ nz2({dur:0.14,fq:500,q:1,vol:0.14}); tone2({type:'sine',f0:160,f1:80,dur:0.16,vol:0.12});
      [523,659,784].forEach((f,i)=>setTimeout(()=>tone('triangle',f,f,0.24,0.09),110+i*70)); } },
    // The Bible's bolt: a struck note of light — pure, bright, unhurried.
    bibleShot(){ if(lim('bshot',70)&&gate('atk',0.16)){ tone2({type:'sine',f0:1568,f1:2093,dur:0.14,vol:0.07});
      tone2({type:'triangle',f0:784,f1:1046,dur:0.12,vol:0.08}); } },
    // The Word: a verse-blast — a deep bell swell under a bright crown.
    bibleBlast(){ if(!gate('pow',0.3)) return;
      tone2({type:'sine',f0:196,f1:196,dur:0.7,vol:0.16,att:0.12}); tone2({type:'sine',f0:392,f1:392,dur:0.6,vol:0.08,att:0.12});
      [1046,1318,1568].forEach((f,i)=>tone2({type:'triangle',f0:f,f1:f,dur:0.3,vol:0.06,delay:0.05+i*0.06})); }
  };
})();
