# Watchmen on the Wall: Conquest (v0.1 design)

This is a separate build. The tower defense game in `../game/` is untouched. Everything carries over: the art, the sound, all 12 heroes (who now serve as army generals), the worlds, Grokonians, the free battle pass, progression and the GX Hub adapter.

## Lore
The watchmen came down from the walls. Across the lands of the old stories, rival warlords have broken the peace. The Philistine Host and Amalekite raiders hold the Valley of Elah, and the Jericho Garrison and the Canaanite League hold the plain of Jericho. The later worlds (Egypt, Babylon, the Liberty Frontier, Toon Town) wait beyond them. One general rides out at a time, whether David, Deborah, Gideon, Samson, Moses or the Liberty crew, and leads a small, stubborn army from village to village. They free the lands, raise barracks and drill new recruits. Rival factions grow too: they take land, fight each other and come for you. Each world ends when its last stronghold falls and its champion is beaten. The champions are Goliath of Gath in Elah and the Gatekeeper Colossus at Jericho. Respect rules still apply: no holy symbols on the enemy side, and no gore (the fallen fade out and routed troops flee).

## Core loop
1. **Campaign map** (per world). 11–13 seeded territories are linked by roads. You start with one capital and each rival faction (2 AI) holds another. Tap your land, then a neighboring land, to march. Each territory yields **gold** and **food** every turn. In your own land you can **Recruit**, **Drill** (upgrade a unit type) and **Build barracks** (levels 1–3 unlock more unit types). Press **End turn** to collect income; then the AI recruits, expands and attacks you, which triggers a defense battle.
2. **Battle** (2–4 minutes, real time, phone-first).
   - **Primary control:** tap anywhere and your **hero walks there**. The army follows in formation ("Follow Me" is the default).
   - **Command bar** (big buttons): Follow Me, Charge, Hold, Flank L, Flank R, Fall Back, Shield Wall, plus Volley (archers fire at the tapped spot) and Ride Down (horsemen charge the tapped enemy).
   - **Target chip:** commands go to *All* or to one unit type. Tapping one of your squads detaches it, and the next tap orders that squad.
   - **Hero abilities:** 2 skills and an ultimate, taken from the hero data.
3. **Win and earn.** You earn stars (3 if 60%+ of the army survives, 2 if 30%+, 1 for a win), XP (player level, mastery, battle pass), Grokonians (through `tokens.js` and the GX Hub) and challenge progress. Conquering a world pays a large Grokonian reward.

## Combat model
| Unit | Role | Strong vs | Weak vs |
|---|---|---|---|
| Swordsmen | solid melee | spearmen, archers | horsemen |
| Shieldmen | slow wall, blocks 70% of arrows from the front (90% in Shield Wall) | archers, slingers | swordsmen |
| Spearmen | anti-cavalry, ×2.5 vs mounted | horsemen, chariots | swordsmen, archers |
| Archers | long range, weak in melee | spearmen, swordsmen | horsemen, shieldmen |
| Horsemen | fast, charge bonus ×2 on the first hit | archers, slingers, healers | spearmen |
| Slingers | medium range, shots ignore shields | shieldmen | horsemen |
| Chariots | very fast, trample (hit everything they pass) | infantry, ranged | spearmen, archers |
| Healers | heal nearby squads, restore morale | (none) | everything |

- **Flanking:** hits to the side deal +50% damage, hits to the rear +100%, and both drain morale.
- **Formation:** squads keep slots around the hero. Shield Wall puts the shields in front and slows the army.
- **Morale:** it drops from losses, flanking, nearby routs and losing the hero, and rises near the hero, healers and Rally. Below 20 a squad **routs**: it flees and takes double damage. It can rally again near the hero.
- **Terrain:** hills give ranged units +30% range and defenders −20% damage taken. Forest slows units by 40% and halves incoming missile damage. Rivers slow units to 35% except at fords.

## AI
- **Counter-picks:** the AI builds its army from a budget weighted toward counters to *your* composition. On Normal 60% of its picks are counters, on Hard 85% and on Nightmare 100%.
- **Tactics:** the AI rethinks every 0.4–1.4 seconds (faster on harder difficulties). Archers kite away from melee, spearmen screen the archers, and horsemen hunt your ranged units and flanks. Healers stay back, and squads with low morale pull back. On Hard and above, the AI focuses your hero.
- **Difficulty** sets the budget (×0.85, ×1.1, ×1.35), the reaction time and the counter rate.

## Daily and unlocks
- **Daily skirmish:** a seeded battle with fixed armies on Hard. The best score is kept locally.
- **Unlocks:** heroes unlock from the battle pass, Grokonians, milestones and account level. Worlds open by account level (Elah and Jericho are playable). Barracks levels unlock unit types within a campaign.

## GX Hub
All earns and spends go through `tokens.js` and `gxhub.js`. Large payouts are split into earns of 10 or less, sent at least 1.1 seconds apart. Earns stay within the session budget (300) and the daily budget (200). The pending queue is saved in localStorage, so it survives closing the game and resumes in the next session or on the next day.
