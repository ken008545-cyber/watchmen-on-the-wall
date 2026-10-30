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
