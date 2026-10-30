// Original procedural "ink and parchment" sprites drawn at boot into textures. No third-party art.
window.makeArt = function(scene){
  const INK=0x140c07;
  function tex(key,w,h,fn){ const g=scene.make.graphics({x:0,y:0,add:false}); fn(g,w,h); g.generateTexture(key,w,h); g.destroy(); }
  function blob(g,cx,cy,r,fill,jit){ // wobbly hand-drawn circle
    const pts=[]; for(let i=0;i<14;i++){ const a=i/14*Math.PI*2, rr=r*(1+(Math.random()-0.5)*(jit||0.12)); pts.push(new Phaser.Geom.Point(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr)); }
    g.fillStyle(fill,1); g.fillPoints(pts,true); g.lineStyle(3,INK,1); g.strokePoints(pts,true,true);
  }
  // --- Enemies ---
  tex('locust',32,32,(g)=>{ g.fillStyle(0xd9cfa0,0.55); g.fillEllipse(10,12,16,8); g.fillEllipse(22,12,16,8); blob(g,16,18,7,0x6b6a2a); g.fillStyle(0xff3a1a,1); g.fillCircle(13,15,1.6); g.fillCircle(19,15,1.6); g.lineStyle(2,INK); g.lineBetween(10,24,6,29); g.lineBetween(22,24,26,29);});
  tex('frog',40,40,(g)=>{ blob(g,20,23,13,0x4d6b2e); blob(g,13,12,5,0x5e7d38); blob(g,27,12,5,0x5e7d38); g.fillStyle(0xf2d03b,1); g.fillCircle(13,12,2.4); g.fillCircle(27,12,2.4); g.fillStyle(INK,1); g.fillCircle(13,12,1); g.fillCircle(27,12,1); g.lineStyle(2,INK); g.beginPath(); g.arc(20,25,6,0.2,Math.PI-0.2); g.strokePath();});
  tex('froglet',24,24,(g)=>{ blob(g,12,13,8,0x5e7d38); g.fillStyle(0xf2d03b,1); g.fillCircle(9,10,1.6); g.fillCircle(15,10,1.6);});
  tex('spearman',44,48,(g)=>{ g.lineStyle(3,INK); g.lineBetween(34,4,34,46); g.fillStyle(0xb08d4a,1); g.fillTriangle(30,8,38,8,34,0); blob(g,20,30,12,0x7a3b22); blob(g,20,13,8,0xc99a6b); g.fillStyle(0x9c7a3c,1); g.fillRect(12,5,16,6); g.lineStyle(2,INK); g.strokeRect(12,5,16,6); for(let i=0;i<5;i++){g.lineBetween(13+i*3.5,5,13+i*3.5,0);} blob(g,9,31,8,0xa8853f); g.fillStyle(INK,1); g.fillCircle(17,14,1.3); g.fillCircle(23,14,1.3);});
  tex('goliath',100,110,(g)=>{ g.lineStyle(5,INK); g.lineBetween(84,6,84,106); g.fillStyle(0x9c7a3c,1); g.fillTriangle(76,16,92,16,84,0); blob(g,50,72,32,0x7a3b22,0.08); g.fillStyle(0xa8853f,1); for(let i=0;i<4;i++){ g.fillRect(26,52+i*10,48,6);} blob(g,50,30,18,0xc99a6b,0.06); g.fillStyle(0x9c7a3c,1); g.fillRect(32,10,36,12); g.lineStyle(3,INK); g.strokeRect(32,10,36,12); g.fillStyle(INK,1); g.fillRect(41,28,6,3); g.fillRect(54,28,6,3); g.lineStyle(3,INK); g.lineBetween(42,40,58,40); blob(g,18,74,16,0xa8853f,0.05); g.lineStyle(2,INK); g.strokeCircle(18,74,8);});
  tex('bearer',36,40,(g)=>{ blob(g,18,24,11,0x6b3a22); blob(g,18,10,7,0xc99a6b); g.fillStyle(0xa8853f,1); g.fillRect(2,12,14,26); g.lineStyle(3,INK); g.strokeRect(2,12,14,26);});
  // --- Towers (base then tier pips added in code) ---
  tex('t_sling',56,56,(g)=>{ blob(g,28,36,18,0x6e5a3a); g.lineStyle(4,INK); g.lineBetween(20,34,28,14); g.lineBetween(36,34,28,14); g.fillStyle(0xc9a46a,1); g.fillCircle(28,14,6); g.lineStyle(2,INK); g.strokeCircle(28,14,6);});
  tex('t_altar',56,56,(g)=>{ g.fillStyle(0x7b6b55,1); g.fillRect(12,28,32,22); g.lineStyle(3,INK); g.strokeRect(12,28,32,22); for(let i=0;i<3;i++){ g.lineBetween(12,35+i*7,44,35+i*7);} g.fillStyle(0xd8572a,1); g.fillTriangle(16,28,40,28,28,4); g.fillStyle(0xf2c14e,1); g.fillTriangle(21,28,35,28,28,12);});
  tex('t_trumpet',56,56,(g)=>{ blob(g,28,40,14,0x6e5a3a); g.fillStyle(0xe0c25a,1); g.fillTriangle(8,8,22,18,8,24); g.fillTriangle(48,8,34,18,48,24); g.lineStyle(3,INK); g.strokeTriangle(8,8,22,18,8,24); g.strokeTriangle(48,8,34,18,48,24); g.lineBetween(22,18,28,32); g.lineBetween(34,18,28,32);});
  tex('t_cloud',56,56,(g)=>{ blob(g,28,46,10,0x8d8f95); blob(g,20,28,11,0xbfc8d6); blob(g,34,24,12,0xcfd6e0); blob(g,28,12,9,0xe2e7ee);});
  // --- Hero David ---
  tex('david',40,48,(g)=>{ blob(g,20,32,11,0x8a6a3c); blob(g,20,15,8,0xd9b48a); g.fillStyle(0x5a3a1e,1); g.fillEllipse(20,9,16,7); g.fillStyle(INK,1); g.fillCircle(17,16,1.2); g.fillCircle(23,16,1.2); g.lineStyle(2,INK); g.lineBetween(30,24,36,14); g.fillStyle(0xd8d0c0,1); g.fillCircle(36,13,3);});
  // --- Projectiles / fx ---
  tex('stone',16,16,(g)=>{ g.fillStyle(0x000000,0.35); g.fillCircle(9,10,5); g.fillStyle(0x8a8274,1); g.fillCircle(8,8,5); g.fillStyle(0xc8c0b0,1); g.fillCircle(6.5,6.5,2); g.lineStyle(2,INK); g.strokeCircle(8,8,5);});
  tex('ember',24,24,(g)=>{ g.fillStyle(0xd8572a,0.25); g.fillCircle(12,12,11); g.fillStyle(0xd8572a,0.6); g.fillCircle(12,12,7); g.fillStyle(0xf2c14e,1); g.fillCircle(12,12,4.5); g.fillStyle(0xfff3c0,1); g.fillCircle(11,11,2);});
  tex('spark',8,8,(g)=>{ g.fillStyle(0xffffff,1); g.fillCircle(4,4,3);});
  // --- Field coins (Upgrade 3): gold disc with a darker rim, an inner ring and a star heart ---
  tex('coin',26,26,(g)=>{ g.fillStyle(0xd9a441,1); g.fillCircle(13,13,11); g.lineStyle(2,0x8a6420,1); g.strokeCircle(13,13,11); g.lineStyle(1.5,0xa87a28,1); g.strokeCircle(13,13,7); g.fillStyle(0xf2c14e,1); g.fillTriangle(13,8.5,14.6,11.8,18,11.8,15.2,13.8,16.4,17.5,13,15.4,9.6,17.5,10.8,13.8,8,11.8,11.4,11.8); });
  // Grokonian coin: same coin, struck brighter — pale gold with a white-hot ring.
  tex('coing',26,26,(g)=>{ g.fillStyle(0xf2c14e,1); g.fillCircle(13,13,11); g.lineStyle(2,0xd9a441,1); g.strokeCircle(13,13,11); g.lineStyle(1.5,0xfff3c0,1); g.strokeCircle(13,13,7); g.fillStyle(0xfff8dd,1); g.fillTriangle(13,8.5,14.6,11.8,18,11.8,15.2,13.8,16.4,17.5,13,15.4,9.6,17.5,10.8,13.8,8,11.8,11.4,11.8); });
  tex('spear',40,8,(g)=>{ g.fillStyle(0x5a4020,1); g.fillRect(0,3,32,2); g.fillStyle(0x9c7a3c,1); g.fillTriangle(30,0,40,4,30,8);});
  // Ark of the covenant shown as a simple tent camp (no depiction of holy objects in combat)
  tex('camp',90,70,(g)=>{ g.fillStyle(0x8a6a3c,1); g.fillTriangle(5,65,45,8,85,65); g.lineStyle(3,INK); g.strokeTriangle(5,65,45,8,85,65); g.fillStyle(0x3a2412,1); g.fillTriangle(35,65,45,35,55,65); g.lineBetween(45,8,45,0);});
};
window.makeArt2=function(scene){ const INK=0x140c07;
 function tex(k,w,h,fn){const g=scene.make.graphics({add:false});fn(g);g.generateTexture(k,w,h);g.destroy();}
 function person(k,robe,extra){tex(k,40,48,g=>{g.fillStyle(robe,1);g.fillEllipse(20,32,22,24);g.lineStyle(3,INK);g.strokeEllipse(20,32,22,24);g.fillStyle(0xd9b48a,1);g.fillCircle(20,15,8);g.strokeCircle(20,15,8);g.fillStyle(INK,1);g.fillCircle(17,16,1.2);g.fillCircle(23,16,1.2);extra&&extra(g);});}
 person('deborah',0x6a4a7a,g=>{g.fillStyle(0x3a2a4a,1);g.fillTriangle(10,14,30,14,20,2);g.lineStyle(3,0x4a7a3a);g.lineBetween(33,40,33,10);});
 person('gideon',0x4a6a5a,g=>{g.fillStyle(0xf2c14e,1);g.fillCircle(34,22,4);g.lineStyle(2,INK);g.strokeCircle(34,22,4);});
 person('samson',0x7a3b22,g=>{g.lineStyle(4,0x2a1a0a);for(let i=0;i<7;i++)g.lineBetween(13+i*2,9,8+i*4,30);g.fillStyle(0xe8e0c8,1);g.fillTriangle(30,30,38,18,36,34);});
 tex('priest',40,44,g=>{g.fillStyle(0x4a2a3a,1);g.fillEllipse(20,30,22,24);g.lineStyle(3,INK);g.strokeEllipse(20,30,22,24);g.fillStyle(0xc99a6b,1);g.fillCircle(20,13,7);g.strokeCircle(20,13,7);g.fillStyle(0x8a7a2a,1);g.fillTriangle(12,8,28,8,20,-2);g.lineStyle(2,0x6a5a2a);g.lineBetween(34,42,34,8);g.fillStyle(0x6a5a2a,1);g.fillCircle(34,7,3);});
 tex('golem',56,60,g=>{g.fillStyle(0x6a6458,1);g.fillRect(12,18,32,36);g.lineStyle(4,INK);g.strokeRect(12,18,32,36);g.fillStyle(0x7a7468,1);g.fillRect(18,4,20,16);g.strokeRect(18,4,20,16);g.fillStyle(0xd8572a,1);g.fillRect(22,10,4,3);g.fillRect(30,10,4,3);g.lineStyle(2,INK);g.lineBetween(16,30,30,40);g.lineBetween(36,24,40,46);});
};
