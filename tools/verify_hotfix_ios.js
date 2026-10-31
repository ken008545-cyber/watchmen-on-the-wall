#!/usr/bin/env node
// iPhone fullscreen hotfix verification — the installable-app route
// (kennin, 2026-10-31: Abel on iPhone, where Safari has no Fullscreen
// API for page elements; kennin's Samsung works). Batteries:
// (1) statics — the manifest link and Apple declarations in the shell,
//     viewport-fit=cover, safe-area CSS around the canvas;
// (2) the manifest itself — required fields, kennin's colors, and the
//     three icon routes with their real PNG dimensions on disk;
// (3) the pure displayMode function over a UA matrix: iPhone Safari
//     (install help), iPhone standalone by either signal (already
//     fullscreen — the button hides), iPadOS in its desktop disguise,
//     an iPhone that CAN fullscreen (the capability, not the badge,
//     decides), Android Chrome and desktop (native fullscreen);
// (4) the panel and the route, in a stubbed scene — the exact help
//     sentence, one panel only, the field sealed behind it, a clean
//     close, and standalone/native routes opening nothing;
// (5) the deliberate absence: no service worker anywhere in main.js.
// The install flow itself cannot be proven here — it takes Abel's
// real iPhone (Add to Home Screen, then launch from the icon).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- statics: the shell ----------
const html = read('index.html');
const main = read('js/main.js');
ok(html.includes('viewport-fit=cover'), 'the viewport paints edge-to-edge: viewport-fit=cover');
ok(html.includes('<link rel="manifest" href="manifest.webmanifest">'), 'index.html carries the manifest link');
ok(html.includes('name="apple-mobile-web-app-capable" content="yes"') && html.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"'),
  'the Apple declarations stand: capable = yes, status bar black-translucent');
ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="assets/icons/apple-touch-icon.png">'), 'the apple-touch-icon points at the 180 derivative on the KV icon route');
ok(['safe-area-inset-top', 'safe-area-inset-right', 'safe-area-inset-bottom', 'safe-area-inset-left'].every(v => html.includes('env(' + v)), 'the canvas container is padded by all four safe-area insets');
ok(html.includes('max-width:calc(100vw - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px))') && html.includes('max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))'),
  'the canvas itself is capped inside the safe area — battle circles clear the notch and the home indicator');

// ---------- the manifest and its icons ----------
const manifest = JSON.parse(read('manifest.webmanifest'));
ok(manifest.name === 'Watchmen on the Wall' && manifest.short_name === 'Watchmen' && manifest.display === 'standalone' && manifest.orientation === 'landscape' &&
   manifest.background_color === '#0d0906' && manifest.theme_color === '#0d0906' && manifest.start_url === '.' && manifest.scope === '.',
  'the manifest: Watchmen on the Wall, standalone, landscape, the stone-hall colors, the game root as start and scope');
ok(Array.isArray(manifest.icons) && manifest.icons.length === 3 && manifest.icons.every(i => i.type === 'image/png') &&
   manifest.icons.some(i => i.sizes === '192x192' && i.src === 'assets/icons/icon-192.png') && manifest.icons.some(i => i.sizes === '512x512' && i.src === 'assets/icons/icon-512.png'),
  'the manifest names its icons on the KV route: 192 and 512 (plus the 180 Apple icon)');
function pngSize(p) { const b = fs.readFileSync(path.join(ROOT, p));
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }; }
{ const i192 = pngSize('assets/icons/icon-192.png'), i512 = pngSize('assets/icons/icon-512.png'), i180 = pngSize('assets/icons/apple-touch-icon.png');
  ok(i192 && i192.w === 192 && i192.h === 192 && i192.bytes > 1000, 'icon-192.png is a real 192x192 PNG (' + (i192 ? i192.bytes : 0) + ' bytes)');
  ok(i512 && i512.w === 512 && i512.h === 512 && i512.bytes > 1000, 'icon-512.png is a real 512x512 PNG (' + (i512 ? i512.bytes : 0) + ' bytes)');
  ok(i180 && i180.w === 180 && i180.h === 180 && i180.bytes > 1000, 'apple-touch-icon.png is a real 180x180 PNG (' + (i180 ? i180.bytes : 0) + ' bytes)'); }

// ---------- main.js statics ----------
ok(main.includes('function displayMode(env)') && main.includes("const IOS_FS_HELP='On iPhone, install the game for true fullscreen: tap Share, then Add to Home Screen — it opens like an app, full screen.'"),
  'main.js: the pure displayMode function and the exact install sentence the panel speaks');
ok(main.includes('function showIOSFullscreenHelp(s)') && main.includes('function fullscreenRoute(s)') &&
   (main.match(/displayMode\(\)\.mode==='standalone'/g) || []).length >= 2 && (main.match(/startFullscreen/g) || []).length >= 2,
  'both Fullscreen buttons route through the hotfix, hide in standalone, and still call startFullscreen on the native route');
ok(!/serviceWorker/.test(main), 'no service worker — deliberate: stale builds have bitten this project before, and iOS installability needs none');

// ---------- runtime scaffolding (the U17/U18 pattern) ----------
const store = {};
const ctx = {
  console, performance, setTimeout, clearInterval, setInterval,
  Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  Phaser: {
    Scene: class {}, AUTO: 1,
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Game: class { constructor(cfg) { ctx.__cfg = cfg; } },
    Math: { Distance: { Between: (a, b, c, d) => Math.hypot(c - a, d - b) }, Between: (a, b) => a, Angle: { Between: () => 0 } },
    Geom: { Point: class { constructor(x, y) { this.x = x; this.y = y; } } },
    Utils: { Array: { GetRandom: a => a[0] } }
  },
  SFX: new Proxy({}, { get: () => () => null }),
  Music: { play() {}, toggle: () => true, enabled: () => true },
  Progress: { init() {}, perks: () => ({ hp: 1, dmg: 1, cd: 1 }), data: { xp: { kill: 1, wave: 2, perfectWave: 3, clear: 4, perfectClear: 5 } }, takeEvents: () => [],
    track() {}, addXP() {}, level: () => ({ lv: 1, into: 0, need: 100 }), mastery: () => ({ lv: 0, max: false }), bpTier: () => 0 },
  Tokens: { earn() {}, spend: () => true, balance: () => 1000, milestone: () => true, setMilestone() {} },
  Levels: { init() {} },
  makeArt() {}, makeArt2() {}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(main, ctx, { filename: 'main.js' });
const displayMode = vm.runInContext('displayMode', ctx);
const IOS_FS_HELP = vm.runInContext('IOS_FS_HELP', ctx);
const showIOSFullscreenHelp = vm.runInContext('showIOSFullscreenHelp', ctx);
const fullscreenRoute = vm.runInContext('fullscreenRoute', ctx);
const GameProto = vm.runInContext('Game.prototype', ctx);

// ---------- the UA matrix over the pure function ----------
const NO_FS = { documentElement: {} };
const NATIVE_FS = { documentElement: { requestFullscreen() {} } };
const WEBKIT_FS = { documentElement: { webkitRequestFullscreen() {} } };
const browserWin = { matchMedia: () => ({ matches: false }) };
const standaloneWin = { matchMedia: q => ({ matches: q === '(display-mode: standalone)' }) };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S918U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAC_TOUCH = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const env = (navigator, window, document) => ({ navigator, window, document });

{ const st = displayMode(env({ userAgent: IPHONE, platform: 'iPhone' }, browserWin, NO_FS));
  ok(st.mode === 'ios-install', 'UA matrix: iPhone Safari without the Fullscreen API routes to the install help');
  ok(st.showButton === true && st.installHelp === true && st.standalone === false, '…the button still stands there — it now tells the truth instead of failing silently'); }
{ const st = displayMode(env({ userAgent: IPHONE, platform: 'iPhone', standalone: true }, browserWin, NO_FS));
  ok(st.mode === 'standalone' && st.showButton === false, 'UA matrix: iPhone launched from the home screen (navigator.standalone) — standalone, the button hides'); }
{ const st = displayMode(env({ userAgent: IPHONE, platform: 'iPhone' }, standaloneWin, NO_FS));
  ok(st.mode === 'standalone' && st.showButton === false, 'UA matrix: display-mode: standalone says the same — already fullscreen, button hidden'); }
{ const st = displayMode(env({ userAgent: MAC_TOUCH, platform: 'MacIntel', maxTouchPoints: 5 }, browserWin, NO_FS));
  ok(st.mode === 'ios-install' && st.ios === true, 'UA matrix: iPadOS in its desktop disguise (MacIntel + touch) is still iOS'); }
{ const st = displayMode(env({ userAgent: IPHONE, platform: 'iPhone' }, browserWin, WEBKIT_FS));
  ok(st.mode === 'browser' && st.canFullscreen === true && st.installHelp === false, 'UA matrix: an iOS browser that CAN fullscreen takes the native route — capability decides, not the badge'); }
{ const st = displayMode(env({ userAgent: ANDROID, platform: 'Linux armv8l' }, browserWin, NATIVE_FS));
  ok(st.mode === 'browser' && st.ios === false, 'UA matrix: Android Chrome (kennin\'s Samsung) — untouched, the native route');
  ok(st.canFullscreen === true && st.showButton === true && st.installHelp === false, '…with real fullscreen available and no install panel'); }
{ const st = displayMode(env({ userAgent: DESKTOP, platform: 'Win32' }, browserWin, NATIVE_FS));
  ok(st.mode === 'browser' && st.ios === false && st.canFullscreen === true, 'UA matrix: desktop — the native route, exactly as before'); }

// ---------- the panel and the route, in a stubbed scene ----------
function mkObj() { const o = { _t: null, _handlers: {}, x: 0, y: 0, active: true, _visible: true, _scale: 1 };
  ['setDepth', 'setOrigin', 'setAlpha', 'setScrollFactor', 'setSize', 'setStrokeStyle', 'setColor', 'setDisplaySize'].forEach(m => { o[m] = () => o; });
  o.setVisible = v => { o._visible = v; return o; };
  o.setScale = s => { o._scale = s; return o; };
  o.setInteractive = () => o;
  o.setPosition = (x, y) => { o.x = x; o.y = y; return o; };
  o.setText = t => { o._t = t; return o; };
  o.add = () => o;
  o.on = (ev, cb) => { o._handlers[ev] = cb; return o; };
  o.destroy = () => { o._destroyed = true; o.active = false; };
  return o; }
function gfxObj() { const o = mkObj(); ['clear', 'fillStyle', 'fillRoundedRect', 'fillRect', 'lineStyle', 'strokeRoundedRect', 'strokeRect', 'lineBetween', 'fillCircle', 'strokeCircle', 'fillEllipse', 'fillPoints', 'fillTriangle', 'strokeTriangle', 'arc', 'beginPath', 'strokePath'].forEach(m => { o[m] = () => o; }); return o; }
function panelScene() { const texts = [];
  const s = { _iosFsPanel: null, _texts: texts,
    add: { graphics: () => gfxObj(),
      text: (x, y, str) => { const o = mkObj(); o._t = str; o.x = x; o.y = y; texts.push(o); return o; },
      image: (x, y) => { const o = mkObj(); o.x = x; o.y = y; o.height = 120; return o; },
      container: (x, y) => { const o = mkObj(); o.x = x; o.y = y; return o; } } };
  return s; }
function setGlobals(navigator, window, document) { ctx.navigator = navigator; ctx.window = window; ctx.document = document; }
function clearGlobals() { delete ctx.navigator; delete ctx.document; ctx.window = ctx; }

{ clearGlobals();
  setGlobals({ userAgent: IPHONE, platform: 'iPhone' }, Object.assign(Object.create(ctx), { matchMedia: () => ({ matches: false }) }), NO_FS);
  // displayMode() reads the globals through window/navigator/document:
  // window must be the object carrying matchMedia, so point it there.
  ctx.window = { matchMedia: () => ({ matches: false }) };
  const s = panelScene();
  ok(fullscreenRoute(s) === 'install' && Array.isArray(s._iosFsPanel), 'the route: an iPhone browser tap routes to install and the panel opens');
  ok(s._texts.some(t => t._t === IOS_FS_HELP) && s._texts.some(t => t._t === 'FULLSCREEN ON IPHONE'), 'the panel speaks the exact sentence: Share, then Add to Home Screen');
  ok(showIOSFullscreenHelp(s) === false && s._iosFsPanel.length === 4, 'one panel only — a second open is refused (backdrop, title, sentence, Got it)');
  const g = Object.create(GameProto); g._iosFsPanel = s._iosFsPanel; g.over = false; g.shopOpen = false; g.victoryOpen = false;
  let marched = 'sealed'; try { g.onTap({ x: 300, y: 300 }); } catch (e) { marched = 'threw: ' + e.message; }
  ok(marched === 'sealed', 'while the panel stands, a field tap is sealed — no march order slips underneath it');
  const closeBtn = s._iosFsPanel[3]; const pieces = s._iosFsPanel.slice();
  closeBtn._handlers.pointerup({}, 0, 0, { stopPropagation() {} });
  ok(s._iosFsPanel === null && pieces.every(t => t._destroyed), 'Got it closes the panel clean and destroys every piece of it');
  clearGlobals(); }
{ const s = panelScene();
  ctx.window = { matchMedia: q => ({ matches: q === '(display-mode: standalone)' }) };
  ctx.navigator = { userAgent: IPHONE, platform: 'iPhone' }; ctx.document = NO_FS;
  ok(fullscreenRoute(s) === 'standalone' && s._iosFsPanel === null, 'the route: standalone answers standalone and opens nothing — it is already fullscreen');
  clearGlobals(); }
{ const s = panelScene();
  ctx.window = { matchMedia: () => ({ matches: false }) };
  ctx.navigator = { userAgent: ANDROID, platform: 'Linux armv8l' }; ctx.document = NATIVE_FS;
  ok(fullscreenRoute(s) === 'native' && s._iosFsPanel === null, 'the route: Android answers native — the button calls startFullscreen as it always did');
  clearGlobals(); }

console.log(fails === 0 ? 'ALL PASS (' + total + ' checks)' : fails + ' FAILURES of ' + total);
process.exit(fails ? 1 : 0);
