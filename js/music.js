// Music for Watchmen on the Wall — Conquest (Upgrade 3, ruling 2026-10-30).
// The music is the quiet generative WebAudio pad: two detuned oscillators
// per chord tone through a lowpass, gain ~0.04, chords drifting every 7s.
// Kennin heard it on the loading screen, preferred it, and ruled his own
// battle track ("demon diss") removed — the game loads no music files.
// The file slots (assets/music/menu.mp3, battle.mp3) remain supported by
// play() below if he ever reverses the ruling; with nothing cached, the
// pad always stands in so the game is never silent.
// Toggle persists in localStorage and lives next to Sound on the Menu.
window.Music = (function(){
  const KEY='gxhub_wotw_music';
  let on=true; try{ on=localStorage.getItem(KEY)!=='off'; }catch(e){}
  let cur=null, curKey=null;       // current Phaser sound (file mode)
  let pad=null;                    // generative pad nodes (fallback mode)
  let lastScene=null, lastWhich='menu';
  const CHORDS=[ // slow, low, minor-key drift (A minor family)
    [220.00,261.63,329.63],
    [174.61,220.00,261.63],
    [196.00,246.94,293.66],
    [164.81,220.00,329.63]
  ];
  function actx(){ return (window.SFX&&SFX.unlock)?SFX.unlock():null; }
  function stopFile(){ if(cur){ try{ cur.stop(); }catch(e){} try{ cur.destroy(); }catch(e){} cur=null; curKey=null; } }
  function stopPad(){ if(!pad) return; const p=pad; pad=null;
    try{ clearInterval(p.timer); }catch(e){}
    try{ p.gain.gain.linearRampToValueAtTime(0.0001, p.ctx.currentTime+0.4); }catch(e){}
    setTimeout(()=>{ try{ p.oscs.forEach(o=>{ try{ o.stop(); }catch(e){} }); p.gain.disconnect(); p.filt.disconnect(); }catch(e){} }, 500);
  }
  function startPad(){ if(pad) return; const c=actx(); if(!c) return;
    const gain=c.createGain(); gain.gain.setValueAtTime(0.0001,c.currentTime);
    gain.gain.linearRampToValueAtTime(0.04,c.currentTime+2.5);
    const filt=c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=520; filt.Q.value=0.4;
    gain.connect(filt); filt.connect(c.destination);
    const oscs=[];
    CHORDS[0].forEach(f=>{ [-4,5].forEach(det=>{ const o=c.createOscillator(); o.type=det<0?'sine':'triangle'; o.frequency.value=f; o.detune.value=det; o.connect(gain); o.start(); oscs.push(o); }); });
    let ci=0;
    const timer=setInterval(()=>{ if(!pad) return; ci=(ci+1)%CHORDS.length; const t=c.currentTime; let k=0;
      CHORDS[ci].forEach(f=>{ for(let j=0;j<2;j++){ const o=oscs[k++]; if(o) o.frequency.exponentialRampToValueAtTime(f,t+2.5); } }); },7000);
    pad={ctx:c,gain,filt,oscs,timer};
  }
  function play(scene,which){ if(!scene||!scene.cache) return; lastScene=scene; lastWhich=which||'menu';
    if(!on){ stopFile(); stopPad(); return; }
    const key=lastWhich==='battle'?'mus_battle':'mus_menu';
    if(scene.cache.audio.exists(key)){ stopPad();
      if(curKey===key&&cur){ if(!cur.isPlaying){ try{ cur.play(); }catch(e){} } return; }
      stopFile();
      // A real track sits under the SFX, never over it: battle a touch lower than menu.
      try{ cur=scene.sound.add(key,{loop:true,volume:key==='mus_battle'?0.3:0.35}); curKey=key; cur.play(); }catch(e){ cur=null; curKey=null; startPad(); }
    } else { stopFile(); startPad(); }
  }
  function toggle(){ on=!on; try{ localStorage.setItem(KEY,on?'on':'off'); }catch(e){}
    if(!on){ stopFile(); stopPad(); } else if(lastScene){ play(lastScene,lastWhich); }
    return on; }
  return { play, toggle, enabled(){ return on; } };
})();
