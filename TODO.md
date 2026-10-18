# Pending ideas and things still to add

Things deliberately left for later. Cross them off when done.

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
