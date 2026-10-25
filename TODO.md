# Pending ideas and things still to add

Things deliberately left for later. Cross them off when done.

## Battle Tower (added 2026-10-25)

Design doc: the "Megamon Tower Mode: Design Premise" doc (the "Battle Tower v1" section is what was built).
Code: `js/data/tower.js` (floors, Badges, BP shop), `js/systems/tower.js` (floor loop), `js/systems/towerbosses.js`
(scripted bosses), `js/ui/tower-ui.js` (screens, lobby mode).

- **Co-op check.** Expeditions, Seal Plates and Twin Bond have only been tested solo (`G.Tower.debugEvents()` in `?dev`).
  Try a real Expedition with 2+ players: floor changes, the Badge pick wait, Gengar's darkness and Rayquaza's wind.
- **Balance pass.** Every number is a placeholder: horde quotas, boss HP on the floor clock, BP rewards, Badge costs,
  head-start levels (`TowerData.headStart`), enrage timers.
- **Scripts for the other bosses.** Tyranitar, Metagross, Garchomp and the gatekeepers (Entei, Suicune, Raikou,
  Groudon) still use the shared kit; the design doc has ideas (Tyranitar's boulders as cover, Garchomp's Dig...).
- **Active arenas.** Arena mechanics on a timer (rising lava, spreading ice, turrets, wind) are not in yet.
- **Leaderboard.** Highest floor and fastest section clear, solo and group (needs new Firestore rules).
- **Landing choices.** Between floors there is only the card pick; the design also had heal / shop / risk choices.
- **Sounds and music.** The tower reuses rift, boss and biome music and the generic boss sounds.

## Zygarde Portal (added 2026-10-18)

- **Sound effects.** Right now the transformation reuses the generic boss sound (`G.Audio.sfx('boss')`,
  marked `TODO` in `js/systems/rift.js`, `startMega`). Wanted:
  - a portal ambient hum and a "step on" sound,
  - a transformation sound (charge-up, then a burst at the swap moment),
  - Mega Zygarde's own roar / hit sounds,
  - the monolith hum in the arena.
- **Music.** The arena uses the normal rift music. A dedicated track for the Zygarde fight, and a more
  intense one for the Mega phase.
- **Mega Zygarde moves.** It uses Zygarde's normal attack pattern (ranged shots) with more damage and speed.
  The sprite sheet also has Swing, Double, Hop, Rotate and SpAttack animations that could be used for new
  attacks (`tools/fetch_zygarde_mega.py` only downloads Idle, Walk, Attack, Shoot, Charge, Hurt and Faint).
- **Portal sprite.** The friend's PNG is 64x64 with a semi-transparent glow and is shrunk to 32x32 in
  `js/world/tiles.js` (`PAINT.zportal`). A native 32x22 version with solid-pixel glow would look crisper.
  Also: add the artist's name to `CREDITS.md`.
- **Co-op check.** The transformation is synced to guests by the `zm` event (`js/systems/rift.js`), but it has
  only been tested solo. Try it with two players: the guest should see the flash, the sprite swap and the
  purple arena at the same moment as the host.
- **Arena options.** Other ideas that were discussed: a larger arena, different monolith layouts, and extra
  effects when the Mega phase starts.

## Sprites tooling

- `tools/fetch_zygarde_mega.py` adds Mega Zygarde (number 9718) to `assets/pokemon/` and `js/data/sprites-meta.js`.
  `tools/fetch_sprites.py` keeps it (it reads `tools/cache/9718.json`), and `tools/fetch_credits.py` credits its
  artists.
