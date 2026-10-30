# Watchmen on the Wall — Chapter 1: Valley of Elah
Run: `cd /workspace/td-game/game && python3 -m http.server 8080` then open http://localhost:8080 (phone on same network: http://<box-ip>:8080).
Controls: tap a tower button then tap ground to build; tap a tower to upgrade (tier 4 = branch choice) or sell; tap ground to move the hero; skill buttons; "Wave" (or Space) starts the next wave; x1/x2 speed.
Data: data/game.json (towers, branches, enemies, waves, heroes, unlocks, grokonian rates). Tokens: js/tokens.js (earn/spend; swap for GX Hub API later).
Test: `PW=/tmp/pw/node_modules/playwright node tests/smoke.js` (screenshots in tests/).

## Art pass
Sprites load from the atlas `assets/sprites.png` (rebuild: `python3 art_src/cut.py`). Enemies squash/stretch and wobble, flyers flap, towers squash on fire. Enemies now hurt the hero (downed 10s, respawns at camp). The upgrade panel docks in the HUD, and the boss name/bar sit at the bottom of the map.

## Worlds, levels and progression (v0.4)
- **Worlds** (`data/worlds.json`): Valley of Elah and Walls of Jericho are playable. Egypt, Babylon, Liberty Frontier and Toon Town are locked stubs that have background art and data. Worlds open by **account level**.
- **Levels** (`js/levels.js`): each world has a node map of 12–15 levels. Every level is generated from a seed `(world, index, difficulty)`, so the same spec always builds the same level. The generator produces a serpentine path, a wave budget drawn from the world's weighted enemy pool, 0–2 modifiers (Fog, Double Flyers, Armored, Fast, Swarm) and a boss on every 4th level and on the last level. Elah level 1 keeps the hand-made Chapter 1.
- **Difficulty**: Normal, Hard and Nightmare change HP, speed, lives, manna and the XP multiplier. Hard opens after you clear a Normal level in that world, and Nightmare after you clear a Hard one.
- **Stars**: 3 for no lives lost, 2 for keeping half your lives, 1 for a clear. **Endless** runs one survival mode per world, with a boss every 10 waves. **Daily Challenge**: a seeded level on Hard with 2 modifiers.
- **Scores**: best scores are saved locally under `gxhub_wotw_levels_v1` (stars, per-level best, endless best, daily best). `lastScore` is kept so it can be sent to a future GX Hub leaderboard.
- **Battle Pass and Profile**: see `data/progression.json`. Only the free track exists. The paid track is reserved in the data and disabled.
- **Tokens**: every Grokonian earn and spend goes through `js/tokens.js`, which mirrors to the GX Hub through `js/gxhub.js` (postMessage) and falls back to localStorage.
