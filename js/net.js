// Watchmen on the Wall — Slice 1 multiplayer front end (js/net.js).
// Loaded AFTER js/main.js (see index.html). This file is the ONLY client
// code that touches the network, and it touches exactly one origin — the
// rooms service named in ~/workspace/watchmen-conquest/multiplayer/PROTOCOL.md:
//   https://watchmen-rooms.gxhub.workers.dev  (HTTP + WebSocket)
// Identity comes from the GX Hub parent frame by postMessage, the same
// channel js/gxhub.js already uses for Grokonians: we ask the parent for
// a single-use multiplayer ticket and present it ONCE over HTTPS to
// create or join a room. Standalone play gets the same ticket through
// the hub API when the player has signed in inside the game (Upgrade
// 21); signed-out standalone can get none, and the multiplayer entry
// explains itself and offers no socket.
// js/gxhub.js and js/tokens.js are untouched; main.js gained exactly one
// Menu button ('Play Together').
//
// Sim ownership (PROTOCOL.md): the Room DO owns the whole simulation.
// This file only renders authoritative state, glides the own hero's
// sprite toward the authoritative position, and sends intents. No
// client-side state is ever trusted or invented.
//
// Camera choice for NetGame (stated per the build brief): solo's own
// approach — the Phaser camera follows the player's own hero through
// the 1920x1200 Bible world (bounds + startFollow, lerp 0.08), with all
// HUD furniture at depth >= 30 pinned by setScrollFactor(0), exactly as
// the solo Game scene's fixUI() does.
(function(){
'use strict';
const ROOMS_HTTP='https://watchmen-rooms.gxhub.workers.dev';
const ROOMS_WS='wss://watchmen-rooms.gxhub.workers.dev';
const TICKET_TIMEOUT_MS=6000;
const RECONNECT_RUN_MS=70000;   // protocol brief: retry a dropped run ~70 s
const RECONNECT_LOBBY_MS=30000;
// Slot colours, in slot order (protocol: gold, blue, green, rose).
const SLOT_COLORS=[
  {name:'gold', css:'#f2c14e', num:0xf2c14e},
  {name:'blue', css:'#6a9ad8', num:0x6a9ad8},
  {name:'green', css:'#63c74d', num:0x63c74d},
  {name:'rose', css:'#e87a9a', num:0xe87a9a}];
function slotColor(slot, colorField){
  if(typeof colorField==='number'&&SLOT_COLORS[colorField]) return SLOT_COLORS[colorField];
  if(typeof colorField==='string'){ const byName=SLOT_COLORS.find(c=>c.name===colorField); if(byName) return byName;
    const n=parseInt(colorField.replace('#',''),16); if(isFinite(n)) return {name:colorField,css:colorField,num:n}; }
  return SLOT_COLORS[Math.max(0,Math.min(SLOT_COLORS.length-1,slot||0))]; }
// Orb stations: ids and Grokonian costs replicate the ORBS table in
// js/main.js (Upgrade 5) — the wire message carries the station id, and
// the local Tokens.spend must land BEFORE the {t:'orb'} send, exactly as
// solo buys. (Costs: strength 15, swiftness 12, mending 20, iron 18,
// thunder 25 — if main.js ever retunes ORBS, retune this comment's kin:
// NET_ORB_COST reads main.js's global ORBS at runtime, so the numbers
// below are only a fallback if ORBS is somehow absent.)
const NET_ORB_COST={strength:15,swiftness:12,mending:20,iron:18,thunder:25};
function orbDef(stationIdxOrId){
  const table=(typeof ORBS!=='undefined'&&ORBS)||null;
  if(table){ if(typeof stationIdxOrId==='number') return table[stationIdxOrId]||null;
    return table.find(o=>o.id===stationIdxOrId)||null; }
  if(typeof stationIdxOrId==='string') return {id:stationIdxOrId,cost:NET_ORB_COST[stationIdxOrId]||0,name:stationIdxOrId};
  return null; }
const SIGNAL_GLYPHS={thumbs:'👍',attack:'⚔',defend:'🛡',wait:'⏳'};
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // the protocol's code alphabet

// ---------- ticket client ----------
// Asks the hub parent frame for a single-use ticket. Resolves
// {ok:true,ticket,player,username} or {ok:false,error}. A fresh ticket
// is fetched for EVERY create/join attempt — tickets are single-use and
// live 120 s, so none is ever stockpiled.
function netTicket(){
  return new Promise(resolve=>{
    let done=false;
    const finish=v=>{ if(done) return; done=true; window.removeEventListener('message',onMsg); resolve(v); };
    let inHub=false; try{ inHub=window.parent!==window; }catch(e){ inHub=true; }
    if(!inHub){ // Upgrade 21: standalone with a GX sign-in gets the same
      // single-use ticket from the hub API, presented with the game token
      // (js/gxhub.js) — the accounts-only law (G12) holds identically.
      if(window.GXHub&&GXHub.fetchTicket){ GXHub.fetchTicket().then(r=>{
        if(r&&r.ok&&r.ticket) resolve({ok:true,ticket:r.ticket,player:r.player,username:r.username});
        else resolve({ok:false,error:(r&&r.error)||'standalone'}); }); }
      else resolve({ok:false,error:'standalone'});
      return; }
    function onMsg(e){ if(e.source!==window.parent||!e.data) return;
      if(e.data.type!=='multiplayer:ticket') return;
      if(e.data.ok&&e.data.ticket) finish({ok:true,ticket:e.data.ticket,player:e.data.player,username:e.data.username});
      else finish({ok:false,error:e.data.error||'sign-in'}); }
    window.addEventListener('message',onMsg);
    try{ window.parent.postMessage({type:'multiplayer:ticket'},'*'); }
    catch(e){ finish({ok:false,error:'standalone'}); return; }
    setTimeout(()=>finish({ok:false,error:'timeout'}),TICKET_TIMEOUT_MS); }); }
function noTicketText(err){
  const head='Multiplayer needs a GX Hub account.';
  if(err==='standalone') return head+'\nThis copy is running standalone, outside the hub. Sign in from the menu (GX Account) and multiplayer will open — or open the game in the GX Hub.';
  if(err==='timeout') return head+'\nThe hub did not answer the ticket request — if you are signed in, try again.';
  return head+'\nThe hub reports that you are signed out.'; }

// ---------- rooms HTTP (the one origin this file may call) ----------
async function netPost(path,body){
  try{ const r=await fetch(ROOMS_HTTP+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});
    let j=null; try{ j=await r.json(); }catch(e){}
    return {status:r.status,body:j}; }
  catch(e){ return {status:0,body:null}; } }
const JOIN_ERRORS={ 'not-found':'No room with that code — check the code and try again.',
  'full':'That room is already full (four watchmen).', 'started':'That room has already marched — the run is under way.',
  'expired':'That room has expired — ask the host for a fresh code.' };

// ---------- WebSocket link with bounded reconnect ----------
class NetLink{
  constructor(code,resumeToken){ this.code=code; this.resumeToken=resumeToken;
    this.ws=null; this.stopped=false; this.connected=false;
    this.onMsg=null; this.onStatus=null; // onStatus: 'open'|'closed'|'retrying'|'lost'
    this.retryBudgetMs=0; this.retryStart=0; this.retryTimer=null; }
  url(){ return ROOMS_WS+'/rooms/'+encodeURIComponent(this.code)+'/ws?resume='+encodeURIComponent(this.resumeToken); }
  connect(){ if(this.stopped) return;
    let ws; try{ ws=new WebSocket(this.url()); }catch(e){ this.scheduleRetry(); return; }
    this.ws=ws;
    ws.onopen=()=>{ this.connected=true; this.retryStart=0; if(this.onStatus) this.onStatus('open'); this.send({t:'hello'}); };
    ws.onmessage=ev=>{ let m; try{ m=JSON.parse(ev.data); }catch(e){ return; } if(this.onMsg) this.onMsg(m); };
    ws.onclose=()=>{ this.connected=false; if(this.stopped) return; if(this.onStatus) this.onStatus('closed'); this.scheduleRetry(); };
    ws.onerror=()=>{ try{ ws.close(); }catch(e){} }; }
  scheduleRetry(){ if(this.stopped||!this.retryBudgetMs) return;
    if(!this.retryStart) this.retryStart=Date.now();
    if(Date.now()-this.retryStart>this.retryBudgetMs){ if(this.onStatus) this.onStatus('lost'); return; }
    if(this.onStatus) this.onStatus('retrying');
    if(this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer=setTimeout(()=>this.connect(),2000); }
  send(o){ if(this.ws&&this.ws.readyState===1){ try{ this.ws.send(JSON.stringify(o)); return true; }catch(e){} } return false; }
  stop(){ this.stopped=true; if(this.retryTimer){ clearTimeout(this.retryTimer); this.retryTimer=null; }
    if(this.ws){ try{ this.ws.close(); }catch(e){} this.ws=null; } } }

// The one live room session, shared by NetLobby and NetGame:
// {code, resumeToken, slot, heroId, lobby, state, link, started, goalWave}
let NETS=null;
function bibleHeroes(){ return (DATA?DATA.heroes:[]).filter(h=>(h.theme||'bible')==='bible'); }
function heroName(id){ const h=(DATA?DATA.heroes:[]).find(x=>x.id===id); return h?h.name:(id||'—'); }
function playerName(state,slot){ const p=state&&state.players?state.players.find(q=>q.slot===slot):null; return p?p.name:('Slot '+(slot+1)); }

// ================= NetLobby =================
class NetLobby extends Phaser.Scene{ constructor(){ super('NetLobby'); }
  create(){
    backdrop(this,0.7); Music.play(this,'menu');
    this.busy=false; this.inRoom=false;
    this.codeEntry=''; this.heroPick=(NETS&&NETS.heroId)||'david';
    // ?room=CODE in the page URL prefills the join code.
    try{ const q=new URLSearchParams(window.location.search).get('room');
      if(q) this.codeEntry=q.toUpperCase().split('').filter(c=>CODE_CHARS.indexOf(c)>=0).join('').slice(0,6); }catch(e){}
    txt(this,W/2,44,'Play Together',40,GOLD).setOrigin(0.5);
    txt(this,W/2,82,'One wall, up to four watchmen — Bible era, the camp shared.',17).setOrigin(0.5);
    this.statusTxt=txt(this,W/2,116,'',17,'#f2c14e',{align:'center',wordWrap:{width:980}}).setOrigin(0.5);
    this.entryItems=[]; this.roomItems=[]; this.roomDyn=[];
    this.buildEntry();
    if(NETS&&NETS.link&&!NETS.link.stopped){ // re-entered with a live room
      NETS.link.onMsg=m=>this.onNetMsg(m); NETS.link.onStatus=s=>this.onLinkStatus(s);
      this.showRoom(); if(NETS.lobby) this.renderLobby(); }
    else { let inHub=false; try{ inHub=window.parent!==window; }catch(e){ inHub=true; }
      if(!inHub&&!(window.GXHub&&GXHub.account)) this.statusTxt.setText(noTicketText('standalone')); }
    this.events.once('shutdown',()=>{ /* the link belongs to NETS, not the scene; Leave stops it */ }); }
  eAdd(o){ this.entryItems.push(o); return o; }
  rAdd(o){ this.roomItems.push(o); return o; }
  setStatus(m){ if(this.statusTxt) this.statusTxt.setText(m||''); }
  buildEntry(){
    const b=this.eAdd(button(this,W/2,168,320,56,'Create Room',()=>this.createRoom(),{size:24}));
    this.eAdd(txt(this,W/2,224,'— or join a room with its code —',16,'#cdbd95').setOrigin(0.5));
    // Code slots: six stone boxes the keypad fills.
    this.slotBoxes=this.add.graphics(); this.eAdd(this.slotBoxes);
    this.slotTxts=[]; for(let i=0;i<6;i++){ const x=W/2-150+i*60;
      this.slotTxts.push(this.eAdd(txt(this,x,262,'',34,GOLD).setOrigin(0.5))); }
    this.drawSlots();
    // On-screen keypad over the protocol's code alphabet (the codebase
    // has no text-input control anywhere — Settings captures raw keys
    // for binds only — so the code is tapped, not typed).
    const kx=W/2-196, ky=330;
    for(let i=0;i<CODE_CHARS.length;i++){ const col=i%8,row=Math.floor(i/8);
      this.eAdd(button(this,kx+col*56,ky+row*48,50,42,CODE_CHARS[i],()=>{ if(this.codeEntry.length<6){ this.codeEntry+=CODE_CHARS[i]; this.drawSlots(); } },{size:17})); }
    this.eAdd(button(this,W/2-120,ky+4*48+6,200,42,'⌫ Delete',()=>{ this.codeEntry=this.codeEntry.slice(0,-1); this.drawSlots(); },{size:15}));
    this.eAdd(button(this,W/2+120,ky+4*48+6,200,42,'Clear',()=>{ this.codeEntry=''; this.drawSlots(); },{size:15}));
    this.eAdd(button(this,W/2,ky+4*48+62,320,54,'Join Room',()=>this.joinRoom(),{size:22}));
    this.eAdd(button(this,90,680,140,46,'Back',()=>this.scene.start('Menu')));
    return b; }
  drawSlots(){ if(!this.slotBoxes) return; const g=this.slotBoxes; g.clear();
    for(let i=0;i<6;i++){ const x=W/2-150+i*60; g.fillStyle(0x140c07,0.92); g.fillRoundedRect(x-26,236,52,54,8);
      g.lineStyle(2,i<this.codeEntry.length?0xf2c14e:0xd9a441,1); g.strokeRoundedRect(x-26,236,52,54,8);
      if(this.slotTxts[i]) this.slotTxts[i].setText(this.codeEntry[i]||''); } }
  async createRoom(){ if(this.busy||this.inRoom) return; this.busy=true; this.setStatus('Asking the GX Hub for a ticket…');
    const tk=await netTicket();
    if(!tk.ok){ this.busy=false; this.setStatus(noTicketText(tk.error)); return; }
    this.setStatus('Creating the room…');
    const r=await netPost('/rooms',{ticket:tk.ticket}); this.busy=false;
    if(!r.body||!r.body.ok){ this.setStatus('The rooms service could not create a room ('+((r.body&&r.body.error)||('HTTP '+r.status||'no answer'))+'). A fresh ticket is fetched on the next try.'); return; }
    this.openRoom(r.body.code,r.body.resumeToken,r.body.slot); }
  async joinRoom(){ if(this.busy||this.inRoom) return;
    if(this.codeEntry.length!==6){ this.setStatus('Enter the full 6-letter room code first.'); return; }
    this.busy=true; this.setStatus('Asking the GX Hub for a ticket…');
    const tk=await netTicket();
    if(!tk.ok){ this.busy=false; this.setStatus(noTicketText(tk.error)); return; }
    this.setStatus('Joining room '+this.codeEntry+'…');
    const code=this.codeEntry;
    const r=await netPost('/rooms/'+encodeURIComponent(code)+'/join',{ticket:tk.ticket}); this.busy=false;
    if(!r.body||!r.body.ok){ const e=r.body&&r.body.error;
      this.setStatus(JOIN_ERRORS[e]||('The rooms service refused the join ('+(e||('HTTP '+r.status)||'no answer')+').')); return; }
    this.openRoom(code,r.body.resumeToken,r.body.slot); }
  openRoom(code,resumeToken,slot){
    NETS={code,resumeToken,slot:slot||0,heroId:this.heroPick,lobby:null,state:null,started:false,goalWave:0};
    NETS.link=new NetLink(code,resumeToken); NETS.link.retryBudgetMs=RECONNECT_LOBBY_MS;
    NETS.link.onMsg=m=>this.onNetMsg(m); NETS.link.onStatus=s=>this.onLinkStatus(s);
    NETS.link.connect(); this.showRoom(); this.setStatus('Connecting to the room…'); }
  showRoom(){ this.inRoom=true;
    this.entryItems.forEach(o=>{ try{ o.destroy(); }catch(e){} }); this.entryItems=[]; this.slotTxts=[];
    txt(this,W/2,140,'ROOM CODE',16,'#cdbd95').setOrigin(0.5);
    this.rAdd(txt(this,W/2,182,NETS?NETS.code:'',56,GOLD,{letterSpacing:8}).setOrigin(0.5));
    this.rAdd(txt(this,W/2,224,'Share the code — friends open Play Together and join with it.',15,'#cdbd95').setOrigin(0.5));
    this.rAdd(button(this,90,680,140,46,'Leave',()=>this.leaveRoom()));
    this.heroSent=false; this.renderLobby(); }
  renderLobby(){ this.roomDyn.forEach(o=>{ try{ o.destroy(); }catch(e){} }); this.roomDyn=[];
    const dAdd=o=>{ this.roomDyn.push(o); return o; };
    const L=NETS?NETS.lobby:null, members=L?L.members:[{slot:NETS?NETS.slot:0,name:'You',heroId:this.heroPick,color:null,connected:true,warden:false}];
    if(L&&typeof L.host==='number') NETS.hostSlot=L.host;
    members.forEach((m,i)=>{ const y=262+i*46, c=slotColor(m.slot,m.color);
      const chip=this.add.circle(330,y,13,c.num,1); dAdd(chip);
      dAdd(txt(this,356,y,(m.name||'Watchman')+(m.slot===(NETS?NETS.slot:-1)?' (you)':'')+(m.slot===(NETS?NETS.hostSlot:-2)?' — host':''),19,c.css).setOrigin(0,0.5));
      dAdd(txt(this,700,y,heroName(m.heroId),17,PARCH).setOrigin(0,0.5));
      dAdd(txt(this,1010,y,m.connected?'● on the wall':'○ away',15,m.connected?'#8fd06a':'#a08a6a').setOrigin(0,0.5)); });
    if(!members.length) dAdd(txt(this,W/2,262,'Waiting for the room…',17,PARCH).setOrigin(0.5));
    // Hero pick: the Bible roster, duplicates allowed; locked heroes
    // stay locked, honouring Progress.heroUnlocked exactly as solo does.
    dAdd(txt(this,W/2,452,'Choose your hero (Bible)',18,GOLD).setOrigin(0.5));
    bibleHeroes().forEach((h,i)=>{ const col=i%4,row=Math.floor(i/4),x=250+col*260,y=502+row*96, ok=heroUnlocked(h), sel=this.heroPick===h.id;
      const g=this.add.graphics(); g.fillStyle(0x2a1a10,0.95); g.fillRoundedRect(x-120,y-42,240,84,10);
      g.lineStyle(3,sel?0xf2c14e:(ok?0xd9a441:0x5a4a3a)); g.strokeRoundedRect(x-120,y-42,240,84,10); dAdd(g);
      const im=spr(this,x-78,y,h.id,56); if(!ok) im.setTint(0x222222); dAdd(im);
      dAdd(txt(this,x+18,y-12,h.name,15,ok?PARCH:'#8a7a6a',{wordWrap:{width:150}}).setOrigin(0,0.5));
      dAdd(txt(this,x+18,y+16,ok?h.role:('🔒 '+lockLabel(h)),12,ok?'#cdbd95':'#a08a6a',{wordWrap:{width:150}}).setOrigin(0,0.5));
      if(ok){ const z=this.add.zone(x,y,240,84).setInteractive({useHandCursor:true}); dAdd(z);
        z.on('pointerup',()=>{ this.heroPick=h.id; if(NETS){ NETS.heroId=h.id; NETS.link.send({t:'hero',heroId:h.id}); } this.renderLobby(); }); } });
    const isHost=NETS&&(typeof NETS.hostSlot==='number'?NETS.slot===NETS.hostSlot:NETS.slot===0);
    if(isHost){ const sb=button(this,W/2,668,320,52,'Start the Run',()=>{ if(NETS) NETS.link.send({t:'start'}); },{size:22}); dAdd(sb); }
    else dAdd(txt(this,W/2,668,'Waiting for the host to start…',17,'#cdbd95').setOrigin(0.5)); }
  onLinkStatus(s){ if(!this.inRoom) return;
    if(s==='open'){ this.setStatus('On the wall — room '+NETS.code+'.');
      if(!this.heroSent){ this.heroSent=true; NETS.link.send({t:'hero',heroId:this.heroPick}); } }
    else if(s==='retrying'||s==='closed') this.setStatus('Connection dipped — reconnecting…');
    else if(s==='lost') this.setStatus('Connection lost. Leave and rejoin with the same code.'); }
  onNetMsg(m){ if(!NETS) return;
    if(m.t==='lobby'){ NETS.lobby=m; if(m.phase&&m.phase!=='lobby'){ /* room already marched */ }
      if(this.inRoom) this.renderLobby(); }
    else if(m.t==='start'){ NETS.started=true; NETS.goalWave=m.goalWave||NETS.goalWave; this.scene.start('NetGame'); }
    else if(m.t==='snap'||m.t==='delta'){ NETS.state=m;
      if(m.phase&&m.phase!=='lobby'){ NETS.started=true; this.scene.start('NetGame'); } }
    else if(m.t==='error'){ this.setStatus(m.msg||('Refused: '+(m.error||'unknown'))); } }
  leaveRoom(){ if(NETS){ NETS.link.send({t:'leave'}); NETS.link.stop(); NETS=null; } this.scene.start('Menu'); } }

// ================= NetGame =================
// A remote-mode renderer: a sibling of the solo Game scene, NOT a fork
// of its sim. Everything on screen mirrors the last authoritative state;
// the only local motion is sprite glide toward that state.
class NetGame extends Phaser.Scene{ constructor(){ super('NetGame'); }
  create(){
    this.state=null; this.ents=new Map(); this.coinMap=new Map();
    this.orbStations=[]; this.orbBuilt=false; this.ownEnt=null; this.camSet=false;
    this.volleyMode=false; this.postMode=false;
    this.shopOpen=false; this.shopItems=[]; this.shopPage=0; this.votedReady=false; this.shopEndsAt=0; this._shopSig='';
    this.goalOpen=false; this.goalItems=[]; this.endShown=false; this.runEnded=false;
    this.resyncNeeded=true; this.myCampBuys={};
    const era=eraById('bible'); this.worldW=era.worldW||1920; this.worldH=era.worldH||1200;
    this.campPos={x:150,y:600};
    this.add.image(0,0,era.bg||'bg_elah').setOrigin(0,0).setDisplaySize(this.worldW,this.worldH).setDepth(0);
    this.add.rectangle(this.worldW/2,this.worldH/2,this.worldW,this.worldH,0x0d0906,0.15).setDepth(1);
    this.campSpr=this.add.image(this.campPos.x,this.campPos.y,'camp').setDepth(2);
    this.campBar=this.add.graphics().setDepth(12);
    this.fx=this.add.graphics().setDepth(20); // every ent HP bar, redrawn per frame
    this.buildNetHUD();
    this.cameras.main.setBounds(0,0,this.worldW,this.worldH);
    this.cameras.main.centerOn(480,620);
    this.input.on('pointerdown',p=>this.onTap(p));
    if(!NETS||!NETS.link){ this.waitTxt.setText('No room — return to Play Together.'); return; }
    NETS.link.retryBudgetMs=RECONNECT_RUN_MS;
    NETS.link.onMsg=m=>this.onMsg(m);
    NETS.link.onStatus=s=>this.onLinkStatus(s);
    if(NETS.state) this.applyState(NETS.state,true);
    Music.play(this,'battle');
    this.events.once('shutdown',()=>{ if(NETS&&NETS.link&&!this.endShown){ NETS.link.stop(); } }); }
  buildNetHUD(){
    const bar=this.add.graphics().setDepth(30); bar.fillStyle(0x1a110a,0.94); bar.fillRect(0,HUD_Y,W,H-HUD_Y);
    bar.lineStyle(3,0xd9a441); bar.lineBetween(0,HUD_Y,W,HUD_Y);
    this.stat=txt(this,12,8,'',19,PARCH).setDepth(31);
    this.stat2=txt(this,12,34,'',14,'#cdbd95').setDepth(31);
    this.waitTxt=txt(this,W/2,300,'Joining the room…',24,GOLD).setOrigin(0.5).setDepth(31);
    this.respawnTxt=txt(this,W/2,120,'',24,'#ff9a86',{align:'center'}).setOrigin(0.5).setDepth(31);
    this.connTxt=txt(this,W/2,64,'',17,'#f2c14e',{backgroundColor:'#140c07cc',padding:{x:10,y:4}}).setOrigin(0.5).setDepth(41);
    this.bossBar=this.add.graphics().setDepth(32); this.bossName=txt(this,W/2,HUD_Y-30,'',20,GOLD).setOrigin(0.5).setDepth(32).setVisible(false);
    const cmds=[['charge','Charge'],['hold','Hold'],['follow','Follow Me'],['flank','Flank'],['fallback','Fall Back'],['shieldwall','Shield Wall']];
    cmds.forEach(([id,label],i)=>{ const b=button(this,130+i*117,HUD_Y+55,110,56,label,()=>this.sendOrder(id),{size:15}); b.setDepth(31); });
    const vb=button(this,130+6*117,HUD_Y+55,110,56,'Volley',()=>{ if(this.runEnded||this.shopOpen||this.goalOpen) return; this.volleyMode=true; this.postMode=false; this.toast('Volley: tap a target spot'); },{size:15}); vb.setDepth(31);
    const pb=button(this,130+7*117,HUD_Y+55,110,56,'Post',()=>{ if(this.runEnded||this.shopOpen||this.goalOpen) return; this.postMode=true; this.volleyMode=false; this.toast('Post: tap where your squads hold'); },{size:15}); pb.setDepth(31);
    // Upgrade 22: rooms get the fullscreen button too — the solo bar's
    // own seat (far right of the command bar), same fsPress truth.
    const nfsb=button(this,1221,HUD_Y+26,110,36,fsActive()?'Exit full':'Fullscreen',()=>fsPress(this),{size:13}); nfsb.setDepth(31); this.fsb=nfsb;
    // Quick signals (protocol ids thumbs|attack|defend|wait).
    [['thumbs','👍'],['attack','⚔'],['defend','🛡'],['wait','⏳']].forEach(([id,glyph],i)=>{
      const b=button(this,972+i*64,30,56,44,glyph,()=>{ if(NETS) NETS.link.send({t:'signal',id}); },{size:19}); b.setDepth(31); });
    const lb=button(this,1236,30,76,44,'Leave',()=>this.leaveRun(),{size:13}); lb.setDepth(31);
    this.fixNetUI(); }
  fixNetUI(){ this.children.list.forEach(o=>{ if(o&&o.depth>=30&&o.setScrollFactor) o.setScrollFactor(0); }); }
  mySlot(){ return (this.state&&this.state.you&&typeof this.state.you.slot==='number')?this.state.you.slot:(NETS?NETS.slot:0); }
  sendOrder(id){ if(NETS) NETS.link.send({t:'order',order:id}); }
  toast(m,ms){ if(this._toast) this._toast.destroy();
    const t=txt(this,W/2,HUD_Y-70,m,21,GOLD,{backgroundColor:'#140c07cc',padding:{x:10,y:4},wordWrap:{width:900},align:'center'}).setOrigin(0.5).setDepth(40).setScrollFactor(0);
    this._toast=t; this.tweens.add({targets:t,alpha:0,delay:ms||1800,duration:600,onComplete:()=>t.destroy()}); }
  floatText(x,y,s,c){ const t=txt(this,x,y,s,14,c).setOrigin(0.5).setDepth(25); this.tweens.add({targets:t,y:y-26,alpha:0,duration:700,onComplete:()=>t.destroy()}); }
  onLinkStatus(s){
    if(s==='open'){ this.connTxt.setText(''); this.resyncNeeded=true; if(this.state) this.applyState(this.state,true); }
    else if(s==='retrying'||s==='closed'){ if(!this.runEnded) this.connTxt.setText('reconnecting…'); }
    else if(s==='lost'){ this.connTxt.setText('Connection lost — use Leave and rejoin the room.'); } }
  onMsg(m){ if(!m||!m.t) return;
    if(m.t==='snap'||m.t==='delta'){ const full=(m.t==='snap'&&this.resyncNeeded); if(m.t==='snap') this.resyncNeeded=false; this.applyState(m,full); }
    else if(m.t==='shop'){ this.shopEndsAt=m.endsAt||this.shopEndsAt; if(this.state&&this.state.phase==='shop') this.openShop(); }
    else if(m.t==='event'){ this.handleEvent(m); }
    else if(m.t==='runEnd'){ this.showRunEnd(m); }
    else if(m.t==='start'){ if(NETS) NETS.goalWave=m.goalWave||NETS.goalWave; }
    else if(m.t==='error'){ this.toast(m.msg||('Refused: '+(m.error||'unknown')),2400); } }
  handleEvent(ev){ const st=this.state;
    const nameOf=slot=>playerName(st,slot);
    switch(ev.kind){
      case 'wave': this.toast('Wave '+(ev.wave||(st?st.wave:'')||'')+(ev.night?' — Night':' — Day')); break;
      case 'waveclear': this.toast('Wave '+(ev.wave||(st?st.wave:''))+' cleared!'); break;
      case 'campdown': this.toast('The camp has fallen! No hero returns while it is down.',3200); break;
      case 'herodown': this.toast((typeof ev.slot==='number'?nameOf(ev.slot):(ev.name||'A hero'))+' is down!',2600); break;
      case 'heroback': this.toast((typeof ev.slot==='number'?nameOf(ev.slot):(ev.name||'A hero'))+' returns to the wall!',2400); break;
      case 'coin': if(typeof ev.x==='number') this.floatText(ev.x,ev.y-14,'+8 Manna',GOLD); break;
      case 'grokcoin': this.toast('+1 Grokonian!',1600); break;
      case 'orb': { const d=orbDef(ev.station); this.toast('Orb lit: '+(ev.name||(d?d.name:ev.station||'')),2400); break; }
      case 'signal': { const g=SIGNAL_GLYPHS[ev.id]||'•';
        const from=(typeof ev.from==='number')?nameOf(ev.from):(ev.from||(typeof ev.slot==='number'?nameOf(ev.slot):'A watchman'));
        this.toast(g+'  '+from,2200); break; }
      case 'goalclear': this.toast('The goal wave is cleared!',3000); this.showGoal(); break;
      case 'warden': this.toast(ev.name?('The Warden: '+ev.name):'The Warden walks the wall…',2600); break;
      case 'withdrawn': this.toast(ev.msg||'A watchman has withdrawn from the room.',2600); break;
      default: if(ev.msg) this.toast(ev.msg,2400); } }
  applyState(st,full){ const prev=this.state?this.state.phase:null; this.state=st; if(NETS) NETS.state=st;
    if(this.waitTxt) this.waitTxt.setVisible(false);
    if(full){ this.ents.forEach(e=>this.destroyEnt(e)); this.ents.clear();
      this.coinMap.forEach(c=>{ try{ c.spr.destroy(); }catch(e){} }); this.coinMap.clear(); this.orbBuilt=false; this.ownEnt=null; this.camSet=false; }
    if(st.orbs&&!this.orbBuilt) this.buildOrbs(st.orbs);
    this.syncEnts(st.ents||[]); this.syncCoins(st.coins||[]);
    if(st.shopEndsAt) this.shopEndsAt=st.shopEndsAt;
    if(st.phase==='shop'&&prev!=='shop') this.openShop();
    if(st.phase!=='shop'&&prev==='shop') this.closeShop();
    if(st.phase==='goal'&&prev!=='goal') this.showGoal();
    if(st.phase!=='goal'&&prev==='goal') this.hideGoal();
    if(this.shopOpen){ const sig=[st.you?st.you.manna:0,st.campMax,st.campHp,this.shopPage].join('|');
      if(sig!==this._shopSig){ this._shopSig=sig; this.renderShop(); } }
    this.refreshNetHUD(); }
  buildOrbs(list){ this.orbBuilt=true; this.orbStations=[];
    list.forEach(row=>{ const [idx,x,y]=row, def=orbDef(idx); if(!def) return;
      const glow=this.add.circle(x,y-8,34,def.color||0xffffff,0.16).setDepth(4);
      const img=this.add.image(x,y,'orb_'+def.id).setDepth(5);
      const label=txt(this,x,y-58,def.short+' · '+def.cost+' G',14,def.css||PARCH).setOrigin(0.5).setDepth(6);
      this.tweens.add({targets:img,scale:1.07,duration:1100,yoyo:true,repeat:-1,ease:'Sine.inOut'});
      this.orbStations.push({idx,def,x,y,img,glow,label}); }); }
  entDef(kind,typeIdx){ if(kind===0) return (UNITS.bible.enemy||[])[typeIdx]||null;
    if(kind===1) return (UNITS.bible.player||[])[typeIdx]||null;
    return (DATA?DATA.heroes:[])[typeIdx]||null; }
  makeEntSprite(kind,def,boss,owner){
    if(kind===2){ let frame='david', tinted=false;
      if(def){ let has=false; try{ const tx=this.textures.get('spr'); has=!!(tx&&tx.has&&tx.has(def.id)); }catch(e){ has=false; }
        if(has) frame=def.id; else tinted=true; }
      const im=spr(this,0,0,frame,58); if(tinted) im.setTint(slotColor(owner).num); return im; }
    if(kind===0) return uspr(this,0,0,def,boss?120:(def.img?66:((typeof SZ!=='undefined'&&SZ[def.sprite])||54)));
    return uspr(this,0,0,def,def.img?58:54); }
  syncEnts(list){ const seen=new Set(), my=this.mySlot();
    list.forEach(row=>{ const [id,kind,typeIdx,x,y,hp,mhp,owner,boss]=row; seen.add(id);
      let e=this.ents.get(id);
      if(e&&(e.kind!==kind||e.typeIdx!==typeIdx)){ this.destroyEnt(e); this.ents.delete(id); e=null; }
      if(!e){ const def=this.entDef(kind,typeIdx); if(!def) return;
        e={id,kind,typeIdx,def,owner,boss:!!boss,x,y,rx:x,ry:y,hp,mhp};
        e.spr=this.makeEntSprite(kind,def,e.boss,owner); if(kind!==2) applyTint(e.spr,def);
        e.spr.setOrigin(0.5,0.9);
        if(kind!==0){ const c=slotColor(owner,undefined); e.ring=this.add.circle(x,y+8,kind===2?20:14,0x000000,0).setStrokeStyle(2,c.num,0.9).setDepth(6); }
        else if(e.boss){ e.ring=this.add.circle(x,y+8,34,0x000000,0).setStrokeStyle(2,0xa33b20,0.9).setDepth(6); }
        if(kind===2){ e.nameTxt=txt(this,x,y-56,playerName(this.state,owner),13,slotColor(owner).css).setOrigin(0.5).setDepth(13); }
        this.ents.set(id,e); }
      e.x=x; e.y=y; e.hp=hp; e.mhp=mhp; e.owner=owner; e.boss=!!boss;
      if(kind===2&&owner===my){ this.ownEnt=e;
        if(!this.camSet){ this.camSet=true; this.cameras.main.startFollow(e.spr,true,0.08,0.08); } } });
    this.ents.forEach((e,id)=>{ if(!seen.has(id)){ this.destroyEnt(e); this.ents.delete(id); if(this.ownEnt===e) this.ownEnt=null; } }); }
  destroyEnt(e){ [e.spr,e.ring,e.nameTxt].forEach(o=>{ if(o){ try{ o.destroy(); }catch(err){} } }); }
  syncCoins(list){ const seen=new Set();
    list.forEach(row=>{ const [id,x,y,grok]=row; seen.add(id);
      if(!this.coinMap.has(id)){ const s=this.add.image(x,y,grok?'coing':'coin').setDepth(6);
        this.tweens.add({targets:s,scale:1.25,alpha:0.75,duration:650,yoyo:true,repeat:-1,ease:'Sine.inOut'});
        this.coinMap.set(id,{spr:s,x,y,grok:!!grok}); } });
    this.coinMap.forEach((c,id)=>{ if(!seen.has(id)){ this.tweens.killTweensOf(c.spr); try{ c.spr.destroy(); }catch(e){} this.coinMap.delete(id); } }); }
  refreshNetHUD(){ const st=this.state; if(!st) return; const you=st.you||{};
    const goalTxt=st.endless?'∞ (goal cleared)':String(st.goalWave||(NETS&&NETS.goalWave)||10);
    this.stat.setText('Manna '+Math.floor(you.manna||0)+'   Camp '+Math.max(0,Math.ceil(st.campHp||0))+'/'+(st.campMax||CAMP_MAX)+(st.campDown?' (FALLEN)':'')+'   Wave '+(st.wave||0)+'/'+goalTxt+'   '+(st.night?'Night':'Day')+'   Kills '+(you.kills||0)+'   Score '+(you.score||0));
    const cds=you.orbCds?Object.keys(you.orbCds).filter(k=>you.orbCds[k]>0).map(k=>{ const d=orbDef(k); return (d?d.short:k)+' '+Math.ceil(you.orbCds[k])+'s'; }):[];
    this.stat2.setText((st.players||[]).map(p=>p.name+' · '+p.kills+' kills · '+Math.floor(p.manna)+' manna'+(p.warden?' · Warden':'')+(p.down?' · DOWN':'')+(p.connected?'':' · away')).join('     ')+(cds.length?('     Orbs: '+cds.join(' · ')):''));
    if(this.respawnTxt){ if((you.respawnIn||0)>0) this.respawnTxt.setText(st.campDown?'You are down — the camp has fallen, so there is no return.':'You are down — returning in '+Math.ceil(you.respawnIn)+'s, while the camp stands.');
      else this.respawnTxt.setText(''); } }
  onTap(p){ if(this.runEnded||this.shopOpen||this.goalOpen||!this.state) return;
    if(p.y>=HUD_Y) return; // the command row is furniture, not field
    const wx=Math.max(20,Math.min(this.worldW-20,(p.worldX!==undefined?p.worldX:p.x)));
    const wy=Math.max(40,Math.min(this.worldH-20,(p.worldY!==undefined?p.worldY:p.y)));
    if(this.volleyMode){ this.volleyMode=false; NETS.link.send({t:'volley',x:Math.round(wx),y:Math.round(wy)}); this.toast('Volley away!'); return; }
    if(this.postMode){ this.postMode=false; NETS.link.send({t:'post',x:Math.round(wx),y:Math.round(wy)}); this.toast('Squads: post there and hold'); return; }
    const st=this.orbStations.find(o=>Math.hypot(wx-o.x,wy-o.y)<=48);
    if(st){ this.tryOrb(st); return; }
    NETS.link.send({t:'move',x:Math.round(wx),y:Math.round(wy)});
    const marker=this.add.circle(wx,wy,10,0xf2c14e,0.35).setDepth(17);
    this.tweens.add({targets:marker,scale:2.2,alpha:0,duration:400,onComplete:()=>marker.destroy()}); }
  // Orb buy, the protocol's order of operations: the LOCAL Tokens.spend
  // lands first (exactly solo's call — Tokens.spend('orb:'+id, cost));
  // only on success does the {t:'orb'} intent go to the room. The server
  // still checks range (90 px) and the per-buyer 15 s station cooldown.
  tryOrb(st){ const def=st.def, you=(this.state&&this.state.you)||{};
    const cd=you.orbCds?you.orbCds[def.id]:0;
    if(cd&&cd>0){ this.toast(def.name+' is recharging — '+Math.ceil(cd)+'s'); return; }
    const h=this.ownEnt;
    if(!h){ this.toast('Your hero is not on the field'); return; }
    if(Math.hypot(h.x-st.x,h.y-st.y)>90){ this.toast('Move closer to the orb — your hero must stand within reach'); return; }
    if(!Tokens.spend('orb:'+def.id,def.cost)){ this.toast('Not enough Grokonians (have '+Tokens.balance()+')'); return; }
    NETS.link.send({t:'orb',station:def.id});
    this.toast(def.name+' — Grokonians spent, the room confirms the power…',2200); }
  // ---------- shop phase ----------
  openShop(){ if(this.shopOpen||this.endShown) return; this.shopOpen=true; this.votedReady=false; this.volleyMode=false; this.postMode=false; this._shopSig=''; this.renderShop(); }
  closeShop(){ this.shopOpen=false; this.clearShopItems(); }
  clearShopItems(){ (this.shopItems||[]).forEach(o=>{ try{ o.destroy(); }catch(e){} }); this.shopItems=[]; }
  shopAdd(o){ o.setDepth(52); if(o.setScrollFactor) o.setScrollFactor(0); this.shopItems.push(o); return o; }
  renderShop(){ this.clearShopItems(); const st=this.state; if(!st) return; const you=st.you||{};
    const bg=this.add.graphics(); bg.fillStyle(0x140c07,0.94); bg.fillRect(24,38,W-48,H-62); bg.lineStyle(3,0xd9a441); bg.strokeRect(24,38,W-48,H-62); this.shopAdd(bg).setDepth(50);
    this.shopAdd(txt(this,W/2,54,'Between Waves — the Shop',26,GOLD).setOrigin(0.5));
    this.shopHead=this.shopAdd(txt(this,W/2,84,'Manna '+Math.floor(you.manna||0)+'  •  Camp '+Math.max(0,Math.ceil(st.campHp||0))+'/'+(st.campMax||CAMP_MAX)+' HP  •  Next: wave '+((st.wave||0)+1),17,PARCH).setOrigin(0.5));
    this.shopTimerTxt=this.shopAdd(txt(this,1090,54,'',17,GOLD).setOrigin(0.5));
    // Camp track (main.js CAMP_UPGRADES / CAMP_REPAIR — same ids the
    // protocol's buy message carries). Fortify tiers already owned are
    // read off campMax (solo's law: each tier adds its hpAdd to the
    // max); swift/watchfire have no state echo in v1, so a local buy
    // disables its own button and the server's word is final.
    const tier=(st.campMax||CAMP_MAX)>=1100?3:(st.campMax||CAMP_MAX)>=850?2:(st.campMax||CAMP_MAX)>=650?1:0;
    CAMP_UPGRADES.forEach((u,i)=>{ const cx=180+i*184, cy=126, owned=(u.id.indexOf('fortify')===0&&tier>=Number(u.id.slice(7)))||!!this.myCampBuys[u.id];
      if(owned){ this.shopAdd(txt(this,cx,cy,u.name+' ✓',13,'#8fd06a').setOrigin(0.5)); return; }
      const b=button(this,cx,cy,176,36,u.name+' · '+u.cost,()=>{ this.myCampBuys[u.id]=true; NETS.link.send({t:'buy',item:u.id}); this._shopSig=''; this.renderShop(); },{size:13,disabled:(you.manna||0)<u.cost}); this.shopAdd(b); });
    const full=(st.campHp||0)>=(st.campMax||CAMP_MAX);
    const rb=button(this,1100,126,176,36,'Repair +'+CAMP_REPAIR.heal+' · '+CAMP_REPAIR.cost,()=>{ NETS.link.send({t:'buy',item:'repair'}); },{size:13,disabled:full||(you.manna||0)<CAMP_REPAIR.cost}); this.shopAdd(rb);
    // Squads: the Bible player list, eight to a page.
    const units=(UNITS.bible.player||[]), pages=Math.max(1,Math.ceil(units.length/8));
    if(this.shopPage>=pages) this.shopPage=0;
    units.slice(this.shopPage*8,this.shopPage*8+8).forEach((def,i)=>{ const col=i%4,row=Math.floor(i/4),x=70+col*300,y=176+row*196,cx=x+140;
      const g=this.add.graphics(); g.fillStyle(0x2a1a10,0.97); g.fillRoundedRect(x,y,280,180,10); g.lineStyle(2,0xd9a441); g.strokeRoundedRect(x,y,280,180,10); this.shopAdd(g).setDepth(51);
      const im=uspr(this,x+40,y+42,def,52); applyTint(im,def); this.shopAdd(im).setDepth(52);
      this.shopAdd(txt(this,x+72,y+16,def.name,16,GOLD,{wordWrap:{width:200}}));
      this.shopAdd(txt(this,x+72,y+44,def.role+'  ·  hp '+def.hp+'  ·  dmg '+def.dmg,13,PARCH));
      const can=(you.manna||0)>=def.cost;
      const b=button(this,cx,y+128,180,44,'Buy '+def.cost,()=>{ NETS.link.send({t:'buy',item:def.id}); },{size:16,disabled:!can}); this.shopAdd(b); });
    if(pages>1){ const pv=button(this,420,668,60,44,'◀',()=>{ this.shopPage=(this.shopPage+pages-1)%pages; this._shopSig=''; this.renderShop(); },{size:17}); this.shopAdd(pv);
      this.shopAdd(txt(this,492,668,(this.shopPage+1)+'/'+pages,17,PARCH).setOrigin(0.5));
      const nx=button(this,564,668,60,44,'▶',()=>{ this.shopPage=(this.shopPage+1)%pages; this._shopSig=''; this.renderShop(); },{size:17}); this.shopAdd(nx); }
    const go=button(this,880,668,320,50,this.votedReady?'Ready ✓ — waiting for the others':'Next Wave — I\'m Ready',()=>{ if(!this.votedReady){ this.votedReady=true; NETS.link.send({t:'ready'}); this._shopSig=''; this.renderShop(); } },{size:19,disabled:this.votedReady}); this.shopAdd(go);
    this.fixNetUI(); }
  // ---------- goal choice ----------
  showGoal(){ if(this.goalOpen||this.endShown) return; this.goalOpen=true;
    const items=[]; this.goalItems=items; const gAdd=o=>{ if(o.setScrollFactor) o.setScrollFactor(0); items.push(o); return o; };
    const g=this.add.graphics().setDepth(55); g.fillStyle(0x140c07,0.95); g.fillRoundedRect(W/2-310,210,620,250,12); g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-310,210,620,250,12); gAdd(g);
    gAdd(txt(this,W/2,250,'The Goal Wave Is Cleared!',30,GOLD).setOrigin(0.5).setDepth(56));
    const isHost=NETS&&(typeof NETS.hostSlot==='number'?NETS.slot===NETS.hostSlot:NETS.slot===0);
    if(isHost){ gAdd(txt(this,W/2,300,'Endless waves go on from here — or finish the run and take the tally.',16,PARCH,{align:'center'}).setOrigin(0.5).setDepth(56));
      const c=button(this,W/2-160,396,290,54,'Continue Endless',()=>{ NETS.link.send({t:'endless',go:true}); this.hideGoal(); },{size:18}); c.setDepth(56); gAdd(c);
      const f=button(this,W/2+160,396,290,54,'Finish Run',()=>{ NETS.link.send({t:'endless',go:false}); this.hideGoal(); this.toast('Finishing the run…'); },{size:18}); f.setDepth(56); gAdd(f); }
    else gAdd(txt(this,W/2,320,'The host is choosing: endless, or finish.',17,PARCH).setOrigin(0.5).setDepth(56)); }
  hideGoal(){ this.goalOpen=false; (this.goalItems||[]).forEach(o=>{ try{ o.destroy(); }catch(e){} }); this.goalItems=[]; }
  // ---------- run end ----------
  showRunEnd(m){ if(this.endShown) return; this.endShown=true; this.runEnded=true;
    this.closeShop(); this.hideGoal(); this.connTxt.setText('');
    if(NETS&&NETS.link){ NETS.link.retryBudgetMs=0; }
    const victory=m.outcome==='victory';
    const tallies=m.tallies||[];
    const own=tallies.find(t=>t.slot===this.mySlot())||null;
    // Stars: the server's own tally wins when it carries them; otherwise
    // solo's End math — camp fraction ≥0.85 → 3, ≥0.45 → 2, else 1 for a
    // victory (a fallen camp can still end in victory only via the goal
    // clear, per the new defeat rule), 0 for defeat.
    const campFrac=this.state?Math.max(0,(this.state.campHp||0)/(this.state.campMax||CAMP_MAX)):0;
    const stars=(own&&typeof own.stars==='number')?own.stars:(victory?(campFrac>=0.85?3:(campFrac>=0.45?2:1)):0);
    if(own&&window.GXHub&&GXHub.submitScore) GXHub.submitScore(own.score,own.waves);
    if(victory) cqRecordStars('bible',stars);
    const items=[]; const eAdd=o=>{ if(o.setScrollFactor) o.setScrollFactor(0); items.push(o); return o; };
    const g=this.add.graphics().setDepth(57); g.fillStyle(0x140c07,0.96); g.fillRoundedRect(W/2-360,120,720,470,12); g.lineStyle(3,0xd9a441,1); g.strokeRoundedRect(W/2-360,120,720,470,12); eAdd(g);
    eAdd(txt(this,W/2,168,victory?'The Wall Held!':'The Camp Has Fallen',38,victory?GOLD:'#c0392b').setOrigin(0.5).setDepth(58));
    if(victory) eAdd(txt(this,W/2,214,'★'.repeat(stars)+'☆'.repeat(Math.max(0,3-stars)),32,GOLD).setOrigin(0.5).setDepth(58));
    eAdd(txt(this,W/2,254,'Room '+((NETS&&NETS.code)||'')+'  •  the tally of the watch',16,'#cdbd95').setOrigin(0.5).setDepth(58));
    tallies.forEach((t,i)=>{ const y=300+i*44, c=slotColor(t.slot,t.color);
      eAdd(txt(this,340,y,(t.name||'Watchman')+(t.slot===this.mySlot()?' (you)':''),19,c.css).setDepth(58));
      eAdd(txt(this,700,y,'Kills '+t.kills,17,PARCH).setDepth(58));
      eAdd(txt(this,830,y,'Waves '+t.waves,17,PARCH).setDepth(58));
      eAdd(txt(this,960,y,'Score '+t.score,17,PARCH).setDepth(58));
      if(typeof t.stars==='number') eAdd(txt(this,1090,y,'★'.repeat(t.stars),16,GOLD).setDepth(58)); });
    if(!tallies.length) eAdd(txt(this,W/2,320,'No tally reached the client.',16,PARCH).setOrigin(0.5).setDepth(58));
    const done=button(this,W/2,540,280,54,'Back to Menu',()=>{ if(NETS){ NETS.link.stop(); NETS=null; } this.scene.start('Menu'); },{size:20}); done.setDepth(58); eAdd(done);
    this.fixNetUI(); }
  leaveRun(){ if(NETS){ NETS.link.send({t:'leave'}); NETS.link.stop(); NETS=null; } this.scene.start('Menu'); }
  update(time,delta){ const st=this.state; if(!st) return;
    const dt=Math.min(0.05,(delta||16)/1000), f=Math.min(1,dt*10);
    let boss=null;
    this.ents.forEach(e=>{ e.rx+=(e.x-e.rx)*f; e.ry+=(e.y-e.ry)*f;
      if(e.rx<e.x-2) e.spr.setFlipX(false); else if(e.rx>e.x+2) e.spr.setFlipX(true);
      const yOff=e.kind===2?18:(e.kind===1?16:((e.def&&e.def.size)||18));
      e.spr.setPosition(e.rx,e.ry+yOff).setDepth((e.boss?9:(e.kind===2?8:7))+e.ry/1000);
      if(e.ring) e.ring.setPosition(e.rx,e.ry+8);
      if(e.nameTxt) e.nameTxt.setPosition(e.rx,e.ry-56);
      if(e.boss) boss=e; });
    // HP bars (one shared Graphics, solo's colours and widths).
    const g=this.fx; g.clear();
    this.ents.forEach(e=>{ if(e.hp>=e.mhp) return; const w=e.boss?64:32, x=e.rx-w/2, y=e.ry-(e.boss?70:40), fr=Math.max(0,e.hp/e.mhp);
      g.fillStyle(0x000000,0.7); g.fillRect(x,y,w,5);
      g.fillStyle(e.kind===0?0xa33b20:0x5aa33b,1); g.fillRect(x,y,w*fr,5); });
    // Boss plate, solo's treatment: name + gold-framed bar over the HUD line.
    if(boss){ this.bossName.setVisible(true).setText((boss.def?boss.def.name:'Champion').toUpperCase()+' — CHAMPION');
      const bb=this.bossBar, fr=Math.max(0,boss.hp/boss.mhp); bb.clear();
      bb.fillStyle(0x000000,0.7); bb.fillRect(W/2-250,HUD_Y-16,500,12); bb.fillStyle(0xa33b20,1); bb.fillRect(W/2-250,HUD_Y-16,500*fr,12);
      bb.lineStyle(2,0xd9a441); bb.strokeRect(W/2-250,HUD_Y-16,500,12); }
    else { this.bossName.setVisible(false); this.bossBar.clear(); }
    // Camp bar + the fallen camp's grey.
    if(this.campBar){ const fr=Math.max(0,(st.campHp||0)/(st.campMax||CAMP_MAX)), x=this.campPos.x-46, y=this.campPos.y-58, b=this.campBar;
      b.clear(); b.fillStyle(0x000000,0.7); b.fillRect(x,y,92,8); b.fillStyle(fr>0.3?0x5aa33b:0xa33b20,1); b.fillRect(x,y,92*fr,8); b.lineStyle(1,0xd9a441,0.9); b.strokeRect(x,y,92,8); }
    if(st.campDown&&this.campSpr&&!this._campGreyed){ this._campGreyed=true; this.campSpr.setTint(0x666666); }
    if(this.shopOpen&&this.shopTimerTxt){ const left=Math.max(0,Math.ceil(((this.shopEndsAt||0)-Date.now())/1000));
      this.shopTimerTxt.setText('Next wave in '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')); }
    this.refreshNetHUD(); } }

// ---------- scene registration ----------
// main.js's scene list is untouched: the two net scenes register with
// the running game from here. Registration is attempted at once and
// again on the game's 'ready' event, in case the manager is still
// booting when this file executes.
function netRegisterScenes(){
  try{ const g=window.__game; if(!g||!g.scene) return false;
    if(!g.scene.getScene('NetLobby')) g.scene.add('NetLobby',NetLobby,false);
    if(!g.scene.getScene('NetGame')) g.scene.add('NetGame',NetGame,false);
    return !!(g.scene.getScene('NetLobby')&&g.scene.getScene('NetGame')); }
  catch(e){ return false; } }
if(!netRegisterScenes()&&window.__game&&window.__game.events){
  window.__game.events.once('ready',netRegisterScenes); }
window.NetClient={ticket:netTicket,version:1}; // small handle for the hub/coordinator to probe
})();
