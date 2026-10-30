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
