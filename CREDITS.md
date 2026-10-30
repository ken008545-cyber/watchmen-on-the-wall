# Credits & licenses
- Phaser 3.90.0 (MIT) — vendor/phaser.min.js, license in vendor/PHASER-LICENSE.md
- assets/bg_elah.jpg — original AI-generated background made for this project
- All sprites (heroes, enemies, towers, fx) — original, drawn procedurally in js/art.js
- All sound effects — original, synthesized at runtime with WebAudio in js/sfx.js
No third-party art or audio. No Binding of Isaac assets.

## Art pass sprites
Heroes, enemies, Goliath + armor bearer and all tower tiers were generated with Grok Bot's image tool (original art, no third-party assets), cut out with `art_src/cut.py` (border flood-fill background removal) and packed into `assets/sprites.png` / `assets/sprites.json`. Projectiles and the camp are still drawn in code (`js/art.js`).
- Title logo (assets/logo.png): generated with Grok Bot's image tool, background removed with PIL.
- World backgrounds (bg_jericho, bg_egypt, bg_babylon, bg_liberty, bg_toon) and hero sheets heroes2/heroes3: original images generated for this project.

- Conquest unit sprites (swordsmen, shieldmen, spearmen, archers, horsemen, slingers, chariot, healer): original art generated for this project (art_src/units1.jpg, units2.jpg), cut by art_src/cut.py. No third-party assets.
