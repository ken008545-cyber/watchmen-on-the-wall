// Formara: tiny controller. No deps. Emits window 'wc:command' events; the game listens.
export function mountCommandUI(root=document){
  const bars=[...root.querySelectorAll('.wc-rail')], forms=root.querySelector('#wcForms');
  const emit=(type,detail)=>window.dispatchEvent(new CustomEvent('wc:'+type,{detail}));
  bars.forEach(bar=>bar.addEventListener('click',e=>{const b=e.target.closest('[data-cmd]');if(!b)return;
    const cmd=b.dataset.cmd; if(cmd==='formation'){forms.classList.toggle('open');return}
    root.querySelectorAll('.wc-rail [data-cmd]').forEach(x=>x.setAttribute('aria-pressed',x===b));forms.classList.remove('open');emit('command',{cmd});}));
  forms.addEventListener('click',e=>{const b=e.target.closest('[data-form]');if(!b)return;forms.classList.remove('open');const n=root.querySelector('#wcFormNow b');if(n)n.textContent=b.textContent;emit('command',{cmd:'formation',form:b.dataset.form});});
  return{
    setArmy(counts,foes){let t=0;for(const[k,v]of Object.entries(counts)){const el=root.querySelector(`[data-u="${k}"]`);if(el)el.textContent=v;t+=v}
      root.querySelector('#wcTotal').textContent=t;if(foes!=null)root.querySelector('#wcFoes').textContent=foes},
    setMorale(v){const m=root.querySelector('#wcMorale');m.querySelector('i').style.width=v+'%';m.querySelector('b').textContent=Math.round(v);m.classList.toggle('low',v<34)},
    setFood(used,cap){root.querySelector('#wcFoodVal').textContent=used+'/'+cap;root.querySelector('#wcFood').classList.toggle('low',used>=cap)},
    // screen-space helpers for overlays (or draw the same look on canvas)
    ring(parent,x,y){let r=parent.querySelector('.wc-ring');if(!r){r=document.createElement('div');r.className='wc-ring';parent.append(r)}r.style.left=x+'px';r.style.top=y+'px';return r},
    hp(parent,x,y,frac,enemy=false){const h=document.createElement('div');h.className='wc-hp'+(enemy?' enemy':'')+(frac<.35?' low':'');h.style.left=x+'px';h.style.top=y+'px';h.innerHTML=`<i style="width:${Math.max(0,frac)*100}%"></i>`;parent.append(h);return h}
  };
}
