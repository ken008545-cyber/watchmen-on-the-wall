#!/usr/bin/env node
// Upgrade 21 verification harness — GX SIGN-IN INSIDE THE GAME
// (kennin, 2026-10-31: "you should be able to sign into your GX account
// into in the game" — Abel, standalone on his iPhone, was a guest in his
// own account's game). Batteries:
// (1) statics — the token door stands in gxhub.js, the reconcile in
//     tokens.js, the GX Account scene in main.js (door, mask, hub link),
//     the ticket fallback in net.js; the password is never a stored
//     value anywhere in the game;
// (2) mode law — frame wins (welcome -> hub mode, postMessage chunks,
//     and NOT ONE fetch: a hosted game never networks), token second
//     (standalone + stored token -> direct), local third;
// (3) sign-in — wrong password refused with the hub's own words and
//     nothing stored; success stores ONLY {token, username, player,
//     exp}, flips the mode to direct, and reconciles the wallet to the
//     hub balance through Tokens.syncTo;
// (4) the direct door at work — earns chunked at 10 and paced like the
//     frame's, every call carrying the bearer; spend and score and the
//     multiplayer ticket all ride it; hub balance callbacks fire;
// (5) revocation — a hub 401 mid-session clears the token, drops the
//     mode to local, sets the visible note and fires onSessionEnded;
//     an expired stored token does the same at boot, quietly;
// (6) boot reconcile — a fresh standalone boot with a live token asks
//     the hub its balance and the wallet mirrors it.
// The hub is a scripted fetch double implementing the U21 API contract;
// the LIVE end-to-end (real accounts, real caps, real revocation) was
// proven against hub.gxhub.workers.dev at build time and is recorded in
// BUILD-NOTES — this suite guards the client half forever.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fails = 0, total = 0;
function ok(cond, label) { total++; console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails++; }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const TOK = 'a'.repeat(96), PLAYER = 'p_abelabelabelab01';
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

// ---------- a scripted hub ----------
function hubDouble(state) {
  return async (url, fo) => {
    const p = String(url).replace('https://hub.gxhub.workers.dev', '');
    const auth = (fo && fo.headers && fo.headers.authorization) || '';
    const body = fo && fo.body ? JSON.parse(fo.body) : {};
    state.calls.push({ p, auth, body });
    const resp = (status, obj) => ({ status, ok: status < 300, json: async () => obj });
    if (p === '/api/game-login') {
      if (body.username === 'abel' && body.password === 'pw-test-1234')
        return resp(200, { ok: true, token: TOK, username: 'abel', player: PLAYER, expires_ms: Date.now() + 30 * 864e5, balance: state.balance });
      return resp(401, { error: 'wrong username or password' });
    }
    if (state.revoked || auth !== 'Bearer ' + TOK) return resp(401, { error: 'sign in first' });
    if (p === '/api/game/earn') { state.balance += body.amount; return resp(200, { ok: true, amount: body.amount, balance: state.balance }); }
    if (p === '/api/game/spend') { if (state.balance < body.amount) return resp(402, { error: 'not enough Grokonians' }); state.balance -= body.amount; return resp(200, { ok: true, balance: state.balance }); }
    if (p === '/api/game/me') return resp(200, { ok: true, username: 'abel', player: PLAYER, balance: state.balance });
    if (p === '/api/game/score') return resp(200, { ok: true, rank: 3 });
    if (p === '/api/game/ticket') return resp(200, { ok: true, ticket: 't'.repeat(64), player: PLAYER, username: 'abel' });
    if (p === '/api/game/logout') return resp(200, { ok: true });
    return resp(404, { error: 'not found' });
  };
}

// ---------- a browser double ----------
function makeEnv(opts) {
  const store = new Map(Object.entries(opts.store || {}));
  const state = { balance: opts.balance != null ? opts.balance : 42, revoked: false, calls: [] };
  const posted = [], timers = [], msgHandlers = [];
  const sandbox = {
    console, JSON, Math, Date, Number, String, Object, Array, Set, Map, Promise, isFinite,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    fetch: hubDouble(state),
    addEventListener: (t, f) => { if (t === 'message') msgHandlers.push(f); }
  };
  sandbox.window = sandbox;
  sandbox.parent = opts.inHub ? { postMessage: m => posted.push(m) } : sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/gxhub.js'), sandbox, { filename: 'gxhub.js' });
  if (opts.withTokens !== false) vm.runInContext(read('js/tokens.js'), sandbox, { filename: 'tokens.js' });
  return { sandbox, store, state, posted, timers, msgHandlers,
    runTimers(n) { let c = 0; while (timers.length && c < (n || 60)) { timers.shift().fn(); c++; } },
    dispatch(data) { msgHandlers.forEach(f => f({ source: sandbox.parent, data })); } };
}

(async () => {
  // ---------- (1) statics ----------
  const gx = read('js/gxhub.js'), tk = read('js/tokens.js'), main = read('js/main.js'), net = read('js/net.js');
  ok(gx.includes("HUB_API='https://hub.gxhub.workers.dev'") && gx.includes("'/api/game-login'") && gx.includes("'gxhub_wotw_gametoken_v1'"),
    'the token door stands: hub API origin, the game-login call, the guarded token key');
  ok(gx.includes("get mode(){ return inHub?'hub':(gtok?'direct':'local'); }"),
    'the mode law is one line: frame wins, token second, local third');
  ok(gx.includes('saveToken({token:j.token,username:j.username,player:j.player,exp:j.expires_ms})') && !/password\s*:/.test(gx.slice(gx.indexOf('saveToken({'))),
    'sign-in stores exactly {token, username, player, exp} — no password field exists to store');
  ok(!/localStorage\.setItem\([^)]*password/i.test(gx + tk + main + net),
    'no file in the game writes a password to localStorage, ever');
  ok(tk.includes("GXHub.mode==='direct'&&GXHub.fetchMe") && tk.includes('syncTo(n)'),
    'tokens.js reconciles only in direct mode, through syncTo — frame/local paths untouched');
  ok(main.includes("super('GXAccount')") && main.includes('Armory,GXAccount,BattlePass') && main.includes("scene.start('GXAccount')"),
    'the GX Account scene exists, is registered, and the Menu door opens it');
  ok(main.includes("'•'.repeat(") && main.includes("window.open('https://hub.gxhub.workers.dev/login','_blank')"),
    'the panel masks the password and sends account creation to the hub, where it belongs');
  ok(net.includes('GXHub.fetchTicket') && net.includes("postMessage({type:'multiplayer:ticket'}") &&
     net.indexOf('if(!inHub){ // Upgrade 21') > net.indexOf('function netTicket()') &&
     net.indexOf('GXHub.fetchTicket') > net.indexOf('if(!inHub){ // Upgrade 21') &&
     net.indexOf("postMessage({type:'multiplayer:ticket'}") > net.indexOf('GXHub.fetchTicket'),
    'net.js: the token ticket lives inside the standalone branch of netTicket; the frame postMessage path stands after it, reached only in a frame');

  // ---------- (2)+(3) local mode, then sign-in ----------
  {
    const env = makeEnv({ inHub: false });
    const G = env.sandbox.GXHub, T = env.sandbox.Tokens;
    ok(G.mode === 'local' && T.mode === 'local', 'standalone with no token: local mode on both modules');
    G.earn(25, 'play'); env.runTimers();
    ok(env.state.calls.length === 0 && env.posted.length === 0, 'local mode: GXHub.earn touches no network and no frame');
    T.earn('play', 5); ok(T.balance() === 5, 'local wallet still banks locally, as ever');
    const bad = await G.signIn('abel', 'wrong-password');
    ok(!bad.ok && bad.error === 'wrong username or password' && !env.store.has('gxhub_wotw_gametoken_v1'),
      'wrong password: the hub\u2019s own refusal, and nothing is stored');
    const good = await G.signIn('abel', 'pw-test-1234');
    ok(good.ok && good.username === 'abel' && G.mode === 'direct', 'sign-in succeeds: the mode flips to direct');
    const stored = JSON.parse(env.store.get('gxhub_wotw_gametoken_v1'));
    ok(stored.token === TOK && stored.username === 'abel' && stored.player === PLAYER && typeof stored.exp === 'number' &&
       !env.store.get('gxhub_wotw_gametoken_v1').includes('pw-test-1234'),
      'the stored token record is {token, username, player, exp} — the password is nowhere in it');
    ok(T.balance() === 42, 'sign-in reconciles the wallet to the hub balance (42) via syncTo');
  }

  // ---------- (4) the direct door at work ----------
  {
    const env = makeEnv({ inHub: false, store: { gxhub_wotw_gametoken_v1: JSON.stringify({ token: TOK, username: 'abel', player: PLAYER, exp: Date.now() + 864e5 }) } });
    const G = env.sandbox.GXHub;
    ok(G.mode === 'direct' && G.account && G.account.username === 'abel', 'a stored live token boots straight into direct mode');
    const seen = []; G.onBalance(b => seen.push(b));
    G.earn(25, 'play'); env.runTimers(); await flush();
    const earns = env.state.calls.filter(c => c.p === '/api/game/earn');
    ok(earns.length === 3 && earns.map(c => c.body.amount).join(',') === '10,10,5',
      'direct earns chunk at 10 like the frame\u2019s: 25 -> 10, 10, 5');
    ok(earns.every(c => c.auth === 'Bearer ' + TOK), 'every direct earn carries the bearer token');
    ok(env.state.balance === 67 && G.hubBalance === 67 && seen[seen.length - 1] === 67,
      'the hub balance answers back and the balance listeners hear it (67)');
    G.spend('orb:strength', 17); await flush();
    const spend = env.state.calls.find(c => c.p === '/api/game/spend');
    ok(spend && spend.body.item === 'orb:strength' && spend.body.amount === 17 && env.state.balance === 50,
      'direct spend posts the item and cost; the hub balance falls to 50');
    G.submitScore(500, 3); await flush();
    const score = env.state.calls.find(c => c.p === '/api/game/score');
    ok(score && score.body.score === 500 && score.body.waves === 3, 'direct score submission rides the same door');
    const ticket = await G.fetchTicket();
    ok(ticket.ok && ticket.ticket.length === 64 && ticket.username === 'abel', 'the token door issues the multiplayer ticket');
    await G.signOut(); await flush();
    ok(G.mode === 'local' && !env.store.has('gxhub_wotw_gametoken_v1'), 'sign-out revokes and clears: back to local');
  }

  // ---------- (5) revocation mid-session + at boot ----------
  {
    const env = makeEnv({ inHub: false, store: { gxhub_wotw_gametoken_v1: JSON.stringify({ token: TOK, username: 'abel', player: PLAYER, exp: Date.now() + 864e5 }) } });
    const G = env.sandbox.GXHub;
    let ended = null; G.onSessionEnded(n => { ended = n; });
    env.state.revoked = true;
    G.earn(10, 'play'); env.runTimers(); await flush();
    ok(G.mode === 'local' && !env.store.has('gxhub_wotw_gametoken_v1'),
      'a hub 401 mid-session clears the token and drops the mode to local');
    ok(typeof G.sessionNote === 'string' && G.sessionNote.includes('Sign in again') && ended === G.sessionNote,
      'the ending is VISIBLE: a note stands where the panel will show it, and listeners are told');
    const env2 = makeEnv({ inHub: false, store: { gxhub_wotw_gametoken_v1: JSON.stringify({ token: TOK, username: 'abel', player: PLAYER, exp: Date.now() - 1000 }) } });
    ok(env2.sandbox.GXHub.mode === 'local' && !env2.store.has('gxhub_wotw_gametoken_v1') && /expired/.test(env2.sandbox.GXHub.sessionNote || ''),
      'an expired stored token clears itself at boot and leaves the same honest note');
  }

  // ---------- (6) boot reconcile ----------
  {
    const env = makeEnv({ inHub: false, balance: 77, store: { gxhub_wotw_gametoken_v1: JSON.stringify({ token: TOK, username: 'abel', player: PLAYER, exp: Date.now() + 864e5 }) } });
    await flush();
    ok(env.sandbox.Tokens.balance() === 77, 'boot in direct mode: the wallet mirrors the hub balance (77) before a single earn');
  }

  // ---------- (2b) the frame still wins, and never networks ----------
  {
    const env = makeEnv({ inHub: true, store: { gxhub_wotw_gametoken_v1: JSON.stringify({ token: TOK, username: 'abel', player: PLAYER, exp: Date.now() + 864e5 }) } });
    const G = env.sandbox.GXHub;
    ok(env.posted.length && env.posted[0].type === 'grokonians:hello', 'in the frame, the game still says hello first');
    env.dispatch({ type: 'grokonians:welcome' });
    ok(G.mode === 'hub', 'frame + token both present: the FRAME wins');
    G.earn(25, 'play'); env.runTimers(); await flush();
    const posts = env.posted.filter(m => m.type === 'grokonians:earn');
    ok(posts.length === 3 && posts.map(m => m.amount).join(',') === '10,10,5' && env.state.calls.length === 0,
      'frame earns stay postMessage chunks (10, 10, 5) — and the hosted game makes NOT ONE fetch');
    const t = await G.fetchTicket();
    ok(!t.ok, 'fetchTicket refuses in frame mode — the frame relay is the only ticket door there');
  }

  console.log(fails ? `\n${fails}/${total} FAILURES` : `\nALL ${total} CHECKS PASSED`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
