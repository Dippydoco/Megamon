# PokéSurvivor · Mystery Dungeon

A Pokémon bullet heaven in the style of Survivor.io and Megabonk, with sprites from
*Pokémon Mystery Dungeon*, a roguelike layer, **966 Pokémon from all 9 generations**,
shinies and a gacha per region. Music and sound effects composed for the game.

Vanilla HTML + CSS + JavaScript on Canvas 2D. No build step, no dependencies and
**everything local**: no internet needed to play.

> **Crypto disclaimer**
>
> PokéSurvivor has **no official cryptocurrency, token or NFT**, and I have not
> created any. Any token using the game's name was created by third parties.
> **I take no responsibility for any purchase, sale or investment** you make
> with them, and nothing here is investment advice. The game is free and will
> stay free.

## Playing

Double-click `index.html`. Create an account or play as a guest, take the
personality test and into the dungeon you go.

| Key | Action |
|---|---|
| `W` `A` `S` `D` / arrows | Move |
| `1` `2` `3` `4` | Choose the active move |
| `Q` / `E` | Cycle moves |
| `Esc` / `P` | Pause |

**On phone or tablet** (landscape): put your finger anywhere and drag to move
(the joystick appears where you touch), tap an attack at the bottom to switch
to it, and the button at the top right to pause. It can be installed as an app
("Add to Home Screen"). **Settings** has sound, graphics quality (with an
automatic mode), damage numbers, reduced screen shake, FPS and your account.

Your Pokémon attacks on its own with the active move (or with all the moves in a
**Bond**: each legendary you defeat lets you fuse moves so they fire together
from a single slot, up to 4). Rocks, chests and tall grass break; walls and trees
block enemy shots; water slows you down and lava burns (enemies too).

On the map there are **power altars**, healing **springs**, **locked chests**
(stand next to them for a few seconds) and **traps** that also hurt enemies.
Sometimes a **rift** opens: step in and you fight a **legendary** in a separate
arena.

There is a **type chart** (a Bubble Beam hits a Charmander harder) and, every so
often, **weather** (sun, rain, sand, snow, fog) that boosts some types and
weakens others.

Every day there are **missions** (and weekly ones) that give tickets and coins;
**achievements** give medals and titles, and your **profile** shows your 3
favourite Pokémon, your records and your medals. During runs you find **items**
(Leftovers, Choice Band...) and your moves **evolve** at max level. Enemies have
personality: they heal, put up shields, call their pack or attack with a warning
on the ground.

**Upgrades** belong to each Pokémon. The **gacha** uses **tickets** earned by
playing (×1 from some Pokémon, ×10 from bosses and legendaries) and is pulled on
a pixel-art slot machine.

Every enemy has a 1/4096 chance to be **shiny**: it sparkles, an arrow at the
edge of the screen tells you where it is, and if you defeat it you keep it. In
the gacha, 1 in 100 pulls is shiny. In the collection you choose your partner in
its normal or shiny version.

Music starts after the first click (browsers don't allow sound before that).
Volume and mute: the speaker button at the top right, or in the pause menu.

Saves live in the browser's `localStorage`: if you clear the site's data, they
are lost.

`videos/` has recordings of the game (with music): a boss fight, catching a wild
shiny and a shiny in the gacha.

## Cloud saves and publishing

- **Database (Firebase):** accounts with name + password or Google, and your save
  follows you to any computer. Steps in [docs/FIREBASE.md](docs/FIREBASE.md).
  Without it configured, the game saves only in the browser, as before.
- **Playing with friends (up to 4) and leaderboard:** with a cloud account, the
  **Friends** menu (add by nickname, invite to your room) and **Leaderboard** (time
  survived: solo or group, from today to all-time, friends, per Pokémon).
- **Publishing for free on GitHub Pages:** [docs/PUBLISHING.md](docs/PUBLISHING.md).
- If you play on two computers at once or offline, the saves are **merged**:
  collections are combined (you never lose a Pokémon or a shiny), upgrades and
  stats keep the highest value, and coins and partner take the most recent
  version. Changes from another computer arrive live.

## Licence

Code under [PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md) since
14-10-2026: you may use, study and modify it, but **not for commercial purposes**
(neither selling the game nor charging for anything inside it). Versions up to
commit `b297089` were published under MIT. The sprites (CC BY-NC 4.0), the font
(OFL) and the Pokémon trademarks have their own terms: see [LICENSE](LICENSE)
and [CREDITS.md](CREDITS.md). Non-profit fan project.

**The only official website is [pokesurvivor.com](https://pokesurvivor.com).**
The game is and will stay free: if anyone asks you to pay, it isn't us.

## Structure

```
index.html              screens + load order
css/style.css           Mystery Dungeon style interface
assets/pokemon/{dex}/   PMD sprite sheets (Idle, Walk, Attack, Shoot, Charge, Hurt, Faint)
assets/pokemon/{dex}/s/ the same sheets in their shiny version
assets/fonts/           Pixelify Sans (OFL) and its version with redrawn digits (tools/make_font.py)
js/
  net/      social (nickname, friends, rooms), net (WebRTC + relay),
            coop (group runs), ranking
  core/     util, db (saving), audio (synthesizer + effects), input,
            sprites (PMD animator), camera
  data/     pokedex*, sprites-meta*, moves, starters (+ test), enemies,
            upgrades, music (scores)
  world/    tiles (pixel art in code), world (terrain, objects, collisions)
  entities/ player, enemy, projectile, pickup, fx
  systems/  combat, spawner, levelup, gacha
  ui/       icons (pixel art), ui, hud, login, test, menu, gacha-ui, run-ui,
            social-ui, ranking-ui
  game.js   main flow and loop
tools/      scripts that regenerate the files marked with *
```

`*` = generated. To rebuild them (needs Python 3 + Pillow and internet, just that once):

```
python tools/fetch_sprites.py    # normal and shiny sprites + js/data/sprites-meta.js
                                 # (~20 min; can be stopped and restarted: uses tools/cache/)
python tools/fetch_pokedex.py    # js/data/pokedex.js
python tools/fetch_credits.py    # CREDITS.md
```

## Implementation notes

- **PMD sprites.** Columns = frames, rows = 8 directions (Down, DownRight,
  Right, UpRight, Up, UpLeft, Left, DownLeft — verified against the `-Offsets.png`).
  Each animation has its own frame size, so they are aligned by the
  **ground anchor** taken from `-Shadow.png`; without it the sprite would jump when attacking.
- **Coordinates.** An entity's `(x, y)` is its **feet**. Collisions happen on the
  ground plane; projectiles fly in that plane and are drawn raised with their
  shadow underneath.
- **World.** 16×16-tile chunks: the *data* (terrain, objects) is cheap and always
  generated; the *image* is baked at art resolution by writing into an
  `ImageData` (~4 ms per chunk in Chrome), and only for the visible ones.
- **Performance.** Spatial grid of enemies rebuilt every frame. With 420
  enemies, simulation + full render ≈ 3 ms per frame in Chrome.
- **Metadata in `.js`, not `.json`**, because `fetch()` is blocked on `file://`.
- **Shiny.** SpriteCollab shinies are the same drawing with another palette; they
  are in `s/` and only 30 have different geometry (field `sa` in the metadata).
  Sheets are stored as PNG with an exact palette: same image, half the size.
- **Audio.** Web Audio synthesizer with a look-ahead scheduler (it schedules the
  notes 150 ms ahead) and convolution reverb with a generated impulse.
  The scores are in `js/data/music.js` in a custom text format.
  Effects have a minimum gap between repeats and a voice cap,
  so 400 enemies hit at once don't overload it.
- **Icons.** Character maps converted to canvas and data URLs; always drawn at
  integer multiples of their size so the pixels stay crisp.

## Credits and licence

Sprites from [SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under
**CC BY-NC 4.0** — **non-commercial** use with attribution; the list of artists
is in [`CREDITS.md`](CREDITS.md). Pokémon is the property of Nintendo, Creatures
Inc. and GAME FREAK. Non-profit fan project.
