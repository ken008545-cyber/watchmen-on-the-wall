# Conquest Build — Notes (branch `muse/test`, local only, nothing pushed)

First playable CONQUEST vertical slice of Watchmen on the Wall, built 2026-10-30
against `~/workspace/watchmen-conquest/SPEC.md`. Tower defense is retired.

## What was built
- **Kept as-is:** Phaser shell, main menu, heroes + mastery + skills/ults,
  Battle Pass, Profile, Unlocks, and the Grokonian token system
  (`js/tokens.js`, `js/gxhub.js`, `js/progress.js` untouched — diff confirms
  zero changes to those files). Unlocks heading renamed "Tower styles" →
  "Unit styles" (labels only; skins now tint squads).
- **Era select replaces WorldMap/LevelMap** (`EraSelect` scene): 7 eras —
  Bible playable (bg_elah), Roman / Medieval / Colonial / Civil War /
  WWI-WWII / Modern shown locked with "battlefield art in progress".
- **New data:** `data/eras.json` (7 eras, goalWave 10, squadCap 8,
  startManna 340) and `data/units.json` (all 7 eras: player + enemy lines,
  roles infantry/ranged/shield/spear, costs/upgrades/bounties).
  Bible page-1 numbers match the SPEC shop sample **exactly** (verified by
  script): Militia 110/9/155 with Stout/Rush branch at 270, Slinger 80/11/190
  Max tier, Shieldman 300/7/224 with Bulwark 585, Spearman 190/13/180,
  Swordsman of Gideon 190/17/293 with Drill t1 255, Benjamite Archer
  90/15/241 with Drill t1 210. Bible has a second shop page (6 more units,
  extrapolated). Other eras: 6 player + 4 enemy units each, extrapolated.
- **Battle (new `Game` scene):** hero on the field; tap ground → hero moves,
  squads follow in formation; enemies spawn from the right edge and advance
  on squads/hero/camp; auto-attacks in range (melee instant, ranged
  projectiles); hero auto-attacks and keeps all v1 skills/ults (tower buffs
  remapped to squad buffs); hero down → 10s respawn at camp (as v1);
  enemies reaching the camp cost lives (boss-scaled champion costs 5).
  Day/night alternates by wave (night: dark overlay, enemies +8% speed,
  player ranged +10% range). Goal wave 10 = run clear; stars: 3 = no lives
  lost, 2 = at least half lives left, 1 = clear (stored per era in
  localStorage `gxhub_wotw_conquest_v1`). Clearing the goal offers
  **Continue Endless** or **Finish run**; endless waves continue on the
  flattened curve. Header always shows the current wave and the correct
  goal wave (the SPEC's "Goal: wave 5 on wave 28" bug cannot occur — goal
  comes from one constant).
- **Command bar:** Charge, Hold, Follow Me, Flank, Fall Back, Shield Wall
  (stance orders for all squads; Shield Wall also grants 45% damage
  reduction and slows movement), plus **Volley**: tap Volley, then tap a
  spot — every ranged squad fires a triple-damage splash shot at it
  (12s cooldown). Active order is highlighted and named in the HUD.
- **Between-wave shop** (also opens before wave 1): unit cards with sprite,
  name, `role · hp · dmg`, Buy button, upgrade buttons (branch pick
  Stout/Rush, Drill t1, Bulwark, green "Max tier"), squad cap 8, pages of 6
  with ◀ ▶ and page indicator, **Next wave** button, **Quit run**, and an
  **Auto-start in 20s** countdown that really starts the wave. Squads and
  hero mend fully between waves. Fallen squads can be re-bought.
- **Scaling (SPEC law):** enemy HP ×(1.03/wave to 50, 1.015 to 150, 1.007
  beyond), damage at half rate, per-type counts capped. Harness-measured:
  HP scale = 1.00 (w1), 1.30 (w10), 4.26 (w50), 18.9 (w150), 53.7 (w300);
  damage scale at w300 = 7.4. Every wave stays reachable.
- **Economy:** start 340 Manna (one major 293 purchase, or two minors
  155+180). Wave income = kill bounties (3–25) + clear bonus 60 + 8/wave
  (+50% on Esther's Banquet, +20 for a perfect wave). No 5,000 hoards:
  a typical early shop visit affords ~1 major or ~2 minor purchases.

## Placeholders (explicit)
- **Unit sprites reuse the v1 atlas** (heroes/enemy frames, tinted):
  e.g. Shepherd Militia = David frame, Shieldman = Samson frame tinted,
  enemies = golem/spearman/priest/locust/frog frames. The delivered era
  sheets (4065 default) are reference only — the atlas cut from them is
  still to do.
- Other eras have full data but no battlefields and are locked.
- Bible is the only playable era; the generic wave generator for other
  eras exists but is untested in play.
- Baal Priest does not heal yet; locusts/frogs have no split/swarm traits.
- Balance is a first pass from the SPEC's targets, not yet play-tuned:
  wave sizes grow to ~44 spawns by wave 10 (staggered), which may prove
  hard; economy was tuned on paper, not in a live run.

## Verification (2026-10-30, this machine)
- `node --check` passes on **every** JS file (art, gxhub, levels, main,
  progress, sfx, tokens).
- All JSON parses (data/*.json incl. new eras/units, assets/sprites.json).
- Served with `python3 -m http.server 8901`: HTTP 200 for `/`, index.html,
  all 7 JS files, vendor/phaser.min.js, all 6 data files, all 6 background
  images, logo.png, sprites.png, sprites.json (23 URLs checked).
- **Node logic harness** (game's own JS loaded with minimal Phaser/browser
  stubs): all 9 scene classes load, the Phaser.Game config builds, era
  lookup works, curve values match the SPEC formula (above), and
  `waveComp` on a real Game instance produces sane compositions for waves
  1/4/7/10 with an Idol Golem on the goal wave.
- **Headless-browser check could NOT be completed here, plainly:** the
  only Chromium on this machine (/opt/meta-chromium/chrome) refuses
  standalone startup ("Hatch WebGL domain policy is required for browser
  startup"), and no Playwright/Puppeteer is installed. So no live
  click-through or console-error capture was possible in this environment;
  first live playtest still needs to happen in a real browser.

## What remains
1. Live playtest in a real browser; tune wave sizes/economy from it.
2. Cut the era sprite atlas from the delivered sheets (4065 default),
   replace placeholder frames, incl. silhouette-distinct t2/t3.
3. Battlefield art for Roman/Medieval/Colonial/Civil War/WWI-WWII/Modern,
   then unlock those eras (data already in place).
4. Priest healing, boss phases for the goal-wave champion, per-type orders
   beyond Volley (shield Bulwark stance, spear Brace as timed abilities).
5. Publish to https://hub.gxhub.workers.dev/ (deploy route still unknown —
   SPEC phase 8) and push `muse/test` only when kennin says so.

## Upgrade 1 — real unit art, boss bar, priest healing (2026-10-30)
Local commit on `muse/test` only; nothing pushed. The local tree already
carried the GX Hub hello fix (f75e12b), and js/gxhub.js / js/tokens.js were
not touched by this upgrade.

### Real sprites cut from Formara's sheets (tools/cut_units.py)
- Method: flood-fill background removal against the sheets' uniform
  dark-brown ground, with a second chromatic-distance test so low-contrast
  figures (Gloom purple, Fog green-grey) separate where plain RGB distance
  fails; components grouped per figure, trimmed to bounding box, alpha
  softened 1px. Every PNG verified in PIL (RGBA, sane figure box).
- 28 figures cut to assets/units/: from 4066 (swordsmen) — Shepherd
  Militia, Cohortman, Man-at-Arms, Musket Line, Line Infantry, Trooper,
  Peacekeeper, Idol Golem, Brass Empire, Gloom Barons, Crown of Fog,
  Rust Raiders, Clockwork Legion, Glitch Horde; from 4062 (ranged t1) —
  Shepherd Slinger, Javelineer, Longbowman, Rifleman, Sharpshooter,
  Marksman, Paintball Marksman, Pebble Golem, Brass Dart Thrower,
  Gloom Crossbow, Fog Musketeer, Rust Raider Blaster, Clockwork Popper,
  Glitch Painter. All inspected on a contact sheet; complete figures.
  (The Gloom Crossbow and Fog Musketeer are dark/blended in the source
  itself — the cuts are faithful, not defective.)
- Wiring is data-driven: an "img" field per unit in data/units.json.
  Boot preloads all 28 PNGs; uspr() in js/main.js uses the cut image when
  a def has one and falls back to the atlas otherwise. Placeholder-era
  tints are NOT applied over real art (applyTint skips img units).
- Bible battle + shop now show real art for Shepherd Militia, Shepherd
  Slinger, Idol Golem (incl. the wave-10 champion) and Pebble Golem.
  The other eras' infantry/ranged (player) and enemy infantry/ranged
  units also carry img fields, ready for when those eras unlock.

### Still placeholder (no delivered figure exists)
- Shieldman of Judah, Spearman of the Wall, Swordsman of Gideon,
  Benjamite Archer, and Bible page-2 units; every era's shield, spear
  and elite units; Philistine Spearman, Baal Priest, Locust, Frog
  enemies. They keep their v1 atlas sprites until Formara sheets for
  those roles arrive.

### Boss treatment for the goal-wave champion
- setupBoss/bossTick/clearBoss in the Game scene, ported from the old
  TD: on the champion's spawn — name plate "IDOL GOLEM — GOAL-WAVE
  CHAMPION" above the field, a 500px gold-framed health bar under it,
  camera shake + stomp, and a "has fallen" toast on the kill. The bar
  clears if the champion falls or reaches the camp. Boss phases (the
  old TD's spear-throw / armor-bearer / enrage) are NOT ported — still
  owed.

### Baal Priest healing
- data: "heals": true on baal_priest. In battle the priest mends every
  wounded ally within 110px for 15 HP every 2.5s (small green spark),
  capped at each ally's max.

### Verification
- node --check passes on all JS; every JSON parses; 28 img fields in
  units.json, each file present under assets/units/.
- Served with python http.server: HTTP 200 for index, js/main.js,
  data/units.json, the atlas, and all 28 new unit PNGs.
- Node harness (stubbed Phaser): all 7 game JS files load together, the
  game config builds with all 9 scenes, UNIT_IMGS=28, uspr/applyTint
  behave (tint set for atlas units, skipped for img units).
- Still no live-browser playtest from this environment (same Chromium
  policy limit as the original build); the served playtest address
  shows this build for a human pass.

## Upgrade 2 — balance & clarity pass from the first conquest playtest (2026-10-30)
Local commit on `muse/test` only; nothing pushed. Driven by a real
playtest: 5 runs as David, all defeats at wave 5 ("The Camp has
Fallen"), waves 3-4 draining lives ~17 -> 3-6 with squads dying
permanently and no explanation. js/gxhub.js / js/tokens.js untouched
(0-line diff). Enemy-side changes only — no squad stat buffs; the
flattened scaling law and goal wave 10 are unchanged.

### 1. Wave 3-5 softened (js/main.js waveComp, Bible)
The wall was swarm volume plus Baal Priests (who heal the whole pack,
Upgrade 1) arriving at wave 4. Changes: locusts min(3+w,10) ->
min(2+w,9); frogs max(0,w-1) -> max(0,w-2); priests w>=4 min(w-2,5)
-> w>=5 min(w-3,5). Spearmen, golems, idols and the HP/damage curves
untouched. Harness-measured compositions (game's own waveComp):
- Wave 3: 12 -> 10  (locust 6->5, frog 2->1, spearman 4)
- Wave 4: 17 -> 13  (locust 7->6, frog 3->2, spearman 5, priest 2->0)
- Wave 5: 23 -> 20  (locust 8->7, frog 4->3, spearman 6, priest 3->2,
  pebble golem 2)
- Wave 10: 45 -> 42 (formula totals incl. the goal-wave champion) —
  the late game stays hard; only the early wall moved.
Spawn staggering: locusts/frogs now carry a data "spawnGap"
(1.05s / 1.0s vs the 0.75s melee default; startWave honours
def.spawnGap), so the wave-5 swarm front is less dense (7 locusts
spread over ~7.4s instead of 8 over 6.0s).

### 2. Squad cap display — investigated, single-sourced
The playtest reported shop "Squads 0/8" vs header "Squads 0/9". In
this code both displays (refreshHUD stat line, updateShopHead) — and
the buy gate — already read the one constant ERAS.squadCap = 8
(data/eras.json); no second cap value exists anywhere in the tree
(audit: zero numeric squadCap assignments in main.js, 7 references to
this.squadCap). The "/9" could not be reproduced from the code as it
stands. The one hardcoded label, "Squad full (8)", now renders
'Squad full ('+this.squadCap+')', so every cap display in the game
derives from the single constant and the mismatch is structurally
impossible. Harness prints both live strings: HUD "Squads 0/8" and
shop "Squads 0/8".

### 3. Losses explained
- Squad death toast now reads: "<name> has fallen. Squad lost — the
  fallen do not return this run".
- The first time an enemy actually costs the camp a life in a run, a
  toast explains it: "The camp lost a life — hold the line at the
  tent" (once per run, only when a life is really lost — not when
  Union Shield blocks it).
- The first shop of a run carries the line "Fallen squads are gone
  for the run." under the header.

### 4. First shop has no auto-start
openShop tracks shopFirst. While the first shop of a run is open,
update() does not run the countdown and the timer label reads
"Auto-start off — take your time"; the wave starts only from the
Next Wave button. From the second shop on, the 20s auto-start works
exactly as before. Verified by driving the real update() shop branch
with simulated time: first shop survives 30s unclosed with shopT
untouched; a later shop shows "Auto-start in 1s" at 19s and
auto-closes crossing 20s.

### 5. Skill cast feedback
Cooldown display already existed (skill buttons dim and count down
in update()). What was missing was a cast confirmation: useSkill now
floats the skill's name above the hero ("Psalm!", "Five Stones!")
 on every successful cast — 'No target' casts still only toast and
consume nothing. Psalm keeps its gold ring + squad haste buff and
Five Stones its stones + camera flash; the name float makes the cast
unmissable for both.

### 6. Shop no longer clips the header
The shop panel background moved from y=24 (height H-48) to y=38
(height H-62), so it starts below the HUD stat line instead of
covering its lower half.

### Verification (2026-10-30, this machine)
- node --check passes on all 7 JS files; all 5 data JSONs parse.
- Node harness (stubbed Phaser, game's own main.js):
  - waveComp + startWave spawn queues for waves 3/4/5/10 — counts
    above; goal wave still composes 42 spawns incl. champion.
  - refreshHUD and updateShopHead strings printed from live code:
    "Squads 0/8" in both, "Wave 0/10", "Goal: wave 10".
  - Shop-timer harness (real update() branch): first shop never
    auto-closes; later shops count down and close at 20s.
- Served with python http.server (port 8903): HTTP 200 for /,
  index.html, js/main.js, js/gxhub.js, js/tokens.js, data/eras.json,
  data/units.json, data/game.json.
- No live-browser playtest from this environment (same Chromium
  policy limit as before) — the balance change is harness-verified,
  not yet human-played; whether wave 5 now falls to a first-time
  player needs a real run at the playtest address.

## Upgrade 3 — kennin's feature list (2026-10-30)

Built from kennin's own list after playing Upgrade 2: loading screen + logo,
fullscreen, his music, enemy sounds, camp/respawn redesign, a bigger
explorable map with coins, and more soldiers + upgrades. The flattened
scaling law, goal wave 10, heroes, battle pass and progression are untouched.
`js/gxhub.js` and `js/tokens.js` untouched again.

### Loading screen + logo
- Boot now preloads ONLY the logo, then builds a real loading screen in
  create(): logo large, "WATCHMEN ON THE WALL / Conquest", a progress bar
  driven by the loader's progress event, a percent readout, and a rotating
  tip line (7 tips, 2.4s apart). All remaining assets queue behind it.
  A loaderror listener swallows failures of optional files so a missing
  music track or unit PNG can never stall the load. After 'complete', the
  screen holds for the remainder of a 900ms minimum so it never flashes past.
- The Menu logo is slightly larger (232 -> 252px tall).

### Fullscreen / full-screen fill
- The Phaser config already used Scale.FIT + CENTER_BOTH at 1280x720;
  index.html CSS now also zeroes body padding and caps the canvas at
  100vw/100vh with display:block. A **Fullscreen** button sits on the Menu
  (top right) and in the battle HUD (above the speed button); both call
  `this.scale.startFullscreen()` in a try/catch.

### Music — and kennin's first track HAS ARRIVED
- New `js/music.js` (loaded in index.html before main.js). Slots:
  `assets/music/menu.mp3` and `assets/music/battle.mp3`, queued in Boot.
- **kennin's first track is in the build:** `assets/music/battle.mp3` —
  his song "demon diss" (MP3, 2:38, 3.8 MB, converted from the .m4a he
  sent; the original is preserved OUTSIDE the build at
  ~/workspace/watchmen-conquest/music-inbox/demon-diss-original.m4a and is
  not shipped). Boot loads it as a real file load — the loading screen's
  progress now genuinely includes it. In the Game scene it plays looped
  at volume 0.30, under the SFX. Menu track slot is still empty, so the
  menu falls back to the pad until a menu.mp3 arrives.
- Fallback (placeholder, clearly not a composition): a generative WebAudio
  pad on the SFX context — two detuned oscillators (sine -4 cents,
  triangle +5) per tone of a slow A-minor-family chord, lowpass 520Hz,
  gain 0.04, chords drifting every 7s.
- File tracks: menu 0.35 / battle 0.30 volume, looped. Scene hooks: Menu,
  EraSelect, HeroSelect -> menu track; Game -> battle track; re-entering a
  scene with the same track does not restart it. A **Music: on/off**
  button sits next to Sound on the Menu (the Sound and Music buttons now
  share the old Sound button's row at half width each), persisted in
  localStorage key `gxhub_wotw_music`.
- Autoplay: the pad shares the SFX AudioContext, which every button press
  already resumes (SFX.unlock); file playback is attempted on scene entry
  and retried on later scene entries if the context was still locked.

### Enemy sounds (js/sfx.js)
- New voices, all throttled and given small random pitch variation:
  enemyHit (tick, on every damage()), enemyDie (descending blip, replaces
  the generic die() in kill()), enemyAttack (low thud when an enemy hits a
  defender), campHit (deep thud, 260ms throttle), campWarning (soft double
  thud, first camp attack of a wave), coinPickup (two-note chime; the
  Grokonian coin rings a fourth higher).

### Camp + respawn redesign (replaces lives)
- CAMP_MAX 500. The HUD stat line and a bar above the camp tent read
  "Camp 500/500". The old leak path is gone entirely: enemies no longer
  vanish at the camp line and lives/maxLives/leaked* no longer exist.
- Enemy AI rewritten: the camp is the target. A defender (hero or squad)
  within 90px blocks the road — the enemy closes and fights it; when the
  defender dies or moves off, the march resumes. At camp range
  (dist <= enemy range + 34) the enemy stops and attacks the camp for its
  dmg per its rate; the goal-wave champion deals x3 camp damage.
- Hero death: down 8s (was 10), respawns at the camp at full HP ONLY while
  camp HP > 0 (factored into tickHeroDown). Camp HP 0 -> defeat,
  "The Camp has Fallen", whatever else is true.
- Camp feedback: camp sprite flashes on hit, campHit sound (throttled),
  one "The camp is under attack!" toast + campWarning per wave.
- Kept systems re-pointed: Union Shield now makes the CAMP take no damage
  for 10s (hitCamp early-returns while shieldT > 0); the Ark mends the
  camp +50 (capped) instead of +5 lives; a "perfect" wave/run now means
  the camp took no damage; victory/end stars come from remaining camp HP
  (>=85% 3 stars, >=45% 2, else 1); end score's old lives term became
  round(campFrac*20)*50 so score scale is unchanged.
- First-shop explainer line now reads: "If the camp falls, the run falls —
  and the fallen hero only returns while it stands."

### Bigger explorable map + coins
- eras.json: worldW/worldH per era — bible 1920x1200, the six locked eras
  1600/1000 placeholders. The Game world uses them: background stretched
  to world size (v1: the Elah painting stretched, plus the same dim wash),
  night overlay covers the whole world, camera bounds = world, camera
  follows the hero sprite (lerp 0.08). There is no physics engine in this
  game; "world bounds" = camera bounds + tap-target clamping.
- Screen furniture pinned: HUD bar/stat/order text, command + skill +
  speed + fullscreen buttons, boss bar/name, toasts, shop and victory
  overlays all carry scrollFactor 0 — via direct calls (toast, boss) and a
  fixUI() sweep (any child at depth >= 30) run after buildHUD, after every
  shop render, and after the victory panel builds.
- Taps convert with pointer.worldX/worldY (move + Volley); the HUD
  exclusion still uses the screen-space p.y. Targets clamp to the world.
- Camp at (150, 600); hero and new squads start beside it; enemies spawn
  at x = worldW + 20, y spread 120..worldH-160.
- Coins: during an active wave one spawns every ~6s (max 8 out), at least
  220px right of the camp and 160px from the right edge. New textures in
  makeArt: 'coin' (gold disc, darker rim, inner ring, star heart) and
  'coing' (brighter strike for the Grokonian coin). Coins sparkle (scale/
  alpha tween), persist between waves, and the hero collects within 28px:
  +8 Manna; every 6th spawned coin is a Grokonian coin (+1 via earn()).

### More soldiers + more upgrades (Bible; data-driven as before)
- Levite Healer (support, 230, hp 90, dmg 4, range 110, rate 1.4, sprite
  'priest', soft-green tint, healsSquads): in the squad loop it mends the
  most-wounded squad within 120px for 6 HP/s with a green spark; its own
  attacks ride the ranged projectile path like other ranged roles.
- Armor Bearer (shield, 260, hp 380, dmg 6, sprite 'bearer') with
  Bulwark 520 (+200 hp, +3 dmg, +0.3 armor) — mirrors Gate Shieldbearer.
- Gate Spearman (spear, 210, hp 170, dmg 15, sprite 'spearman') with
  Drill t1 230.
- Slinger of Elah (ranged, 120, hp 70, dmg 7, rate 0.7 — the fastest
  hands in the roster) with Swift Hands 200 (new rateMul mechanic: x0.7
  rate). Sprite is the atlas sling frame 't_sling0' (see decisions).
- Chained upgrades via a new "req" field, enforced in the shop render AND
  in the purchase handler through Game.upgradeLocked(); a locked upgrade
  renders disabled with a "🔒 Needs <name>" note. Shop upgrade rows now
  stack vertically so chains fit the card.
  - Swordsman of Gideon: Drill t2 420 (req drill1, +60 hp, +8 dmg)
  - Benjamite Archer: Drill t2 380 (req drill1, +30 hp, +7 dmg)
  - Shepherd Militia: Veteran 400 (req branch, +40 hp, +4 dmg)
  - Shieldman of Judah: Bulwark t2 640 (req bulwark, +120 hp, +0.15 armor)
- The Bible roster is now 16 player units, so the shop runs to 3 pages.

### Design decisions kennin did not specify (made plainly, all reversible)
1. Loading minimum hold is 900ms from Boot start — enough to read the
   logo and one tip; the bar itself is file-count progress (Phaser's
   loader), not bytes, so the 3.8MB battle track counts as one file
   among ~45 even though it dominates the wait on a slow connection.
2. Camp attack range = enemy range + 34px (the tent's visual radius);
   blocking range is the specified 90px.
3. "Perfect" (wave bonus + perfect-clear Grokonians) now means the camp
   took no damage — the direct analog of the old no-leak rule.
4. Slinger of Elah's sprite is the old tower sling frame 't_sling0': the
   atlas holds no non-hero human figure with a sling, and hero frames
   were off-limits. The Levite's green tint separates it from the enemy
   Baal Priest, which shares the 'priest' frame.
5. Bulwark t2's armorAdd is +0.15 (the spec said "+armor" without a
   number); a fully-built Shieldman reaches 0.70 armor before the
   Shield Wall order multiplier. Strong, priced like it (585 + 640).
6. Score keeps its old scale by valuing camp fraction at the old 20-life
   rate (round(frac*20)*50).
7. Music file volumes: battle 0.30, menu 0.35 — under the SFX by ear.

### Verification (2026-10-30, this machine)
- node --check passes on all JS files; all 5 data JSONs parse.
- tools/verify_upgrade3.js (stubbed Phaser, real main.js): **47/47 checks
  pass** — scale config + fullscreen calls, index CSS/music wiring, coin
  textures, all six new SFX voices, music toggle persistence + pad,
  battle.mp3 present (>3.7MB) while menu.mp3 absent (pad path), the
  inbox .m4a NOT in the build, era world sizes, all four new units'
  fields, all four req chains, live config FIT/CENTER_BOTH, CAMP_MAX 500,
  hitCamp damage/defeat-at-0/Union-Shield/boss-x3, hero down=8s, respawn
  at the camp at full HP, NO respawn with camp HP 0, coin +8 Manna in
  28px, Grokonian coin through earn(), upgradeLocked open/shut cases.
- Local server: 200 for /, js/main.js, js/music.js, data/units.json,
  data/eras.json, a unit PNG, and assets/music/battle.mp3 (audio/mpeg).
- NOT verified (no live browser in this environment — needs kennin's or a
  playtest's hands): camera follow feel and HUD pinning while scrolled,
  fullscreen behaviour on a phone (browser chrome, notch, resume),
  whether the stretched Elah backdrop reads well at 1920x1200, the
  loading screen's real duration on a phone connection with the 3.8MB
  track, audio unlock timing on first tap, camp-defense balance (500 HP
  against full waves designed for the lives system — first pass, expect
  to tune), and whether 16 shop units across 3 pages stays readable.

## Upgrade 4 — camp upgrades (2026-10-30)

kennin's addition, same day: "we should be able to upgrade the camp as
well." The camp gained its own per-run upgrade track, bought with Manna in
the between-wave shop. Nothing persists across runs; waves and scaling are
untouched.

### The camp strip (shop presentation)
- A slim full-width strip under the shop header, **page 1 only**, so it
  never consumes one of the 6 unit slots: left label "THE CAMP" with the
  live "Camp x/y HP", then the five one-time upgrade buttons, then Repair.
- To fit it, page 1's unit grid shifts down 24px (cards start y=136) and
  the two header lines move up slightly (head y=50, head2 y=76). Pages 2+
  render with the original geometry, byte for byte.
- Locked tiers show "🔒 Name cost" on a disabled button (the unit cards'
  separate "🔒 Needs …" side-label had no room in a one-row strip); owned
  upgrades render as green "Name ✓" text, the same convention as units.

### The track (constants in js/main.js: CAMP_UPGRADES / CAMP_REPAIR / CAMP_FIRE)
- **Fortify I** — 200: camp max +150, and the camp heals by the same +150.
- **Fortify II** — 320 (requires I): max +200, heal +200.
- **Fortify III** — 450 (requires II): max +250, heal +250.
  A full chain takes the camp from 500 to 1100 HP.
- **Swift Return** — 300: hero respawn 8s -> 4s. hurtHero() now waits
  `this.respawnTime`, and its "Returns in Ns" toast reads the same value.
- **Watch Fire** — 500: the camp fights. Every 1.2s (campFireTick, called
  from update) it shoots the nearest enemy within 240px for 10 fire damage
  via the existing shoot() path ('ember'), with a gold spark at the camp
  as the visible source. No target in range -> it re-checks in 0.25s
  instead of holding a stale cooldown; it never fires between waves.
- **Repair** — 90 per use, repeatable: +100 camp HP, never above max;
  the button disables at full HP or under 90 Manna. Present in the first
  shop too (camp starts full, so it simply shows disabled there).

### campMax — one source for the current maximum
- Upgrade 3 read the constant CAMP_MAX (500) wherever "current max" was
  meant. Upgrade 4 adds `this.campMax` (starts at CAMP_MAX, grows with
  Fortify) and points every such read at it: the HUD "Camp x/y" readout,
  drawCampBar's fraction, the Ark skill's heal cap, the strip label, and
  the victory/end-screen star + score fractions. Stars and score were
  already fraction-based, so they scale with the bigger camp unchanged —
  85% of an 1100-HP camp earns the same 3 stars as 85% of 500.

### Design decisions kennin did not specify (made plainly, all reversible)
1. The strip sits on page 1 only (his "pinned as the first card of page 1"
   idea, as a strip). A player shopping page 2/3 pages back to repair —
   accepted trade for zero changes to the other pages' layout.
2. Fortify's heal is exactly its hpAdd (per his wording), not a full mend —
   a camp at 300 buying Fortify I goes to 450/650, not 650/650.
3. Watch Fire uses the 'ember' projectile and fire damage type, matching
   the altar-flame visual language already in the game; no new art.
4. Swift Return changes only the wait, not the respawn spot or the
   camp-must-stand rule from Upgrade 3.

### Verification (2026-10-30, this machine)
- node --check passes on all JS files; all 5 data JSONs parse (no data
  files were changed — Upgrade 4 is code-only in js/main.js).
- tools/verify_upgrade4.js (stubbed Phaser, real main.js): **32/32 checks
  pass** — static wiring (track constants, strip page-1-only, campFireTick
  in update, no stale CAMP_MAX reads), Fortify I max 500->650 with +150
  heal from full and from damaged, one-time enforcement, II/III req
  gating, full chain to 1100, insufficient-Manna refusal, Repair cap at
  max / 90-per-use / repeatable / refused at full HP and when broke,
  Swift Return halving the actual hurtHero() down-timer (8s -> 4s) with
  respawn after the short wait, Watch Fire firing on its 1.2s interval at
  an in-range enemy, silent out of range and between waves.
- tools/verify_upgrade3.js still passes 47/47 — no regressions.
- Local server: 200 for /, index.html, js/main.js, both data JSONs,
  battle.mp3, and a unit PNG.
- NOT verified (no live browser in this environment — needs kennin's or a
  playtest's hands): the camp strip's on-screen layout — button label fit
  at 142px wide for "Fortify III 450", the 24px grid shift's look on
  page 1, and the tight first-shop explainer line between the unit cards
  and the bottom buttons; Watch Fire's feel (is 10 dmg / 1.2s worth 500?);
  and overall camp-economy balance (Fortify chain + Repair income vs wave
  rewards is a first pass, expect to tune).

## Upgrade 5 — Grokonian orbs: mid-wave wall-buys (2026-10-30)

kennin's design, in his words: "there should be these magic orbs that you
can buy with the Grokonians while you're alive in the wave... like guns you
buy on Black Ops Zombies on the walls, but they're different powers." Built
exactly on that model: five glowing stations stand fixed in the world, the
hero walks up, taps the orb, and Grokonians leave the wallet mid-wave via
Tokens.spend('orb:<id>', cost) — the same spend path as hero unlocks.
js/tokens.js and js/gxhub.js are untouched (verified by diff).

### The orbs (constant ORBS in js/main.js; textures in js/art.js; sound in js/sfx.js)
| Orb | Colour | Cost | Effect |
|---|---|---|---|
| Orb of Strength | crimson | 15 G | hero damage x1.5 for 60s |
| Orb of Swiftness | cyan | 12 G | hero + squad movement speed x1.3 for 60s |
| Orb of Mending | green | 20 G | instant: hero to full HP, every living squad +50% of its max HP, camp +75 HP (capped at campMax) |
| Orb of Iron | silver | 18 G | the camp takes no damage for 30s |
| Orb of Thunder | gold | 25 G | instant: every living enemy takes 150 damage through damage(); the goal-wave boss takes half (75) |

Art: one generated texture per orb (orb_<id> in makeArt) — a wobbly stone
base, pale outer glow, halo, coloured core, white-hot heart — placed as a
world image with a breathing glow circle behind it and a slow pulse tween.
Label floats above in the orb's own colour: "Strength · 15 G". While the
orb sleeps after a purchase the image dims to 0.45 alpha, the glow hides,
and the label counts down ("Strength · 12s"); on waking the price label
returns. New SFX.orbBuy: a low sine hum swelling down, crowned with the
coin sparkle. One new loading tip names the orbs.

### Placement (fractions of the world, so locked eras inherit the same posts)
- Strength (0.323, 0.25), Swiftness (0.323, 0.75), Mending (0.1875, 0.5),
  Iron (0.547, 0.5), Thunder (0.781, 0.5).
- In the Bible world (1920x1200) those land at (620,300), (620,900),
  (360,600), (1050,600) and (1500,600): a north and a south post in the
  mid-field, Mending a short walk east of the camp, Iron at centre-field,
  Thunder deep toward the enemy edge — the strongest power asks the
  longest walk into danger.

### Buying (tryBuyOrb, routed from onTap before movement)
- onTap hit-tests the tap against orb positions (42px) using world
  coordinates and routes to tryBuyOrb instead of issuing a move order.
  Volley targeting still takes precedence, and the shop being open blocks
  orb taps entirely (purchases happen only while the shop is closed and
  the run is live — between-wave wandering included).
- Gates, in order: orb cooling down -> toast with the seconds left; hero
  down -> refused (no one stands to touch it); hero farther than 90px
  (ORB_RANGE) -> "Move closer to the orb" toast AND the hero's move target
  is set to a spot beside the orb, so one more tap buys; Tokens.spend
  false -> "Not enough Grokonians (have X)". Only a passed spend applies
  the effect, starts the 15s cooldown (ORB_CD), plays the sound and
  sparks. A refused tap changes nothing — no spend, no buff, no cooldown.
- First approach: the first time the hero comes within 140px of an orb in
  a run, one hint toast names it ("Orb of Strength — 15 Grokonians. Tap
  the orb to buy its power."). Once per orb per run, never again.

### Wiring — the real paths, no parallel systems
- Strength: orbDmgMul() (1.5 while buffStrT runs) multiplies hd.dmg at the
  hero's two attack sites in update() — the melee damage() call and the
  ranged shoot() payload.
- Swiftness: orbSpdMul() (1.3 while buffSpdT runs) multiplies hd.speed in
  hero movement and the squads' computed spd (after the Shield Wall 0.6).
- Iron: reuses the Union Shield mechanic — hitCamp already turns every
  blow aside while shieldT runs — by raising shieldT to at least 30s. A
  separate buffIronT mirrors the purchase purely so the HUD can show
  IRON's own countdown even alongside a Union cast.
- Mending and Thunder are one-shot effects inside applyOrb at purchase
  time, using the ordinary caps (heroDef.hp, squad max, campMax) and the
  ordinary damage() path (so armor, crit rules and kill bookkeeping all
  apply; Thunder's damage type is 'holy').
- Timers: orbTick(dt) runs in update() beside the volley cooldown; timed
  buffs are refreshed by assignment on re-buy, so magnitude can never
  stack (a second Strength is still x1.5, with a fresh 60s).
- HUD: a second stat line (buffTxt, y=36, pinned like the rest of the
  HUD) shows live timers compactly — "STR 42s · SPD 18s · IRON 30s" —
  rebuilt by refreshHUD, which update() already calls every frame.

### Design decisions kennin did not specify (made plainly, all reversible)
1. Station posts are world fractions, not per-era coordinates, so the six
   locked eras inherit the same layout when their art lands; the Bible
   numbers above are what those fractions produce.
2. The tap hit-test radius is 42px and the buy range is 90px centre to
   centre, both measured on the hero's position (not his sprite edge).
3. A downed hero cannot buy. Mending bought the moment before a fall will
   still be waiting in his restored HP when he returns.
4. Iron rides shieldT rather than a second invulnerability flag, so Union
   Shield and the orb extend one another by max(), never additively.
5. Thunder strikes through damage() with 'holy' — golems (armorType idol,
   holy x0.5) feel it less than flesh does; the boss rule (half) is applied
   before armor, as specified.
6. Buff timers pause while the shop is open, like every other timer in
   the battle loop; orb cooldowns pause with them.
7. The approach hint ring (140px) is wider than the buy range (90px) on
   purpose: the hint arrives while there is still walking to do.

### Verification (2026-10-30, this machine)
- node --check passes on all JS files; all 5 data JSONs parse (no data
  files changed — Upgrade 5 is code-only in js/main.js, js/art.js,
  js/sfx.js, plus this note and the new harness).
- tools/verify_upgrade5.js (stubbed Phaser, REAL main.js, Tokens stub
  with a true balance): **41/41 checks pass** — orb table costs/durations,
  station coordinates in the Bible world, price labels; a successful buy
  deducts 15 G through Tokens and logs 'orb:strength'; insufficient funds
  refuses with balance, buffs and cooldown untouched and the toast naming
  the balance; the 90px gate refuses at 200px, spends nothing and sends
  the hero to the orb's side; Strength enters the real damage path
  (50 -> 75 per hit); orbSpdMul reads 1.3 under Swiftness; Mending caps
  hero (30->200), squad (+50% of max, full and dead squads untouched) and
  camp (480->500, capped) exactly; Thunder deals 150 to two soldiers, 75
  to the boss, nothing to the dead; Iron raises shieldT to 30 and the real
  hitCamp then deals 0; the 15s cooldown refuses a second buy with no
  double spend; timers tick, the orb wakes with its price label back,
  re-buy refreshes 60s without stacking magnitude, and the buff expires
  on schedule; the approach hint fires exactly once. The HUD buff line is
  exercised through the real refreshHUD against text stubs ("STR 60s").
- tools/verify_upgrade3.js (47/47) and tools/verify_upgrade4.js (32/32)
  still pass — no regressions.
- Local server: 200 for /, index.html, js/main.js, js/sfx.js, js/art.js,
  js/tokens.js, data/eras.json, a unit PNG and battle.mp3.
- NOT verified (no live browser in this environment — needs kennin's or a
  playtest's hands): whether the orb textures and glow read clearly on
  the busy Elah field at battle zoom; whether the floating labels collide
  with enemy health bars or the boss plate when fights pass over a
  station; whether 90px feels like "standing at the orb" or slightly
  short; whether the label countdown is legible at phone size; and the
  prices' feel against real Grokonian income (a clear pays ~30 + waves —
  Thunder at 25 G is priced as a run-saver, Strength as a habit).

## Music ruling (kennin, 2026-10-30, voice)
Kennin heard the generative pad on the loading screen, called it better than his own track — "that eerie music... that's perfect" — and ruled: his "demon diss" battle track is REMOVED and the pad is the game's music, in the menu and in battle alike (battle already falls back to the same pad when no file is cached; Boot now loads no music files at all). His original .m4a remains preserved untouched in ~/workspace/watchmen-conquest/music-inbox/. The file slots in js/music.js stay supported should he ever reverse the ruling. verify_upgrade3.js updated to assert the ruling (no loads, no shipped mp3) instead of the old wiring.


## Upgrade 6 — wave flow: a 60-second intermission, never a required click (2026-10-30)
Kennin's ruling from his own playtest (voice, 2026-10-30 ~14:58 CDT): "I don't like when the wave is over, I have to click to make it next wave. So instead there should be like the wave time and then when you complete the wave, there should be at least a minute of wait time before the next wave comes so you could do upgrades and buy more soldiers and things like that."

This supersedes two earlier behaviors recorded above: the slice's 20s auto-start, and Upgrade 2's "first shop has no auto-start" — both are gone.

### What changed (js/main.js only, plus this note and the new harness)
1. **Every shop gets the same minute.** `SHOP_COUNTDOWN=60`. `openShop()` — all callers: the pre-wave-1 shop (`create()` -> `openShop(true)`), each `waveClear()` shop, and the post-victory Endless shop — arms `shopEndsAt = Date.now() + 60s` and `shopT = 60`. The `shopFirst` branch no longer touches the timer at all (the flag now only gates the first shop's camp footnote text).
2. **Visible countdown.** The shop footer timer reads `Next wave in M:SS` (`shopTimerLabel()`, ceiling so 0:00 means the wave is here), rendered larger (18px) and in gold at the same footer spot, updated every frame while the shop is open.
3. **Auto-start at zero, exactly once.** `update()`'s shop branch derives the remaining time from the deadline each frame and calls `closeShop()` at zero; `closeShop()` sets `shopOpen=false` before `startWave()`, so no later frame can re-enter the branch or double-start a wave.
4. **The click is now optional.** The footer button is relabeled "Next Wave Now ▶" and still calls `closeShop()` for a player who finishes shopping early.
5. **No stale text.** The strings "Auto-start in 20s" / "Auto-start off — take your time" and the old "Next wave ▶" label no longer exist anywhere in the game code.

### Timer implementation and judgment calls
- The countdown is a **wall-clock deadline** (`shopEndsAt`, ms), not accumulated frame deltas. It lives on the scene, set once in `openShop()`. Buying, upgrading and camp purchases all re-render the shop via `renderShop()`, and shop paging does too — none of them touches the deadline, and the re-rendered label reads the current `shopT` mirror, so the displayed time never jumps back up after a purchase.
- **Hidden tab:** Phaser stops calling `update()` while the tab is hidden, so nothing can start unseen; on return, the wall clock has honestly elapsed and the wave begins on the first frame back. The timer never grants hidden bonus shopping time and never freezes mid-shop either.
- **Game speed (x2) does not shorten the intermission** — the shop branch already ran on unscaled time before this upgrade; the minute is a real minute.
- **Goal-wave victory choice is untouched.** Clearing the goal wave opens Continue Endless / Finish with no timer behind it — it waits for the player indefinitely. Choosing Continue Endless re-enters the shop flow, so waves 11+ get the same 60s intermission. Quit run and defeat flows are unchanged.
- **First-shop footnote kept.** The "If the camp falls..." line on the first shop is flavor/instruction, not timer text, and stays.

### Verification (2026-10-30, this machine)
- `node --check` passes on js/main.js and tools/verify_upgrade6.js.
- tools/verify_upgrade6.js (stubbed Phaser, REAL main.js, `Date.now` patched inside the vm to a controllable clock): **34/34 checks pass** — label formatting (1:00 / ceil / 0:00 / 2:05); the first shop arms exactly 60,000ms, shows 1:00 -> 0:30 -> 0:01 and starts wave 1 by itself with startWave called exactly once and no click handler fired, and cannot double-start; a later shop behaves identically and is still open at the old 20s mark (0:40 left); "Next Wave Now" starts the wave immediately with the full minute left; a real Shepherd Militia purchase at 35s remaining charges Manna, re-renders the shop and leaves the deadline and the displayed 0:35 untouched, as does a page flip, and the wave still auto-starts at the original deadline; goal-wave `waveClear()` opens the victory choice with no timer (two simulated minutes pass, nothing starts), Continue Endless arms a fresh 60s and wave 11 auto-starts.
- No regressions: tools/verify_upgrade3.js (47/47), tools/verify_upgrade4.js (32/32), tools/verify_upgrade5.js (40/40) all still pass as they stand after the music ruling.
- NOT verified (no live browser in this environment — needs kennin's or a playtest's hands): countdown legibility at phone size in the shop footer; whether a full minute feels right in a real run (long enough to shop, short enough to keep momentum); behavior across an actual device sleep/wake during a shop.

## Upgrade 7 — boss phases for the goal-wave champion (2026-10-30)
kennin's priority (voice, 2026-10-30): upgrade the game, make it better,
then it goes on the GX Hub. This closes the oldest open debt in this file
— Upgrade 1 shipped the champion's name plate and gold bar but recorded
"boss PHASES remain a debt", and the original slice notes listed "boss
phases for the goal-wave champion" under What remains. The champion (the
wave-10 Idol Golem, boss-scaled at spawn) no longer fights like a large
ordinary enemy. js/gxhub.js and js/tokens.js untouched again (zero diff);
the flattened scaling curve is untouched — phases add mechanics and
tempo, never stats.

### The three phases (constant table BOSS in js/main.js; state on the champion)
Keyed to the champion's HP fraction, checked in damage() the instant a
threshold is crossed (and defensively in bossTick):
- **Phase I (100–66%) — the heavy strike.** Every 6s, if the champion is
  engaged (a living defender within the 90px road-block, or the camp
  within striking distance — the march AI's own terms), it winds up for
  1.1s: sprite flushed red and swelling, a red ring drawn at cleave
  radius (range+26 = 64px), a "!" floated overhead — and the champion
  STANDS COMMITTED (the enemy loop skips its movement/attacks while
  heavyWind runs). At completion the cleave lands for 3x a normal blow
  on every defender still inside the ring; the camp, if it is the target,
  takes it through hitCamp (whose boss x3 keeps the camp blow at the
  same 3x-a-normal-blow weight, 230 of 500 — a real threat, answered by
  Fortify/Repair/Iron). Whoever stepped out takes nothing.
- **Phase II (66–33%) — the call and the slam.** On entry: a roar (new
  SFX.bossRoar), the name plate pulses, a banner toast names the shift,
  and the champion CALLS AN ESCORT — exactly 4 of the era's own soldiers
  (spear, infantry, spear, ranged by role from the roster; never its own
  kind, never a healer), spawned at its side on the wave's scales. Once
  per entry, hard-capped by the escorted flag. It also gains the GROUND
  SLAM, every 7s: a circle (radius 110) is marked at its prey's position
  — the nearest defender within 150px, else the camp if the champion is
  on it — and fills over a 1.2s telegraph; at impact everyone still
  inside takes 2x damage, and a camp inside the circle takes one normal
  camp blow.
- **Phase III (below 33%) — enrage.** Movement x1.35, attack period
  x0.7, heavy strikes at 4x on a 4.5s cadence. No new summons. The name
  plate reads "— ENRAGED" in red; roar + banner again. The multipliers
  live ONLY in bossAtkRate/bossMoveMul/bossHeavyMul/bossHeavyEvery and
  are applied at the movement/attack sites — the champion's stored hp,
  max, dmg, rate and speed are byte-identical to their spawn values
  (harness-asserted). Pressure through tempo, not inflated numbers.

### Transitions are clean state changes
bossPhaseSync is monotonic: phases never step back (a champion healed
by a Baal Priest above a threshold stays enraged and never re-calls its
escort), each crossed phase's entry fires exactly once, in order — a
single hit from 100% to 20% enters Phase II (escort called once) and
then Phase III, landing in the correct phase with no double-trigger.
A stunned champion's telegraph timers hold, so a telegraph can never
shrink under a stun. Telegraphs live on a new world-space graphics
layer (bossFx, depth 6) redrawn from live state every bossTick: the
wind-up ring closes as the blow gathers, the slam circle fills toward
full radius as impact nears — nothing damages before its mark completes.

### Numbers and tuning rationale (wave 10, the real champion)
Champion: 380 HP x curve 1.305 x5 = 2,479 HP; dmg 14 x 1.143 x1.6 =
25.6 per normal blow (0.9s). Heavy: 76.8 (Phase I/II), enraged 102.5 —
against David's 200 HP, no telegraphed blow one-shots a full hero at
waves 10, 20 or 30 (harness checks all three on the real curve: 102 /
119 / 138, all < 200): dodge it, or eat it and live — that is the whole
design. Slam: 51.2 in the circle. A plausible wave-10 army (8 upgraded
squads + David) fields ~171 DPS of full contact, ~15s of focused fire
for the kill — the fight is short, violent and losable, not a sponge.

### Verification (2026-10-30, this machine)
- node --check passes on all JS files; all 5 data JSONs parse.
- tools/verify_upgrade7.js (stubbed Phaser, REAL main.js): **44/44
  checks pass**, stable across 10 repeated runs — BOSS table and wiring;
  spawn stats exactly curve x5 / x1.6; thresholds (67% still Phase I,
  66% Phase II once, 33% Phase III once); escort cap 4, era defs, spawns
  at the champion's side, never re-called, monotonic under healing; the
  one-hit double-crossing; enrage tempo with zero stat inflation;
  telegraph-before-damage for BOTH attacks, with the dodge dealing zero
  and standing still paying exactly x3 / x2; the champion still marches
  on the camp undefended, damages it, and freezes mid wind-up; the
  no-one-shot bound at waves 10/20/30; and a **competent-play
  simulation through the real update() loop**: scripted player (CHARGE
  between telegraphs, FALL BACK the moment a wind-up or slam mark
  appears, hero kiting at sling range; NO skills, NO orbs, NO camp
  upgrades) kills the wave-10 champion in ~31s of fighting with the
  camp untouched at 500/500, passing through all three phases. (Two
  early harness flakes were the harness's own observation windows —
  the freeze invariant and the camp-watch loop — not game defects;
  both were corrected to state the real invariant and the suite then
  ran 10/10 clean.)
- No regressions: tools/verify_upgrade3.js (47/47), verify_upgrade4.js
  (32/32), verify_upgrade5.js (40/40), verify_upgrade6.js (34/34).
- Local server: 200 for /, js/main.js, js/sfx.js, data/units.json.
- NOT verified (no live browser in this environment — needs kennin's or
  a playtest's hands): whether the red ring and filling slam circle
  read clearly on the busy Elah field at phone zoom; whether the name
  plate pulse and PHASE float are noticeable mid-fight; the roar's
  volume against the pad; and the fight's feel at waves 20/30 in real
  endless runs (the harness proves the numbers stay survivable there,
  not that they feel fair).

### What remains for the champion
- Endless waves 20/30 field no flagged champion under the current
  spawn rule (boss flag is goal-wave-only); whether endless deserves
  its own champions is kennin's call, not made here.
- The escort is Bible-shaped by role, so other eras inherit it when
  they unlock — untested there, like the rest of those eras.

## Upgrade 8 — attack buttons + Held-Power mastery: patience is power (2026-10-30)
Kennin's direction, from play and from the 2026-10-30 call: upgrade the
buttons "to attack and do different things," a brawler-like fighting feel,
and a signature mechanic of his own that players get addicted to mastering.
The seed is his own play story: power moves are saved tools with time
limits — cornered by five hard trolls, he held his power moves until the
moment was forced, then spent them and lived. The mechanic built from it
is named plainly in-game: **Held Power**. js/gxhub.js and js/tokens.js
untouched again (zero diff); the 60s intermission, command bar, orbs and
boss phases are untouched except where noted. Code is in js/main.js only,
plus this note and the new harness.

### 1. Held-Power mastery (constant table HELD in js/main.js)
- Every hero power move (both skills and the ult, every hero), while OFF
  cooldown and unspent, accrues charge — in battle time only. It does not
  accrue while the move is on cooldown, and it cannot accrue in the shop:
  update()'s accrual lives in the battle loop, which never runs while a
  shop is open, so patience cannot be farmed in the 60s intermission.
- Tiers: **Ready** at once, **Tempered** after 20s held, **Perfect** after
  45s held. Spending multiplies the move's effect: x1 / **x1.5** / **x2.25**.
  "The move's effect" is everything the cast does, routed through four
  helpers inside useSkill (dmgS / shootS / buffS / ctrlS): damage numbers,
  stun/slow/confuse durations, burn dps, squad-buff durations, heal and
  camp-mend amounts, Manna yield, Union Shield's duration, and Royal
  Banquet's bonus (which now stores its multiplier: 1.5 at Ready, 1.75
  Tempered, 2.125 Perfect). Delayed effects (Five Stones' staggered
  stones, Three Hundred, Almanac Storm, Wild West Show) are closures over
  the cast's tier, so a Perfect ult stays Perfect stone by stone.
- **Perfect flourish:** a Perfect cast adds a 0.6s stun rider to every
  enemy the move touches. On David's sling moves it stacks with the
  stone's own (scaled) stun; on a move that never stunned — Samson's
  Jawbone Cleave — the flourish is the stun itself.
- **Perfect can be knocked out of your hands:** hurtHero gained a heavy
  flag, passed ONLY by the champion's heavy strike and ground slam (the
  two boss call sites — harness-counted at exactly 2). A heavy hit drops
  every Perfect charge to Tempered (held := 20s), floated as "Perfect
  lost!". Ordinary enemy blows, however frequent, never touch charge.
  Dropping one tier rather than to zero is a deliberate call: one eaten
  slam costs the flourish, not the whole patience — the tension is real
  but the lesson isn't cruelty.
- **At a glance:** the skill button itself is the readout. A charge bar
  along its bottom fills toward the next tier (dim at Ready, gold at
  Tempered), the label gains the tier name and warms in colour, Tempered
  gets a gold border, Perfect a bright pulsing one — and crossing a tier
  floats "<move> — Tempered!" / "— Perfect!" over the hero.
- **Tally:** every successful cast increments heldSpent[tier] ('No target'
  casts consume nothing — no cooldown, no charge, no tally, exactly as
  before). Nothing persists beyond the run.

### 2. Button weight
- The shared button() helper now presses with mass: pointerdown dips the
  button to 0.93 scale and lights it; release springs it back. Every
  button in the game — skills, ult, command bar, Volley, shop, menus —
  inherits the feel from the one helper.
- **Cooldown sweep:** skill buttons and Volley carry a graphics overlay
  (drawSkillSweep, drawn from live state each frame) — a dark veil whose
  height is the cooldown fraction remaining, draining as the move
  returns; the Held charge bar takes over the same face off cooldown.
- **Input buffer (150ms):** skill and Volley presses route through
  pressSkill/pressVolley. A press landing within 150ms before the
  cooldown ends is remembered and fired by update() the moment the move
  is ready; a press earlier than the window is forgotten, as before.
- **Order echo:** every command-bar order now also floats its name above
  the hero ("Charge!", "Fall Back!") in the world, beside the existing
  toast — the player sees the army heard it.
- Plainly: the hero has no basic-attack button — he auto-attacks, as he
  always has. Button weight was applied to the whole kit that exists.

### 3. Mastery readout
The End screen gains one line under the Grokonians tally, shown whenever
at least one power move was cast: "Held Power: 3 Perfect, 2 Tempered,
1 Ready" (nonzero tiers only, Perfect first). The skill is now visible
and chaseable run over run.

### Tuning rationale
- 20s to Tempered is roughly a wave's mid-fight: one deliberate hold
  inside a single wave. 45s to Perfect is a wave-scale decision — across
  a wave boundary or deep into a hard one — which is the shape of
  kennin's corner story: the save is the strategy, not a reflex.
- x1.5 / x2.25: a Perfect regular move lands between a Tempered cast and
  ult-class weight without reaching ult numbers (Perfect Smooth Stone =
  270 vs one Five Stones boss-stone at 750). Mastery deepens the kit; it
  does not replace it.
- Multipliers are read ONLY from the cast's tier and applied ONLY to the
  move's own numbers. No enemy stat, spawn, or curve value is read from
  HELD anywhere (the harness's Ready-only proof below stands on this).

### Verification (2026-10-30, this machine)
- node --check passes on all JS files; all data JSONs parse; served
  locally: 200 for /, index.html, js/main.js, data/units.json,
  data/game.json.
- tools/verify_upgrade8.js (stubbed Phaser, REAL main.js, Math.random
  pinned so measured hits are exact): **54/54 checks pass**, identical
  across 3 repeated runs — HELD/INPUT_BUFFER tables; accrual crossing
  Tempered at 20s and Perfect at 45s of battle time; zero accrual on
  cooldown and zero in the shop; Psalm haste 6s / 9s / 13.5s across the
  tiers through the real cast; Smooth Stone 120 (Ready, stun 1.5) vs 270
  (Perfect, stun 3.375) through the real shot path; Jawbone 90 with no
  stun (Ready) vs 202.5 + the 0.6s flourish stun (Perfect); 'No target'
  consuming nothing; chip damage leaving Perfect untouched while a heavy
  hit drops two Perfect charges to Tempered and spares a Tempered one;
  the same loss through the REAL bossHeavyStrike (hero takes exactly x3
  and loses Perfect); the input buffer through the REAL HUD buttons
  (100ms-early skill press fires on cooldown end, Volley likewise, a
  300ms-early press forgotten, no phantom casts); the order echo through
  the real Charge button; drawSkillSweep clean at every state; and the
  End screen rendering "Held Power: 3 Perfect, 2 Tempered, 1 Ready".
- **The scaling-law proof — two competent-play simulations** of the
  wave-10 champion fight through the real update() loop (U7's army and
  telegraph-dodging script; the two regular moves only — the ult is
  excluded from BOTH styles because Five Stones against a lone champion
  is a one-button delete at any tier, 5 stones with the boss stone at
  250x3: a pre-existing ult truth, not a mastery question):
  - **Ready-only** (spend each move the frame it is ready; 6 casts, all
    Ready): champion killed in **33.4s**, camp untouched at 500/500.
    A no-mastery player finds the fight exactly as reachable as
    Upgrade 7 left it.
  - **Perfect-saved** (both moves held to Perfect entering the fight —
    kennin's corner story — then spent only at Perfect again; 2 Perfect
    casts): champion killed in **35.7s**, camp 500/500.
  - Honest read: in the isolated champion duel the saved-Perfect style
    was ~2s SLOWER, not faster — after the opening Perfect volley, its
    refusal to spend at Tempered idles the kit while Ready keeps firing.
    Mastery is not a blanket speed-up and does not trivialize anything;
    its value is the forced moment — the Perfect that lands when the
    fight is actually decided — which a duel against one champion
    cannot price. What the pair of sims does prove is the law in both
    directions: neither style breaks the fight's reachability.
- No regressions: tools/verify_upgrade3.js (47/47), verify_upgrade4.js
  (32/32), verify_upgrade5.js (40/40), verify_upgrade6.js (34/34),
  verify_upgrade7.js (44/44) all still pass.
- NOT verified (no live browser in this environment — needs kennin's
  hands): whether the charge bar, tier label and Perfect pulse read at
  phone size on a 175x44 button mid-fight; whether the press dip feels
  like weight or like lag on a real touchscreen; whether the tier-cross
  float is noticeable without being noise; and the feel of the 20s/45s
  thresholds in real waves (both are one-line constants in HELD if a
  playtest says they should move).

### What remains
- Thresholds and multipliers are first-pass tuning, set to be moved by
  kennin's playtest, not defended against it.
- The mastery readout is per-run by design; a lifetime Held record
  (across runs, in Profile) would be a Progress change, not made here.
- Endless waves 20/30 still field no flagged champion (Upgrade 7's open
  question) — Held Power's heavy-loss rule therefore bites only where a
  champion stands, for now.

### Upgrade 8, second half — kennin's combat controls: two hands, one marches, one fights

Kennin's addition, by voice minutes after the Held-Power brief
(2026-10-30): a DODGE button, a BLOCK button, and a SPRINT; all attack
buttons ON SCREEN on the right side, laid out like Minecraft /
Brawlhalla; timing mechanics FROM THE START — the hero must NOT
auto-fire when an enemy enters the range circle (the circle is a
warning/range indicator only); the PLAYER presses to strike, aiming at
the tapped area/enemy in range; and the two hands kept separate — one
hand taps the map to move, the other works the fight buttons, attacks
woven WITH tap-to-move, never merged into the same input. This is the
signature control scheme of the game, in his design: **one hand marches,
one hand fights.**

**Scope call, stated openly:** the HERO went manual. Squads keep their
existing behavior — they are the army the command bar directs, and the
hero is the fighting-game character. Widening manual control to squads
was not done and is not assumed; it is kennin's call if he wants it.

**What was built** (all in `js/main.js`; the `FIGHT` table beside `HELD`):

- **The auto-fire block is deleted.** The hero's old automatic attack
  (nearest enemy in range, on his rate clock) is gone; the range ring
  remains as indicator only. Harness-proven: 3 s with an enemy standing
  inside the circle, zero strikes.
- **The fight cluster** — five screen-fixed buttons on the right side:
  HEAVY (1184,296) over LIGHT (1184,384), SPRINT (1076,340), DODGE
  (1076,428), BLOCK (1184,472), with a STAMINA bar over the cluster.
  `onTap` refuses any tap landing on the cluster (`overFight`), so a
  fight press is never also a march order — the separation is enforced
  in code, not just in layout, and harness-proven.
- **Aiming:** a press strikes the enemy standing at the marching hand's
  tap point first (within 85 px of it), else the nearest enemy inside
  the range circle. A press with nothing in range is free — no recovery
  is spent on air.
- **LIGHT:** ×0.75 of the hero's basic damage, ready again after
  ×0.55 of his basic rate — the quick hand. **HEAVY:** ×2.1 damage
  after a real 0.28 s wind-up (the enemy owns that time; harness proves
  nothing has landed at 0.20 s), ready after ×1.9 of rate; melee heavies
  cleave (enemies within 46 px of the victim take half), ranged heavies
  splash (38 px, full). One shared recovery clock for both hands — a
  press during recovery buffers inside the same 150 ms window as
  skills, and alternating buttons cannot machine-gun. The Strength
  orb's damage multiplier rides both strikes, as it rode the old
  auto-attack.
- **DODGE:** a 150 px dash over 0.22 s in the march direction (or the
  facing, if standing), with 0.30 s of true i-frames and a 1.6 s
  cooldown, bufferable like the rest. Inside `hurtHero`, i-frames
  return before ALL damage — a dodged champion heavy costs neither
  blood nor a Perfect charge (harness-proven through the real
  `bossHeavyStrike`).
- **BLOCK (a hold, not a press):** pointerdown raises the guard,
  release/outside drops it; a cyan arc shows on the hero's facing side.
  Mitigation: 65% off ordinary blows, 45% off heavy-class blows — a
  boss heavy lands through a guard at 55%, reduced, NEVER erased, and
  it still knocks a Perfect charge down (harness-proven). Holding drains
  12 stamina/s, impacts cost 8 (ordinary) / 18 (heavy) plus a fraction
  of the damage stopped, and an emptied guard BREAKS for 1.2 s and
  cannot be re-raised early. Blocking slows the hero to ×0.45 movement.
- **SPRINT (a toggle):** ×1.45 hero movement, draining 8 stamina/s
  while actually moving. Stamina is ONE pool (100, regen 16/s after a
  0.6 s breath) shared by block and sprint, so the two postures argue —
  that argument is the fighting game. Sprint is impossible behind a
  raised guard and raising the guard cancels a sprint. Striking after
  ≥0.2 s of sprinting movement earns the ×1.25 OPENER on that strike
  and spends the built-up time.
- **Faces:** the cluster buttons carry the same press weight as the rest
  of Upgrade 8, live recovery veils on LIGHT/HEAVY/DODGE, and the
  stamina pool drawn into the BLOCK base and the bar over the cluster.
  Two new loading tips teach the scheme and the dodge/block split.

**Tuning rationale:** light is deliberately a little hotter than the
old auto-attack's DPS IF worked at full cadence (×0.75 per ×0.55 rate
≈ ×1.36) — that surplus is the reward for hands, and the simulation
below shows it does not break the law; heavy trades time (wind-up +
long recovery all-in ≈ ×1.1 DPS) for burst, position, and cleave —
burst is what kills escorts and finishes, not a faster clock. Block was
tuned so the wave-10 champion's telegraphed heavy (≈77, ≈102 enraged)
is survivable through a guard (≈42 / ≈56) but never ignorable, and the
skilled answers remain dodge or repositioning, per Upgrade 7's intent.

**Simulation, restated for manual combat** (same army, same kite
script as Upgrade 7/8; the hero now fought BY HAND — scripted presses
at a 0.3 s human cadence, LIGHT LIGHT HEAVY, dodging telegraphs when
close; skills per style as before): **Ready-only: 29.8 s. Perfect-saved:
34.5 s. Camp 500/500 in both.** Against the pre-controls numbers
(33.4 s / 35.7 s with the old auto-fire), honest hands are slightly
stronger than the machine was — a player working the buttons SHOULD
out-fight an idle auto-attack — and Perfect remains no shortcut, for
the same tempo reason recorded above. Reachability is intact and, if
anything, a touch kinder to the player who plays.

**Harness:** `tools/verify_upgrade8.js` now carries 100 checks: the
Held-Power battery, the fight battery (no auto-fire, light/heavy
numbers and timing, aim priority, attack buffer, dodge i-frames +
champion-heavy save, block mitigation/break, sprint/opener/exclusions,
the cluster itself through the real HUD build), the aftermath line, and
both sims. One prior-suite touch: `verify_upgrade5.js`'s two static
regexes asserted the OLD auto-attack call shapes (`hd.dmg*orbDmgMul()`
at the auto-attack site); the multipliers still ride the real damage
and movement paths, so those two assertions were re-pointed at the new
strike/movement shapes and U5 passes whole (40). No regressions:
U3 47/47, U4 32/32, U5 40/40, U6 34/34, U7 44/44, U8 100/100, all
deterministic; `node --check` clean; `js/gxhub.js` and `js/tokens.js`
zero diff. Local commit only, NOT pushed, pending kennin's word (same
standing as the rest of Upgrade 8).

**What remains, honestly:**
- Phone feel, again kennin's hands: cluster size/placement under real
  thumbs (the buttons are 92 px wide at 1280×720 logical — his call
  whether the cluster should sit lower or larger), the block-hold on a
  touchscreen while the other thumb marches, and whether the heavy
  wind-up reads clearly at speed.
- The heavy wind-up has no dedicated wind-up animation (the strike
  simply lands late); a lean/flash telegraph of the hero's own would
  help it read, if kennin wants it.
- Enemy contact attacks still land on the hero mid-dodge only via
  `hurtHero` (i-framed ✓); squadmates have no dodge/block — by design,
  they are the army, not the fighter.

## Upgrade 9 — Command & Care: tap-to-order army, mid-wave camp panel, orbs like a potion (2026-10-30)

Kennin's three rulings from the 2026-10-30 call, built as one upgrade —
and the reversal of Upgrade 8's recorded scope call ("manual squads
would be kennin's call"): he has now made that call.

**Ruling 1 — the army does not follow unless told (tap-to-order).** The
default-follow is dead. Every squad carries its own order (`s.ord`): it
is born `'post'` at its spawn point beside the camp and holds there; the
army's standing order at run start is Hold. `squadOrder(s)` resolves the
effective order (the squad's own, else the army's) and `squadTarget()`
resolves where it marches: its post, the army's charge/hold/fall-back,
or its formation slot around the hero (Follow Me / Flank / Shield Wall).
The marching hand now works by selection:

- Tap a squad → selected (gold breathing ring drawn in the world by
  `selFx`, name floated). Tap ground → the squad posts there and holds.
  Tap another squad → selection switches. Tap the hero → selection
  returns to the hero (the default at wave start). Repeated taps on a
  crowded spot CYCLE through whoever stands there, so a squad stacked on
  its brothers at the camp is never unselectable.
- The command bar speaks to the selection (`giveOrder`): with a squad
  selected, the order is that squad's alone (`s.ord=id`, echo floats
  over the squad, toast names it); with the hero selected, the order is
  army-wide as before and every squad returns to army control
  (`s.ord=null`, echo over the hero — the exact float U8's harness
  pins). Follow Me on one squad restores following for that squad only,
  until countermanded: follow is an order, not the default.
- The HUD order line names the audience ("Squad: Spearman of the Wall —
  Posted / Charge…" vs "Order: …"), and button highlighting follows the
  displayed order.
- Shield Wall's mitigation and movement factors follow the squad's
  EFFECTIVE order (a squad in its own Shield Wall gets the wall's
  numbers even when the army is doing something else).
- **Guard posts:** a posted squad is ground held, not a statue. An enemy
  that comes within guard reach (its range + 50) is met and fought at
  contact; when the intruder falls or leaves, the squad returns to its
  post. This exists because the enemy stops at its own reach + 6 (44 px
  for a golem) — outside a posted melee squad's arm (38 px) — so without
  the guard step a posted blade could be struck without ever striking
  back, and camp defense would be a fiction. Support squads (the Levite
  Healer) hold their post and work from it instead.
- Two-hands separation kept: fight-cluster taps are never selection or
  move taps (`overFight` unchanged), and the new CAMP button carries the
  same wall (below). A squad posted at the camp stays and defends it —
  proven in the sim below.

**Ruling 2 — camp care mid-wave (the camp panel).** Tapping the camp
(hero selected; with a squad selected the same tap posts the squad
there instead) or the persistent CAMP button (top-left, under the stat
lines) opens a compact panel (600×384, centre-field) with the camp's
five upgrades and Repair — the SAME `CAMP_UPGRADES` / `CAMP_REPAIR`
table, the SAME `buyCampUpgrade` / `buyCampRepair`, the SAME run state
(`campUp` / `campMax` / `campHp` / `respawnTime`). One source of truth,
two doors; `afterCampBuy()` re-renders whichever surface sold the
purchase. The wave does NOT pause behind the panel, purchases are
instant, and while the panel is open `onTap` refuses field taps so
nothing leaks through it. The between-wave shop's camp strip is
untouched. `openShop` closes the panel first; `end()` closes it too.

**Ruling 3 — orbs like a Minecraft potion.** A purchase is now a moment:
- **Banner:** a panel at the top of the screen in the orb's color —
  the orb's icon disc, its NAME, and a plain-language effect line (new
  `fx` field on every orb def: "Hero damage +50% for 60s", "The camp
  cannot be harmed for 30s", …), held ~1.7 s before fading, on top of
  the existing purchase toast which still names the effect in text.
- **Splash:** a 16-spark burst in the orb's color at the hero plus an
  expanding colored ring.
- **Sound:** a distinct drink — `SFX.orbDrink()` (two gulps, a fizz, a
  sparkle) layered with the existing `SFX.orbBuy()` hum.
- **Buff chips:** under the stat lines, each live timed power wears a
  labeled chip (color disc + NAME + seconds: "STRENGTH 60s") drawn by
  `drawBuffChips()` — the old timer-only line still rides above them,
  byte-identical (U5's harness asserts it).
- **One clear tap:** tapping an orb from ANY distance now marks the
  purchase pending (`o.pending=6`); the hero walks to the orb as before
  and `orbTick` completes the purchase the moment he arrives in range
  while the orb is awake — one tap, one result, no second tap to land.
  Scope call, recorded: the on-tap hit radius stays 42 px (U5's harness
  pins that literal); the widening is delivered by the pending purchase
  rather than a fatter, mis-tappable target. Walking within 90 px + tap
  still buys instantly, exactly as before.

**Scaling law:** no enemy stat, no wave-curve number, no orb price or
duration changed. Driven through the real command path (`giveOrder`,
army-wide), the competent-play sim reproduces Upgrade 8's standard
EXACTLY: **wave-10 champion dead in 29.8 s, camp 500/500.** The posted
variant — the same army directed squad-by-squad through the real tap
path into a kill-zone astride the champion's road (tanks and spears
forward, blades beside them, ranged and healer behind), then never
ordered again, hero fighting in the field — also clears: **champion
dead in 51.6 s, camp standing at 269/500, 1 of 8 squads left.** Slower
and bloodier, as a passive posture should be against an active one —
the Phase II escort splits the zone's fire and leaks blows onto the
camp — but reachable and honest: posted defense is a real way to play,
not the optimal one.

**Harness:** `tools/verify_upgrade9.js`, 61 checks — statics for the
new wiring, runtime batteries for no-follow, select/post/switch/cycle,
scoped vs army-wide orders, Follow-Me-as-order, the guard post (step
out, kill, return), the camp panel from both surfaces at identical
prices with the wave running behind it, orb tap-to-buy + banner + chip
state, the one-tap pending purchase, and both sims. Three documented
re-points in prior suites, same pattern as U8's: `verify_upgrade5.js`'s
squad-speed static now keys on the effective order (`eo===` — the
multiplier's law is unchanged, its subject widened), and the
`verify_upgrade7.js` / `verify_upgrade8.js` sims drive orders through
`giveOrder` instead of writing `g.order` (assertions untouched; U8's
sim times reproduced to the tenth of a second). No regressions:
U3 47/47, U4 32/32, U5 40/40, U6 34/34, U7 44/44, U8 100/100,
U9 61/61; `node --check` clean; `js/gxhub.js` and `js/tokens.js`
zero diff. Local commit only, NOT pushed (parent sequences pushes,
with Upgrade 8).

**What remains for kennin's hands:**
- Thumb feel of selection: tap targets are bodies within 44 px (with
  cycling for stacks) — whether that radius and the ring read well at
  phone size is his playtest call, as is the CAMP button's top-left
  placement and the camp panel's size.
- The banner's wording and hold time (~1.7 s) — written to be read at a
  glance mid-fight; his eyes settle whether it says enough.
- Posted play is deliberately the costlier posture (see the sim): if
  kennin wants posted armies stronger (e.g. a guard-reach or
  entrenchment bonus), that is a balance ruling for him, not a default
  the scribe smuggles in.

## Upgrade 10 — the approved button UI: auto-fire restored, big buttons (2026-10-30)

Kennin playtested Upgrade 8's manual combat and reversed it in a voice
call (~16:29 CDT): "I would much rather have it auto fire. Instead of
have a light and heavy attack." He then directed the replacement
himself — sketch v1, his refinements, sketch v2 — and approved v2
element by element (~16:34 CDT): auto-fire toggle, the right-thumb
button stack, the command row with CAMP in it. "All right, you're
approved to work on it." This upgrade builds exactly that sketch.

**What changed (js/main.js, plus this note, the new harness, and
documented re-points in verify_upgrade8.js / verify_upgrade9.js):**

- **Auto-fire restored, toggleable.** The hero's basic attacks are
  automatic again — nearest enemy inside the range circle, on the
  hero's own attack clock (`h.cd` against `hd.rate`), melee at hand
  range or a sling stone beyond it, through `orbDmgMul()` like every
  hero hit: the pre-Upgrade-8 behavior with its numbers unchanged
  (new method `heroAutoFire()`, called from `update()`). A large
  labeled **AUTO-FIRE toggle** tops the right stack and reads its
  state (`AUTO-FIRE: ON` / `AUTO-FIRE: OFF`). Default ON; the choice
  persists in localStorage (`gxhub_wotw_autofire`). OFF means the hero
  performs NO basic attacks at all — power moves still fire by button.
- **The manual scheme is removed entirely.** LIGHT and HEAVY buttons,
  `pressAttack` / `lightStrike` / `heavyStrike` / `attackTarget`, the
  shared recovery clock and attack buffer, the heavy wind-up, cleave
  and splash, and their FIGHT-table numbers are all gone — not
  disabled, deleted.
- **The right-thumb stack** (one column, x center 1178, 196 px wide,
  every button 56 px tall, real text labels, the game's stone-and-gold
  `button()` styling): AUTO-FIRE toggle (y 70), the stamina readout and
  bar under it, DODGE (176), BLOCK (240, still a hold), SPRINT (304),
  then the hero's power moves (368/432/496). The stack's last bottom
  edge is y 524 — clear of the command bar at HUD_Y 610. Every stack
  rect is registered in `fightRects`, so `onTap` refuses the whole
  stack (toggle included) as march orders.
- **Power moves are their own named buttons, driven from the data.**
  The skill buttons moved out of the bottom bar into the stack, built
  in `buildFightControls()` from `[...hero.skills, hero.ult]` with the
  data's own names as labels — for David: SMOOTH STONE, **PSALM**,
  **FIVE STONES** (the data already carried those names; no data fix
  was needed). Another hero shows his own names (the harness proves
  Samson's). Cooldown sweep and label countdown ride each button
  exactly as before.
- **Held Power stays.** Kennin never revoked "patience is power," and
  it composes with auto-fire without friction: charge still accrues on
  ready power buttons only, tiers still multiply the cast only, a
  boss-class heavy still knocks Perfect down to Tempered. Every U8
  Held-Power harness battery passes unchanged.
- **The command row rebuilt to the sketch.** One row along the bottom,
  eight buttons at 110×56 (centers y HUD_Y+55, x from 176, pitch 117):
  CHARGE, HOLD, FOLLOW, FLANK, FALL BACK, SHIELD WALL, VOLLEY, and
  **CAMP** — Upgrade 9's mid-wave camp panel entry moved here from its
  top-left perch; the same panel, state and prices stand behind it,
  and `campBtnRect` moved with it. The order line keeps HUD_Y+8, clear
  above the taller row; speed and Fullscreen keep the far right,
  clear of the row (row ends x 1050, they start x 1166). Upgrade 9's
  tap-to-order is untouched.
- **The stamina kit survives intact** — DODGE (dash + i-frames),
  BLOCK (hold, mitigation, guard break), SPRINT (toggle, drain), one
  shared pool, same FIGHT numbers. The stamina bar moved with the
  stack (drawn at 1080,122, 196 wide under the toggle).
- One loading tip rewritten: the LIGHT/HEAVY tip now teaches the
  toggle instead. The DODGE/BLOCK/SPRINT tip was already true.

**Scope calls (the scribe's, stated plainly):**

1. **Three power buttons, not two.** The sketch drew two because
   kennin named two aloud — Psalm and Five Stones. Every hero carries
   THREE power moves (two skills + ult; David's third is Smooth
   Stone). The stack carries all three from the data; silently
   deleting Smooth Stone would have cut a move kennin never asked to
   remove. The approved pair is present and named exactly as ruled.
2. **The sprint opener retired with the manual strikes.** Upgrade 8's
   opener (×1.25 on a strike pressed out of a sprint) was a property
   of the press; with no press there is nothing for it to ride.
   Sprint itself — speed, drain, guard rules — is unchanged. This is
   the one multiplier that did not survive, and it touched only the
   player's own strike while it lived.
3. **CAMP's old top-left spot is simply vacated** — nothing else moved
   into it; the buff chips keep the top-left column.

**The law:** the flattened enemy curve is untouched — no spawn-count,
HP or damage scaling constant changed anywhere in this upgrade; the
only surviving multipliers (Held tiers) touch the player's power moves
only, exactly as in U8.

**Verification (2026-10-30, this machine):** new harness
`tools/verify_upgrade10.js`, **50/50**: the toggle (default ON,
persistence key, label state, a fresh scene opening with the saved
choice), OFF = zero hero basic damage over 3 s in range with power
moves still firing by button, ON = full basic damage on the rate clock
(ranged and melee), the manual path's absence, stack and row geometry
(every button ≥ 56 px tall, stack clears the bar, CAMP in the row),
David's PSALM + FIVE STONES from the data (and Samson's own names),
the stamina kit, and U9's tap-to-order. **The scaling-law proof:**
competent play (the standard U7/U8/U9 army and script, orders through
`giveOrder`, telegraphs dodged, the two regular moves at Ready) with
auto-fire ON clears the wave-10 champion in **32.5 s, camp 500/500** —
comparable to the pre-U8/U9 standard (~30 s). Re-pointed suites, same
documented pattern as U8/U9 used: `verify_upgrade8.js` (100 → 93
checks — the seven net-removed checks are the manual batteries
themselves: LIGHT press, aim priority, Samson LIGHT/HEAVY, ranged
heavy splash, attack buffer, the opener assertion, and the inverted
no-auto-fire battery; every Held-Power, dodge, block, sprint, buffer,
sweep and tally battery preserved; its sims now read Ready 32.5 s /
Perfect 35.7 s, camp 500/500 both) and `verify_upgrade9.js` (the CAMP
static follows the button into the row; both sims replace their
scripted presses with auto-fire — standard 32.5 s camp 500/500, posted
variant 51.7 s camp 269/500 with 1/8 squads standing, the same shape
U9 recorded). No regressions: U3 47/47, U4 32/32, U5 40/40, U6 34/34,
U7 44/44, U8 93/93, U9 61/61, U10 50/50 — 401 checks. `node --check`
clean on every JS file; HTTP spot-check served the new main.js
byte-identical from the local server (AUTO-FIRE present, no LIGHT
button); `js/gxhub.js` and `js/tokens.js` zero diff. Local commit
only, NOT pushed (the parent sequences pushes).

**What remains for kennin's hands:**

- Thumb feel at phone size: the stack is wide (196 px) and the row is
  tall (56 px) by his sketch; whether the stack's reach over the field
  and the row's new height sit right in his hand is a playtest call,
  as is the toggle's top-right placement.
- The three-power-button call (scope call 1): if he wants the stack
  to carry exactly the two moves he named, Smooth Stone's button is
  the one to strike — his word, not the scribe's.

### Approved additions (kennin, same call, 2026-10-30)

Two further ideas from the same call, both approved on the spot and
built the same day. A third idea from that call — a shared stamina
well — was NOT approved and is not built.

**Addition 1 — RALLY BANNER.** A ninth seat on the command row:
**Rally**, at the same 110×56 as every other seat — the whole row
shifted left (start x 130) to seat it rather than shrinking any
button. Flow: tap Rally (a targeting mode like Volley's; the two
cancel each other), then tap the ground to plant the banner there.
Upgrade 9's scoping law decides who answers: the selected squad
alone (its own order becomes `'rally'`, the point its own), or, with
the hero selected, the whole army (army order `'rally'`, every squad
returned to army control, one shared point). `'rally'` is a true
citizen of the ord model: `squadTarget` resolves it (the squad's own
point, else the army's) and arrival is a hold — a rallied squad also
GUARDS its banner the way a posted squad guards its post (stepping to
contact within its range + 50, returning when clear; support squads
work from the banner). Shield Wall's factoring is untouched — it
still keys on the effective order through `squadOrder`, so a squad
leaving a rally for Shield Wall gets the wall's numbers, and a
rallied squad gets none. Planting again moves the point. Any later
order supersedes the rally — a command-bar order, a direct
tap-to-place, or a new rally — because rally is an order, not a mode
that outlives orders. The banner itself (pole, gold cloth, ground
ring, drawn by `drawRallyBanners` from `rallyPoints()`) flies only
while someone holds it: when the last holder is ordered elsewhere,
it comes down. The HUD order line names Rally for both the squad and
army cases, and shows "RALLY: tap a spot" while planting is armed. A
loading tip teaches it.

**Addition 2 — POWER-READY WHISPER.** When Psalm or Five Stones
finishes cooling, the readiness signal is a whisper, not a shout:
`powerReady()` sets a soft glow pulse on that power's button (a gold
halo drawn by `drawSkillSweep`, decaying over ~0.6 s in `update()`)
and plays one gentle SFX cue — new `SFX.ready(id)`, a soft rising
fifth on pure sine at a fraction of combat volume, throttled per
power so two powers completing on the same tick each get their one
cue. No toast, no banner, no float text. It fires **exactly once per
cooldown completion**: `update()` detects the crossing tick (cooldown
was running, now ready) and fires only if the move stays ready — a
buffered cast spends the crossing and re-cools instead, so no whisper
sounds for a move that never sat ready; and a move sitting ready
cannot re-fire until it is spent and cools again. Scope call, stated
plainly: kennin named David's two powers; the rule is implemented by
button position — the hero's **second skill and his ult** whisper for
every hero, and the quick first skill (Smooth Stone) does not, on
the reasoning that an 8-second cycle whispering forever is noise,
not signal.

**Verification for the additions:** `verify_upgrade10.js` grew
50 → **77 checks** (row now seats nine; whisper and rally statics;
a 13-check rally battery — plants, selected squad paths and holds,
unselected squad unmoved, re-plant moves the hold point, tap-to-place
supersedes and drops the banner, army-wide rally with squads actually
marching, a later command supersedes; a 7-check whisper battery —
one cue + pulse on the crossing, silence while cooling and while
sitting ready, no whisper for the quick skill, re-fire after a real
spend, no whisper through a buffered crossing). One documented
re-point: `verify_upgrade9.js`'s CAMP static follows the row's shift
(176+7·117 → 130+7·117) — same button, same panel. No regressions:
U3 47/47, U4 32/32, U5 40/40, U6 34/34, U7 44/44, U8 93/93, U9 61/61,
U10 77/77 — **428 checks**. The law stands: nothing here touches the
enemy curve (rally moves only the player's own squads; the whisper
is a signal). The champion sim is unchanged (32.5 s, camp 500/500 —
neither addition is exercised by the script). `node --check` clean;
HTTP spot-check served the new main.js and sfx.js byte-identical;
`js/gxhub.js` and `js/tokens.js` zero diff. Local commit only, NOT
pushed.

## Upgrade 11 — Tutorial mode: the camp teaches the fight (2026-10-30)

kennin's approval (voice, 2026-10-30): "I like tutorial mode more...
All right, I approve that. You can work on the tutorial mode." His
shape: a tutorial that sits by the camp and teaches a new player the
game's real systems, one step at a time, with no pressure — no wave
timer, the camp cannot fall, the hero cannot die, practice targets
instead of real waves. What was built is a GUIDED LAYER over the real
battle scene and the real controls, not a mock: the same Game scene,
the same hero, buttons, squads, camp panel and orbs — with
`tutorial:true` in the scene data switching create() from the opening
shop to `startTutorial()`. `waveActive` never turns on in here, so no
wave, no shop, no victory screen and no `end()` can ever fire.

**Entry.** A TUTORIAL button on the main menu (its own row under the
button grid; the Level/Grokonians/footer lines moved down 585→612,
630→652, 680→694 to seat it) — always present, locked by nothing,
replayable any time. It starts `{hero:'david', level:{era:'bible'},
tutorial:true}`. Also offered ONCE on a fresh profile's first battle
entry: HeroSelect's Lead button checks `tutPromptNeeded()` (neither
flag set) and shows a dismissible prompt — "New here?" with Tutorial /
Start the battle side by side. Either choice is honored at once; the
offered flag (`gxhub_wotw_tutorial_offered`) is set the moment the
prompt SHOWS, so it never nags again; later battle entries go straight
in. The completion flag (`gxhub_wotw_tutorial_done`) is set only at
FINISH. Both flags exist solely to stop the game SUGGESTING the
tutorial — they lock nothing, and the menu door stays open forever.

**The seven steps** (each: one plain instruction line in a quiet panel
across the top centre of the screen, a pulsing gold ring on the exact
control or ground, advance only on the real action):
(a) MOVE — tap the ground; detected in update()'s real march.
(b) AUTO-FIRE — a practice dummy walks in and waits at the edge of the
hero's circle; the step has two halves in either order: a real
auto-fire strike (`heroAutoFire`) and a flip of the real AUTO-FIRE
toggle (`toggleAutoFire`) — flip it off and leave it off counts; the
line has three faces (waiting / auto-fire-is-off / now-flip-it).
(c) DODGE, BLOCK, SPRINT — one step; each is credited by its real path
(a successful `pressDodge`, a guard actually raised in `setBlock`, a
sprint switched on in `toggleSprint`); the sub-line names what is left
("Still to try: Block, Sprint"). Real play order applies: the held
block must be lifted before sprint will engage, exactly as in battle.
(d) POWER — a sturdier dummy; complete on any real cast, hooked at the
END of `useSkill` (past every 'No target' return, beside the Held
tally), so a cast that consumed nothing can never complete the step.
The line names Psalm and Five Stones and points out the ready whisper.
(e) COMMAND YOUR ARMY — one Shepherd Militia granted free at step
entry (run-local `addSquad`, never bought, never saved); tap squad →
tap ground posts it (the real U9 post, phase one); then RALLY — tap
RALLY, tap ground, the banner plants through the real `plantRally`
(phase two).
(f) THE CAMP — complete when the real camp panel opens
(`openCampPanel`, by CAMP button or camp tap); the line explains
Fortify and Repair. Purchases inside use the run's own manna, as in
any battle — run-local state, gone with the scene.
(g) ORBS — complete on a successful buy at the nearest orb (the ring
follows whichever station is nearest the hero). The buy is a GRANT:
`tryBuyOrb`'s spend line is `if(!this.tutorial&&!Tokens.spend(...))`
— Tokens is not called at all in here, and the instruction line says
so: "this first buy is on the house, this once."
(h) FINISH — a closing panel naming what was learned (march, auto-fire
as your choice, dodge/block/sprint, Psalm and Five Stones and their
whisper, post and rally, camp care from CAMP, the orbs), a Finish
button back to the menu, and the completion flag set — the ONLY
persistent write in the whole mode.

**Freedom inside it.** SKIP STEP and EXIT TUTORIAL stand on the panel
the whole time. Movement and every button stay live between steps.
Exiting mid-way keeps no penalties and no partial rewards: nothing
persists but the flags above. Detection is credit-based: `tutCred`
records real actions WHENEVER they happen (a toggle flipped during
step (a), Psalm cast four steps early), and `tutStepDone` is checked
again on every step entry — an action done early is honored when its
step arrives, never made to repeat (proven in the harness). The
two-phase steps (auto-fire, army) turn on their own internal events
the same way.

**Safety, by construction.** The camp cannot fall: `hitCamp` returns
at once in the tutorial. The hero cannot die: hurtHero's death branch
leaves him standing at 1 HP with a quiet "You cannot fall here" (in
practice nothing here deals damage at all — dummies deal 0 — so it is
a promise kept, not a path taken). There is no timer anywhere.

**Practice dummies.** The Pebble Golem's own figure and data path
(`pebble_golem`, img `u_pebble_golem`), spawned through the real
`spawn()` so every real system sees a real enemy — but outside the
wave system: `spawn()` is called by hand, `spawnQ` is never fed, and
wave multipliers are pinned to 1. Tutorial numbers (TUT_DUMMY): 120 HP
for the auto-fire dummy, 320 for the power-step dummy, damage 0, speed
26. A dedicated branch in the enemy loop walks a dummy to the hero and
stops it at 110 px — inside David's 140 range so auto-fire can always
reach it (the golem's own 150 range would have parked it outside) —
and there it waits: it never strikes and never marches on the camp.

**Economy firewall.** The tutorial cannot move real Manna/Grokonians,
progression, battle pass, scores, or saved squads. Kills and casts
fill only the scene's own pend (`tr`/`gx`), and `flush()` is only ever
called from `end()`/victory — unreachable here; orb buys are grants;
the granted squad is scene state; camp purchases spend run manna. The
harness proves it with recording Tokens/Progress stubs across a FULL
walkthrough plus a deliberate dummy kill: zero spends, zero earns,
zero tracks, zero XP, `g.earned` unmoved. (A kill's bounty does land
in run-local manna, exactly as in any battle — scene state that dies
with the scene.)

**Scope calls, stated plainly.** (1) The tutorial is always David in
the Bible era: the power step names Psalm and Five Stones by design,
as the task specified; other heroes' powers are the same buttons in
the real game. (2) The instruction panel sits at the TOP centre
(depth 44) — under the camp panel (50/51, whose Close stays clickable
through the camp step) and under the orb banner (45/46), which keeps
its one two-second moment over the panel when a buy lands; the panel
never covers the fight stack, the command row, or the camp. (3) The
camp step completes on OPEN, not on a purchase — Fortify/Repair are
explained in the line; buying stays the player's free choice with the
run's own manna. (4) The orb step rings the NEAREST station rather
than naming one — shortest walk from wherever the lesson has taken
the hero. (5) Skip-through still ends at an honest FINISH (the flag
is set there and only there); EXIT never sets it. (6) A loading tip
now points new players at the Tutorial. (7) Instruction WORDING is
kennin's to judge on his own playthrough — the lines are plain and in
his vocabulary (camp, rally banner, the whisper, Psalm, Five Stones),
but they have not had his ears yet.

**Verification:** `tools/verify_upgrade11.js` — **81 checks**: statics
(flags, both entries, prompt behavior hooks, grant branch, guards,
step hooks, dummy stats); `tutPromptNeeded()` as behavior across flag
states; a full walkthrough driven through the real controls with the
instruction line checked at every step; skip/exit batteries; the
silent-credit battery; camp/hero invulnerability; the firewall at the
kill itself; and the competent-play sim copied from U10 — champion
clears in **32.5 s, camp 500/500**, the U10 benchmark exactly, so the
real game is untouched. All suites green: U3 47, U4 32, U5 40, U6 34,
U7 44, U8 93, U9 61, U10 77, U11 81 — **509 checks**. `node --check`
clean. `js/gxhub.js` and `js/tokens.js` zero diff. Local commit only,
NOT pushed.

## Upgrade 12 — Controls Are Yours: custom layout, keybinds, movement schemes (2026-10-30)

Kennin's three rulings from the 2026-10-30 calls: players change their
button layout "like people can do in their settings on Fortnite";
players "change their key binds and stuff like that"; and "people
should also be able to use a joystick, touch to move around and like a
arrow like on slither.io." All three persist per player in one
localStorage settings family — `gxhub_wotw_layout`,
`gxhub_wotw_binds`, `gxhub_wotw_move`. `js/gxhub.js` and `js/tokens.js`
untouched again (zero diff). Code is in `js/main.js` only, plus this
note and the new harness.

### Ruling 1 — the custom button layout
- Every movable battle control (the right-thumb stack: AUTO-FIRE,
  DODGE, BLOCK, SPRINT, the three power buttons; the whole command
  row: the six orders, Volley, CAMP, Rally — 16 in all) registers
  itself as it is built, in a `LAYOUT_DEFS` table whose defaults ARE
  the Upgrade-10 geometry. Construction is unchanged — buttons are
  born at the approved sketch — and `applyLayout()` then moves any
  button the player's save names, syncing every coordinate the game
  keeps beside it: sweep origins (`sx`/`sy`), the `fightRects` onTap
  wall, the CAMP/RALLY tap walls, the stamina bar (now drawn under
  the toggle wherever the toggle lives) and the tutorial's rings.
  One position per button, never two. With no save, geometry is
  byte-for-byte U10 (harness-asserted).
- **Two doors, one editor.** The menu gains a **Controls** button →
  a new `Settings` scene, where the layout is edited on GHOST buttons
  (the game's own button face) standing at the layout's real positions
  over the battlefield art; and the battle HUD gains a small **⚙**
  (top right, above the stack, walled in onTap like CAMP) opening a
  **pause overlay** — the fight genuinely holds (`update()` returns
  while paused) — whose Edit Layout mode drags the REAL buttons, so
  the layout applies the moment DONE is pressed. Both editors are the
  one `layoutEditor()` helper; both carry RESET LAYOUT, which clears
  the save and puts every button back at the exact default.
- **Editing cannot misfire.** While editing, the items are
  non-interactive (a drag can never fire a button), the banner reads
  EDITING LAYOUT in gold, field taps are walled in `onTap` (a dragging
  tap never becomes a march/selection order — the U8/U9 separation
  law), and drags clamp so a button always stays fully on screen.
  Positions save as each drag ends.

### Ruling 2 — keybinds
- The Settings scene lists all 16 battle actions → key. Click a key,
  press the new one ("press a key…"); **Escape cancels**; clicking
  elsewhere cancels too. **Conflict law (chosen, recorded): a SWAP** —
  the action that held the captured key receives the key being given
  up, so no action is ever left keyless.
- **Defaults (chosen, recorded):** Space = Dodge, Shift (left, hold) =
  Block, V = Sprint, 1/2/3 = the three powers in stack order, T =
  Auto-fire toggle, B = Camp panel, Q = Volley, E = Rally, and the
  orders on the home row — Z Charge, X Hold, F Follow Me, G Flank,
  H Fall Back, J Shield Wall.
- `Game.keyAction` routes every key to the SAME function its button
  calls (`pressDodge`, `setBlock`, `toggleSprint`, `pressSkill`,
  `pressVolley`, `pressRally`, `toggleCampPanel`, `toggleAutoFire`,
  `giveOrder`) behind the same gates the buttons live behind (shop
  open, victory choice, pause, layout editing, run over). Block is
  the one hold: keydown raises the guard, keyup drops it, and a
  release is honored even if the world changed mid-hold. Because the
  paths are shared, the tutorial credits a dodge KEY exactly as it
  credits the button (harness-proven).

### Ruling 3 — movement schemes (the hero only)
- **TAP** (default): unchanged — onTap resolves on pointerdown, the
  hero marches where tapped.
- **STICK**: a floating-base virtual joystick. A field press is held
  (`pendTap`); drag it past 16px and the stick is born where the
  thumb landed — base ring and knob drawn on the screen layer, hero
  running continuously in the stick's direction at his normal speed
  (sprint and the guard's drag still apply in the one movement
  block). Release collapses his target to where he stands: a full
  stop, not a glide.
- **FOLLOW** (Slither-style): hold a field press for 280ms (or drag
  it) and the hero runs to your finger while it stays down; a gold
  arrow from the hero shows the heading (`moveHeading`). Release
  stops him.
- **The disambiguation law, whole:** under STICK/FOLLOW a quick,
  still release resolves as a tap through the very same `onTap` path —
  selection, squad posting, orb taps, Volley and Rally spots all keep
  working — while a steering drag is cancelled as a tap and can never
  post or select. Posting is an ORDER and works under every scheme;
  the hero's own march-by-tap exists under TAP only (off TAP, a
  ground tap never sends him — he is steered, not sent). Squad
  tap-to-order (U9) and the command bar are untouched. The scheme
  switches any time — Controls at the menu, or the pause overlay
  mid-battle — and persists.
- **Tutorial interplay (chosen, recorded):** the tutorial forces TAP
  for its own scene (init), and when the player's saved scheme is not
  TAP its first line says so — "The tutorial teaches tap-to-move;
  your own scheme waits outside." The tutorial never writes the
  scheme, so the player's choice is exactly where they left it
  afterwards (harness-proven).

### Scope calls (the scribe's, stated plainly)
1. **Positions only — no button scaling.** The brief allowed a
   uniform scale if trivially safe; a Phaser container's hit area
   does not scale as simply as its face, and an honest hit area
   matters more than the knob. Sizes stay the approved family.
2. **The stick is direction-only past a 10px deadzone** — the hero
   runs at his normal speed, per the ruling's own words; deflection
   depth does not throttle speed in this pass.
3. **Keybind capture lives in the menu's Controls scene**, not the
   battle pause (which carries movement + layout + resume + quit) —
   a mid-fight rebind is a rare errand, and the pause stays small.
4. **The ⚙ refuses to open during the tutorial** (with a toast saying
   why): the lesson's Exit already stands at the top, and the pause's
   scheme buttons must never quietly un-force the tutorial's TAP.
5. The pause is a true pause of the battle loop; the shop's wall-clock
   intermission is upstream of it and unreachable while it stands
   (the ⚙ sits under the shop panel, and openShop's branch runs
   first), so no timer can be gamed through it.

### Verification (2026-10-30, this machine)
- `node --check` clean on every JS file; all data JSONs parse;
  `js/gxhub.js` / `js/tokens.js` zero diff; local server serves the
  new main.js (200, U12 markers present).
- tools/verify_upgrade12.js (stubbed Phaser, REAL main.js): **66/66
  checks pass** — the settings family and both doors; defaults
  byte-equal to U10 with no save (all 16 controls + both tap walls);
  the save → rebuild round-trip (container, sweep origin, fightRects
  and CAMP wall move together; unnamed buttons keep defaults); RESET
  restoring defaults; a real in-battle editor drag (buttons disabled,
  DODGE moved but never fired, field tap walled, layout saved at drag
  end, next battle opens with it); the bind defaults (all distinct),
  capture + persistence, the swap in both directions, Escape; the
  keyboard driving dodge/block/sprint/Psalm/auto-fire/Charge through
  the real functions, walled behind the shop, and earning tutorial
  credit; scheme persistence; the tutorial forcing TAP, saying so,
  and leaving the saved scheme untouched; STICK steering east at the
  hero's speed (210px in 1.5s of harness time) with release-stop;
  the disambiguation battery (quick taps select and post under STICK,
  a steering drag never posts, no march-tap off TAP); FOLLOW arming
  on a hold, bearing −0.80 rad to a north-east finger and −π/2 due
  north, closing distance while held, ending on release; TAP
  byte-unchanged behavior; and the competent-play sim at **32.5 s,
  camp 500/500** — the standing benchmark, so default controls play
  the identical game.
- No regressions: U3 47/47, U4 32/32, U5 40/40, U6 34/34, U7 44/44,
  U8 93/93, U9 61/61, U10 77/77, U11 81/81 — **575 checks** in all.
  (One build-time correction, kept honest: the first cut rebuilt the
  CAMP wall from the container's raw position inside syncLayoutMeta
  and added size literals at registry call sites; U10's geometry
  counts caught both. The registry now takes sizes from LAYOUT_DEFS
  and the CAMP/RALLY walls follow only their sync callbacks — the
  suites as they stand assert the corrected shape.)
- NOT verified (no live browser in this environment — needs kennin's
  hands): the drag FEEL (does a button track the thumb cleanly, does
  the 16px tap/drag threshold read as intent), the stick's size and
  where its floating base wants to live, whether the follow arrow
  reads at phone zoom mid-fight, the ⚙'s reachability above the
  stack, and whether the Settings ghost editor's flat field teaches
  positions as honestly as the live one. Local commit only, NOT
  pushed (the parent sequences pushes).

**What remains for kennin's hands (Upgrade 12):**
- Drag feel and the tap/drag threshold (16px, 500ms quick-tap window,
  280ms follow hold) — all one-line constants of feel, his to move.
- Stick size/placement: base radius 52, knob 23, born where the thumb
  lands — whether it wants to be bigger, or fixed instead of floating.
- Follow-arrow readability at battle zoom, and whether FOLLOW should
  also steer while the finger DRAGS only (today a held still press
  arms it too, the slither way).

## Upgrade 13 — The Sound Pass: weight and identity (2026-10-30)

Kennin's ruling (voice, 2026-10-30): "we work on the sound like the
sound effects, the sound the enemies make, the sound the heroes make,
the players. The attack sounds, the power move sounds — you know, like
we need a oomph the sound up." Code is in `js/sfx.js` (rewritten around
its own legacy API — every pre-U13 voice survives by name and shape)
and the call sites in `js/main.js`, plus this note and the new harness.
`js/music.js` is OUT of scope and untouched: the generative pad kennin
ruled perfect keeps its own key (`gxhub_wotw_music`), its own gain, and
never passes through the new master. `js/gxhub.js` / `js/tokens.js`
zero diff.

### The master: one gain, the player's setting
- Every SFX voice now routes through a single master GainNode built at
  first unlock. Its level is the SOUND setting, `gxhub_wotw_sound`
  (0–100, default 100), persisted like the other `gxhub_wotw_*` keys.
- Controls (the U12 Settings scene) gains a Sound row: Quieter/Louder
  step by 25, a live "Sound: N%" readout, and Mute — which is the same
  setting at 0; unmuting restores the level the player had (tracked as
  lastVol). The Menu's Sound button keeps its old behavior on top of
  the same state: `SFX.toggle()` flips between 0 and the last level.
- The browser rule stands: the context is only ever created/resumed
  through `SFX.unlock()` (button presses, as before), and every voice
  fails silent — never throws — when audio is locked, absent, or the
  constructor itself throws (harness-proven both ways).

### The mix (peak gains at master = 100, before the master)
Power signatures 0.30–0.34 · boss boom 0.34 (slam ×1.2) · hero attacks
0.15–0.42 by weapon (blunt heaviest) · camp crack+thud 0.30, threshold
drums 0.30 · squad attacks 0.08–0.26 (golem fist the loud squad-side
voice) · impacts 0.05–0.17 scaled by damage · field voices 0.04–0.26
(golem spawn 0.22, falls 0.13–0.28) · the U10 power-ready whisper
unchanged at 0.045 — still the quietest thing in the kit, by design.

### Family 1 — attacks, layered (transient + body + low thump)
- `atkMelee` swish (bandpass sweep 1500→450) + triangle body (190→75)
  + sine thump (105→42); `atkBlunt` 92→30 boom + lowpass wash + a
  square knock inside it; `atkSling` rising whistle (850→2300) + strap
  snap (highpass) + body; `atkBow` string (260→150) + pluck tick +
  arrow flight (bandpass sweep up); `atkSpear` a Q5 stab + short body.
  The hero's mix runs roughly double his squads' throughout — harness
  asserts hero melee peak > 1.8× squad peak.
- Wiring: heroAutoFire melee → atkMelee(hero); ranged → atkSling, or
  atkBow for holy heroes (their "ember" needed a brighter string).
  Squads speak by weapon from their data (`squadAtkSfx`): archer/
  bowman ids → bow; other ranged/support → sling; spear role → spear;
  melee roles → melee + `exert`, a tiny grunt under the swing.
- CHOICE: the Levite Healer (support) shoots with the sling voice —
  there is no separate "holy dart" sound; if kennin's ear wants the
  healer brighter, it is a one-line branch in squadAtkSfx.

### Family 2 — power signatures
- **Psalm** (`psalm`): a warm chord — C major sines (261.63/329.63/
  392/523.25) with a slow 0.28s attack, a harp's body rather than its
  pluck — under four triangle plucks climbing 523→1046.
- **Five Stones** (`fiveStones`): CHOICE — five discrete rising
  strikes, not one crescendo: five snap+tone pairs at the move's own
  120ms cadence (the useSkill code already throws the stones 120ms
  apart), each higher than the last (480→920Hz bodies), so the ear
  counts the stones as the hand throws them.
- **Smooth Stone** (`smoothStone`): a charge — sine rising 240→900
  over 0.22s with a slow attack — then the release: strap snap +
  whistle at hero weight.
- useSkill's generic `skill()` chirp now steps aside for exactly these
  three ids; every other skill keeps it, and every other ult keeps
  `ult()` (Five Stones was the only ult with its own sound before; it
  keeps exclusivity). Boss telegraphs: `bossWarn(dur)` — two detuned
  saws rising (95→185, 142→278) with the attack stretched across the
  telegraph's own duration (heavyWindup 1.1s / slamDelay 1.2s), so the
  pitch IS the timer — and `bossBoom(scale)` at the landing: the old
  stomp plus a 58→22Hz sub and a lowpass wash, slam scaled ×1.2.
  Harness asserts the warning's first oscillator is scheduled before
  the boom's, at under half its peak.

### Family 3 — voices of the field
- Golems: `golemSpawn` rumble at spawn (two low sines + lowpass noise),
  `golemGroan` when struck (low saw + wash, 260ms throttle, from
  damage() by sprite), `golemDie` crumble instead of the generic blip
  (85→26 collapse + three descending noise bursts). Tutorial dummies
  are Pebble Golems, so the lesson field rumbles and groans too — the
  sounds are the unit's, not the mode's.
- The Baal Priest's heal (he lands one on an ally) triggers
  `priestChant`: three sines a minor second apart (196/208/98Hz)
  gliding down together over 1s at whisper-adjacent levels, throttled
  to the heal's own cadence — eerie because it beats against itself.
- Falls differ per side: enemies keep `enemyDie`; squads fall with
  `allyDie` (a descending triangle + soft thud in hurtSquad's death
  branch); the hero's fall adds a low drum (`heroDown`, hurtHero's
  real down branch only — the tutorial's 1HP mercy stays quiet).
- Enemy blows: `enemyAttack(e)` now receives the attacker; a golem
  attacker lands `atkBlunt(false)` — its fist — everything else keeps
  the legacy grunt.
- THE GATE: per-family sliding windows (100ms): atk 6, impact 6,
  voice 4, pow 5, camp 3. When a family is full, a new voice enters
  only if it is LOUDER than the quietest in the window, which it
  evicts — otherwise it is dropped. The legacy per-sound throttles
  (lim) still stand underneath. A 20-swing burst admits exactly 6.

### Family 4 — impact & camp
- `damage()` passes its amount to `enemyHit(amt)`, which is now the
  impact family: a thock whose bandpass center (800→2400Hz) and peak
  (0.05→0.17) grow with the blow, a sine body joining at 14+ damage —
  the old square chirp rides on top at lower level so the ear keeps
  the sound it learned. Projectile arrivals keep the legacy `hit()`
  tick; the thock is the damage, the tick is the landing.
- `campHit` gains a wooden crack (850Hz bandpass snap) over the thud.
- Threshold drums in `hitCamp` (`campAlarm(1|2|3)`): first blood one
  drum, crossing 50% two, crossing 25% three — each fired once per run
  from run-state flags set beside campWarnedWave in create; repairs
  and Fortify do not re-arm them (a mended camp that falls back
  through a line does not drum twice — the flags are the run's memory,
  and the camp bar already shows the number).
- Victory/defeat stingers already existed (`win`/`lose`) and stand.

### Verification
tools/verify_upgrade13.js — 110 checks: statics (new surface, legacy
surface, music untouched, every main.js wiring point); the recording-
studio runtime (layers per weapon, hero>squad, damage scaling, gate
caps + quietest-first eviction + window slide, chant throttle, voice
cap, warn-before-boom order and weight, camp crack + drum sequences,
whisper level, volume persistence/reload/clamp, silence-at-zero, and
no-throw under missing/throwing AudioContext); main integration with
the REAL SFX (hero thump through heroAutoFire, golem groan/crumble
through damage(), camp drums 1/0/2/3 through hitCamp(), Psalm chord
and five-strike pattern through useSkill(), and the Controls sound
row driving the real persisted setting through its own buttons); and
the competent-play sim copied from U12. All suites green together:
U3 47, U4 32, U5 40, U6 34, U7 44, U8 93, U9 61, U10 77, U11 81,
U12 66, U13 110 — 685 checks. Sim unchanged: champion 32.5s,
camp 500/500. Local commit only, NOT pushed (the parent sequences
pushes).

**What remains for kennin's ears (Upgrade 13):**
- The overall loudness balance between families — the mix above is a
  first setting of the faders; which family feels too forward or too
  buried is his call on real speakers.
- Five Stones as five counted strikes vs one gathering crescendo —
  the counted version shipped (it matches the throw cadence); the
  crescendo is the alternative if the ult should feel like one wave.
- Smooth Stone's charge time (0.22s rise) — whether the wind-up
  should feel longer, more dangerous, before the release.
- The priest's chant: how eerie is right — it is deliberately quiet;
  if it reads as noise rather than menace, it wants lowering or a
  slower glide, both one-line changes.

## Upgrade 14 — The Last Pieces: endless champions, two heroes given their identities, and the week's law (built 2026-10-30, at kennin's word on the evening voice call: "You could go ahead and start working on that now")

The two pieces kennin had already decided and left waiting for a start word: endless mode gets its bosses ("I do want more bosses there"), and the Bible era gets the two heroes and two weekly twists of the ERA-IDEAS sheet — Deborah, Samson, Night of the Torches, The Seventh Day. All of it rides the existing machinery: the champion IS the Upgrade 7 engine, the heroes' powers were already in the data, the twists bend numbers the wave system already had (night, spawn timing). Nothing new inflates anywhere; the flattened curve is untouched, and the Grokonian flow and the generative music are untouched.

### 1. Endless champions — every tenth endless wave
- **Cadence: every 10th endless wave (20, 30, 40, …)**, `ENDLESS_CHAMP_EVERY = 10`. Why ten: the campaign's own heartbeat is ten — the goal wave is 10 — so endless keeps the same pulse the player already learned. The champion rides the goal wave itself in a normal run (unchanged); endless adds one idol golem to waves past the goal on the cadence, flagged boss, spawned last in its group exactly as the goal champion is, and the wave toast names it: "a champion rises!" The name plate reads "— ENDLESS CHAMPION · WAVE N" so a player always knows what stands in front of him.
- **Same engine, same law.** Three phases (telegraphed heavy, roar + four era escorts + slam at 2/3, enrage below 1/3), HP ×5 / damage ×1.6 on the flattened curve, gold plate and phases included. Wave 30 champion: 4,477 HP, enraged heavy 138 (a full hero is 200 — heavy but never one-shot). **One edge stated plainly, not hidden:** the enraged heavy grows with the damage curve and reaches exactly 200 at endless 60 — an unperked David caught standing in the ring at wave 60 falls. It remains what it always was: telegraphed and dodgeable, and mastery HP (240 at ten levels) clears it. Kennin's call whether the deep heavy should cap below base hero HP; the curve itself was not bent to hide it.
- Banked scores and leaver behavior are untouched — the champion changes what a deep run must survive, not what it banks.

### 2. Deborah and Samson — the identities the sheet promised
Both heroes already stood in the roster with their powers; what they lacked was the passive identity ERA-IDEAS assigns them. Built smallest-form, riding existing systems:
- **Deborah, the Palm Judge** — *"her song slows the enemy line."* While Deborah leads, every enemy's advance is ×0.92 (`HEROISM.deborahSongAdvance`) — a permanent, quiet slowing of the whole march, both branches (the road march and the camp assault), applied through the new `enemySpdMul()`. Her ult (Song of Deborah, −40% speed for 8s) remains the crescendo of the same song. The sheet's flavor won over the sketch's "orders strengthened": the doc is the decided material.
- **Samson, the Nazirite** — *"power that peaks when he stands alone. Strength with a price is his whole story."* While no living squad stands within 240px of him (`HEROISM.samsonAloneRange`), Samson's own blows deal ×1.5 (`HEROISM.samsonAloneDmgMul`), composed with the orb multiplier in the new `heroDmgMul()`. The price is the standing itself: alone, nothing guards him but Pillar Pull and his own strength. The moment the state turns, the game says so — a "Strength alone!" float over him and an `ALONE ×1.5` chip in the buff line. Jawbone Cleave was already his; the identity is now true in the numbers.
- Both ride the flattened curve — ×0.92 and ×1.5 are tempo and placement, not inflation.

### 3. The week's law — Night of the Torches and The Seventh Day
- **One twist at a time, Bible-era runs only, rotating weekly** (`TWISTS`, `weekIndex()`, Monday rollover, strict alternation of the two decided twists). The rotation is a pure function of the calendar week — same answer all week, deterministic, harness-proven across the Sunday→Monday seam. The tutorial is exempt (its sealed economy keeps no outside weather). The law is NAMED where the player chooses: the era-select screen's line reads "This week in the Bible era: Night of the Torches — …", and the run's opening toast repeats it.
- **Night of the Torches** — Gideon's night, retold weekly: *every* wave is a night wave. Your ranged reach farther (×1.25 range at night, up from the plain night's ×1.1) and the enemy marches faster (×1.15 at spawn, up from ×1.08). A gift and a threat in one law.
- **The Seventh Day** — rest is a weapon too: every 7th wave opens with ten seconds of stillness — no enemy spawns — while manna rains on the camp at 15 per second (150 across the rest). The wave toast announces it; a float at the camp marks its close. First-pass numbers (the 1.25/1.15, the ×0.92, the 240px, the 150 manna) are kennin's to tune; they sit in one named table each (`TWIST`, `HEROISM`) for exactly that.
- Deborah's slowing and the Torches' haste compose honestly: under Deborah in Torches week the enemy still marches faster than a plain day (1.15 × 0.92 > 1.08 base night) — two laws, both visible, neither silently cancelling the other.

### Verification — tools/verify_upgrade14.js (new suite, 54 checks); full battery 739/739 across all twelve suites
- **Cadence, from the real queue:** goal wave non-endless = exactly one boss; endless 20 and 30 = exactly one idol-golem boss; endless 21 and 25 = none. Endless plate text and curve stats asserted at 20/30/60, one-shot bounds at 30.
- **Sims, played through the real update() loop with the Upgrade 7 script** (charge/fall back on telegraphs, hero kiting): **endless 30** — the deep roster (the shop ladder's strongest eight, fully upgraded, POSTED along the road — Upgrade 9's prepared play), orders and steel only, no skills, no orbs: champion dead in 32–37s, camp untouched at 500/500, all three phases. **Endless 60** — the same posted line with what a wave-60 run honestly holds (Fortify III, max-mastery hero, powers cast with the ult held to Tempered, and the orb economy played openly — Strength kept up, Thunder on cooldown, Mending when the line bleeds; 150–175 Grokonians spent per fight, the spend reported in the check itself): champion dead in 44–54s, camp untouched at 1100/1100, all three phases. Both sims re-run repeatedly green.
- **Two honest balance findings, recorded rather than tuned away.** (a) The wave-10 kit — the austere Upgrade 7 army — is NOT enough at depth: at endless 30 it is a coin flip, at endless 60 a clear loss. That is the kit's story, not the wave's: squad HP never scales (the shop fixes it), so deep waves are answered by the deeper roster, posting, and the orb economy — the game's own systems, which the passing sims use and the failing ones deliberately did not. (b) The champion's area blows punish a clustered melee line at depth; the posted spread line is the working answer. If kennin wants the austere kit to carry deeper, the lever is squad durability at depth, and it is his to pull — no number was bent here to make a check pass.
- **Heroes:** Samson's alone blow lands exactly 45 (30 × 1.5) with Math.random pinned, exactly 30 accompanied, a squad beyond 240px does not break his solitude, a fallen squad does not count as company, and David is untouched by the factor. Deborah's line marches at a measured 0.92 of David's over forty real update steps.
- **Twists:** same week same law from Monday and Wednesday; the week turns at Monday; the two laws strictly alternate; Torches makes an odd wave a night wave with the rect drawn, spawn speed exactly ×1.15 (plain night still ×1.08), and a posted slinger at 175px — beyond plain range, inside Torches reach — fires on frame one while holding fire on a plain day. Seventh Day: every wave-7 spawn delayed ≥10s, ten seconds of updates spawn nothing, manna lands 148–150 (continuous rain, integer payouts), and wave 8 keeps the old clock.
- **Three older checks re-pointed, documented per house custom:** U5's hero-damage assertion now names `heroDmgMul()` (orbDmgMul is still asserted directly in that suite); U8's and U10's Samson melee batteries now expect 45, not 30 — Samson stands alone in those batteries, and their labels say so. Nothing else regressed: U3 47/47, U4 32/32, U5 40/40, U6 34/34, U7 44/44 (goal champion: same ~30s, camp whole), U8 93/93, U9 61/61, U10 77/77, U11 81/81 (tutorial benchmark intact), U12 66/66, U13 110/110, U14 54/54.
- Local server: 200 for /, js/main.js, data/units.json, data/eras.json. js/gxhub.js and js/tokens.js untouched, as ordered.

## Multiplayer Slice 1 — private code-lobby co-op (built 2026-10-30, at kennin's word on the late voice call: he has a tester, chose the Among Us shape himself — "a queue lobby like among us? With the code?" — and said "let's get to work")

Multiplayer is un-parked and built as the design (multiplayer/DESIGN.md) prescribed, under all thirteen gate rulings and the NEW defeat rule kennin laid down the same night: **when the camp falls, the run does not end — play continues until the heroes die** (no respawns with the camp down; a hero who falls then stays down). Full record: multiplayer/MULTIPLAYER-NOTES.md and multiplayer/PROTOCOL.md.

- **Rooms service (new Worker `watchmen-rooms`, free tier):** a Registry Durable Object mints 6-char codes (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 30-minute lobby expiry, failed-lookup rate limiting); one Room Durable Object per code seats up to 4, runs the authoritative sim at 10 Hz over hibernating WebSockets, and broadcasts full-but-compact state (delta compression is named future work, not hidden). The sim (`multiplayer/rooms/sim.js`) is a headless extraction of the solo rules: the same Bible waveComp, the same flattened curve (player count NEVER touches HP/damage scaling — kennin's law), count scaling ×(1+0.55 per extra player) with elites capped at +1 per extra player, shared camp at 500×(1+0.5 per extra player), per-player Manna with kill attribution, camp track bought personally and blessing the team (Swift Return is the buyer's own), field coins (every sixth a Grokonian, earned through each client's own hub bridge), orb effects with the per-buyer 15 s station cooldown, the Upgrade 7 champion (three phases — telegraphed heavy, escort call + ground slam, enrage), Deborah's song (×0.92) and Samson's standing alone (×1.5) as passives, the 60 s shop on the server clock with the all-connected Ready vote, and the Warden: a dropped seat is held 60 s, then the hero withdraws and their squads rally to the camp. Data is generated from the game's own data files (`rooms/build_data.py`, hash-stamped) — no hand-copied roster to drift.
- **Entry is GX Hub accounts only (G12 as ruled):** the game asks the hub bridge for a single-use ticket (`POST /api/multiplayer/ticket`, session-cookie auth, 120 s TTL, stored hashed in D1 `mp_tickets`); the rooms service consumes it against the same D1. No ticket → a plain "sign in to the GX Hub" refusal, no socket. The hub deploy carried the standing discipline (snapshots in gxhub/snapshots, bindings identical 12/12 and 9/9, AUTH_GATE untouched).
- **Game client (`js/net.js`, new):** Menu gains one 'Play Together' button (the ONLY main.js change; scenes register from net.js; gxhub.js/tokens.js byte-identical). NetLobby: create (big code) or join by an on-screen keypad over the code alphabet, `?room=` prefill, member rows with slot colours, hero pick honouring solo unlocks, duplicates allowed, host Start. NetGame: a remote-mode mirror — sprites/HP bars from the authoritative state, camera following the own hero, tap-to-move (the own hero glides to the server's position; no client state is invented or trusted), command row + post + volley, quick signals (👍 ⚔ 🛡 ⏳), shop + camp track, orb buys spent locally through Tokens first exactly as solo, goal-wave host decision, runEnd tallies → `GXHub.submitScore` + CQ stars, ~70 s reconnect with the same resume token.
- **Not in Slice 1, stated plainly (the honest seam):** hero skills/ults (heroes fight with basic attacks + the two decided passives), squad upgrade purchases in the net shop (base squads + camp track only), weekly twists in rooms, the public queue (Slice 2), delta compression, rematch voting. Solo mode is behavior-untouched: all twelve suites re-run by the coordinator — **739/739**, per-suite counts identical to baseline.
- **Verification:** rooms headless suite 44/44 (curve, count scaling at 1–4 players, camp-falls continuation, all-heroes-dead defeat, 60 s Warden + rally, respawn rule, Registry/Room DO logic with mocked storage/sockets, ticket path with a fake D1). **Live, end-to-end, twice:** two throwaway hub accounts → real tickets → room SJWCBY/UJ4CRF → join, lobby, hero pick, host start, authoritative shop + wave state streaming to both WebSocket clients, Warden event on a mid-wave drop, resume inside grace with a live snapshot — all PASS; both test accounts and every row they touched deleted and verified zero afterward. A client-protocol mismatch was caught in integration (the client anchors the shop countdown on a wall-clock `shopEndsAt`; the server now sends it in state and as `{t:'shop'}`) and re-verified live. What remains unproven is the one thing no harness here can prove: two real devices in two real hands — kennin and his tester are the first true two-player test.

## Upgrade 15 — Gather & Build: mine the field, fence the camp (built 2026-10-30, at kennin's word on the voice call: "All right. Let's get working on it then.")

Kennin's design, in his words across the call: gather resources by mining — wood from trees, stone from rocks — then build defenses around the camp, "like fences, like in Fortnite Save the World where you have to protect the core. We could do that for the camp." The assistant's suggestion he received warmly in the same call stands in the build: fences wear with use and must be mended between waves. The 3D/first-person framing was discussed as a LATER possibility only — no view change was attempted; the game stays its 2D self. Solo only: the netcode (`js/net.js`, the rooms sim) is untouched, and the port to rooms is future work, named below. Music untouched; `js/gxhub.js` and `js/tokens.js` untouched; the tutorial's seven steps untouched (build mode refuses there, like the ⚙ does); the flattened curve untouched — building is a player-side tool, not a curve change. Solo defeat/respawn stands exactly as Upgrade 3 left it (the camp-falls continuation rule lives in rooms; this upgrade changed nothing about it).

### 1. Resource nodes — trees and rocks, stand-to-gather
- **The field:** 6 trees and 5 rock outcrops at fixed world fractions (`NODE_SPOTS` — the orb-station pattern, so every era inherits the same posts). In the Bible world (1920×1200): trees at (480,240), (768,420), (979,180), (1171,756), (1421,300), (1680,876); rocks at (518,1020), (883,1020), (1114,420), (1517,1020), (1766,516). Harness-proven: every node ≥200px from the camp, ≥110px from every orb station, deterministic across runs.
- **Gathering is standing, not clicking:** the hero gathers by standing still within `GATHER.range` (80px) of a node — feet settled under every movement scheme (a tap target reached, a stick released, a finger lifted; actual stillness is measured, so no scheme is favored). Every `GATHER.tick` (0.55s) one swing lands — tree: the melee swish, rock: the blunt knock, the SFX families the field already speaks, no new audio — and +2 of its resource joins the purse (`GATHER.woodYield`/`stoneYield`), with a "+2 Wood/Stone" float and a chip spark at the node. Walking through a grove gathers nothing; a dodge or a march breaks the channel.
- **Depletion and regrow — the slow timer was chosen** (over a between-waves refresh): a node holds 5 swings (10 of its resource), then stands dimmed, greyed and shrunk, and regrows full after `GATHER.regrow` (45s). A long defense can be re-timbered mid-run, but the field cannot be strip-mined in one breath — and the intermission cannot be farmed by emptying the map, because the map refills slower than the minute runs.
- **The purse is run-local:** wood and stone live beside Manna in the HUD stat line ("Wood N · Stone M", always visible during a run), are earned nowhere else, buy nothing but building, and die with the run — never Manna, never Grokonians, never saved.

### 2. Build mode — the bar, the tools, and the one placement law
- **The BUILD control** takes the seat directly under the power stack (1178,568 — the stack's eighth seat, same 196×56 family, bottom edge 596 still clear of the command bar). It joins the Upgrade 12 system properly: a `LAYOUT_DEFS` entry (the table is now 17 controls) so it drags in both layout editors, and a `build` keybind (default **KeyC**, free among the defaults) in the Settings list — which now lays out three columns of six to hold 17 actions. It is command furniture, not a fight input: it does NOT join `fightRects` (the Upgrade-10 stack wall stays exactly seven, so U10 is untouched), and it keeps its own onTap wall like CAMP and ⚙. One documented re-point: U12's control count 16→17, labeled as such in that suite.
- **The build bar** (a panel above the command row): Fence and Wall tools with their costs, Mend, Demolish, Done. The purse shows in the bar; a tool the purse can't afford renders disabled. The tool in hand stays selected and highlighted. Build mode and the targeting modes (Volley/Rally) cancel each other; the camp panel and the build bar close each other. A **placement ghost** follows the pointer's world point: the snapped cell, green where the tool may land, gold over a piece it can mend or demolish, red where it may not — a guide drawn from live state; the tap itself re-checks everything.
- **Numbers (the `BUILD` table, first pass, kennin's to tune):** Wooden Fence — 6 wood, 120 HP. Stone Wall — 6 stone, 320 HP. Mend — restores 50% of max HP for ⌈cost/3⌉ = 2 of the piece's resource; refuses a whole piece. Demolish — refunds ⌊cost/2⌋ = 3. Placement snaps to a 64px grid, one piece per cell.
- **THE PLACEMENT LAW, stated plainly and defended:** pieces may stand anywhere EXCEPT (a) inside the camp's own ground (center within 118px of the camp), (b) across a resource node (64px) or an orb station (76px), or (c) in the spawn-mouth band (cell center east of worldW−150) — **the road in can be funneled, never sealed.** The defense of the law: this game has no pathfinding and needs none for the law to hold. An enemy marches on the camp and stops for the nearest blocker in its 90px scan; a piece is a blocker with HP (§3), so even a complete ring is only ever a delay — it is chewed through piece by piece and the camp is reached the moment a gap opens. Nothing buildable can make the camp unreachable, so placement freedom elsewhere costs nothing and funneling is real play. The spawn band exists so the mouth itself can never be corked at the source — enemies always enter the field and find a road, however narrow the funnel beyond it.

### 3. Fences as defenders — pieces in the game's own targeting
- A piece joins the enemy loop's EXISTING blocker scan, unchanged in shape: measured to its body (center distance − `BUILD.bodyR` 30), it must beat the nearest living defender's distance, and it must truly stand between the enemy and the camp (its own camp-distance no greater than the enemy's + `behindPad` 30) — a fence behind the enemy's line, or behind the enemy himself, blocks nothing, and a defender standing closer is still fought first. An enemy that reaches a piece attacks it at its own rate and damage through `damageBuild()`; wear shows as tint stages (bright → worn → battered) over a squad-pattern HP bar; at zero the piece falls with a crash knock and a "Fence/Wall down!" float, and the road reopens.
- The champion chews pieces with his ordinary blows through the same loop (`bossEngaged` counts a piece he is held at, so his wind-up gathers at a fence as at a defender) — but his telegraphed SPECIALS stay aimed at the living: the heavy strike's ring and the slam's circle do not target pieces. A fence delays his march and eats his plain attacks; it does not eat a blow meant for men. Stated here so the tuning conversation starts from the truth.
- The hero and his squads pass through pieces freely — no friendly collision exists anywhere in this game, and none was invented for fences. Squads shoot through them (there is no line-of-sight system to honor). Camp-assault behavior is otherwise byte-identical: enemies still prefer their standing targets per the current AI; pieces matter only when they block.

### 4. The intermission's other room — building needs a window, so the shop got a door
- The 60-second intermission was the natural build window, but the shop filled the whole screen for the whole minute: there was no field to build on. The shop now carries a **"To the Field ▶"** button (top right of the shop panel). Stepping out closes the shop's furniture and puts the player on the live field — hero, squads, nodes, orbs, build mode, all of it — under a slim field bar carrying the SAME countdown, a **Shop** button back in, and **Next Wave ▶**. 
- **One clock, two rooms:** the deadline is the shop's own `shopEndsAt`, never re-armed by leaving or returning (`openShop(first, keepT)` — the keep-deadline path, used only by the field bar's Shop button; every other caller arms the full minute as ever, and U6's shop battery passes untouched). At zero the wave starts from the field exactly once (`beginInterWave`, guarded by the state flag, harness-proven). The pause holds this clock too, as it holds everything. Held Power does not accrue during the field intermission — patience is earned in the fight, and the intermission is the shop's time wherever the player stands.
- The tutorial tip asked for in the brief stands in two cheap places that force nothing: the field bar carries the line "Between waves: gather wood and stone — BUILD fences and walls around the camp," and one loading tip teaches the whole loop. The tutorial's seven steps are unchanged; build mode refuses inside it.

### Verification — tools/verify_upgrade15.js (new suite, 53 checks); full battery 792/792 across all thirteen suites
- **Gathering, exact:** standing at a tree for 80 frames yields exactly 10 wood (5 swings × 2) and empties the node; the regrow clock reads 44.1s after ~1.2s of depletion; out of range the purse never moves; at timer's end the node stands full; a rock yields stone, not wood (+2 after one swing).
- **Building, exact:** placement deducts exactly 6 and registers the piece at table HP on its snapped cell; every refusal proven without charge — occupied cell, camp ground, spawn band, node cell, orb cell, empty purse. Build-mode field taps route to the tool in hand; the tutorial refuses build mode.
- **Combat truth, through the real update() loop:** a locust spawned on the camp road marches, stops at a road fence (held at x≈999, east of the piece), chews it from 120 HP down (76 HP at the 10-second mark), destroys it, and only then reaches the camp (500→468 by the end of the run). The control march — same enemy, same road, no fence — is on the camp within seconds (500→476). Nothing about the unblocked road changed; U7's goal champion and U14's endless sims pass byte-identical (44/44, 54/54).
- **Mend & demolish at table:** 120−70=50; mend → 110 for 2 wood; second mend caps at 120; a whole piece refuses; wall registers 320; demolish refunds 3 of 6 and the piece is gone.
- **Intermission:** shop opens on a fresh 60,000ms deadline; leaving keeps the identical deadline; at 30s gone the field bar reads "Next wave in 0:30" and no wave has started; returning to the shop keeps the deadline; at zero the wave starts exactly once, and not twice.
- **Full regression:** U3 47, U4 32, U5 40, U6 34, U7 44, U8 93, U9 61, U10 77, U11 81, U12 66 (one documented re-point: the control count), U13 110, U14 54, U15 53 — **792/792**. `js/net.js`, the rooms sim, `js/gxhub.js`, `js/tokens.js`, and the music are untouched (git-verified at ship).

### Honest findings for kennin's tuning
- **A fence is strong against stragglers, weak against packs — by arithmetic, not accident.** One locust (4 dmg / 0.9s) needs ~27 seconds to chew a 120-HP fence; a full locust pack focuses the same piece (the scan gives them all the same nearest blocker) and melts it in ~3 seconds. If fences should hold a swarm road longer, the lever is fence HP or a per-piece attacker cap — both his call; neither was smuggled in.
- **The first intermission is a real build window now.** Before wave 1 the hero can empty roughly two nodes in the field minute (a node's five swings take ~2.75s of standing, plus the walking) — about 20 resources, three pieces, before the first enemy arrives. That is the intended Fortnite beat (prepare the core, then defend it), but if the first wave should arrive against a barer camp, the lever is node distance from the camp or the first shop's length — not the curve.
- **The champion's specials ignore pieces (see §3).** A player who rings the camp and stands inside the ring will still eat heavies and slams through the fence line. If kennin would rather the ring eat ONE special as a sacrificial layer, that is a small, honest addition — but it changes the dodge's meaning, so it waits for his word.
- **Gather swing cadence (0.55s) and the 45s regrow are the two feel numbers most likely to move** after his hands are on it; both sit in the one `GATHER` table with the yields.

### Future work, named not built
- **Multiplayer port:** rooms need the sim to own nodes, the purse, pieces and placement (server-authoritative, per the Slice 1 pattern), with G4's command scoping deciding whose taps build and whose purse pays — a design question for kennin before it is a code question (shared camp, personal wallets: whose wood fences the shared camp?). Not attempted here, per the brief.
- 3D/first-person build framing remains a later possibility only, as kennin left it.


## Upgrade 16 — battle buttons become SYMBOLS, not words (2026-10-30)
Kennin's ruling (voice, 2026-10-30 ~23:39 CDT): "I want you to upgrade
the buttons, like the attack buttons — I don't want them to be words, I
want them to be symbols." Every in-battle HUD face in the Upgrade
8/9/12/15 control set now wears a symbol; menus keep their words.
js/gxhub.js, js/tokens.js, js/net.js and the music are untouched; no
balance numbers moved; button sizes, positions, drag layout, saved
layouts and keybinds are byte-for-byte the systems they were.

### The family (makeIcons() in js/main.js, called at Boot)
27 textures drawn in code — Phaser Graphics vector shapes generated at
boot on one 120px canvas (ICON_SIZE), gold-on-dark in the game's own
palette; no emoji, no icon files, no text glyphs. A texture that
already exists is never regenerated. The faces:
- Powers (resolved per hero by skillIconKey, from the move's own name):
  Psalm / any Song -> lyre (ico_psalm); Five Stones -> five stones in
  an arc (ico_stones5); Smooth Stone / any Stone -> one ringed stone
  (ico_stone1); flame/fire/altar/chariot -> flame; sea/geyser/wave ->
  wave; palm/judgment -> palm; sword/cleave/jawbone -> sword; roar ->
  sound arcs; rally -> banner; pitcher -> jar; manna/meal/raven ->
  bowl; pillar -> pillars; anything else -> the eight-point burst
  (ico_burst), the family's generic power mark.
- Dodge -> curved swoosh arrow; Block -> shield with cross; Sprint ->
  boot with speed lines.
- Charge -> crossed swords; Hold -> planted flag over a ground line;
  Follow Me -> footsteps toward a star; Flank -> two hooked arrows
  around a center block; Fall Back -> an arrow returning to a shield;
  Shield Wall -> three shields in a row; Volley -> a fan of arrows
  arcing onto a marked ring.
- CAMP -> a tent; RALLY -> a planted flag with a ring at its foot;
  BUILD -> a hammer over a fence board; AUTO-FIRE -> a bow inside a
  circular arrow.

### How the faces are built (the button() helper grew three options)
- opt.icon: the button carries the symbol image centered on its face;
  its label text is created EMPTY and hidden — no word stands on any
  battle button. Cooldowns ride the existing sweeps plus a dimmed icon;
  Held Power tiers ride the sweep's bar/rim, and a Perfect power tints
  its symbol gold (the update loop no longer writes names/countdowns
  onto skill faces — the tier float above the hero still speaks them).
- opt.floatName: a press (pointerdown) floats the action's name above
  the button for ~1s (Game.floatBtnName, one float at a time) — the
  Upgrade 9 skill-name float, generalized, so a symbol teaches its
  meaning in the moment.
- AUTO-FIRE's state is its face: ON = symbol untinted + the button lit
  (applyAutoFace drives redraw(true)); OFF = symbol dimmed to grey +
  unlit. The toast still speaks the state in words; the button doesn't.
- opt.caption (Controls ghosts only): the layout editor's ghost buttons
  wear the same symbols WITH the name as a small caption beneath, and
  the Controls keybind list still names all 17 actions in words — the
  Controls screen is where symbol and name are learned together.
- Out of scope, deliberately: shop/intermission/menu/camp-panel/build-
  bar buttons keep text (they are menus, with prices to read); the
  speed (x1) and ⚙ buttons are untouched; NetGame's mirrored room
  controls in js/net.js still carry their word faces — porting the
  family there is a slice of the room work, not smuggled into this one.

### Verification (2026-10-30, this machine)
- node --check passes on all JS files.
- tools/verify_upgrade16.js (stubbed Phaser, REAL main.js): **35/35** —
  makeIcons generates exactly 27 textures at 120x120 and is Boot-safe
  on a second call; CMD_ICONS complete (9 distinct) and LAYOUT_ICONS
  covering all 17 controls; the resolver's mappings incl. fallback;
  the built HUD: all 17 battle controls carry symbol images with EMPTY
  hidden labels and 17 DISTINCT icon keys; simulated presses fire the
  right actions (lyre -> pressSkill(1), crossed swords -> Charge,
  swoosh -> dodge); presses float the right names ("Hold", "Five
  Stones", "Build"); the AUTO-FIRE face flips gold<->dim with state
  and never shows a word; a saved custom layout loads onto the symbol
  faces (DODGE and CAMP land at saved seats with their sync state);
  the Controls scene's bind list names every action and its ghosts
  wear symbols + name captions.
- Superseded checks re-pointed, not deleted: verify_upgrade10.js (the
  U10 word-face assertions — "AUTO-FIRE: ON" label, "real text labels",
  skill label==name — now assert the symbol faces and the same
  behaviors: toggle persistence, per-hero resolution) and
  verify_upgrade9.js (the CAMP button call site). All fourteen suites
  green: **827/827 checks** (792 prior + 35 new). Prior benchmarks
  unchanged (U7 champion sim, U9 posted-play, U11 tutorial 81/81).
- NOT verified (no live browser here): whether each glyph READS at
  phone size in a live fight — my honest doubts, named for kennin's
  eyes: **ico_follow** (footsteps + star is the busiest face and may
  blur at 110px wide) and **ico_volley** (the arrow fan's heads are
  small; the marked ring carries it). ico_flank's hooks read as
  brackets at small size — acceptable, but it is the third to watch.

## Upgrade 17 — CIRCULAR battle UI + the SIMPLE battle face (built 2026-10-31)
Kennin's rulings (2026-10-31 ~00:09–00:10 CDT): "I want the ui buttons
and the attacks to be circles not squares and rectangles." — and a
minute later: "And i want you to simplify the buttons. I want the game
to be easy to play." Every battle-phase button is a circle now, and the
battle view has two faces: SIMPLE (the core circles plus one ORDERS
circle that fans the command rank open) and FULL (every circle always
visible — the previously approved layout, preserved). Simplification is
by presentation only: no function was removed; every command is at most
two taps away in Simple. js/gxhub.js, js/tokens.js, js/net.js and the
music are untouched; no balance numbers moved; the scaling law, the
camp rules, and personal wallets / own-army orders stand as they were.

### The circles (js/main.js)
- The shared `button()` helper takes `opt.circle` (a diameter): the
  face is drawn with fillCircle/strokeCircle, the U16 glyph is centered
  at 64% of the diameter, and every control records `circleR`.
- **Hit-testing is truly circular, enforced in the press handlers from
  the pointer's own local coordinates** (`Math.hypot(lx,ly) <= circR`,
  in the same centered frame the face is drawn in): a tap in the
  bounding square's corner never dips, floats a name, or fires; center
  taps always fire. The container's Phaser hit area stays the default
  rectangle — a harmless superset. Why not a `Geom.Circle` hitArea:
  Phaser's container hitArea offset conventions could not be verified
  without a live browser, and a displaced hit area would silently
  break every button in the real game while the stub suites could not
  catch it; the layout editor also resets `setInteractive` on exit,
  which would have wiped a custom hitArea. The radius gate is exact
  under any Phaser version and survives the editor. BLOCK's hold
  handler carries the same gate, and `overFight` (the onTap wall for
  the stack) is a circle test with no padding — a corner tap now falls
  through to the field instead of dying in a dead corner. The CAMP /
  pause / BUILD onTap walls are circles too.
- **Geometry** (LAYOUT_DEFS; w==h==diameter for all 18 controls):
  powers **76** (the biggest circles), the thumb cluster (auto-fire,
  dodge, block, sprint) **64**, the command rank **56** — every current
  button was 56 tall, so no target shrank; the hierarchy kennin
  approved stands. The stack keeps x 1178 with wider pitch (auto 76,
  dodge 166, block 234, sprint 302, powers 384/470/556; the last rim
  lands at 594, clear of the bar at 610). The command row keeps its
  seats. **One default seat moved:** BUILD's old seat under the stack
  (1178,568) is physically occupied by the grown power circles, so
  BUILD is a 64 circle at the row's right end (1130,665) — and is the
  fan's last member in Simple. Saved layouts are untouched by this:
  positions are centers, were always stored as centers, and land
  identically (proven against a pre-U17 save in the suite).
- The ⚙ pause button is a 40 circle; the speed toggle is a 44 circle.
  **One documented exception:** the Fullscreen button stays a rectangle
  — it is a display utility whose whole word is its meaning, and no
  circle that fits its corner could carry it. Menus, the shop, panels,
  cards, and the build bar's tool buttons are panels, not battle
  buttons, and stay as they were (per the brief). The stamina bar under
  the auto-fire toggle stays a bar — it is a readout, not a button —
  narrowed to the toggle's own width. NetGame's room controls in
  js/net.js still wear the word-faced row from U16's deferral: the
  circle support lives in the shared `button()` helper, so the room
  work can adopt it without a fork; mirroring the faces into rooms is
  room work, named here rather than smuggled in.

### Round feedback
Cooldowns are rings now. A skill on cooldown wears a dark disc over
the glyph and a gold arc that sweeps clockwise from the top, growing
back as the power returns — the arc's length is the time left. Smooth
Stone's held charge, always ring-shaped in spirit, is a rim arc
climbing to the gold Tempered rim and the pulsing Perfect rim. The
power-ready whisper is a ring pulse that swells once and fades. The
dodge veil is a disc with a recovery arc; the block stamina strip is a
ring around the Block circle (green while the guard holds, red through
a guard break); the volley sweep matches the skill language. Arcs are
drawn from line segments (arcSegs) — the one graphics verb every
surface already trusts. Buff chips and press name-floats are unchanged.

### The two faces and the fan
- SIMPLE stands: the three powers, Dodge, Block, Sprint, the auto-fire
  toggle, CAMP, and **ORDERS** (a new circle wearing the existing
  banner glyph, ico_banner — no new texture; the family stays 27).
  The command rank (Charge, Hold, Follow Me, Flank, Fall Back, Shield
  Wall, Volley, RALLY, BUILD) is hidden — disabled, not removed.
  Tapping ORDERS fans the nine circles open in a row above the bar
  (y = anchor − 113, pitch 84, the members at their full 56/64 size —
  never shrunk to fit). Tapping a member issues it and closes the fan;
  tapping ORDERS again, tapping anywhere else (consumed — never a
  march order), opening the shop, or the run ending closes it without
  issuing. CAMP is never behind the fan. Keyboard players keep their
  one-press binds for everything, as before.
- **The setting:** "Buttons: Simple / Full" in Controls AND in the ⚙
  pause mid-battle (`gxhub_wotw_face`). **Derivation:** a stored choice
  always wins; otherwise a player who already customized anything
  under Upgrade 12 (layout, binds, or movement keys present) defaults
  to **Full** — nobody's learned layout is taken away — and a new
  player defaults to **Simple**. The tutorial always teaches Simple.
- **Seats vs standings:** every control's layout seat is kept in
  `seatPos` (recorded through the registry sync; `seatOf()` falls back
  to the table default) — never read back off a container. The fan
  moves members for display; their seats do not move. applyFace() is
  the single mover for face changes, and the active-position records
  (volley sweep origin, rally/build tap walls) are computed from seats
  and fan geometry. One bug this design caught in its own first draft:
  a save path that fell back to a container's live position would have
  saved a fan spot as a seat — the save now reads seats only.

### The editors, and what Reset does in each face
- In-battle editor: in Simple, the fan's members are shown OPEN but are
  not editor items — ORDERS is the one draggable anchor and the group
  follows it live; every non-item button is still disabled for the
  duration. In Full, every command is an item at its own seat and
  ORDERS is not an item. The Controls ghost editor mirrors this (fan
  ghosts dimmed and undraggable in Simple; no ORDERS ghost in Full).
  Ghost saves and battle saves alike write every unmoved seat
  unchanged.
- **Reset, precisely:** Reset clears the saved layout (defaults return)
  in either face — in Simple the defaults are the circular Simple
  defaults with ORDERS at (130,665) and the fan's offsets as tabled; in
  Full the defaults are the same table's seats, every circle standing.
  Reset never changes the face itself; the face is its own setting.

### The tutorial
The army step is now three phases: post the squad (unchanged), then
"Your orders live behind one button now. Tap ORDERS…" (the ring
circles ORDERS), then RALLY in the open fan (the ring circles RALLY at
its fan place) and plant as before. Earlier steps are unchanged; the
finish summary names ORDERS. A fan opened early still earns its credit
when the step arrives.

### Verification (2026-10-31, this machine)
- node --check passes on all JS files.
- tools/verify_upgrade17.js (stubbed Phaser, REAL main.js): **79/79** —
  the table's circle geometry and hierarchy; centre-press fires and
  corner-press dead (no dip, no float) for every standing battle
  button; Block's hold gated by the circle; overFight's circular wall
  (corner falls through, rim inclusive); radii and glyph presence
  (ORDERS = ico_banner); the cooldown ring's arc growing as the
  cooldown drains (segment counts compared at full/half/near), the
  ready ring pulse, the Perfect rim, the dodge disc + arc, the block
  stamina ring; the fan's open/issue/close semantics, stray-tap
  consumption, two-tap reachability of all nine members, CAMP in one
  tap, mid-battle face switching + persistence; face derivation (new
  player Simple; layout/binds/move customization each imply Full; an
  explicit choice wins); a pre-U17 save landing on identical centres;
  the layout round-trip exact under circles (including ORDERS' seat
  saved while hidden in Full); both editors' fan-group handling
  (members not items, anchor drag carries the group live, seats
  preserved, fan spots never saved as seats); the tutorial's fan
  phases end-to-end.
- Superseded checks re-pointed, not deleted: verify_upgrade8.js and
  verify_upgrade9.js (stack/CAMP call sites), verify_upgrade10.js (six
  geometry assertions), verify_upgrade11.js (the army walk gains the
  fan phase), verify_upgrade12.js (defaults/count/walls/drag-press
  point), verify_upgrade15.js (BUILD's def + the count),
  verify_upgrade16.js (the counts 17 -> 18). All fifteen suites green:
  **908 checks** (827 prior + 79 new + 2 net re-point deltas). Standing
  benchmarks unchanged: the champion sim still clears in 32.8s with the
  camp at 500/500 across U8–U14; U7/U9/U11 proofs untouched.
- NOT verified (no live browser here): whether the circles READ at
  phone size in a live fight. Honest flags for kennin's eyes, carrying
  the U16 doubts into smaller faces: the command circles are 56 across
  — the same height the buttons always were, but the glyph now sits in
  a circle's inscribed area, so **ico_follow** (the busiest face) and
  **ico_volley** (small arrowheads) are the two most likely to blur;
  **ico_flank** is third. If any face reads worse round, the fix is a
  glyph redraw, not a return to squares — his eyes rule next.

## Upgrade 18 — Weapons & Loot: the arsenal, the chests, the Rack (built 2026-10-31)

kennin's commission, verbatim: "I also want to add guns. Ima hold on
the building mechanic for now I want there to be guns and different
type of weapons and powers. I also want the bible to be a weapon as
well. I want the weapons to drop rpg with chests and things like that."
Building is HELD by the same word: U15 stands exactly as it was — no
new building work, no room port. This upgrade is the arsenal.

### The arsenal — seven families, six tiers, one Bible

The hero's basic attack is weapon-driven (`heroAutoFire` reads
`this.weapon`). Base stats are the Common tier's; the tier ladder
multiplies damage (×1 / 1.15 / 1.30 / 1.50 / 1.75 / 2.05), quickens
rate (÷1 → ÷1.18), stretches range (+0% → +20%) and adds crit
(+0 → +0.14). Weapon damage is rated for a standard arm and scaled by
the hero's own damage stat (hero dmg / 18); its rate is scaled by his
tempo (hero rate / 0.7) — David feels the table exactly, Samson's
strength carries any weapon harder, mastery keeps its meaning.

| Family | DMG | Rate | Range | Pattern | Trait (strengthens with rarity) |
|---|---|---|---|---|---|
| Sling | 18 | 0.70 | 140 | one stone, 620 speed | True Aim — crit grows |
| Bow | 15 | 0.55 | 185 | one arrow, 820 | Keen String — crits hit harder (critMul 1 → 1.6) |
| Sword | 24 | 0.80 | 58 | melee ARC, instant | Cleave — arc widens 110° → 200° |
| Spear | 21 | 0.85 | 96 | melee thrust, line | Long Reach — pierces 1, +1 at Epic, +1 at Mythic |
| Pistol | 13 | 0.38 | 150 | one bullet, 1050 | Deadeye — crit 0.22 base, grows |
| Rifle | 30 | 1.05 | 260 | one bullet, 1350, PIERCES THE LINE | Through the Line |
| Scattergun | 7/pellet | 1.00 | 100 | pellets seek nearest foes | Fuller Spread — 5,5,6,6,7,7 pellets |
| **The Bible** | 26 | 0.62 | 195 | bolts of light, holy | **The Word** — see below |

Every family has a generated name per tier (42 names, e.g. a Rare
rifle is the "Rifle of the Ridge"; a Mythic sling is "The Seventh
Stone"), its own synthesized voice (atkPistol / atkRifle / atkScatter
join the U13 kit — crack, body, low tail; no audio files), and a
code-drawn glyph in the U16 hand (wpn_* textures; the Bible's is an
open book under a cross of light). A weapon carries its own damage
type: the arms and guns are physical, the Bible is holy. The hero's
innate dmgType governed only the old built-in attack (see the starter
rule below) — FLAG for kennin: Deborah's basic attack is physical
while she carries a found weapon; her skills are untouched.

**THE STARTER RULE (the baseline, kept whole).** The Rack's starter
(sling:0) is not treated as a found weapon: while it is what the Rack
holds, every hero fights with HIS OWN HAND — innate damage, rate,
range and type, delivered exactly as pre-U18 (Samson's instant melee
30, Deborah's holy ember, David's stone). For David the innate
profile IS the Common sling, number for number. The moment any found
weapon is equipped, its pattern takes over for whoever leads. This is
what keeps the standing benchmark honest, and four prior suites
(U8/U10/U13/U14) assert Samson's blow by name.

**THE BIBLE.** Singular, off the ladder, never sold. Attack: bolts of
light (holy, dmg 26, rate 0.62, range 195, crit 0.15). Its power, the
Word: every 6s of an active wave, a verse-blast — 45 holy damage
(hero-scaled) to every foe within 130 of the bearer, a ring of light,
and the next verse in a four-verse rotation spoken over him
(Ps 119:105, Heb 4:12, Matt 24:35, Ps 119:11) — plus a constant
strength aura: squads within 175 of the bearer strike at ×1.25
(read at the one squad-attack site; no parallel system). It is found,
never bought: no shop path and no Grokonian path exists — the suite
proves Rack.grant has exactly two call sites, both inside the reveal.

### Chests — the only road to new weapons

Drops roll at the kill, by what fell (CHEST_DROPS): ordinary enemies
**2%**, ELITES **35%**, champions (goal + endless) **100%**. Grades
weight the rarity odds (CHEST_GRADES): Wood mostly Common/Uncommon
and never Mythic; Iron reaches Mythic at 0.5%; Gold's ladder is
flattest (Mythic 4%) and **Gold alone can hold the Bible, at 3%** —
and only while the Rack lacks it (the Bible is unique; a bearer who
carries it finds an ordinary weapon instead). Champions drop Iron
(55%) or Gold (45%) only. The hero banks a chest by walking over it;
**chests open in the intermission**, on a reveal panel over the shop
(depth 60/61 — panels stay panels): chest, grade, Open — then the
weapon's glyph, name in its tier color, stats beside the carried
weapon's, its trait, and Equip-it-now / Keep-in-the-Rack. Battle is
never interrupted by loot. While the reveal stands, the shop's
60-second deadline is HELD (update shifts it by exactly the elapsed
frame) and Next Wave refuses — the reveal is the intermission's first
business, on its own named exception to U6's honest-minute law.

**The unopened-chest rule, exactly:** a banked chest never vanishes.
It waits in the Rack (persisted) across runs, is named on the end
screen ("N chests waiting in your Rack — they open at your next
intermission"), and opens at the next shop — including a run's first,
prepare shop. A chest still lying UNBANKED on the field belongs to the
field and ends with the run, like a coin never picked up.

### The Rack — the persistent armory

`gxhub_wotw_rack_v1`, guarded load/save in the CQ pattern: owned set,
equipped key, waiting-chest list. The starter can never be lost; a
corrupt store falls back to it. The ARMORY scene (Menu top-left and
Hero Select top-right) lists owned weapons as cards — glyph, name,
tier, stats, trait — the Bible's card first and gilt; "Carry it"
equips. **Duplicates convert to Manna at reveal**: Common 25,
Uncommon 40, Rare 70, Epic 120, Legendary 200, Mythic 325 — no chest
is ever wasted. In-run, the carried weapon shows modestly: the range
ring takes the weapon's reach and its tier's color, and a small
weapon glyph rides at the hero's shoulder (hidden while he fights
with his own hand). The run's opening toast names what he carries.

### Faces, tutorial, rooms

Battle circles unchanged (U17); armory and reveal are panels. The
tutorial is untouched and still passes: it forces the starter (the
lesson's weapon) whatever the Rack holds, drops no chests, and its
economy firewall stays sealed. **Rooms (js/net.js) are untouched and
keep their fixed loadout — weapons are solo-first, like U15 was.**
js/gxhub.js and js/tokens.js are byte-identical (empty git diff).

### Design forks taken (kennin's to bend)

- **"Elite" defined:** the code had no elite concept; the roster's
  elite class is the non-champion **Idol Golem** (380 HP, bounty 25 —
  it already plays that role from wave 5). Pebble Golems and Baal
  Priests count as ordinary for drops.
- **Rarity strength:** the ladder above is a first pass inside the
  brief's bound (see sims). Drop rates (2% / 35% / 100%), grade mixes,
  tier odds, BIBLE_ODDS (3%) and duplicate Manna are all single-table
  numbers in main.js (CHEST_DROPS / CHEST_GRADES / WEAPON_TIERS).
- **Hero scaling of weapons** (dmg × hero-dmg/18, rate × hero-rate/0.7)
  was chosen over flat weapon stats so mastery and hero identity keep
  meaning; the alternative flattens every hero to the same gun.
- The rifle's piercing flight is segment-tested per frame and flies
  through its mark to flyRange — a coarse-frame artifact found in
  verification (arrival killing the shot at its first target) was
  fixed in the shot loop, not papered over in the test.

### Verification (2026-10-31, this machine)

- node --check passes on all JS. tools/verify_upgrade18.js (stubbed
  Phaser, REAL main.js): **57/57** — statics (tables, the reveal's
  intermission gate, the two-grant-sites law, rooms clean); rarity
  monotonic in all seven families with trait steps as named; Rack
  persistence round-trip, starter invariants, corruption guard;
  measured family patterns (projectile counts/kinds, eight distinct
  attack clocks, acquisition-range law, sword arc geometry, spear
  pierce count, the rifle's through-the-line flight in the real update
  loop); the starter-as-own-hand proofs for Samson and David; seeded
  chest mathematics (200k ordinary kills → 1.93%; elite 34.7%;
  champion guarantee, Gold 43.7%; Bible in Gold 3.00%; Bible from
  Wood/Iron/once-carried: 0 in 150,000 rolls; Wood never Mythic); the
  full chain kill → drop → bank → persist across end() → inherit next
  run → reveal; duplicate conversion (+40 Manna, Uncommon); reveal
  equip changing the hero's real attack; reveal refused mid-battle;
  the Word's blast (45 holy inside 130, nothing at 200) and aura
  (×1.25 inside 175, ×1 outside); the tutorial on the starter.
- **The balance bound, in the U13 benchmark's own harness conditions**
  (random held at 0.99, the U13 play script unaltered): starter
  **32.8s, camp 500/500** — the standing benchmark reproduced. Rare
  rifle **26.7s** (81% of baseline; the bound was ≥60%). Mythic rifle
  **22.9s** (70%) — earned strength, still a three-phase fight. The
  Bible **25.1s** with the camp standing. The enemy curve never moved.
- All sixteen suites green: **965 checks** (908 prior + 57 new). One
  prior check re-pointed, not deleted: verify_upgrade16.js's texture
  count 27 → 35 (the eight wpn_* glyphs join the family at the same
  120×120 law).
- NOT verified (no live browser here): gun feel and readability —
  whether the pistol reads as fast, the scatter as wide, the Bible's
  blast as weighty; the wpn_bible glyph at shoulder size (0.34 scale);
  the reveal panel over a live shop. kennin's ears and eyes rule next.

## Hotfix — iPhone fullscreen: the installable app (built 2026-10-31)

kennin's commission, from live play with his brother Abel: Abel plays
on an iPhone and the game's Fullscreen button does nothing there; on
kennin's Samsung it works. He asked for "either a downloadable app or
he can make it full screen from there."

**ROOT CAUSE.** iOS Safari does not implement the Fullscreen API for
arbitrary page elements — on an iPhone there is no way for any web
page to fullscreen itself, so the button could only fail silently.
The supported route is the installed home-screen web app: Add to Home
Screen installs the game, and the installed icon launches it
standalone — edge-to-edge, truly full screen. This hotfix delivers
that installable app, and makes the button tell the truth everywhere.

### What shipped

- **The manifest** (`manifest.webmanifest`, a text file on the
  branch): name "Watchmen on the Wall", short_name "Watchmen",
  display standalone, orientation landscape, background and theme
  #0d0906 (the stone hall), start_url and scope the game's own root
  (".", so it resolves on both serving origins and under the hub's
  /g/<id>/ path alike).
- **The icons** — 192 and 512 for the manifest, 180 for Apple's
  touch icon — cut with PIL from the APPROVED logo v2: a square crop
  (0,100)-(340,440) on the watchtower and its eye-and-shield banner,
  no title text. They are binary, so they travel the wotw-assets KV
  route like the unit art: both proxy Workers (watchmen-game and
  wotw-playtest) now also serve assets/icons/* from KV by basename,
  and both learned the webmanifest content type
  (application/manifest+json) so the manifest serves as JSON.
  Upload script: gxhub/deploy-test/upload_icons_kv.py.
- **The Apple declarations** in index.html: apple-mobile-web-app-
  capable yes, status bar black-translucent, the apple-touch-icon
  link, the standard mobile-web-app-capable beside them, a theme-
  color, and **viewport-fit=cover** so a standalone launch can paint
  edge-to-edge.
- **Safe areas, the simple route:** CSS only, in index.html. The
  #game container is padded by all four env(safe-area-inset-*) values
  and the canvas is capped at the viewport minus the insets (the old
  plain 100vw/100vh caps stand as the fallback line before the calc).
  Phaser's FIT + CENTER_BOTH centring is untouched — the canvas
  simply centres inside the safe area, so no battle circle can sit
  under the notch or the home indicator in standalone landscape.
  Every inset is 0 on rectangular screens, Android included.
- **The button tells the truth** (js/main.js): a PURE function
  `displayMode(env)` reads an injectable navigator/window/document
  and answers standalone / ios-install / browser. Standalone (either
  signal: display-mode media query or navigator.standalone) — both
  Fullscreen buttons hide; it is already fullscreen. iOS without the
  Fullscreen API — tapping the button opens a short panel:
  "On iPhone, install the game for true fullscreen: tap Share, then
  Add to Home Screen — it opens like an app, full screen." While the
  panel stands, Game.onTap is sealed behind it. An iOS browser that
  CAN fullscreen (capability present) takes the native route — the
  capability decides, not the badge. Android and desktop are
  byte-for-byte the old behavior: the same startFullscreen calls.
- **The hub speaks too:** one small line on the Watchmen game page
  only (gated on the game id, in both page branches), under the
  frame: "Playing on iPhone? Open the game, tap Share, then Add to
  Home Screen — it opens like an app, in true fullscreen." Deployed
  from the live-matching tree (src-studio copied to src-iosline),
  bindings verified identical after on both Workers (12/12 hub,
  9/9 play), AUTH_GATE untouched, nothing else changed.
- **NO SERVICE WORKER — deliberate.** This project has been bitten
  by stale builds before; a service worker is a cache with opinions,
  and iOS home-screen installability does not require one. The game
  installs and launches standalone without it, and every load stays
  as fresh as the proxies serve it (no-store, as always).

### Verification (2026-10-31, this machine)

- tools/verify_hotfix_ios.js (stubbed Phaser, REAL main.js):
  **30/30** — the shell statics (manifest link, Apple metas,
  viewport-fit, all four safe-area insets in the CSS); the manifest
  parsed with its required fields; the three PNGs' real dimensions
  on disk; the UA matrix over the pure displayMode (iPhone Safari →
  install; iPhone standalone by navigator.standalone AND by the
  display-mode query → hidden; iPadOS in its MacIntel disguise →
  install; iPhone WITH the API → native; Android and desktop →
  native); the panel in a stubbed scene (exact sentence, one panel
  only, field taps sealed behind it, Got it destroys every piece);
  standalone and native routes opening nothing; and no
  serviceWorker anywhere in main.js.
- All seventeen suites green: **995 checks** (965 standing + 30 new),
  zero re-points — the U3 canvas-cap check passes on the fallback
  declaration the calc now overrides.
- Live, after push and proxy redeploys: the manifest serves 200 with
  the JSON content type at BOTH proxies; all three icon routes serve
  200 image/png, byte-identical to the generated files, at BOTH
  proxies; the served index.html carries the manifest link, the
  Apple metas and viewport-fit (grep of the served bytes); the
  served js/main.js matches the local file byte for byte; the hub
  line is live on the Watchmen game page, once.
- NOT verified — cannot be, from here: the install flow itself.
  Whether Add to Home Screen offers the install on Abel's iPhone,
  whether the icon launches the game standalone and edge-to-edge,
  and whether the safe-area padding clears his notch in a real
  fight — Abel's phone is the test, exactly as kennin set it up.

## Upgrade 20 — Few Buttons, Deep Presses (built and shipped 2026-10-31)

> STATUS: shipped live to `muse/test` on 2026-10-31 on kennin's
> explicit ruling in chat (~01:56 CDT: "Put the new controls live
> now"), ahead of Upgrade 19 — the sequencing question that had held
> the push is settled by his word. The build was first held back
> unverified-live until that ruling; the no-divergence check, push,
> and proxy parity verification were run at ship time. Everything
> below describes the shipped tree exactly as verified.

Kennin's ruling, from the live call (2026-10-31 ~01:24 CDT), in his
words across three turns: the buttons "need to be like easier to
press they're on weird and awkward parts of the screen" → "We may
need a shortened down to just a few buttons and like the way you
press them makes them do more things" → "Adjust it for the whole
thing." Scope: the WHOLE game, every platform. This extends Upgrade
17's Simple face; it does not resurrect the old density.

### The Few face (the default for everyone)

Upgrade 17's Simple face is renamed **Few** (Controls label, plain:
"Buttons: Few / Full"). Standing circles in Few: the 3 powers, ONE
**Guard** circle (Dodge and Block, merged — see the grammar), Sprint,
the auto-fire toggle, CAMP, ORDERS. Everything else lives behind
ORDERS, as in U17. Full remains the opt-in face with every circle
standing. Stored layouts and keybinds persist and apply in BOTH
faces, exactly as U12/U17 left them — nobody's custom layout was
stranded by this upgrade.

**The migration rule, stated plainly:** Few is the default for
EVERYONE — new players and existing players alike ("the whole
thing"). A stored face choice is honored only as follows:
- stored `simple` reads as Few (it is the face Simple became);
- stored `full` is honored ONLY if the player actively re-picks
  Full in Controls (or the battle pause) after this upgrade — the
  pick stamps `gxhub_wotw_face_u20`, and the stamp is what the
  loader trusts. A pre-U20 Full choice, and any amount of U12
  customization (layouts, binds, movement scheme), no longer
  implies a face: those saves are honored as layouts/binds, in both
  faces, and the face itself opens Few.

### The press grammar (tap vs hold, HOLD_MS = 280)

One helper — `wirePress(btn, kind)` — gives five circles two verbs
each. A press begins on pointerdown INSIDE the circle (U17's radius
law); crossing 280ms "holds" it; the release — the scene-level
pointerup, the game's real release channel — fires the tap verb if
the press never crossed, and completes the hold verb if it did.
While a press ripens, its rim fills toward the hold in U17's arc
language (the powers' and Guard's own sweeps carry it; ORDERS and
CAMP get `drawPressFx` rims), so the player SEES the second verb
coming. A press on a cooling power routes straight to the old tap
path (the input buffer) — a hold never aims a move that is not
ready.

| Circle | TAP | HOLD |
|---|---|---|
| **Guard** (new, merged) | Dodge — today's dodge exactly | Block — the guard rises at the crossing and stays until the release ends it |
| **Powers** (×3) | Cast, exactly as pre-U20 | Aimed cast — a gold reticle wakes at the hero's aim point (nearest foe in reach, else a step ahead of his facing), drag moves it, release casts AT that point |
| **ORDERS** | Fan open/close, as U17 | RALLY arms immediately; the fan stays shut |
| **CAMP** | The camp panel, as ever | Quick Repair — the panel's own repair action; if it cannot run, a shake + a float saying why, never a silent nothing |
| **Auto-fire** | Toggle, as ever | Opens the controls (the pause: sound, face, layout) |
| **Sprint** | Toggle — unchanged; it is a state, not a verb pair | — |

Aimed casts (`useSkill(i, aimPt)`): the cast's CENTER moves to the
reticle point — area/target selection happens around there
(Five Stones gathers its five around the point; Smooth Stone picks
its mark around the point; Psalm's ring blooms there, its blessing
still army-wide, as it was never local). Projectiles still fly from
the hero's hand. An aimed cast whose point holds no mark answers
"No target" and consumes NOTHING — no cooldown, no charge — exactly
like a tap cast with no mark. A tap cast passes no point and is
byte-for-byte the cast it has always been (proven target-for-target
against a direct `useSkill` in the U20 suite). The Held tier of a
power is read at cast time as before — aiming does not touch the
patience economy.

Guard: one circle, glyph `ico_guard` (shield + cross + the dodge
swoosh; `ico_dodge`/`ico_block` textures are still generated,
unassigned, so nothing naming them breaks). The stamina ring and
the dodge veil/recovery arc now share Guard's sweep. Keybinds:
Dodge and Block merge into ONE Guard action — Space by default
(tap dodges, hold blocks); a pre-U20 binds save migrates (the old
Dodge key becomes the Guard key; the old Block key is freed). The
binds list is 16 actions; conflict-swap rules unchanged.

### Placement — the thumb arcs

The default seats were re-laid to natural phone-landscape thumb
arcs (all still U12-draggable; the editor's Reset restores THESE):

- Right rail: auto-fire (1178,76); ORDERS (1178,268); the powers
  arc beneath it — (1178,368), (1178,462), (1178,556), the ult
  nearest the corner. In Few, CAMP rides the rail directly above
  ORDERS (1178,182, derived from ORDERS' seat + `CAMP_RAIL`); its
  own seat (949,665) belongs to the Full face's row.
- Left rail: GUARD (102,448), Sprint (102,548).
- The fan row is unchanged in absolute terms (130…806, y 552): the
  fan is one formation on the ORDERS anchor (`FAN_OFFSETS` re-based
  on the rail seat), so dragging ORDERS carries the whole fan by
  the same delta, as U17's did — from the rail seat the tether is
  long, and a far drag carries the row far with it. Reset restores
  the arcs. (Flagged below.)
- Nothing stands mid-screen or top-left; the only top-corner
  resident is the auto-fire toggle, as before. Diameters never
  shrank: powers 76, thumb circles 64, command rank 56.

### Tutorial

The lesson teaches the grammar, advancing only on real actions as
ever: the kit step is Guard tap (dodge) / Guard hold (block) /
Sprint on two circles; the power step gains an aiming half (cast,
then hold-drag-release an aimed cast onto the sturdy dummy — a
banked early cast completes the first half silently, as the house
rule requires); the army step is post → HOLD ORDERS (Rally arms,
fan shut) → tap the ground to plant. LOAD_TIPS and the finish
summary speak the grammar too.

### Rooms

Untouched, as U18 left them: `js/net.js` is byte-identical, the
shared `button()` helper's signature is unchanged, and the room
client keeps its current controls this pass. Room adoption of the
press grammar is later work.

### Verification (2026-10-31, this machine)

- tools/verify_upgrade20.js (new; stubbed Phaser, REAL main.js):
  **61/61** — the grammar statics; Guard tap/hold/short-press/
  corner laws; aimed Stone/Psalm/Five Stones landing at the
  reticle, an empty-point aim consuming nothing, and tap casts
  target-identical to direct `useSkill` calls on identical fields;
  ORDERS tap-vs-hold; CAMP hold repairing (+100 HP / −90 Manna at
  the crossing, the release never opening the panel) and explaining
  (whole camp, thin purse — shake + float, nothing spent); the
  auto-fire hold opening the controls without flipping the toggle;
  every migration case (fresh/simple/unstamped-full/stamped-full/
  customized-with-seats-kept); editor reset standing every control
  on the new defaults; the tutorial's gesture credits earned
  through the real press path.
- All eighteen suites green: **1065 PASS lines, zero failures**
  (the pre-U20 tree stood at 995 checks; suites re-pointed by this
  upgrade, each with its reason recorded in place: U8, U9, U10,
  U11, U12, U15, U16, U17 — the U18 champion benchmarks did not
  move: starter 32.8s, camp whole; the enemy curve was never
  touched; js/gxhub.js, js/tokens.js, js/net.js and all data
  files are byte-untouched).
- NOT done, deliberately: the push to `muse/test` and the
  two-proxy byte-parity proof. They run with the release, not
  before it.

### Flags for kennin's thumbs

- **The 280ms hold threshold** — one number (`HOLD_MS`), his to
  bend after real play.
- **The reticle feel** — where it wakes (nearest foe, else a step
  ahead of his facing) and how it drags are first-pass choices.
- **The fan tether** — the fan follows ORDERS as one formation; a
  far ORDERS drag now carries the command row far from its home
  row (Reset always restores it). If that reads wrong in the hand,
  the fan can be pinned to the home row instead.
- The U17 glyph flags carry into the circles unchanged
  (ico_follow busiest, ico_volley arrowheads small, ico_flank can
  read as brackets) — and ico_guard is new beside them.

## Upgrade 19 — Seasonal Chests & Gift Cards: the year of chests (built 2026-10-31)

kennin's commissions, verbatim: "I want to make a chest system where
you can get gifts in like the madden player cards. I want to make
Halloween themed chest and base the chest system off of seasons and
holidays." — and, minutes later: "You gotta make it where you can buy
them with the grokonians." Built on the U20 tree (fc8d12c) after
kennin shipped the controls first by his ruling; the U20 press
grammar is untouched.

### Seasons are data

`SEASONS` is a table, not a codebase: each row carries an id, a name,
a **yearly window by month/day** (windows may wrap the year end — the
window math resolves a Dec 28 – Jan 3 season from both sides of New
Year), a visual identity (color + chest texture), a gift pool, drop
chances, bundle table, and a Grokonian price. One calendar —
`seasonState` — serves the panel, the drops, and the shop: a season
is LIVE when the player's own date stands inside its window, both
named days whole, `daysLeft` counting today. Adding a future holiday
is a new row. The U18 Wood/Iron/Gold chests stand exactly as they
were: seasonal chests join the Rack's ONE pending queue (its filter
now admits season ids beside grades) and open in the SAME
intermission reveal — bought or found alike, battle is never
interrupted by loot, and `revealOpenChest`'s intermission gate rules
both. `chestDisplay` gives every chest, grade or season, one face.

### The Hallows Chest — first, live in its season

**Oct 25 – Nov 7, every year** (LIVE on ship day, 2026-10-31, with 8
days left). It wears kennin's own settled meaning of the day —
celebrating the living in Christ, and those who died in Christ who
live with Him now — so it is a chest of **remembrance** in torch-flame
gold (the Night of the Torches' fire), ember-brown with a gold latch.
No horror, no devil theming anywhere in it. Price: **60 Grokonians**
(first pass, flagged). In play it drops beside the U18 chests:
**elites 35%, champions guaranteed**; ordinary foes never (the
standing chests remain U18's roll). Its pool:

| Gift | Rate | What it is |
|---|---|---|
| A Witness card | **45%** | One of the WITNESSES set, dealt weighted by tier (weights 30/26/20/13/8/3) |
| A Torchlit weapon | **30%** | A family dealt on Iron's rarity ladder, as the `@hallows` variant (below) |
| A treat bundle | **25%** | Manna 120 (w4) / Grokonians 10 (w3) / an orb treat (w2) / Manna 60 (w2) / Grokonians 25 (w1) |

### Gift cards — the Madden heart

A card is a name, a tier on kennin's six-rung ladder, a set, and a
face drawn from the game's EXISTING glyph family (no new icon
textures: David wears the lyre, Deborah the palm, Gideon the flame,
Samson the pillars, Peter the stone, John the star-burst, Stephen the
stones, Paul the sword). **THE WITNESSES** (8): Gideon (Common),
Samson (Uncommon), Deborah (Rare), Peter (Rare), John (Epic),
Stephen (Epic), Paul (Legendary), David (Mythic). Each card carries
an epithet in plain words and a **Scripture REFERENCE — no new verse
text is quoted** (the only quoted words in the game remain the
verified U18 Word cycle). Cards persist in **THE ALBUM**
(`gxhub_wotw_album_v1`, the Rack's guarded pattern): a scene reached
from the Armory and the Chests panel, one set to a page — owned cards
in tier colors with epithet and reference, the unfound as silhouettes
with their tier named, find-counts kept (×n). **Duplicates melt into
Manna at reveal on the weapon ladder: 25 / 40 / 70 / 120 / 200 / 325.**
**Finishing a set pays its gift ONCE**, at the completing reveal:
Witnesses **+150 Manna and +25 Grokonians** — the Grokonians through
`Tokens.earn`, so the hub's caps apply as they do to every earn;
`Album.claimSetGift` guards the once, and later openings never
re-pay (proven). Treats land where they're spent: Manna into the
run's purse, Grokonians earned, and an **orb treat** banks a free orb
touch for the run (`freeOrbs`, checked in `tryBuyOrb` before any
Tokens spend — a tutorial buy is still a grant and never touches it).

### Torchlit weapons — variants under U18 rules

`resolveWeapon(family, tier, 'hallows')` returns the same weapon —
same numbers, same trait — under a new Rack key (`family:tier@hallows`),
a **Torchlit** name, and blows that land as **fire** (the damage type
the camp's Watch Fire already speaks; armor tables already know it).
It racks beside its plain twin (the Rack's list now resolves every
owned key, variants after their twins), equips the same way, and its
glyph burns orange at the hero's shoulder and in the reveal. A found
variant changes no balance number of its base weapon.

### Buying, and the calendar surface

The **CHESTS panel** (Menu → Chests; also from the Armory) shows:
the in-season chest on a card with its tagline, days left, and a
**Buy — 60 G** button (spend via `purchaseSeasonalChest`, riding
`Tokens.spend('chest:<id>', price)` — the orb path; short balance
refuses with the reason, out of season the button is not offered at
all), the standing U18 chests with how they're found, and **the year
of chests**: every defined season with its window and state, plus the
next opening named. A bought chest queues in the Rack and opens at
the next intermission — one reveal flow for bought and found alike
(a design fork, stated: the panel never opens a chest itself, so
loot's one law — intermission only — has no second door).

**THE TIDINGS CHEST** proves the framework as pure data: Christmas,
**Dec 18–27**, starlight blue, price 60 G, dormant on ship day. Its
pool shares the framework's generic gifts (cards 45% on the TIDINGS
set of 6 — the Shepherds, Joseph, Anna, Simeon, Mary, the Magi,
tiers Common→Legendary; weapons 30% dealt PLAIN on Wood's ladder, no
variant; treats 25% of the same shape). Set gift: +100 Manna + 20
Grokonians, once. It simply sleeps until December.

### The hard law — the Bible

The Bible enters **no seasonal pool and no purchasable chest, at any
tier, ever** — not as a low odds row but as an ABSENCE: no seasonal
table names it, `rollSeasonalGift` has no such branch, and the suite
measures its rate at **exactly 0 across 300,000 seeded rolls** of both
seasons' pools plus every purchase path (a purchase grants a chest
id, never a weapon). U18's law stands with it: `Rack.grant` now has
three call sites, ALL inside the reveal system (the U18 chest and the
seasonal chest) — the U18 suite's check was re-pointed to say so,
with the reason recorded in place. U18's Gold reveal remains the
Bible's only road.

### Verification (2026-10-31, this machine)

- tools/verify_upgrade19.js (new; stubbed Phaser, REAL main.js,
  recording Tokens, a movable pinned clock): **58/58** — statics
  (seasons-as-data, the Bible's absence from every seasonal table and
  roll, rooms clean, scenes registered and reachable); the calendar
  matrix (edges inclusive both ends, Hallows live on 2026-10-31 with
  8 days left, Tidings dormant then and live Dec 18–27, year-wrap on
  a synthetic season from both sides); purchase (exact spend item and
  price, refusal at 59 G with nothing charged or queued, out-of-
  season purchase impossible — spend never called — the dormant
  chest unbuyable in October); seeded pools (45.0 / 30.1 / 24.9
  against the 45/30/25 law; every card a Witness; every weapon
  Torchlit and fire; the Mythic dealt but rare — 2,095 of 200,000);
  Album persistence, corruption guard, duplicate melt (+25 at
  reveal), set completion paying once (+150 Manna, +25 Grokonians on
  the recorded earn path) and never twice; the bought chest opening
  at the next run's intermission in the shared reveal; the orb treat
  paying for a real orb touch with zero Tokens spends; in-season
  champion and elite drops beside U18's, and their absence on
  Nov 14; the seasonal reveal refusing mid-battle.
- **All nineteen suites green: 1,123 checks** (1,065 standing + 58
  new). The champion benchmark reproduces in this suite's own sim at
  the pinned out-of-season date: **starter 32.8s, camp 500/500**.
  js/gxhub.js, js/tokens.js, js/net.js and all data files are
  byte-untouched (empty git diff); the U20 press grammar untouched.
- Two prior checks re-pointed, none deleted, each with its reason
  recorded in place in verify_upgrade18.js: the grant-sites law
  (three sites, all in the reveal — above), and that suite's harness
  clock is now pinned to 2026-11-14 (out of season, SAME weekly-twist
  parity as its first green run) because seasons are date-driven and
  its chest chain counts the U18 chest alone; in-season behavior is
  this suite's office.
- NOT verified (no live browser here): the Hallows chest's look on
  the field beside a gold one, card faces at album size, and the
  Chests panel's calendar in the hand. kennin's eyes rule next.

### Flags for kennin's tuning

- **Window dates** — Hallows Oct 25 – Nov 7 and Tidings Dec 18–27
  are first passes; the rows are one-line edits.
- **Price** — 60 Grokonians for both chests (his "buy them with the
  grokonians" ruling; the number is a first pass).
- **Pool rates** — 45 cards / 30 weapons / 25 treats, the card tier
  weights (30/26/20/13/8/3), and the elite drop chance (35%, matching
  U18's elite chest chance) are all single-table numbers.
- **Set gifts** — Witnesses 150 Manna + 25 G; Tidings 100 + 20 G.
- **The orb treat** is run-scoped by design (banked at a reveal,
  spent at a station in the same run); if kennin wants treats to keep
  across runs, the Album is where they'd live.
- **Rooms** keep their fixed loadout: seasonal chests are solo-side
  this pass, like weapons were — the room port is later work.
- Further holidays (Thanksgiving, New Year, Easter…) are future DATA
  rows with their own sets to design at kennin's word — the framework
  takes them without new code, but no pools were invented for them.

## Camp-Falls — the camp is the respawn, not the run (built 2026-10-31)

kennin's ruling, given before and restated while he watched the
playtest (01:57–02:09 CDT), the second statement sharpening the
first: "You still have to change it to where when the camp falls you
still are able to be alive and the game continues." — "The camp is
only there so the player can respawn. When the camp is not there and
or if the camp gets destroyed while the player is still alive, the
player has to die to lose." Solo only: the multiplayer rooms (js/net.js
and the room sim) already lived by this law and are untouched.

### The rule, as it now stands in js/main.js

- **The camp falls; the run does not.** `hitCamp` no longer ends
  anything. At campHp 0 the camp becomes rubble (`campFall`): the
  sprite stands dimmed and greyed (tint 0x6a5a4a, alpha 0.55), a field
  float and a long toast speak it — "The camp has fallen — no more
  respawns. Stay alive." — its HP bar leaves the field, rubble takes
  no further blows (so the fall is spoken once), and Watch Fire goes
  quiet. Waves, squads, orbs, chests, gathering and the hero's fight
  continue exactly as before — proven in the suite by clearing a wave,
  starting the next, watching it spawn, and banking a chest, all on a
  rubble field.
- **Respawn is the camp's only job.** While it stands, hero death →
  the standing respawn (8s / Swift Return 4s, at the camp), unchanged.
  A hero who falls while the camp is rubble meets the game's only
  defeat, at that moment (`hurtHero` ends the run). A hero already
  down when the camp falls has his pending respawn cancelled by the
  fall itself — he stays down and the run ends there (`campFall`
  checks him). The end screen names this defeat for what it is:
  "The Hero has Fallen" (a quit still reads as it always has).
- **The host stops targeting rubble.** With no camp to win, enemies
  no longer march on it: the defender scan that normally blocks the
  road within 90px widens to the whole field and the host hunts
  whoever still stands. The champion neither winds a heavy up on
  rubble (`bossEngaged`) nor spends a slam on it (`bossSlamTarget`);
  his heavy/slam camp blows already pass through `hitCamp`, which
  now refuses them. No enemy numbers moved — while the camp stands,
  every targeting rule is byte-for-byte the old behavior, which is
  why the standing benchmarks (starter ~32.5s, camp 500/500, in
  U18/U19's suites) reproduce exactly.
- **Victory unchanged in shape.** Clearing the goal champion with
  the hero alive wins, camp or no camp. Endless: banking continues
  while the hero lives; his death on a rubble field ends the run
  with the banked waves on the record (the end payload carries them;
  the hub submission already rode wavesCleared).
- **Tutorial** untouched: its camp still cannot fall (the U11 guard
  line stands verbatim at the top of `hitCamp`).

### FORK 1 — the rebuild (FIRST PASS, awaiting kennin's ruling)

The existing **Repair** action works on a fallen camp: paying its
standing cost (90 Manna) raises the camp from rubble at the repair
amount (+100 HP), respawns and camp systems resume, and the rubble
read clears. The camp panel and the shop strip stay reachable after
the fall for exactly this purpose, and the CAMP-hold quick Repair
works on rubble mid-wave too. The choice that makes this coherent is
a single derived rule — *the camp stands iff campHp > 0* — so any
road that lifts HP also raises the camp: Repair, a Fortify tier's
heal (upgrades already bought stay bought across a rebuild; they are
never reset), the Mending orb's +75, the Ark's mend. `syncCampRubble`
follows campHp on every update tick so the picture can never disagree
with the number. If kennin wants rubble to be permanent, or Repair
priced differently at zero, or mends forbidden from raising it, each
is a small, single-place change — but as built, the camp can always
be raised again by care, which matches "the camp is there so the
player can respawn" read as a standing invitation rather than a
one-time gift.

### FORK 2 — stars (FIRST PASS, awaiting kennin's ruling)

Stars today ride on the camp fraction at victory. As built: a camp
**standing** at victory earns stars exactly as it always has
(≥85% → 3, ≥45% → 2, else 1 — the formula is untouched at both star
desks, the victory panel and `end()`); a camp **fallen** at victory
caps the run at **1 star**, and the reason is written on both
surfaces in plain words — the victory panel: "The field was held,
but the camp was lost — one star."; the end screen: "The field was
held, but the camp was lost." The score's camp term already read the
fraction, so a lost camp scores its honest zero there with no new
arithmetic. The interesting bend for kennin: a camp that fell and was
REBUILT to, say, 60% stands at victory and earns its two stars under
this pass — history is forgiven, only the standing state is read.

### Rider 1 — the CAMP button did not open the panel (REAL, root-caused, repaired)

In the watched session the CAMP tent button never opened the camp
panel; the panel answered only to tapping the camp structure. The
trace, against the vendored engine (vendor/phaser.min.js): U20 wired
every TAP verb to the **scene-level** 'pointerup' (`endPresses`). But
Phaser's `processUpEvents` runs the game objects' own handlers first
and emits the scene POINTER_UP **only if the shared input event data
was not cancelled** — and the shared `button()` helper's own
pointerup handler calls `stopPropagation()`, which sets exactly that
cancelled flag (`_eventContainer.stopPropagation` writes
`_eventData.cancelled`). So a press released over its own circle was
never resolved: the record lingered and fired late, on some later
field release. The structure tap worked because it never goes near a
button's release. This cut EVERY grammar tap released over its own
button (Guard, powers, ORDERS, auto-fire included); CAMP was simply
the visible symptom, because it is the one verb with an unmistakable
binary outcome and a working alternative path to compare against.
The repair: `wirePress` now also resolves the press on the **button's
own** pointerup, which runs in the object phase before suppression
can matter. `endPresses` is idempotent, so the scene path still
serving field releases costs nothing. The new suite proves it
through a faithful model of the engine's flow: the helper's release
demonstrably suppresses the scene event (cancelled === true) AND the
panel still opens — in Few and in Full; the CAMP hold still
quick-repairs and never opens the panel behind it; the structure tap
still works; and a Guard tap over its circle dodges through the same
repaired channel.

### Rider 2 — "Wave 0 survived!" (fixed)

The shop head chose its text from the `first` argument, so any
re-render of the OPENING shop — a camp purchase, a page turn —
announced "Wave 0 survived! +0 manna". The head now reads the run's
own count: `wavesCleared > 0` earns the survived line; before wave 1
it always says "Prepare your squads". The shop's first-visit footer
also taught the old law ("If the camp falls, the run falls…") and
now teaches the new one.

### Rider 3 — hover labels (done — it fell out trivially)

The name float (`floatBtnName`, single-float by construction) is now
also called from the helper's pointerover, so a mouse player resting
on a circle hears its name without pressing it. One guarded line,
the same call the press already made.

### What kennin's eyes must judge

- **The rubble read** — tint + dim on the standing sprite was the
  honest minimum; if it does not read as "destroyed" at a glance in
  a real fight, the camp wants a broken-tent frame of its own.
- **The fall banner** — a 4.2s toast plus a field float; if the
  moment deserves more weight (a pause, a drum), say so.
- **Forks 1 and 2 above** — the rebuild's generosity and the star
  cap are first passes in his game's two most judgment-shaped
  numbers; both are written to be bent by one-line edits.

### Verification — tools/verify_campfalls.js (new suite, 53 checks)

The fall and continuation, the respawn law in all three positions,
victory after the fall with the star cap and its reasons, standing
camps earning the old stars (3 at whole, 2 at 60%), the rebuild
(repair at rubble, panel reachable, Watch Fire asleep then awake,
upgrades kept, respawns restored), endless banking to the hero's
death, the CAMP-button battery above through the faithful event
flow, and the opening-shop head. One prior check re-pointed with its
reason recorded in place: verify_upgrade3.js's "camp HP 0 -> defeat"
— the exact assertion kennin's ruling retired. Full battery:
**1,176 checks, 0 failures** (1,123 standing + 53 new), benchmarks
reproduced. js/net.js, js/gxhub.js, js/tokens.js and every data file
byte-untouched; the scaling law untouched — no enemy number moved.

- NOT verified (no live browser here): the rubble read in a real
  fight, the fall banner's weight on a phone, and the CAMP button
  under a real thumb on iOS — the playtest that found the bug is
  the test that closes it.
