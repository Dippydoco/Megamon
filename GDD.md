# GDD — PokéSurvivor · Mystery Dungeon

> Living design document. It reflects the **current** state of the game; at the end
> there is a dated decision log.

## 1. Concept

- **Platform:** browser. Opens by double-clicking `index.html`, no server.
- **Genre:** bullet heaven / horde survival + **roguelike** + **character gacha**.
- **References:** Survivor.io, Megabonk, Vampire Survivors.
- **Look:** **Pokémon Mystery Dungeon** (PMD sprites, blue dialogue boxes,
  pixel-art icons, village music).
- **The player is a Pokémon.** There are **966 Pokémon** from all 9 generations.
- **Everything is local:** sprites, data, font, music and saves. The game makes
  no requests to the internet.

## 2. Screen flow

```
Login / Create account / Guest
        │
        ├─ (first time) Personality test ─> Partner assigned
        │                                     ├─ Let's go together!
        │                                     └─ Choose another (29 starters)
        ▼
Main menu  (the world in the background, with wild Pokémon wandering)
   ├─ Play        → run → summary (+ Poké Coins, shinies caught) → menu
   ├─ Pokémon     → collection by region, choose partner (normal or shiny)
   ├─ Upgrades    → permanent upgrades
   ├─ Gacha       → 9 banners, one per region
   ├─ Friends     → add by nickname, online, invite → Room (up to 4) → group run
   └─ Leaderboard → time survived: Solo / Group × day, week, month, year, all-time
```

### 2.3 Co-op multiplayer (up to 4)
- **Friends by nickname.** Name-and-password accounts use their name; Google
  accounts choose a unique nickname (their real name is never shown).
- **Room:** whoever invites is the host; online friends get the invitation in
  the menu. The host starts the run for everyone.
- **Connection:** direct between browsers (WebRTC, star around the host);
  if the network doesn't allow it, through the Realtime Database (slower, but it works).
- **Who's in charge:** the host runs enemies, items, experience and the clock;
  each player runs their own Pokémon (position, health, attacks). Hits on enemies
  are sent to the host; teammates' attacks are shown as "ghosts".
- **Shared experience**; on levelling up everyone picks their card and the
  game **doesn't continue until everyone has chosen**.
- **Falling:** you stay on the ground; a teammate standing next to you for 3 s
  revives you with half health. It ends when everyone is down.
- **Arrows** at the edge of the screen point to teammates you can't see
  (name and metres; red if they're down).
- Difficulty: ×(1 + 0.75·(n−1)) enemies and ×(1 + 0.3·(n−1)) health; the
  team's experience is divided by (1 + 0.6·(n−1)).
- Pausing doesn't stop the game; if the host leaves, the run ends for everyone.

### 2.5 Battle Tower (second main mode)
- **50 floors** in 5 sections of 10, each a closed arena (the rift arena machinery). Horde floors: defeat a quota.
  Every 5th floor a boss, every 10th a legendary gatekeeper, **Rayquaza** at 50F. Difficulty follows a "floor clock":
  floor n plays like second (n − 1) × 36 of a survival run.
- **Climb** (solo): beating a gatekeeper saves that checkpoint for good; runs start at 1F or after any saved
  checkpoint, with free levels as a head start. **Expedition** (co-op, the room's mode): same floors, never moves
  checkpoints; with 2+ players the 3rd and 8th floor of each section are co-op events (Seal Plates, Twin Bond).
- **No experience in the tower** (25-10-2026): every cleared floor gives flat level-ups (1, or 2 for bosses and
  gatekeepers; checkpoint head starts give the same, 12 per wing). No Learning card or Lucky Egg there.
- Each cleared floor: level-ups, a heal and **Battle Points** (BP, a ledger currency like coins). After every boss:
  pick 1 of 3 **Badges** (run-long passives; 4 free, 8 unlocked with BP). The BP Shop also sells Battle Tower
  themes and exchanges BP for coins and tickets. First clears of boss floors give ×10 tickets.
- **Floor kinds** (systems/towerfloors.js): after each floor two stairways offer the next floor's kind (bosses,
  gatekeepers and co-op events are fixed). Objective: Survival, Bounty, Relic Hunt, Hold the Ground, Escort.
  Puzzle (Climb only): Lights Out, Unown Sequence. Dungeon (built maps, more common higher up; 4F Gauntlet and
  9F Mystery Dungeon always): Gauntlet, Mystery Dungeon. Wild Pokémon fit each wing's types; healers and shielders
  come whatever the theme.
- **Entrance hall** (systems/towerhub.js): every tower run starts in a castle hall with a Climb door and an
  Expedition door (the other mode's is locked) and a statue for every boss floor you have cleared.
- Scripted bosses (systems/towerbosses.js): Slaking (Truant), Gengar (shadow clones, lights out), Rayquaza (3 phases),
  Plusle and Minun (Twin Bond). No survival time, records, history or leaderboard from tower runs.

### 2.4 Leaderboard
- Time survived, Most kills and Highest level (25-10-2026). **Solo / Group** tabs; **daily, weekly, monthly, yearly and
  all-time** periods (Spanish time); **everyone or friends only**;
  **filter by Pokémon**; your rank at the bottom even if you're not in the top 50.
- One entry per player (or team) and table, only if it improves. In a group the
  whole team appears in the same row (the host uploads it).
- Basic anti-cheat: at the start the server time is recorded and the rules
  don't accept a time longer than the real time elapsed.

### 2.1 Accounts
- Sign in, create an account or **play as a guest** (nothing is saved).
- Provisional in `localStorage` behind `js/core/db.js`. Passwords with salt +
  SHA-256, but it's local: not real security.
- The session is remembered when the game is reopened.

### 2.2 Personality test
- 8 Mystery Dungeon style questions; each answer adds trait points.
- The dominant trait decides the partner among the **29 starters**: starters from
  the 9 generations + Psyduck + Slowpoke. It can be declined to choose another.

## 3. Combat

- The Pokémon **attacks on its own** with the **active move** (1 of up to 4).
- Switch the active move with `1`–`4` or `Q`/`E`. Move: `WASD` / arrows. Pause: `Esc`.
- Each attack plays the matching **PMD animation**: `Attack`, `Shoot` or `Charge`.
- **Targeting:** whatever is touching you > the boss if in range > the nearest
  enemy > (no enemies) the nearest rock or chest.
- **52 moves** in 7 families (projectile, melee, beam, orbs, nova, aura,
  booster), 5 levels each. They cover all **18 types**.
- Each Pokémon's pool comes from its types + the shared Normal pool.
- Boosters don't deal damage: you switch in, stack them and switch back to an
  attacking move. No more than 2 are ever offered.
- On levelling up: **1 of 3 cards**.

## 4. World

An open, infinite arena, generated with deterministic noise and painted in pixel
art from code (16 px per tile, ×2).

| Element | Effect |
|---|---|
| Rock formations | Block walkers and projectiles |
| Water | Slows down (×0.6 player, ×0.55 enemies) |
| Lava (volcano biome) | Burns whoever steps on it — enemies can be lured into it |
| Trees / crystals | Block; give cover against enemy shots |
| Rocks | Break; drop XP, coins or berries |
| Chests | Break; good coin loot |
| Tall grass | Cut by any attack; sometimes drops something |
| **Power altar** | On touch, 25 s of Fury (damage ×2), Lightning (+45% speed), Magnet (×4) or Haste (−40% cooldown); then it goes dark |
| **Spring** | Heals while you stand on it; runs dry and refills on its own in ~45 s |
| **Locked chest** | Stay next to it for 3.5 s (even under attack): coins, 1-3 tickets (15% a ×10) and enough experience to level up |
| **Traps** | Poison, sticky (slows you) or explosive; triggered by stepping on them, enemies included |
| **Rift** | Rare (every 30 s, 14% from minute 1:15; lasts 45 s). Takes you to a legendary's arena |

- **Flyers, ghosts and bosses** ignore terrain.
- **3 biomes** that rotate every 4 minutes, each with its own music:
  Shady Forest, Crystal Cave, Ash Volcano. The change is a 2.6 s **crossfade**
  between the old and new palettes (ground and objects).
- **Rift → arena:** a closed round area in the *Distortion Rift* biome,
  against a **legendary** (2 min). Win: extra ×10 ticket, 3 tickets and
  coins, and you return to where you were. Lose (everyone falls or time runs out):
  you return with no reward and 30% health. Meanwhile, the map's enemies wait.

### 4.0 Rift arenas (one per type)
The legendary waits for you in the arena of **one of its two types, at random**. Each
arena has its own palette, decoration, terrain and weather, and its own theme plays
("rift"). The legendary collides with walls and columns like you and can't
leave the circle.

| Type | Arena | Terrain | Weather |
|---|---|---|---|
| Normal | Eternal Meadow | columns | — |
| Fire | Igneous Volcano | lava rivers (burn) | sun |
| Water | Sea Grotto | puddles (slow) | rain |
| Grass | Emerald Jungle | swamp (slows a lot), trees | — |
| Electric | Volt Plant | charged puddles | rain |
| Ice | Eternal Glacier | ice sheets (you slide) | snow |
| Fighting | Ancient Dojo | many columns | — |
| Poison | Toxic Swamp | poison puddles | — |
| Ground | Red Desert | quicksand | sand |
| Flying | Sky Peak | cloud trees | — |
| Psychic | Mind Temple | pink crystals, columns | — |
| Bug | Hive Forest | swamp, lots of grass | — |
| Rock | Ancient Quarry | many columns and rocks | sand |
| Ghost | Gloomy Graveyard | dead trees | fog |
| Dragon | Dragon Sanctuary | draconic flames (burn) | — |
| Dark | Dark Alley | columns | — |
| Steel | Steel Fortress | many columns | — |
| Fairy | Enchanted Forest | pink trees, fountains | — |

Terrain immunities: Fire to lava, Poison/Steel to poison,
Electric/Ground to charge, Ice to ice. The legendary isn't affected by its own arena.

### 4.1 Weather (rare event)
From minute 2, every minute there's an 18% chance of weather arriving (~1 minute):

| Weather | Effect |
|---|---|
| Harsh sunlight | Fire ×1.5 · Water ×0.5 |
| Rain | Water ×1.5 · Electric ×1.2 · Fire ×0.5 |
| Sandstorm | Rock, Ground and Steel ×1.3; everyone else loses 1.2% health every 2 s (never a KO) |
| Snowfall | Ice ×1.5; everyone else loses health the same way and is 10% slower |
| Fog | Ghost, Fairy and Psychic ×1.3; the vignette closes in a little |

It affects everyone (you and the enemies). Each biome favours some weathers. The
visuals are gentle: a light tint and few pixel particles. In a group the host decides.

### 4.2 Type chart (softened)
The one from the games, but ×1.6 / ×0.6 / ×0.3 instead of ×2 / ×0.5 / ×0 (with a
single active attack, a full immunity would make some enemies impossible). Two
types multiply, capped at ×0.3–×2.4. Your attacks use the move's type;
enemies use their main type (or their shot's). The number is yellow when it's
super effective and grey when it isn't (no text, to keep the screen clean).

## 5. Enemies

- **From every generation.** 6 tiers by base stat total; each run draws a
  cast of 7 Pokémon per tier, so every run is different.
- AI by type: chase, telegraphed charge (`Charge` → `Attack`),
  ranged shooting or tank.
- **5 bosses** (min. 3, 6, 9, 12, 15): strong **non-legendary** Pokémon
  (pseudo-legendaries, Slaking...) at random, each one stronger; each drops
  a **×10 ticket**. Legendaries only appear in rifts. During a boss fight the waves
  drop to 25%, there are no surges and the boss theme plays.
- Surges every ~45 s. Cap of **280** enemies at once; once the cap is reached,
  those that keep spawning are elite (×1.6 health and experience, ×1.25 damage).
- **Pathfinding:** a distance field (BFS) around each player; walkers go around
  rocks, walls and dangerous puddles. Only those that **float in their sprite**
  fly over (`hv` in sprites-meta, tools/hover_flags.py): Rowlet or Pidgey walk
  even though they're Flying types; Gastly or Zubat float.

### 5.1 Personalities
In each run, each enemy tier brings at least 2 with a personality (1 in the
first, to learn gradually). "Warned" attacks show on the ground first.

| Personality | Who | What it does |
|---|---|---|
| Healer | Chansey, Blissey, Audino, Clefairy... | Heals those around it by 15% every 3.5 s |
| Shield | Shuckle, Bronzong, Mr. Mime, Bastiodon... | Shield worth 35% health on 6 allies |
| Summoner | Nidoqueen, Vespiquen, Golbat, Gyarados... | Calls 2 of its pack (Nidoran, Combee...) |
| Kamikaze | Voltorb, Electrode, Koffing, Geodude... | Closes in and explodes (1 s warning) |
| Beam | Electric, Psychic, Dragon, Ice (some) | Beam with a warning strip |
| Zones | Fire, Ground, Poison (some) | Circles under your feet that burst |
| Fan | Water, Grass, Bug, Fairy (some) | 3 shots in a fan (5 later on) |
| Jumper | Fighting, Ground, Normal, Rock (some) | Leaps and lands where you were |

## 6. Shinies

- **Wild:** every enemy has a **1/4096** chance to be shiny (bosses too).
  It sparkles, has double health, gives ×5 experience, doesn't despawn if you move
  away, and an arrow at the edge of the screen shows where it is.
  **If you defeat it, you keep it** (and the normal version if you didn't have it). If you
  already had that shiny, +300 coins.
- **Gacha:** 1 in 100 pulls is shiny. A duplicate shiny = triple coins.
- **Collection:** a Pokémon whose shiny you own has a **Normal / Shiny**
  toggle; you pick your partner in whichever version you like.
- 958 of the 966 Pokémon have a genuine SpriteCollab shiny sprite.

## 7. Progression

### 7.1 Poké Coins
At the end of a run: `time/5 + defeated/4 + 80 per boss + coins picked up`,
multiplied by the Fortune upgrade. New account: 500 as a gift.

Coins are for **upgrades**; the gacha uses tickets.

### 7.2 Permanent upgrades — per Pokémon
Vitality, Strength, Stride, Reflexes, Armor, Synthesis, Magnet, Wisdom, Fortune
and **Repertoire (start with 2 moves)**. Each Pokémon has its own and they
only count when you play with it (the Upgrades screen lets you choose which).
Those bought back when upgrades belonged to the account went to the partner at the time.

### 7.2a Held items (one per run)
Leftovers, Choice Band, Quick Claw, Focus Sash, Shell Bell, Amulet Coin,
Lucky Egg, Life Orb, Choice Scarf, Rocky Helmet and Assault Vest. Dropped by
**every boss**, locked chests (50%) and sometimes normal enemies (8%). If you
already hold one, you choose (in solo the game pauses).

### 7.2c Move evolution
A move at max level evolves if during that run you've taken its condition
upgrade (Ember + Power → Fire Blast, Bubble + Sprint → Surf...): a
**golden card** appears (always, if it's ready). All 47 attacking moves evolve.

### 7.2d Missions, achievements and profile
- **3 daily + 2 weekly** (rewards in tickets and coins); one daily can be
  rerolled per day. Same missions on any computer (seed per account).
- **Achievements** with a medal (bronze, silver, gold), a reward and sometimes a **title**;
  one for each **legendary** defeated in a rift.
- **Public profile** (from the leaderboard or the friends list): 3 favourites,
  title, best records and the 8 best medals.

### 7.2b Gacha tickets
- **Ticket** (×1): each defeated Pokémon has a 1/400 chance to drop one; locked
  chests give 1-3.
- **×10 ticket**: bosses, the rift legendary (2) and, sometimes, locked
  chests.
- In a group, tickets belong to the team: everyone gets the ones picked up.

### 7.3 Gacha — one banner per region
Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar and Paldea, each with
**its own Pokémon, its 3 featured ones and its own pity**.

| Rarity | Chance | Duplicate returns |
|---|---|---|
| Common | 45% | 15 |
| Uncommon | 30% | 30 |
| Rare | 17% | 60 |
| Epic | 6.5% | 120 |
| Legendary | 1.5% | 300 |
| *Shiny* | *1% (any rarity)* | *×3* |

- ×1 pull: 1 ticket · ×10: **10 normal tickets or 1 ×10 ticket** (two buttons,
  you choose how to pay), with **at least one
  Epic** guaranteed. Duplicates still give coins.
- **Animation: pixel-art slot machine** (lever, 3 reels, light bulbs). The
  symbols are the rarity: Poké, Great, Ultra, Luxury and Master Ball
  (Legendary) and the red star (shiny); with Epic or better the last reel keeps
  you waiting. The ×10 is 10 quick pulls that drop into the tray. Click = speed up.
- **Pity:** after 70 pulls without a Legendary on a banner, the next one is one.
- Some regions have almost empty rarities (Galar only has 4 Uncommons);
  if a rarity has no Pokémon on that banner, the nearest one is used.

## 8. Music and sound

Composed for the game and played by a Web Audio synthesizer (flute, marimba,
plucked guitar, bass, pad, lead and drums, with reverb). Zero files.

| Theme | Where | Style |
|---|---|---|
| Village | Menus | F major, 100 bpm with swing, flute and marimba |
| Forest | Run (forest) | Adventurous D minor, 122 bpm |
| Cave | Run (cave) | Mysterious A minor, 92 bpm, little bells |
| Volcano | Run (volcano) | Tense E Phrygian, 132 bpm |
| Boss | Boss fight | Intense E minor, 150 bpm |

- Effects for buttons, each attack family (with a pitch by type),
  hits, falls, experience (rises in pitch during a streak), coins, level, boss,
  shiny, breaking things, gacha (drop, shakes, burst by rarity).
- Music and effects volume and a mute button in the top bar and in the
  pause menu; remembered by the browser.
- Measured: all 5 themes at the same level (RMS 0.075–0.09), no clipping even with boss + combat.

## 9. Interface

- **No emojis.** Pixel-art icons drawn in code (`js/ui/icons.js`):
  each move has its **type emblem** (18) + a **family badge**;
  plus heart, glove, boot, clock, shield, sprout, magnet, book,
  coin, cards, berry, bomb, star, shiny sparkle, crown, Poké Ball…
- Always at integer multiples of their resolution, so the pixels stay crisp.

## 10. Technical

- Vanilla HTML + CSS + JavaScript on Canvas 2D. No build, no dependencies.
- **Sprites:** [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), 966
  Pokémon × 7 animations × 8 directions, normal and shiny, in `assets/pokemon/`
  (76 MB, lossless palette PNG). **CC BY-NC 4.0: non-commercial use and
  attribution** (114 artists in `CREDITS.md`).
- **Data:** stats and Spanish names downloaded **once** from PokeAPI.
- **Font:** Pixelify Sans (OFL).
- Generated files are rebuilt with the scripts in `tools/`.

## 11. To do

- [ ] Type effectiveness in damage
- [ ] Custom graphics for projectiles (they're coloured orbs for now)
- [ ] Moves specific to each Pokémon (for now they come from their types)
- [ ] Touch controls / gamepad
- [ ] 59 Pokémon without a sprite on SpriteCollab (mostly gen 5, 8 and 9)

---

## Decision log

**2026-10-07 · first version**
- Vanilla stack + Canvas. 1 active move switched with 1–4. Combat first.

**2026-10-07 · second version**
- Everything local: no API at runtime.
- Mystery Dungeon sprites (SpriteCollab) with attack animations.
- Tiles painted in code (the PMD ones only exist by ripping the ROM).
- Map: **open arena with obstacles** (not PMD's strict rooms and corridors).
- Saves: `localStorage` behind a single data layer.

**2026-10-07 · third version**
- **All generations** (966 with sprites). Gacha: **one banner per region**.
- **Shinies:** 1/4096 in the wild, 1/100 in the gacha; the partner is chosen in its
  normal or shiny version from the collection.
- **Music composed in code** (Nintendo's can't be used) + effects.
- **No more emojis**: custom pixel-art icons.

**2026-10-07 · combat fix**
- Bug: projectiles spawned at the Pokémon's edge and moved up to 8 units
  per frame, so **enemies pressed against the player were immune** to every
  projectile move (in a survivor game, there's almost always one pressed against you).
  Now they spawn at the centre and collision is swept (the whole stretch of the frame).
  In the 10-min simulation, it went from 0 to 1 boss defeated per run.
- Demo videos in `videos/` (boss, wild shiny, shiny in the gacha).

**2026-10-07 · effects and visual tweaks**
- **Attacks with pixel-art sprites** (`js/entities/vfx.js`): 23 shapes (flame,
  drop, bubble, leaf, bolt, crystal, rock, sludge, stinger, star, wind,
  web, wave, crescent, sound, impact, slash, fangs, arrow,
  sphere, shadow ball, heart...) painted with each type's palette and with an
  outline like the PMD sprites. Beams as jets (flames, water, electric
  zigzag, crystals), hits as a pixelated crescent with an extra (fangs,
  slash, impact, leaves/feathers), auras and boosters with the type's
  particles, trails (embers, drops, poison bubbles, dust...). Enemy shots
  use the enemy's type and have a red ring on the ground.
- **Same pixel size across the whole interface** (×2): big legendaries
  looked like a different style because they were drawn at ×1. Bosses, at multiples of 0.5.
- **Shiny:** a pixel-art gem as the mark and animated pixel sparkles.
- **Menu partner:** dark box with a border in its type's colour.
- **Targeting:** ranged attacks prioritise the boss; melee ones,
  whatever is pressed against you.

**2026-10-07 · database and publishing**
- **Firebase** (Authentication + Firestore): accounts with name + password or
  Google; the save follows you to any computer. Local copy for playing
  offline, real-time listening to other computers and **merging** when
  syncing (collections combined, maximums for upgrades/stats, coins and
  partner from the most recent version). Rules: each player can only access
  `saves/{their uid}`. Old local accounts are uploaded when signing in with the
  same name and password. Tested with the official emulator in two browsers.
- Without configuration, or opened by double-click, it stays in local mode.
- **Legal and privacy notice** with a contact for content removal and a button
  to delete the account. Open source (MIT) on GitHub (JPTER78).
- Measures NOT applied, on request: renaming without "Pokémon" and removing the
  sprites ripped from the games (the CHUNSOFT ones).

**2026-10-08 · new name**
- The game is renamed **PokéSurvivor** (no "Pokémon" in the name, like
  PokéRogue or Showdown). Repository: `pokesurvivor`.
- Firebase: new project **`pokesurvivor-jpter`** (Firestore in eur3, email/
  password and Google enabled, domains `jpter78.github.io` and `localhost`). The
  projects `pokemon-survivors-jpter` and `asdaad-9e84f` were deleted (recoverable
  for 30 days in Google Cloud).

**2026-10-09 · mobile and settings**
- **Playable on phone and tablet, in landscape** (in portrait it says "Rotate your
  phone" and the run pauses). **Floating joystick**: appears where you put your
  finger. Attack icons can be tapped to switch (on PC by clicking too) and
  there's a pause button. Switching apps pauses the run automatically.
- The camera guarantees a minimum world height on very wide screens.
- Compact interface on short screens (two-column menu, small top bar,
  the credits line moves to Settings → About).
- **Settings** (PC and mobile): sound; graphics (Auto/High/Medium/Low quality,
  damage numbers, less shake and flashing, FPS, full screen);
  controls (joystick size, keys); account (fixed nickname, cloud, sign
  out, delete); about (version, credits, legal notice, contact).
- **Automatic quality**: lowers effects if the game runs below 45 FPS.
- **Installable as an app** (PWA: icon, full screen, opens offline).
- Fixes: the extra orb of orbit moves when upgrading them; sound
  that didn't start on mobile; summoners respect the enemy cap;
  a clear notice if a game file fails to load.

**2026-10-09 · using as little Firebase as possible (free plan)**
- **Leaderboard with a summary**: one `lbs/{table}` document with the top 50 per
  table (1 read per tab instead of ~52) and a 10-min cache in the
  browser; your own records are remembered so there's no read before a write.
  The per-Pokémon filter stays **only in the all-time table** (half the writes).
- **Approximate "online"** via Firestore (`pres/`, heartbeat every 10 min, read
  when opening Friends or the room) and **invitations via Firestore** (`inv/`). The
  Realtime Database only connects inside a room: the free plan's 100-connection
  cap no longer limits normal players.
- **Cloud saving** at most every 30 s (and on closing), without live listening
  to your own document; public profile at most every 10 min.
- Measured in the emulator: viewing the whole leaderboard twice went from 1,275 to 20
  reads; finishing a run from 12 to 3.
- Fewer Pokémon on screen but stronger (×0.45 quantity, ×2.1 health,
  ×1.35 damage, ×2.6 experience) and no "Super effective!" texts.

**2026-10-08 · multiplayer, friends and leaderboard**
- **Co-op up to 4** with a **friends list** (no room codes or public
  rooms). Shared experience and **cards that wait for everyone**; a fallen
  player is **revived** by standing next to them.
- **Direct WebRTC** connection with signalling through the **Realtime Database**
  (new instance `pokesurvivor-jpter-default-rtdb`, europe-west1), and a **relay**
  through that same database if a direct connection isn't possible. No own server
  and no paid TURN.
- **Unique nickname** for friends and leaderboard; Google accounts choose it when
  signing in (privacy: their real name isn't shown).
- **Time-survived leaderboard**: Solo / Group, daily to all-time, friends,
  per Pokémon, your rank. The group appears whole in one row.
- Privacy notice: in a group, browsers connect directly and
  can see each other's IP (as in a video call).

**2026-10-08 · per-Pokémon upgrades, tickets, rifts and interactables**
- **Upgrades belong to each Pokémon** (not the account); those already bought go to the
  current partner. Coins are now only for upgrades.
- **Gacha with tickets** earned by playing (no starting gift or coin
  conversion): ×1 from normal Pokémon (1/260), ×10 from legendaries (always) and bosses (1 in 3).
- **Casual non-legendary bosses**; legendaries only in **rifts**
  (a separate arena; losing sends you back with no reward). In a group you all travel.
- **Altars, springs, locked chests and traps**, in custom pixel art.
- **Crossfade** between biomes instead of the abrupt change.
- Pokédex: `leg` field (legendary or mythical) from PokeAPI.

**2026-10-08 · weather, type chart and slot machine**
- **Weather** as a rare event (sun, rain, sand, snow, fog), gentle visuals.
- **Softened type chart** in both directions.
- Gacha with a **pixel-art slot machine** instead of the Poké Ball.

**2026-10-08 · arenas by type**
- Bug: legendaries (bosses = flyers) went through the arena's rocks and
  couldn't be shot (Celebi). Now they collide and don't leave the circle.
- 18 rift arenas, one per type, with terrain that has effects and their own weather;
  a new music theme for the rift.

**2026-10-08 · more Pokémon-like icons**
- Shiny: a **red star** with a sparkle (like the games' shiny mark),
  instead of the gem.
- Rarity: no more stars; each rarity is its **Poké Ball** — Poké (Common),
  Great (Uncommon), Ultra (Rare), Luxury (Epic) and **Master (Legendary)**.

**2026-10-08 · camera, performance and AI**
- Camera 20% further out (768 world width instead of 640).
- Performance: the hit flash used `ctx.filter` (×95 more expensive than a
  precomputed white silhouette, which is what's used now); cap of 70 damage
  numbers; internal resolution ×1.5 at most; less off-screen work;
  cap of 280 enemies with elites once the cap is reached.
- Enemies go around obstacles; only those floating in their sprite fly.

**2026-10-08 · missions, achievements, items, evolutions and enemies with personality**
- Missions 3+2, achievements with rewards and titles, public profile (everyone can see it).
- Held items, one per run (chests and bosses).
- Move evolution: max level + condition, golden card.
- Enemies with personality: healers, shields, summoners and warned
  attacks (beams, zones, kamikazes, fan, jumps). Tuned with an
  autopilot: average survival is similar to before (89 s versus 60 s).

**2026-10-10 · final touches before the website**
- Water-type Pokémon aren't slowed by water or swamp.
- Levelling up is half as fast (experience per level ×2).
- Fewer enemies at once (cap 64) but a good deal tougher. Those left
  behind while you run fade out and reappear ahead, so no queue
  forms behind you and you can't simply run away. One "runner" per tier
  (fast and fragile, heads to where you're going to be).
- Bosses and legendaries with 4 warned attacks (stomp, charge or leap, and two
  ranged ones by type: zone rain, beams in a fan, ring or fan
  of shots). They alternate between coming for you and fighting from range, and below
  half health they become enraged. More health (×1.35) and damage (×1.2).
- Rifts: a big pulsing arrow, with distance and time, and its own notice when
  opening.
- "Tap to start" screen (the browser doesn't allow sound without interaction) and
  music also at sign-in and in the personality questions.
- 8 new ways of attacking with the same graphics: boomerang, chain, mines,
  meteors, turret, charge, trail and short fan. 7 moves switch to
  them (same id) and there are 12 new ones (64 in total).
- Anti-cheat: the server rejects level and defeated counts impossible for the
  time; the game watches clock, health, speed, attack, level, coins and the
  test tools. If something doesn't add up, the run doesn't count for the
  leaderboard or records.
- Mid-run events every 4-5 min (systems/events.js): a horde of one type
  (30 s), golden hour (30 s, double experience and coins) and lost Pokémon
  (you take it to the marker; healing, coins, ticket and 1 in 5 joins you).
  Treasure goblins 1-2 per run: Meowth (coins) or Gholdengo (×10 ticket;
  Gimmighoul has no sprite). They flee and escape after 15 s. In a group, everything is
  shared.
- Later (10-10): levelling up half as fast again (experience
  per level ×4 compared with the original) and ×1 tickets rarer (1/400 instead of 1/260).
  Level 8/12/15 missions and level 15 and 30 achievements (previously 12/16/20, 20 and 40).
