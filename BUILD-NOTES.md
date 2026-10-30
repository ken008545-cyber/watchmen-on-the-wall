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
