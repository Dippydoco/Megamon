/* ============ changelog.js — what's new in the game ============
 * What people see behind the "What's new" button in the top bar: gameplay
 * changes and bugs fixed (nothing about servers or databases).
 * Newest date at the top. EACH CHANGE gets its own entry (its own
 * title), so they can be told apart; inside, by section:
 *   new  what's new · chg  changes and tweaks · fix  bugs fixed
 * Each entry has `at`: the publish time in UTC (YYYY-MM-DDTHH:MMZ); the game
 * shows it in the viewer's local time. You can get it with `date -u +%Y-%m-%dT%H:%MZ`.
 * Every text is plain English.
 */
G.CHANGELOG = [
  { d: '2026-10-28', at: '2026-10-28T19:39Z', title: 'Lighter small text', chg: [
    'Small text uses a lighter companion font, m5x7 (also by Daniel Linssen), while names, headings and buttons keep m6x11. Small lines that had become hard to read, like the one under the clock in runs, are clear again.',
    'Some small text (mission details, the featured Pokémon, filters, run history) is a little bigger so it stays sharp.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T19:29Z', title: 'New type chips', chg: [
    'Type chips use pixel letters in the style of the Pokémon games (by Slevanas), in white with a small shadow, everywhere types are shown.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T19:19Z', title: 'Sleepy z\'s stay behind the menu', fix: [
    'The z\'s from Pokémon napping behind the main menu no longer float over the menu\'s buttons.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T19:13Z', title: 'A new font', chg: [
    'The game has a new font, m6x11 by Daniel Linssen: taller, narrower and easier to read at a glance, in the menus and in runs.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T18:44Z', title: 'Your partner comes alive in the menu', new: [
    'Your partner in its box on the main menu does more than attack now: it hops, spins and, depending on the Pokémon, nods, eats, sits, poses, twirls or dances.',
    'Leave the menu alone for a while and your partner falls asleep, with z\'s drifting up. Move the mouse or touch the screen to wake it, and tap it to make it react.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T18:35Z', title: 'Naps in the main menu', new: [
    'The Pokémon wandering behind the main menu now and then lie down for a nap, with little z\'s drifting up. Tap a sleeping one to wake it up.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T18:28Z', title: 'Play tile text', fix: [
    'On the Play and Battle Tower tiles, the line under the name now sits right below it instead of near the bottom, clear of the walking partner.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T18:18Z', title: 'Livelier menu tiles', chg: [
    'Menu tiles: the icon hops when you point at a tile and the tile presses in when you click it. A NEW tag marks tiles with something new until you open them.',
    'The Play tile has a strip of grass with your partner (in its skin) walking along it, and the Battle Tower tile a faint castle. Both stay still with Calm on.',
    'The lines under each tile are bigger and sharper, with shorter wording.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T17:26Z', title: 'Move slots and coin pop', chg: [
    'Move slots: the cooldown is now a clock sweep, with a ring that fills in the move\'s type colour. Moves with a longer cooldown flash when they\'re ready again, and evolved moves have a softly glowing gold rim.',
    'Back on the menu after a run, the PokéCoins you earned pop up under your wallet and the total counts up.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T17:20Z', title: 'A cleaner HUD and top bar', chg: [
    'Run HUD: the clock and the line under it sit on a dark plate so they read over any ground; the experience bar has a glowing tip and 10% ticks; the boss bar has 10% ticks.',
    'Health bars (yours, teammates\' and bosses\') show the health a hit just took as a pale chip that drains away a moment later.',
    'Below 25% health the edges of the screen pulse red (gentler with Calm on).',
    'Top bar: your PokéCoins, tickets, Arceus Stars and Battle Points share one capsule, and the sound, fullscreen, settings and log out buttons are grouped.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T17:09Z', title: 'Tidier main menu, longer Mastery', chg: [
    'The main menu is grouped by what you do: your team (Pokémon, Partner, Gacha), spending and friends (Shop, Friends, Mini-Games), and progress (Profile, Goals, Leaderboard), with the Codex across the bottom.',
    'Partner: Upgrades and Moveset are now two tabs of one screen, and switching tab keeps the Pokémon you picked.',
    'Mastery levels need twice as much XP (Mastery 10 now takes 8,000 XP). Skins and rewards you already unlocked stay yours.',
    'Mastery keeps going past 10 (every 3,200 XP is one more level). The rewards still end at Mastery 10; after that it is just the number.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T17:00Z', title: 'Profile and Goals', chg: [
    'The Profile tile is now two: Profile (your profile, run history and Mastery) and Goals (missions, achievements and badges). The red dot for rewards to claim is on Goals.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T16:22Z', title: 'Mastery and skins', new: [
    'Mastery: every Pokémon now has its own Mastery, from 1 to 10, raised by playing runs with it (time survived, level, bosses, legendaries, reaching Arceus and Battle Tower floors). The first run of the day with each Pokémon gives ×1.5 Mastery XP. Your past runs already count, so your favourites start ahead.',
    'Mastery never changes stats. Its rewards are looks: ribbons on your Pokémon, a footstep trail, a glow, a run intro, a sparkle aura, titles, a profile banner with your Pokémon, and skins. See every Pokémon\'s reward track in Profile > Mastery, and your Mastery XP at the end of each run.',
    'Skins: 390 alternate forms to collect and wear, from Mega Charizard X to Alolan Vulpix. They only change the look; your Pokémon plays exactly the same. Teammates see your skin in group runs, and it shows in your history and on your profile.',
    'Megas and Primals unlock when a Pokémon reaches Mastery 10 and has reached Arceus. Female variants and signature forms (Ultra Necrozma, Crowned Zacian, Complete Zygarde and more) come from Mastery. Others have themed challenges, like winning a type\'s rift arena for that Arceus type or playing Deerling in each season.',
    'Smeargle\'s Studio in the Shop sells regional forms, colours and patterns for PokéCoins, with a Daily Spotlight of 4 skins at 30% off. Try any skin before buying it.',
    'New Forms & Mastery achievements, with titles for mastering Pokémon and completing skin sets.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T15:21Z', title: 'Roar and Nugget give fewer PokéCoins', chg: [
    'Roar no longer gives extra PokéCoins (it was +8% a level). It still gives +8% experience a level.',
    'The Nugget card gives half as many PokéCoins: 10 plus 1 per level (it was 20 plus 2 per level).'
  ] },
  { d: '2026-10-28', at: '2026-10-28T14:54Z', title: 'Less max HP growth per level', chg: [
    'The max HP every Pokémon gains each level in a run is halved: 1% of its base HP per level (it was 2%). The Vigor perk and the extra growth of lower rarities are unchanged.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T13:39Z', title: 'Roar makes wild Pokémon faster', chg: [
    'Roar is tougher: each level now also makes wild Pokémon 3% faster (up to +30% at the cap), on top of more of them with more health and damage. The experience and PokéCoin bonus is unchanged.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T11:41Z', title: 'Auto-pick once everything is maxed', new: [
    'When only the Sitrus Berry and the Nugget are left, the level-up screen lets you pick one to take automatically from then on: level-ups stop opening the menu and just give you that card. Turn it off any time in the pause menu. In a group your card is taken at once and you just wait for the others.'
  ] },
  { d: '2026-10-28', at: '2026-10-28T11:36Z', title: 'No more stuck level-ups when everything is maxed', fix: [
    'Levelling up with every move and perk maxed could leave you stuck on an empty level-up screen (if the Sitrus Berry had been banned). The Sitrus Berry can no longer be banned, and the screen always has a card to pick.'
  ], new: [
    'Nugget: when there\'s almost nothing left to upgrade, a Nugget card joins the Sitrus Berry and gives PokéCoins (more at higher levels).'
  ] },
  { d: '2026-10-27', at: '2026-10-27T17:03Z', title: 'Every run counts on the leaderboard', fix: [
    'Big runs are no longer kept off the leaderboard: there are no automatic limits on time, level or Pokémon defeated any more, so runs like a 60,000-defeated one now go on every board.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T16:53Z', title: 'Moveset Back button', fix: [
    'The Back button (and Esc) on the Moveset screen now take you back to the main menu.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T16:35Z', title: 'Max HP grows with levels, stronger Synthesis', new: [
    'Every Pokémon now gains 2% of its base HP as max HP each level in a run, with no cap (on top of the Vigor perk, which is unchanged).'
  ], chg: [
    'Synthesis is much stronger: each level now regenerates +1.5 HP and +0.3% of your max HP per second (it was +0.9 HP per second), so it keeps up as your health grows.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T16:19Z', title: 'Movesets, in-run Ban and damage growth per level', new: [
    'Moveset (new on the main menu): choose, per Pokémon, the 12 moves that can come up as new moves in its runs. Every Pokémon has exactly 12, so each has the same chance of finding the moves it wants. Until you set one up, it is filled in automatically (its own types\' attacking moves first), and any you leave empty are filled the same way. Starting moves and Spiritomb\'s moves are not limited by it.',
    'Ban now works during the run: on a level-up, press Ban (or B) and then a card. That move or perk won\'t be offered again this run, and a new card takes its place. Each level of the Ban upgrade is one ban per run (featured Pokémon get all 3). The old list of banned moves in Upgrades is gone: the moveset does that job now.',
    'Every Pokémon now deals +1.5% damage per level in a run, with no cap.'
  ], chg: [
    'Power is weaker to make room for it: +5% damage a level, adding up, with a cap of 30 (it was +10% multiplying, up to 50).'
  ] },
  { d: '2026-10-27', at: '2026-10-27T16:02Z', title: 'Three boosters, and Spiritomb shows evolutions', chg: [
    'You can now hold up to 3 booster moves at once (it was 2), so Swords Dance, Agility and Harden can all be taken in the same run. Spiritomb follows the same limit.',
    'Spiritomb\'s move offers now show which perk each move needs to evolve, and whether you have it.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T15:57Z', title: 'Quantity perk and evolution families', new: [
    'Quantity perk: +1 projectile, orb, ring, target, link or bee on every move that fires several things, including moves you learn later (up to 3 levels).'
  ], chg: [
    'The perk a move needs to evolve now depends on its family, so it\'s easy to plan: Shooters evolve with Quantity, Strikers with Power, Sprays (novas and cones) with Reflexes, Blasts with Reach, Rushers with Sprint, Beams with Focus, Lingering moves (auras, tethers, marks) with Synthesis, Guardians with Armor and Heavy hitters with Vigor. The Codex has the full list, and cards, tooltips and the pause menu show each move\'s family.',
    'The Magnet perk is gone (your pickup range still grows with the Magnet upgrade, the magnet power-up and shrine). Learning is no longer needed by any evolution, so every move can evolve in the Battle Tower too.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T15:14Z', title: 'Every damaging move evolves', new: [
    'The 28 damaging moves that had no evolution now have one (burst moves and boosters still don\'t evolve): Pyro Ball, Razor Shell, Fusion Bolt, Spike Cannon, Dual Wingbeat, Arm Thrust, Poison Tail, Magical Torque, Rock Tomb, Boomburst, Psywave, Clanging Scales, Water Pulse, Burn Up, Focus Punch, Sacred Sword, Leaf Blade, Fury Cutter, Mud Bomb, Make It Rain, Whirlwind, Curse, Attack Order, Ice Fang, Blaze Kick, Stone Axe and Leech Seed. Check the badge on the move or the pause menu to see which perk each one needs.'
  ], fix: [
    'Rollout can evolve again (into Rollout+, with Vigor): its evolution had been switched off by mistake.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T15:10Z', title: 'See which perk evolves each move', new: [
    'Every move on your move bar shows the perk its evolution needs as a small badge in its corner: lit once you hold that perk, dim while you don\'t. Hover a move to read it in full.',
    'Level-up cards for moves now say which perk evolves them and whether you have it, a free slot for it, or no room left. Perk cards say which of your moves they evolve.',
    'The pause menu has an Evolutions list: each of your moves, its level and the perk it needs.'
  ] },
  { d: '2026-10-27', at: '2026-10-27T15:02Z', title: 'Perks: 4 perk slots and new perk cards', chg: [
    'Stat cards are now perks. You can hold up to 4 different perks in a run, shown in a grid next to your moves (and on the level-up and pause screens). Each perk levels up every time you take it; once your 4 slots are full, only the perks you hold come up. A move\'s evolution still needs a perk, so plan your slots.',
    'Every perk now has a cap, and most caps are higher: Power 50, Reflexes 13, Sprint 12, Vigor 12 (new), Synthesis 15 (new), Learning 12, Magnet, Reach and Focus 10. Armor gives +5% a level up to its 70% cap (14 levels).',
    'The Sitrus Berry is not a perk: it still heals at once and never takes a slot.'
  ], new: [
    'Pay Day perk: +12% PokéCoins from the run per level.',
    'Shiny Lure perk: +30% chance per level for wild Pokémon to be shiny.',
    'Roar perk: makes the run harder (+10% wild Pokémon, +8% their health and +5% their damage per level) for +8% experience and +8% PokéCoins per level. In a group the whole team faces the team\'s average. Not offered in the Battle Tower.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T18:01Z', title: 'Featured achievements and badges', new: [
    'Profile has a new "Featured on your profile" section: choose up to 6 of your achievements and any of your badges, and they show in a Featured section at the top of your public profile, in the order you picked them. Public profiles also show how many badges a player has.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:57Z', title: 'Try themes in the Star Shop', new: [
    'Sableye\'s Star Shop has a Try button on every theme you don\'t own yet. Trying a menu theme recolours the whole page while you stay in the shop (Stop, or leaving the shop, puts yours back). Trying a card theme shows your own card with it, health bar and all.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:57Z', title: 'Profile screen and Badges', chg: [
    'The Missions tile on the main menu is now called Profile. Its tabs are Profile, History, Missions, Achievements and Badges, and it opens on your profile (or straight on Missions when a reward is waiting).'
  ], new: [
    'Badges: a new tab in Profile with one badge per generation, from Kanto to Paldea. Own every Pokémon of a generation to earn its badge (it comes with that region\'s Shiny Charm); the ones still to earn show how many you have.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:50Z', title: 'Health no longer shows 1 over max', fix: [
    'After being healed, your health could read 1 higher than your max (like 105 / 104), solo and in groups. Health on the HUD and in the pause menu now never shows above your max.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:50Z', title: 'Clearer Ready tag in group rooms', fix: [
    'The "Ready" tag on a player\'s card in a group room no longer looks doubled: its text had a dark shadow drawn right behind it.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:26Z', title: 'Physical or Special on move tooltips', chg: [
    'Hovering a move in the menus (the Pokémon tab, Starting Moves and Veto pickers) now also shows whether it is Physical or Special, so you can match it to your Pokémon\'s better attacking stat.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T17:18Z', title: 'Battle Tower levels, Highest level leaderboard', chg: [
    'The Battle Tower no longer has experience: Pokémon drop no XP there. Instead every floor you clear gives a set number of level-ups: 1 for most floors, 2 for bosses and gatekeepers. Starting from a checkpoint gives exactly the levels the floors below would have (12 per wing).',
    'In the Battle Tower the Learning level-up card and the Lucky Egg no longer come up, and the Scholar Badge now gives one more level-up from every boss and gatekeeper floor instead of more experience.'
  ], new: [
    'A new leaderboard category, Highest level: the highest level your Pokémon reached in one run, solo or in groups, for every period.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T16:50Z', title: 'Dungeon lights in a group', fix: [
    'In a group, standing close to a teammate in a Mystery Dungeon (or during Gengar\'s lights-out) no longer blacks out the place where your lights overlap: lights now add up, so standing together lights up more.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T16:36Z', title: 'Darker Mystery Dungeons', chg: [
    'In Battle Tower Mystery Dungeon floors, everything outside the light around you (and your teammates) is now pitch black instead of just darker, with a soft edge to the light.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T16:31Z', title: 'Battle Tower floor tweaks', chg: [
    'Hold the Ground: the zone is bigger, and instead of jumping somewhere new every 10 seconds it slowly drifts while you stand in it, so you move with it. Progress drains more slowly when you step out.',
    'Lights Out is easier: it now takes 2 steps to solve in the first two wings and 3 higher up.',
    'Puzzle floors are not for farming: once their timer runs out, the Pokémon that come give no experience, and neither do the ones a wrong step calls on Unown Sequence.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T16:26Z', title: 'Tougher Battle Tower bosses', chg: [
    'Battle Tower bosses have much more health: 5th-floor bosses ×2.5, gatekeepers ×2.5 and Rayquaza almost twice as much as before. A boss also never has less health than a set number of seconds of your best single-target damage, so strong builds can\'t melt them.'
  ], new: [
    'Every Battle Tower boss learns two new attacks from a new set: Ring (blasts all around it: hug it or stay far away), Cross (a + of beams, then an x), Barrage (four blasts that follow you) and Spiral (rings of shots that turn as they fire).',
    'Gatekeepers have signature attacks. Entei: Eruption Line and Fire Spin. Suicune: Aurora Sweep and Tidal Wave. Raikou: Thunder Cage and Volt Dash. Groudon: Precipice Blades and Eruption Field. Rayquaza now also rains Draco Meteor fields from its second phase.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T16:20Z', title: 'Battle Points in the top bar', chg: [
    'Your Battle Points now show in the top bar on the main menu, next to your Arceus Stars.'
  ], fix: [
    'The Battle Tower screen no longer slides under the top bar.',
    'On narrower windows the top bar is more compact (What\'s new and Support become icons), so nothing runs off the edge.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T15:42Z', title: 'New Battle Tower floors', new: [
    'Choose your stairs: after each Battle Tower floor, two stairways appear, each labelled with the kind of floor it leads to. Walk into the one you want. Boss floors, gatekeepers and co-op event floors still come when they come.',
    'Objective floors: Survival (last 75 seconds while the spawns ramp up; a storm closes in at the end), Bounty (defeat the three marked Pokémon), Relic Hunt (collect five shards, each one calls a wave), Hold the Ground (stand in a zone that moves every 10 seconds) and Escort (lead a lost Pokémon to the exit; enemies near it hurt it).',
    'Puzzle floors, in Climbs only: Lights Out (stepping on a tile flips it and its neighbours; light all nine) and Unown Sequence (watch the plates light up, then step on them in the same order). Few enemies until a 90-second timer runs out.',
    'Dungeon floors: the Gauntlet (a corridor of rolling boulders and flame jets to a door, with a bonus for beating the par time) and the Mystery Dungeon (dark rooms and corridors, sleeping Pokémon, hidden traps, and stairs to find; in a group everyone has to reach them). They get more common higher up; 4F is always a Gauntlet and 9F a Mystery Dungeon, to learn them.'
  ], chg: [
    'Healers and shielders now turn up on Battle Tower floors whatever the wing\'s theme.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T15:24Z', title: 'Themed Battle Tower floors', chg: [
    'Wild Pokémon in the Battle Tower now fit the wing and the arena you are in: Meadow Wing brings Normal, Grass, Bug and Fairy types, Shadow Wing Ghost, Dark, Poison and Psychic, Stone Wing Rock, Fighting and Ground, Iron Wing Steel, Electric, Ground and Fire, and Sky Wing Dragon, Flying and Ice. Most of each floor\'s Pokémon share its arena\'s type.',
    'Some horde floors moved to arenas that suit their wing: Shadow Wing\'s second half is now the Dark Alley, Stone Wing\'s the Ancient Dojo and Iron Wing\'s the Volt Plant.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T15:08Z', title: 'Battle Tower entrance hall', new: [
    'Every Battle Tower run now starts in an entrance hall: a castle room with two doors at the far end, Climb on the left and Expedition on the right. Walk through the open door to start; the other mode\'s door is locked (Climb when playing in a friends room, Expedition when on your own).',
    'Statues of the bosses you have beaten line the hall: 5th-floor bosses on the left, gatekeepers on the right, higher floors closer to the doors. Bosses still to beat leave an empty pedestal.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T14:32Z', title: 'The Battle Tower', new: [
    'A new main mode, the Battle Tower (the tile next to Play): climb 50 floors of closed arenas. Most floors are hordes (defeat a set number of Pokémon), every 5th floor is a boss and every 10th a legendary gatekeeper, with Rayquaza waiting at the summit. Each cleared floor gives a level, a small heal and Battle Points.',
    'Climb on your own: beating a gatekeeper (10F, 20F, 30F, 40F) saves that checkpoint for good. Fall, and you can start again from your checkpoint with any partner, with free levels as a head start.',
    'Expeditions: in a friends room, the host can pick Battle Tower as the mode. The same floors as one run from the start (or any checkpoint the host has saved), with co-op floors: Seal Plates (every plate held at once) and Twin Bond (Plusle and Minun must fall together). Expeditions never move checkpoints, but everyone earns Battle Points.',
    'Badges: after every boss, pick 1 of 3 Badges that last for the rest of the run. Four are free; eight more are unlocked in the tower\'s BP Shop, which also sells Battle Tower menu and card themes and swaps Battle Points for PokéCoins or tickets. The first clear of a boss floor also gives ×10 tickets.',
    'Bosses with their own tricks: Slaking loafs between attacks (hit it then), Gengar hides among shadowless clones and puts out the lights, and Rayquaza fights in three phases with Dragon Ascent, Hurricane gusts and Delta Stream.'
  ] },
  { d: '2026-10-25', at: '2026-10-25T08:40Z', title: 'Status abilities reworked', chg: [
    'Abilities that only worked while you were burned, poisoned or slowed now do something in every run. Guts: each hit you take gives +8% Attack for 6 s (up to +40%). Marvel Scale: +30% damage reduction for 3 s after a hit. Quick Feet: can\'t be slowed, +30% speed when 5 or more foes are close. Flare Boost: up to +50% Sp. Atk the lower your HP. Poison Heal: poison hits deal half and you heal from poisoned foes nearby. Shed Skin: every 15 s a fresh skin blocks a hit. Natural Cure: switching moves heals 4% of your HP. Hydration: +2 HP/s and +10% speed in Rain or water. Healer: you and nearby teammates regenerate. Synchronize: any foe that hits you is burned, poisoned or slowed back.',
    'Abilities that say you can\'t be burned or poisoned (Water Veil, Immunity, Comatose, Misty Surge and others) now make Fire or Poison hits deal 20% less.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T20:27Z', title: 'Protect cooldown fix', fix: [
    'Protect\'s cooldown now really waits for the shield: it stays full while you are protected and only starts counting down once the shield ends. Before, the timer ran from the moment you cast it, and firing it with Space / F started the full cooldown straight away.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:30Z', title: 'Featured Pokémon for everyone', new: [
    'Today\'s featured Pokémon are now on loan to every player for their day: pick them as your partner from the main menu or the Pokémon tab, even if you don\'t own them. When the day ends you go back to your own partner. Loans don\'t count towards your collection or Shiny Charms.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:30Z', title: 'Clearer leaderboard', chg: [
    'The leaderboard is easier to read and switch: a big Time survived / Most kills switch at the top, labelled rows for mode, period and who to show, a title saying exactly which board you are looking at, and your own rank above the list. It also remembers the board you last viewed.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:30Z', title: 'Neater profiles', chg: [
    'The Copy name button on player profiles is now a small button in the corner of the banner, out of the way of the name and title.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:06Z', title: 'Less damage on mobile', chg: [
    'Playing with touch controls on a phone or tablet, you now take 25% less damage from everything, to make up for the harder controls.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:06Z', title: 'Gacha Battle shuffle', chg: [
    'Gacha Battle cards now shuffle like the random partner picker: Pokémon silhouettes flick past, starting fast and slowing down, before each card turns over. The spin also lasts a little longer.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:06Z', title: 'Sableye\'s Star Shop', chg: [
    'Sableye\'s shop is now called Sableye\'s Star Shop.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T19:06Z', title: 'Tidier friends list', chg: [
    'The Copy button for your nickname in the friends list is smaller and sits at the right of the line.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T17:44Z', title: 'Black Flute: tougher wild Pokémon', chg: [
    'The Black Flute now also gives wild Pokémon 25% more HP. It is a flat increase that stays the same for the whole run. In a group, it is averaged across the team like the rest of the flute.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T17:30Z', title: 'Leaderboard fixes', fix: [
    'Long runs with lots of Pokémon defeated, especially in groups, were refused by the leaderboard and never showed up. The limits now match how many Pokémon a run can really defeat.',
    'The leaderboard now times each run from its own start. Before, every run after the first one in a session was timed from that first run.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T16:29Z', title: 'The Shop: Key Items and the Arceus Shop', new: [
    'New Shop on the main menu with two stalls. Klefki runs Key Items (PokéCoins) and a shiny Sableye runs the Arceus Shop (Arceus Stars). The first time you open each stall in a session it rolls up its shutter and lights its lanterns; tap the stall to skip.',
    'Key Items are bought once and kept forever. Take one into each run from the new slot under your partner on the main menu. They are passive, last the whole run, and are separate from held items.',
    'Nine Key Items: Revival Herb (revive teammates twice as fast, and they get up with more HP), Black Flute (more enemies, more XP), White Flute (fewer enemies, less XP), Lucky Pouch (each level-up: sometimes 2 cards, sometimes none), Iron Ball (slower, tougher), Glass Charm (more damage, less HP), Lagging Tail (enemies and you are slower), Ring Target (enemies go for you first, you take less damage and deal a bit less) and Wishing Star (tougher bosses that can drop 2 gacha tickets). All the details are in the Codex.',
    'The Arceus Shop sells looks for your Arceus Stars: menu themes that recolour the menu, tiles and top bar, and player card themes for your card in runs (your teammates see it too). Gilded and Cosmic cards are animated.',
    'The Missions and Codex tiles are now the same size as the others, to make room for the Shop.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T15:19Z', title: 'Easier to read run stats', chg: [
    'The stage, Pokémon defeated and coins under the run timer are bigger, bold and outlined so they stand out on any ground. Each one has its own colour now: the stage in light blue, defeated in white and coins in gold.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T14:55Z', title: 'All tab in the Pokémon page', new: [
    'The Pokémon page has a new All tab before Kanto that shows every generation at once, with how many you own in total. The filters (Owned, Missing, Shiny, rarity...) work on it too.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T14:48Z', title: 'Ready up in group rooms', new: [
    'Group rooms now have a Ready up button. Every player who isn\'t the host has to ready up before the host can start, and each card in the room shows who is ready. Tap it again to cancel. After a run everyone goes back to not ready. Draft Night runs still start straight from the draft.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T14:38Z', title: 'New event: Voltorb swarm', new: [
    'A new run event joins hordes, Golden hour and Lost Pokémon: the Voltorb swarm. For 25 s, waves of Voltorb and Electrode surround you from every side and rush in to self-destruct. Each one flashes and shows its blast circle for a second before it goes off, so keep moving. Electrode take over the swarm later in the run.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T14:28Z', title: 'Evolved moves keep their name', chg: [
    'An evolved move now keeps its name with a + after it (Ember+ instead of Fire Blast). It works exactly as before; only the name changed.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T14:22Z', title: '42 new moves and 10 new move styles', new: [
    'Every type now has physical and special moves for both close range and range. 27 new moves, including Pyro Ball, Razor Shell, Fusion Bolt, Leaf Blade, Focus Punch, Boomburst, Curse, Make It Rain and Attack Order.',
    'New move styles: Combo (a 3-hit string with a heavy finisher), Thrust (pierces a line), Pulse (rings burst out from you), Vortex, Wave (travels along the ground), Eruption (the ground blows up under foes), Mark (a curse that jumps when a foe falls), Tether (a draining link), Focus (charges up for one huge hit) and Companion (bees that fight beside you).',
    'A Burst move for every type that lacked one: Blast Burn, Water Spout, Bloom Doom, Glaciate, Meteor Assault, Acid Downpour, Magnitude, Tailwind, Psycho Boost, Megahorn, Tar Shot, Infernal Parade, Dark Void, Iron Defense and Misty Explosion.',
    'Two new statuses on foes: Confused (they wander and hit other foes) and Soaked (they take +25% from Electric and Ice moves).',
    'Abilities that boost punching, biting, slicing, sound and similar moves also work with the new moves.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T09:16Z', title: 'Abilities are live!', new: [
    'Every Pokémon\'s ability now works in runs: all 236 of them, from Intimidate and Levitate to Drizzle, Sturdy and Wonder Guard. Check your partner\'s in the Pokémon tab, or pause during a run to read it.',
    'Weather abilities (Drizzle, Drought, Sand Stream, Snow Warning) bring their weather for 60 s at the start and 30 s every 4 minutes. Surge abilities do the same with their terrain.',
    'Team abilities (Battery, Power Spot, Telepathy, Victory Star...) help teammates near you in group runs.',
    'Players still don\'t get burned or poisoned: for abilities like Guts or Marvel Scale you count as burned or poisoned for 4 s after a Fire or Poison hit. The Codex\'s Mechanics tab explains the details.',
    'Some abilities are first versions and their effects and numbers may change.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T08:39Z', title: 'Rearrange your moves and a Burst key', new: [
    'Choose which slot each move is in during a run. On PC, drag a move icon onto another slot to swap them. On any device, pause and use Arrange moves: tap a move, then the slot to put it in. The new order stays for the rest of the run, even when you learn more moves.',
    'Burst key: on PC, press Space (or F) to fire a ready Burst move without switching to it. Ready Burst moves show SPACE above their slot.'
  ] },
  { d: '2026-10-24', at: '2026-10-24T08:17Z', title: 'Fallen bosses\' attacks fizzle out', fix: [
    'When a boss or rift legendary is defeated, any attacks it was still warning on the ground now fade away instead of hitting you after it has already fallen.'
  ] },
  { d: '2026-10-23', at: '2026-10-23T17:54Z', title: 'Gacha Battle rolling animation', new: [
    'In Gacha Battles each card now spins and flashes through the rarity colours before it turns over, and 4★, 5★ and shiny pulls burst onto the table. Battles take a little longer as a result.'
  ] },
  { d: '2026-10-23', at: '2026-10-23T17:52Z', title: 'Gacha Battles have equal shiny odds', chg: [
    'Shiny Charms no longer double shiny odds in Gacha Battles: every player (and the Bot) has the same 1 in 100 chance per pull.'
  ] },
  { d: '2026-10-23', at: '2026-10-23T17:49Z', title: 'Shiny Charms', new: [
    'Own every Pokémon of a region to earn its Shiny Charm: shiny odds are doubled for that region\'s Pokémon, in runs, rifts and the gacha.',
    'Completed regions show a sparkle on their Pokédex tab, and each gacha banner shows whether you have its charm. In group runs the host\'s charms count for wild shinies and rifts.'
  ] },
  { d: '2026-10-23', at: '2026-10-23T17:49Z', title: 'Gacha Battle: your own stake, no daily limit, and a Bot', new: [
    'No one to battle? Take on the Bot: it matches your stake, and if your pulls beat its pulls you win its stake as tickets. Start it from Mini-Games or from your room.'
  ], chg: [
    'Gacha Battles no longer have a limit of 3 a day.',
    'Each player now picks their own stake, from 1 to 100 ×1 tickets, and pulls that many. The best total score wins everyone else\'s stakes.',
    'Big battles reveal their cards faster, so they never drag on.'
  ] },
  { d: '2026-10-23', at: '2026-10-23T17:07Z', title: 'Starting Moves upgrade', new: [
    'Repertoire is replaced by Starting Moves (2 levels). Level 1: choose the move your Pokémon starts with. Level 2: choose up to 2. Use the Choose button in Upgrades.',
    'If you owned Repertoire, you now have Starting Moves level 2. With no moves chosen, you start with 2 moves as before.'
  ], fix: [
    'The level-up screen no longer stretches across the screen with the cards stuck on the left when a card has a long description.'
  ] },
  { d: '2026-10-22', at: '2026-10-22T21:46Z', title: 'Full-field bonus removed; Protect cooldown', chg: [
    'Enemies that appear when the field is nearly full no longer get +60% health, +25% damage and +60% experience.',
    'Protect\'s cooldown now starts when the shield ends, so it can no longer be kept up permanently.'
  ] },
  { d: '2026-10-22', at: '2026-10-22T21:40Z', title: 'Enemy scaling rebalance', chg: [
    'Healers no longer heal enemies you hit in the last 2 seconds, and their healing no longer grows with your Attack.',
    'Kills give more experience as the run goes on: ×1.75 at minute 15, ×2.5 at minute 30.',
    'When the field is full, the oldest enemies far behind you return ahead of you with up-to-date stats.',
    'Enemies chasing you for over 8 seconds without hitting you speed up, by up to 35%.',
    'Upgrade cards for your active move appear twice as often. New-move cards appear less often once you have 2 moves.'
  ] },
  { d: '2026-10-21', at: '2026-10-21T08:51Z', title: 'Psychic moves are easier on the eyes', chg: [
    'Confusion, Psychic and Psycho Cut are drawn smaller, closer to the area they actually hit.',
    'Confusion and Psychic shots fade out as they fly, and Psychic shots dim once they\'ve hit something, so they no longer crowd the screen.',
    'Psybeam\'s rings no longer overlap along the beam.',
    'Looks only: damage, range, speed and homing are exactly the same.'
  ] },
  { d: '2026-10-21', at: '2026-10-21T08:44Z', title: 'Treasure thief no longer stuck in your run', fix: [
    'Fixed the main menu\'s treasure thief (Meowth or Gholdengo) and its "Caught!" text staying frozen on screen for the whole run if you pressed Play while it was on the menu or just after catching it.'
  ] },
  { d: '2026-10-21', at: '2026-10-21T08:36Z', title: 'Featured Pokémon are fully upgraded for the day', new: [
    'Today\'s featured Pokémon now have every upgrade at max in runs (except Ban, for now), on top of the +50% PokéCoins.',
    'It only lasts while they\'re featured: the next day they go back to the upgrades you bought, and anything you buy for them is yours to keep.'
  ] },
  { d: '2026-10-21', at: '2026-10-21T08:36Z', title: 'New main menu layout', chg: [
    'The main menu is now a grid of tiles with a big Play button on top, so everything fits on screen without scrolling.',
    'Each tile shows something live: your Pokédex count, gacha tickets ready, your partner\'s upgrade levels, friends online and rewards to claim. A red dot means something is waiting for you.',
    'Your record (runs, best time, best level, defeated) now sits under your partner. Settings is on the gear button in the top bar.'
  ] },
  { d: '2026-10-21', at: '2026-10-20T23:43Z', title: 'Leaderboard updates faster', chg: [
    'New records now show up on everyone\'s leaderboard within 5 minutes (it could take up to 30).'
  ] },
  { d: '2026-10-20', at: '2026-10-20T21:05Z', title: 'No more losing a run by accident', new: [
    'During a run, closing or reloading the page (or going to another site in the same tab) now asks you to confirm first. The Back button and the phone\'s back gesture open the pause menu instead of leaving the game.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T19:01Z', title: 'Group runs: more enemies and faster levelling', chg: [
    'Group runs now allow more enemies on the field at once (64 solo, up to 160 with 4 players). Before, a whole team shared the solo amount, so each player had far fewer foes to fight.',
    'Group runs level up faster: the experience split between players is gentler.'
  ], fix: [
    'Fixed your shared run history sometimes disappearing from your profile when you signed in on a device that hadn\'t loaded your runs yet.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T17:53Z', title: 'Arceus Stars are now a currency', new: [
    'Arceus Stars now show in the top bar next to your PokéCoins and tickets: you have one for every run that reached Arceus. They\'ll be spendable soon. Spending them won\'t change the gold stars on your Pokémon.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T17:46Z', title: 'Mini-Games: Gacha Battle and Draft Night', new: [
    'New Mini-Games button on the main menu. Both games are played with friends in a room: the host starts them from the room.',
    'Gacha Battle: everyone who joins stakes 1, 3 or 5 ×1 tickets and pulls at the same time, revealed live on everyone\'s screen. You keep what you pull, and the best pulls (★1 1 point up to ★5 100, shiny ×3) win everyone else\'s staked tickets. Up to 3 battles a day; battle pulls don\'t count towards pity.',
    'Draft Night: the host deals a pool of Pokémon and everyone takes turns picking one (25 seconds each). The next group run is played with the drafted Pokémon, even ones you don\'t own.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T17:21Z', title: 'Daily featured Pokémon', new: [
    'Every day three Pokémon are featured, the same for everyone: one Common or Uncommon, one Rare and one Epic or Legendary-rarity. Runs with a featured Pokémon earn +50% PokéCoins.',
    'They\'re shown under your partner on the main menu: tap one you own to make it your partner.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T17:03Z', title: 'Codex: levels and rarity', new: [
    'The Mechanics tab now explains levelling up, how each rarity\'s bonus stats and per-level growth work, and how enemies get stronger over time.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T16:50Z', title: 'Codex: Mechanics', new: [
    'The Codex has a new Mechanics tab explaining the game\'s hidden rules with their numbers: STAB, critical hits, the melee guard and melee bonus vs bosses, Defense, status effects and the Afflicted bonus, type matchups, weather, bonds, burst moves and reviving.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T16:45Z', title: 'See enemy status at a glance', chg: [
    'Enemies now show small status badges above their health bar: orange for burn and purple for poison (each with its number of stacks), blue when slowed and pale blue when frozen or stunned. Teammates in group runs see them too.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T16:36Z', title: 'Dash moves reworked, and status pays off', chg: [
    'Dash moves (Quick Attack, Aerial Ace, Aqua Jet, Spark, Psyshield Bash, Spirit Break) now lunge at the target, hit everything in the way and spring straight back. You stay where you were, so you keep full control of your movement and no longer end up inside the crowd.'
  ], new: [
    'Afflicted foes: an enemy takes +8% damage from everyone for each kind of status it has (burned, poisoned, slowed, frozen or stunned), up to +32%. Bosses too.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T16:17Z', title: 'STAB for single-type Pokémon, melee toned down', new: [
    'Same-type attack bonus: single-type Pokémon (like Charmander or Pikachu) now deal ×1.2 damage with moves of their own type. Dual-type Pokémon don\'t get it.'
  ], chg: [
    'Having a melee move active now cuts damage taken by 25% (was 30%).'
  ] },
  { d: '2026-10-20', at: '2026-10-20T15:07Z', title: 'Abilities (preview)', new: [
    'Every Pokémon now has an innate ability, based on its abilities in the main games (Arcanine has Intimidate, Dragonite has Multiscale...). You can see it on each Pokémon\'s page in the Pokémon tab; hover or tap it to see what it does.',
    'The Codex has a new Abilities tab listing all 236 abilities, with search and category filters.',
    'Abilities are a preview for now: they don\'t affect runs yet.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T14:54Z', title: 'Movement stuck in one direction', fix: [
    'Fixed your Pokémon sometimes walking on its own in one direction (on phones and computers), even with the joystick still showing in the pause menu. Letting go anywhere now always stops it, and opening the pause menu, a level-up or switching apps resets movement.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T12:55Z', title: 'Dragon Dance buff and cleaner run history', chg: [
    'Dragon Dance is now a stronger Swords Dance: besides stacking faster, each stack gives +15% Attack (was +11%; Swords Dance gives +13%).',
    'Runs you leave (quitting, or a group run ending under you) no longer go in your run history, so they don\'t push out your real runs. Runs that reached Arceus are always kept.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T12:31Z', title: 'Gyro Ball reaches further', chg: [
    'Gyro Ball\'s balls still spin around you, but now also fly off at foes up to about 280 away (more with Reach), hitting harder than a spinning ball, and come back to your orbit about a second later. It still hits harder the slower you move.',
    'The stats panel now shows Defense as "DMG Reduced" instead of damage taken.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T10:16Z', title: 'See your stats during a run', new: [
    'The level-up screen and the pause menu now show your Pokémon\'s stats: whether it is a physical, special or mixed attacker, and its HP, Attack, Sp. Atk, Defense (as damage taken) and Speed, base value next to its current value with every bonus applied.',
    'The pause menu also shows cooldowns, critical hit chance, regeneration, area size, pickup range and experience.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T10:05Z', title: 'Favourite Pokémon', new: [
    'Mark any Pokémon you own as a favourite with the new button on its page in the Pokémon tab. Favourites get a heart in the grid, and the new Favourites filter shows them all, from every generation.'
  ] },
  { d: '2026-10-20', at: '2026-10-20T10:05Z', title: 'Friends list tooltip', fix: [
    'Hovering over a friend\'s name no longer shows a stray Spanish tooltip. The shiny badge tooltip in the Pokémon tab is now in English too.'
  ] },
  { d: '2026-10-20', at: '2026-10-19T23:17Z', title: 'Group leaderboards by team size', chg: [
    'The Group leaderboard now has a separate table for each team size: 2, 3, 4 and 5 players. Existing group records have been sorted into the table for their team\'s size.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T22:08Z', title: 'Past Arceus stars counted per Pokémon', fix: [
    'Stars earned before the per-Pokémon count now show the right number: each Pokémon\'s count is rebuilt from your run history (your last 100 runs).'
  ] },
  { d: '2026-10-19', at: '2026-10-19T22:07Z', title: 'Reviving during Arceus\'s Judgment', chg: [
    'In the fight against Arceus (minute 30), a downed teammate\'s revive progress no longer drains away when you step off them, so you can revive them a little at a time while you dodge.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T22:03Z', title: 'Spectating shows your teammate\'s moves', chg: [
    'While you are down in a group run and spectating a teammate, the move bar and held item now show theirs instead of yours.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T22:01Z', title: 'Arceus stars count per Pokémon', chg: [
    'The ×number next to a Pokémon\'s gold Arceus star now shows how many times that Pokémon has reached Arceus, instead of your total across all Pokémon (in the Pokédex, on the menu and on team portraits in runs). Stars earned before this update count as 1.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T21:58Z', title: 'Group runs: no more endless waits or sudden "room closed"', fix: [
    'If a player keeps everyone waiting for more than 2 minutes (level cards, an item or move choice, a bond, or the pause menu), they are removed from the game and the others carry on. If it is the host, their choice is made for them instead.',
    'Fixed players being thrown out mid-run with "The room has been closed" when the host\'s connection blinked. The room now comes back on its own, and a run in progress keeps going.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T19:58Z', title: 'Physical Water moves', new: [
    'Aqua Jet: shoot through foes in a jet of water, knocking them aside. Evolves into Wave Crash (with Sprint).',
    'Liquidation: a crashing blow of water in front of you; foes it hits take more damage for a moment. Evolves into Crabhammer (with Focus).',
    'Physical Water Pokémon (Krabby, Poliwrath, Slowpoke and others) now start with Aqua Jet instead of Tackle.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T18:40Z', title: 'More profile customisation', new: [
    'New profile banners: Starfall (animated: drifting, twinkling stars and shooting stars), Aurora, Thunderstorm and Deep sea (also animated), Sakura, Dunes, Meadow, and Haunted (unlocked by defeating a legendary).',
    'New profile borders: Bronze, Obsidian, Frost, Leaf, and the animated Flame, Neon and Starlight (unlocked by catching a shiny).',
    'You can now change your public profile\'s background colour and add a wallpaper pattern (Dots, Grid, Poké Balls, Waves, Diamonds, Stars, Scales or Stripes).'
  ] },
  { d: '2026-10-19', at: '2026-10-19T17:29Z', title: 'Copy nicknames', new: [
    'New Copy buttons next to your nickname (in Friends and Settings → Account) and on other players\' profiles, so nicknames with emoji are easy to share and paste into Add friend.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T16:19Z', title: 'Run restarting after a double click on Play', fix: [
    'Clicking Play twice quickly could start your run and then restart it a moment later. A second click is now ignored (the same for Start in a group room).'
  ] },
  { d: '2026-10-19', at: '2026-10-19T15:15Z', title: '"Caught!" stuck on screen', fix: [
    'Catching the treasure thief on the menu and then starting a run could leave the "Caught!" text on screen for the whole run. It now always fades out after a couple of seconds.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T14:49Z', title: 'Clearer burst move cooldowns', chg: [
    'While a burst move recharges, its icon dims and the seconds left show in large numbers on top of it. Double-digit cooldowns no longer hide behind the icon.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T14:41Z', title: 'Spiritomb, the move tutor', new: [
    'A Spiritomb now appears up to twice a run and opens a portal of otherworldly moves. Defeat it within 60 s to choose 1 of 3 moves from outside your Pokémon\'s usual pool (other types), or skip.',
    'The offer favours moves that suit your Pokémon\'s Attack or Sp. Atk. If your move slots are full, you choose which move the new one replaces (it keeps that move\'s bond; a burst move can only replace a move that isn\'t bonded). Burst moves follow the usual limit of 2.',
    'In group runs, everyone gets to choose, each from their own offer.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T14:26Z', title: 'Gholdengo stuck on screen', fix: [
    'In group runs, a treasure Gholdengo or Meowth (or an Aegislash) that got away could stay frozen on a teammate\'s screen for the rest of the run. It now leaves on every screen when its time runs out.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T14:07Z', title: 'Bonded moves in your run history', new: [
    'Damage by move in your run history now marks bonded moves with 🔗. If you had more than one bond, a number shows which moves were bonded together. This shows on runs played from now on.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T14:03Z', title: 'Defense now counts', chg: [
    'Defense now changes the damage you take. 70 is neutral; each point above it takes 0.25% off (up to 35% less), and each point below adds 0.1% (up to 10% more). It stacks with Armor, items and other damage reduction.',
    'Lower-rarity Pokémon get a bigger rarity bonus to Defense: +60% at 1★, +38% at 2★ and +16% at 3★.',
    'Defense and damage reduction together can\'t cut a hit below 15% of its damage.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T13:54Z', title: 'Defense in the Pokédex', new: [
    'Each Pokémon\'s page now shows its Defense (the average of its base Defense and Sp. Def). It doesn\'t change the damage you take yet.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T13:27Z', title: 'Common Pokémon are stronger', chg: [
    'Lower-rarity Pokémon get more HP, Attack and Sp. Atk: +15% at 1★, +10% at 2★ and +5% at 3★. 4★ and 5★ are unchanged.',
    'They also grow with every level in a run: +1.5% damage and max HP per level at 1★, +1% at 2★ and +0.5% at 3★, up to level 30, so they catch up with the rare ones later in a run.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T12:53Z', title: 'Hyper Beam aims at the biggest group', chg: [
    'Hyper Beam now fires along the line that hits the most enemies in its reach, instead of at the nearest one.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T12:46Z', title: 'Attack and Sp. Atk', new: [
    'Every Pokémon now has two attacking stats, taken from its real base stats: Attack powers physical moves and Sp. Atk powers special moves. Before, both used whichever was higher.',
    'Each Pokémon is a physical, special or mixed attacker, shown in the Pokédex along with both stat bars. Moves that suit your Pokémon turn up more often on level-up cards, and physical and special attackers always start with a move of their kind (for example a physical Ghost starts with Shadow Claw, and a physical Water type with no physical Water move starts with Tackle). This includes the starter Pokémon.',
    'Level-up cards and the Codex now show whether each move is Physical or Special. Damage boosts (Power, items, Swords Dance...) raise both stats alike. Defense is unchanged.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T12:30Z', title: 'Skip upgrade hidden by the Ban picker', fix: [
    'In Upgrades, pressing Choose on Ban opened the move list between Ban and Skip and pushed the Skip upgrade off the screen. The list now opens below the upgrades and scrolls into view, so Skip stays where it is.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T12:24Z', title: 'Easier to find changes in What\'s new', new: [
    'What\'s new now has a search box and filters. Filter by type (New, Changes, Fixes) and by topic (Moves, Pokémon, Co-op, Balance, Account, Interface), click a topic tag on any entry to jump to similar ones, and see changes grouped by day. Entries you haven\'t seen yet are marked NEW.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T11:20Z', title: 'Melee against bosses and rift legendaries', chg: [
    'Melee moves now do 25% more damage to bosses and legendaries.',
    'In a rift arena, the legendary\'s shots, beams and blasts do 25% less damage to you while a melee move is active.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T11:12Z', title: 'Melee is easier and sturdier', chg: [
    'Melee moves now start swinging from further away and hit foes a little beyond their drawn arc, so you no longer have to stand right on top of enemies.',
    'With a melee move active you now take 30% less damage (was 25%).'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:59Z', title: 'Emoji in nicknames', new: [
    'Nicknames can now include emoji (3 to 16 characters, an emoji counts as one). Change yours in Settings → Account.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:52Z', title: 'Change your nickname', new: [
    'You can now change your nickname in Settings → Account (cloud accounts). Your old nickname becomes free for others to take.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:48Z', title: 'Pause menu pauses the whole group', chg: [
    'In group runs, opening the menu now pauses the game for everyone (on PC and mobile) until you close it. A banner shows who is in a menu. Solo runs already paused.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:42Z', title: 'Clearer fullscreen help on iPhone', fix: [
    'On iPhone, the fullscreen help now explains how to add the game to your home screen, and tells you to open it in Safari first if you opened the link from another app (Discord, Instagram...), where that option does not exist.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:33Z', title: 'No team chat during runs on mobile', chg: [
    'On phones and tablets, team chat is hidden during co-op runs so it can\'t get in the way of the controls. You can still chat in the waiting room.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:25Z', title: 'Dwebble gets its own move: Beat', new: [
    'Beat (Bug): Dwebble\'s signature move, and it starts every run with it. Its pincer shoots out in a long-range punch, hits everything on the way out and on the way back, and knocks foes away. Only Dwebble can learn it. At max level it evolves into Rock Wrecker with Power.'
  ], chg: [
    'Dwebble is stronger: more health (92 to 120), more damage (×1.06 to ×1.35) and a little more speed (101 to 108).'
  ] },
  { d: '2026-10-19', at: '2026-10-19T10:02Z', title: 'Bonded moves going quiet', fix: [
    'In a bond, short-range moves (Dragon Claw, Breaking Swipe, Wing Attack and the like) could stop attacking for several seconds while a far-away boss or chest was the bond\'s target, even with foes right next to you. Each move now attacks whatever is within its own reach.'
  ] },
  { d: '2026-10-19', at: '2026-10-19T09:57Z', title: 'Bonded moves stopping with Dig', fix: [
    'Dig no longer freezes the other moves in its bond while you are underground. They keep attacking the whole time, so bonded groups attack steadily again.'
  ] },
  { d: '2026-10-19', at: '2026-10-18T23:31Z', title: '40 new moves and 10 new ways to attack', new: [
    'Every type now has more moves to choose from, with a mix of physical and special ones. They all show a NEW tag in the Codex.',
    'Grass: Seed Bomb, Solar Beam. Electric: Spark, Thunder Punch, Zing Zap, Electro Ball, Thunder Cage. Psychic: Zen Headbutt, Psyshield Bash, Reflect. Poison: Cross Poison. Ground: Dig, Sand Tomb, Scorching Sands. Flying: Drill Peck, Air Slash, Air Cutter. Bug: Infestation, Signal Beam. Rock: Rollout, Power Gem, Ancient Power, Sandstorm. Ice: Ice Punch, Icicle Spear. Fighting: Seismic Toss, Vacuum Wave. Ghost: Shadow Claw, Spirit Shackle, Ominous Wind. Dragon: Dragon Claw, Dragon Darts, Breaking Swipe. Fairy: Play Rough, Spirit Break, Disarming Voice. Steel: Gyro Ball, Mirror Shot. Dark: Sucker Punch, Fiery Wrath.',
    'New ways to attack: Charge (Solar Beam winds up, then fires a huge beam), Ricochet (bounces from foe to foe), Cage (traps a group inside), Wall (Reflect blocks enemy shots; Mirror Coat sends them back), Burrow (Dig: underground, then up under a group), Swarm (bugs that hunt on their own), Roll (Rollout grows the longer you keep moving), Throw (Seismic Toss hurls a foe into the others), Spin (Gyro Ball hits harder the slower you move) and Counter (Sucker Punch strikes the first foe that comes close).'
  ], fix: [
    'Trail moves (Flame Wheel, Toxic, Zing Zap) could stop leaving puddles if you stood still right after coming back from a rift.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T22:53Z', title: 'Frozen after beating Zygarde', fix: [
    'Beating Zygarde could freeze the game for good: its item drops are pulled in all at once, and a new item could replace the "choose an item" screen while it was open. After choosing, the game stayed paused with nothing on screen. Items now wait their turn, and if the game is ever paused for a choice with no screen open, it carries on by itself. In co-op this could freeze the whole group.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T22:33Z', title: 'Life Orb reworked', chg: [
    'Life Orb no longer costs health on every attack. It still gives +50% damage, but now you have 30% less max HP while you hold it (Vigor upgrades taken with it give 30% less too). Swapping it for another item gives that max HP back.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T22:29Z', title: 'Fewer support enemies at once', chg: [
    'At most 3 healers, 3 shield-casters and 3 summoners can be alive at the same time (before, only healers had a limit, and it could slip). In co-op the limit is for the whole map, shared by the team. Summoned minions don\'t count.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T22:25Z', title: 'Damage by move in your run history', new: [
    'Open a run in Missions → History to see how much damage each of your moves did (burn and poison included), with its share and how long it was your active move. It works for runs from now on, and on other players\' shared histories too.'
  ], chg: [
    'Recent runs now also remember the upgrades and level-up cards you took and how the run went, to help balance the game. The privacy notice and the Share my run history setting explain it.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:35Z', title: 'Shiny star on your health card', new: [
    'Playing a shiny Pokémon now shows its little red star next to the name on your health card, and on your teammates\' cards in co-op.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:21Z', title: 'New moves in the Codex', new: [
    'Moves added in the last 30 days now carry a gold NEW tag in the Codex, and a New filter shows just those.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:15Z', title: 'The Codex', new: [
    'A new Codex in the main menu lists every move in the game, including burst moves, without needing a Pokémon that learns them. Filter by type, style, moves that evolve, burst moves or what your partner can learn; search by name or evolution; and sort by type, name, cooldown, power, style or evolution upgrade. Pick a move to see its levels, what it evolves into and which upgrade it needs.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:05Z', title: 'Burst moves', new: [
    'A new kind of move: burst moves. They have a long cooldown, keep charging while you use your other moves, and fire the moment you switch to them. Then switch back to your main moves. Their slot shows the seconds left and glows gold (with a chime) when they are ready.',
    'Hyper Beam (Normal, 18 s): a huge beam across the screen that pierces everything; you slow down for a moment after.',
    'Explosion (Normal, 22 s): a massive blast all around you that costs 15% of your max HP (it never knocks you out).',
    'Protect (Normal, 20 s): you take no damage at all for 3 seconds.',
    'Recover (Normal, 25 s): heals 30% of your max HP at once.',
    'Thunder Wave (Electric, 20 s): stuns every enemy around you; bosses are slowed instead.',
    'Draco Meteor (Dragon, 20 s): a rain of 10 meteors on the enemies around you.',
    'Burst moves can\'t be bonded, you can carry 2 at most, and they are offered once you have 2 moves to swap between. Reach makes their blasts bigger, and Reflexes and Quick Claw shorten their cooldowns.'
  ], chg: [
    'Dragon Rage now evolves into Dragon Energy (Draco Meteor is now its own burst move). It works exactly as before.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:05Z', title: '8 new moves', new: [
    'Absorb (Grass): homing seeds that heal you for part of the damage. Evolves into Giga Drain with Synthesis.',
    'Acid Spray (Poison): enemies it hits take 25% more damage from everyone for 3 seconds, which is great in co-op. Evolves into Corrosive Gas with Reflexes.',
    'Pin Missile (Bug): a rapid volley of homing needles. Evolves into Fell Stinger with Power: every kill raises your damage by 5% for 4 seconds (up to 5 at once).',
    'Ice Shard (Ice): a very fast shard with a chance to freeze enemies solid for a moment. Evolves into Glacial Lance with Power.',
    'Frost Breath (Ice): icy breath that slows, and enemies that keep getting hit by it freeze. Evolves into Sheer Cold with Focus.',
    'Drain Punch (Fighting): a heavy punch that heals you. Evolves into Hammer Arm with Synthesis.',
    'Dragon Breath (Dragon): dragon fire with a chance to stun (stars spin over stunned enemies). Evolves into Dragon Pulse with Reflexes.',
    'Pursuit (Dark): a homing shot that does double damage to enemies below 30% HP (one and a half times against bosses). Evolves into Kowtow Cleave with Focus.',
    'Healing from moves is capped at 2.5% of your max HP per second, and bosses and legendaries can\'t be frozen or stunned.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T21:05Z', title: 'Reach and Focus upgrades', new: [
    'Two new level-up upgrades. Reach: +10% size of every area attack (melee, auras, orbits, beams, mines, meteors and puddles), up to 6 times. Focus: +4% critical-hit chance, up to 6 times. They add to the Critical Hit shop upgrade and the Scope Lens.'
  ], chg: [
    'Move evolutions are spread more evenly between upgrades, so Power is no longer the answer for almost half of them. Now with Reach: Earth Power, Earthquake, Uproar, Eruption, Expanding Force and Misty Terrain. With Focus: Close Combat, Stone Edge, Crunch, Leaf Storm and Psychic Fangs. With Vigor: Giga Impact and Shadow Punch. With Armor: Iron Head and Fissure. With Magnet: Magnet Bomb. With Learning: Future Sight and Swarm.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T17:16Z', title: 'English only', chg: [
    'The game is now English only: the Spanish version and the Language setting have been removed. Every text is written in English directly, so nothing gets lost in translation.'
  ], fix: [
    'A few labels that were wrong or still half in Spanish now read correctly: the Lightning altar power (it said Thunderbolt), the full-screen button (it said Log out), the nickname line in the privacy notice and the Gmail account-recovery help.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T16:31Z', title: 'Defeated by Mega Zygarde', fix: [
    'Falling to Mega Zygarde in the Zygarde Portal said "Defeated by Something". It now names Mega Zygarde and shows its picture.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T16:10Z', title: 'Choice Band move choice', fix: [
    'In co-op, the Choice Band\'s "pick your move" screen could vanish if level-up cards arrived at the same moment, locking you into whatever move was selected. It now comes back after the cards. This happened most with Repertoire, since you start with 2 moves while level-ups are still very fast.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T15:22Z', title: 'Zygarde rebalanced, clock pauses in arenas', chg: [
    'Zygarde\'s health was far too high: it was sized from your team\'s damage against the whole horde. It now follows your damage against a single target, so it is a hard fight you can actually win in time.',
    'The run timer now pauses while you are in a rift or the Zygarde Portal. The fight\'s own countdown still runs.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:41Z', title: 'Bigger Zygarde Portal', chg: [
    'The Zygarde Portal on the map is now twice as big (with a bigger glow and light column), so it is much easier to spot.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:34Z', title: 'Bosses resist poison', chg: [
    'Poison now hurts bosses, rift legends, Zygarde and Arceus\' legends about 10x less (it is capped per tick). Normal enemies are unchanged.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:30Z', title: 'Zygarde is deadly', chg: [
    'If everyone falls (or time runs out) in the Zygarde Portal fight, your run now ends instead of sending you back to the map.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:27Z', title: 'Zygarde Portal: much rarer and tougher', chg: [
    'Zygarde Portals are now about 75 times rarer.',
    'Portal Zygarde has far more health (about 3.6x more) and its health also follows your whole team\'s damage output, so it should last around a minute.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:24Z', title: 'Group freeze after Zygarde', fix: [
    'Fixed a co-op softlock where one player picking a Bond froze everyone else: item drops (like Zygarde\'s) could replace the Bond screen and leave that player marked as still choosing. Items now wait until the Bond is picked, and a stuck choice is released automatically.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:18Z', title: 'No new games on an old version', chg: [
    'When a new version of the game is out, pressing Play (or Start in a co-op room) now updates the game first instead of starting a run on the old version.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:17Z', title: 'Times in What\'s new', new: [
    'Every entry in What\'s new now shows the time it was published, next to the date, in your own time zone.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T12:40Z', title: 'Quit button fix', fix: [
    'Fixed the quit/abandon button (and the end of a run) doing nothing when logged in: publishing your run history failed on its move and teammate lists. It is now stored in a form the server accepts, and a failure there can no longer stop a run from ending.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T14:14Z', title: 'Zygarde Portal', new: [
    'A very rare green portal can now appear on the ground far from the start. Step on it (once per portal) to be taken to a Zygarde fight. This Zygarde is much tougher than a normal rift legend: 2.2x HP, faster, hits harder and shoots more often, and you have 3 minutes.',
    'The fight has its own arena: a floor of glowing green cells, a ring of six monoliths and the portal you came through at the entrance.',
    'At half health Zygarde turns into Mega Zygarde (it cannot be hurt for about 3 seconds while it changes). Mega Zygarde is bigger, hits 25% harder and moves faster, and the arena turns purple and fills with toxic pools.',
    'Winning gives tickets and coins like a normal rift (but no Bond), plus an extra x10 ticket, 4 more tickets, 25 more coins and 2 items. If you lose, you come back with no reward and the portal is used up.'
  ], chg: [
    'Zygarde\'s health now also follows how hard your team really hits (about 60 seconds of your team\'s damage, on top of the player-count scaling), so strong builds can no longer melt it in a few seconds.',
    'Portals always have clear ground around them (no trees, rocks or grass within 4 tiles), are never closer than about 12 tiles to each other, and glow and sparkle more so they are easier to spot.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T11:53Z', title: 'Catch the treasure thief', new: [
    'The treasure thief that runs across the main menu now shows in front of the menu and can be clicked or tapped to catch it. You get a ticket for a catch, then 25 coins for any catches within the next 10 minutes.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T11:16Z', title: 'Substitute in co-op', fix: [
    'In co-op, a teammate\'s Substitute now draws enemies and breaks for everyone, not just when the host is the one using it. Its hit bar now goes down for everyone as it is hit, and when it breaks, its owner gets the explosion and everyone sees it disappear.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T11:09Z', title: 'Capitalised titles', chg: [
    'Profile titles are now written in title case: Shiny Hunter, Legend Hunter, Boss Hunter, Living Legend, Move Master, Rift Traveler and Loyal Partner.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T11:07Z', title: 'See other players\' run history', new: [
    'Open a player\'s profile and tap "Run history" to see their last runs: Pokémon, time, level, kills, moves, held item, teammates and what defeated them.',
    'You can turn this off in Settings > Share my run history.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T10:19Z', title: 'Arceus counter', new: [
    'The gold star now shows how many times you have reached Arceus in total (with any Pokémon), next to the star in the menu and on your portrait in a run. Teammates see your count too.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T10:13Z', title: 'Gold star shown to teammates', chg: [
    'In co-op, the gold star for a Pokémon that has reached Arceus now also shows on your teammates\' portraits, not just your own.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T10:10Z', title: 'Aegislash timer for guests', fix: [
    'The off-screen arrow to the Aegislash now shows its real time left for everyone in co-op, instead of "NaN s".'
  ] },
  { d: '2026-10-18', at: '2026-10-18T10:06Z', title: 'Smoother co-op movement', fix: [
    'Enemies and teammates now glide between network updates instead of hopping, especially on slower connections.'
  ] },
  { d: '2026-10-18', at: '2026-10-18T10:06Z', title: 'Revive protection', fix: [
    'The 3 seconds of protection after being revived now also holds against enemy ground attacks, beams, traps and lava or other damaging liquid, not just normal hits.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:11Z', title: 'Clearer arrows to teammates', chg: [
    'The arrows pointing to off-screen teammates are bigger and now sit on a round badge showing the Pokémon they are playing, with a larger name and distance label. They flash red when a teammate is downed.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:10Z', title: 'Spectator bar moved up', fix: [
    'The "Spectating" bar now sits higher so it no longer touches the move bar and the selected move\'s name.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:08Z', title: 'Pink screen while a teammate bonds', fix: [
    'Fixed the whole screen turning solid purple/pink for everyone when a teammate chose a Bond at the same moment as a rift flash. The flash now always fades out, even while the game is paused.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:04Z', title: 'Revive progress bar', new: [
    'When you are reviving a downed teammate, a progress bar with their name and a percentage now shows above you, along with the ring that fills around them.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:01Z', title: 'Downed players can pick from the Armoury', fix: [
    'Players who have been downed can now choose an item from the Aegislash Armoury too (they keep it if a teammate revives them). The game does not pause for their choice.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T22:00Z', title: 'Substitute lasts longer', chg: [
    'Substitute\'s doll now stays for 10 seconds instead of 7 before the duration upgrade, so it is more likely to break (and explode) than fade away.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T21:58Z', title: 'Team stats on the end screen', fix: [
    'In groups of three or more, some players could only see part of the team on the end screen\'s Stats tab (other players\' numbers were shown under the wrong person, and your own could go missing). Everyone\'s stats now show correctly.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T21:16Z', title: 'Clearer move descriptions', chg: [
    'Rewrote the English descriptions of all moves so they read naturally and say plainly what each one does.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T21:15Z', title: 'Move tooltips in the menu', new: [
    'Hover (or tap) a move in the Pokémon tab, or in the ban list, to see its name, type, attack kind and what it does.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T21:05Z', title: 'Substitute is now a decoy', chg: [
    'Substitute now draws enemies to it: ordinary enemies near the doll go for it instead of you. It can take 8 hits (little stitches above it show how many are left), then it breaks and explodes. It still shoots enemies while it stands.',
    'Its upgrades now add more hits it can take, a bigger and stronger explosion, extra damage and a longer life (it no longer places a second doll). Bosses ignore it.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T21:01Z', title: 'Substitute is now a doll', chg: [
    'Substitute now leaves a stitched plush doll of your own Pokémon instead of a little star. It still shoots at enemies for a few seconds.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T20:52Z', title: 'Fixed mouse joystick is now the default', chg: [
    'When moving with the mouse, the joystick now stays where you clicked instead of following the cursor. You can switch it back with "Locked mouse joystick" in Settings.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T20:45Z', title: 'Bigger move bar', chg: [
    'The move bar at the bottom is a bit larger. When a long move name (like a bonded "Thunder Shock +2") would touch the held item\'s name, the item box now slides left instead of its name jumping up.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T20:43Z', title: 'Bigger move icons in the bar', chg: [
    'On larger screens the move icons in the bottom bar are bigger and fill their boxes better, so the small attack-kind symbol in the corner is easier to see.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T20:36Z', title: 'Move kind tags on cards', new: [
    'Level-up and Bond cards now show each move\'s attack kind (Projectile, Beam, Aura, Melee...) as a small tag. Don\'t like it? Turn off "Move kind tags" in Settings.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T20:05Z', title: 'Easier to read small text', chg: [
    'Small text (buttons, tabs, labels, arrow names, in-run text) now uses the regular letter weight instead of bold, so letters like C no longer look like an O. Titles and big announcements stay bold.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:55Z', title: 'Friends: which Pokémon they are playing', new: [
    'When a friend is in a run, the friends list now also shows which Pokémon they are playing, e.g. "In a run · Pikachu · 12:05". It follows the same "Show what I\'m doing" setting.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:54Z', title: 'Event Pokémon icons', chg: [
    'Events now show their Pokémon: the arrows pointing to an off-screen Treasure Thief (Meowth or Gholdengo), Aegislash or lost Pokémon have a round badge with its picture, and the announcement banner shows the Pokémon next to the text.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:53Z', title: 'Shell Bell description', chg: [
    'The Shell Bell now says exactly what it does: you heal for 4% of the damage you deal, up to 4 HP per second.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:51Z', title: 'Rift arrow with an icon', chg: [
    'When a rift is off screen, the arrow pointing to it now comes with a round badge showing the rift itself (like the boss arrows), plus a bigger label with its distance and time left.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:48Z', title: 'Easier to spot events and arrows', chg: [
    'On-screen announcements (events, bosses, shiny alerts) are bigger: they pop in, sit on a dark band and have a thicker outline. The Aegislash message stays up a little longer.',
    'The arrows at the edge of the screen that point to off-screen things (Treasure Thief, Aegislash, Lost Pokémon, bosses) and their labels are larger.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:38Z', title: 'Use all tickets: every pull is shown', fix: [
    '"Use all tickets" only showed full cards for new, shiny and Rare-or-better pulls, so it looked like most tickets had disappeared. The rest of your pulls (duplicates) are now listed underneath, grouped, with the coins they gave you.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:32Z', title: 'Friends: what they are doing', new: [
    'The friends list now shows what online friends are up to: in the menu, opening gacha packs, browsing upgrades or the Pokédex, in a lobby, in a run or group run (with a live timer showing how long it has lasted) or facing Arceus.',
    'Prefer to keep it private? Settings > Account > "Show what I\'m doing". When it is off, friends only see that you are online.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:23Z', title: 'Balance: gentler difficulty curve', chg: [
    'Enemy damage is a little lower across the whole run (x2.2 instead of x2.4).',
    'New enemy tiers now phase in over about 100 seconds: their first arrivals start closer to the previous tier\'s strength and rise to full strength, so there is no sudden jump when a new tier begins.',
    'Healer Pokémon appear less often, and no more than 3 healers can be alive at once, so they no longer gang up.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:15Z', title: 'Owned counter on level-up stats', new: [
    'Level-up stat cards (Vigor, Reflexes, Armour and the rest) now show how many of that upgrade you have taken this run, e.g. "Owned 3", or "Owned 3/10" when it has a limit.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T19:05Z', title: 'Defeated by', new: [
    'When you faint, the run summary now shows what defeated you: who it was, the attack, its type and how much damage the final hit did, plus the hits just before it. It is also saved in your match history.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:53Z', title: 'Stopwatch freezes new arrivals', chg: [
    'While the Stopwatch effect lasts, enemies that spawn are frozen too (bosses are slowed), for whatever time is left, instead of only the ones already on screen.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:51Z', title: 'Weather tooltip', new: [
    'Hover over the weather label (top right) during a run to see what that weather does: which types are boosted or weakened, by how much, and who loses HP.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:48Z', title: 'Chest targeting range', chg: [
    'Your Pokémon now only prioritises a chest over enemies when the chest is a little closer than before, so it no longer aims at chests that are out of range of the attack.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:41Z', title: 'Connection status for joining players', new: [
    'When you join a friend\'s room, a status bar now shows whether you are connecting, connected (directly or through the server) or having trouble, and the host\'s card shows the same. A short "Joining…" message appears as soon as you accept an invite.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:11Z', title: 'Item and move names no longer overlap', fix: [
    'The held item name and the selected move name (especially a bonded move like "Thunder Shock +2") no longer draw on top of each other above the move bar.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:07Z', title: 'Search your Pokémon', new: [
    'The Pokémon tab has a search box: type part of a name (only Pokémon you own are found) or a Dex number, and it searches every generation at once.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T18:06Z', title: 'Upgrades list in English', fix: [
    'The Pokémon picker in the Upgrades tab now says "levels" instead of the Spanish "niveles".'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:38Z', title: 'Build number', new: [
    'The game build (a short code and its date) now shows in the bottom-right corner of the menus, in Settings > About and in the connection report, so you can check everyone is on the same version.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:16Z', title: 'Group play on any network', fix: [
    'Friends whose networks would not connect directly (for example two people on the same home wifi) can now play together: if the direct link does not work after about 9 seconds, the game goes through the server instead. It is used only as a fallback.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:08Z', title: 'Connection details in the room', new: [
    'If a friend cannot connect, open "Connection details" at the bottom of the room: it shows what went wrong and a likely cause, and has a Copy button.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:04Z', title: 'Profile banner and border', new: [
    'Profile tab: pick a banner (behind your name) and a border for your public profile. A few are unlocked by playing: Legendary (beat a legendary in a rift), Shiny shimmer and the Rainbow border (catch a shiny), and Arceus (reach Arceus).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:04Z', title: 'Chat name colour', new: [
    'Profile tab: choose the colour your name has in room chat and friend chat.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T17:04Z', title: 'Damage number options', new: [
    'Settings > Screen: choose the size of damage numbers (small, normal, large), show only important hits (critical, super effective and boss hits, plus the damage you take), and switch them to plain white.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T16:55Z', title: 'Easier to spot new updates', chg: [
    'The "What\'s new" button now glows gold with a pulsing red dot while there is something you have not read yet.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T16:52Z', title: 'Profile title fix', fix: [
    'The title you pick on your profile now stays selected in the dropdown (it was saving to your public profile but showing as empty when you came back).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T16:46Z', title: 'Friend chat', new: [
    'Chat with your friends: open Friends and press "Chat" next to a name. Your last 25 messages together are kept, you get an unread count on the Chat button and the main menu, and you can mute a friend.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T16:46Z', title: 'Room chat', new: [
    'Chat with everyone in your room, in the waiting room and during a group run: press Enter (or the small Chat button) to type, Enter to send, Esc to close. Room chat is not saved.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:59Z', title: 'New event: Aegislash and its Armoury', new: [
    'Every so often "An Aegislash appears with an Armoury of Items!" It slowly hunts you down and swaps between Shield Forme (takes far less damage) and Blade Forme (takes full damage, but is fast and dangerous). An arrow shows where it is.',
    'Defeat it and everyone chooses one of 3 items, or skips if nothing is worth taking. Taking one replaces your current item. It leaves after 75 seconds if you cannot beat it, and up to 3 can show up per run.'
  ], fix: [
    'An item picked up while the level-up cards were open (solo) could be lost instead of coming back afterwards.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:42Z', title: 'Random partner', new: [
    'A new "Random partner" button under your partner on the main menu picks a random Pokémon from the ones you own and makes it your partner, with a shuffling-silhouette animation. If you own its shiny too, it can come out shiny. Spin again as many times as you like.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:40Z', title: 'A livelier main menu', new: [
    'Tap or click the Pokémon in the menu background and they react, showing their name (or your teammate\'s name).',
    'The rift scenes in the menu now use a team from one of your past group runs: you and your teammates\' Pokémon, when you have one in your History.',
    'The menu background follows your real time of day (dawn, dusk, night with stars) and shows the game\'s weather: rain, sun, sandstorm, snow and fog. Rift scenes bring their own weather.',
    'Game events show up in the menu too: Gold Hour, hordes of one type and the treasure thief (try to tap it).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:28Z', title: 'Favourites list shows every Pokémon', fix: [
    'Picking a favourite Pokémon on your profile only listed your first 120 Pokémon, so later generations were cut off. It now lists everything you own.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:22Z', title: 'Run history', new: [
    'A new History tab on the Missions screen keeps your last 100 runs: Pokémon, date, time survived, level, kills, moves, held item, damage, coins and bosses.',
    'Group runs also list your teammates and their Pokémon. Click a run to see its full details.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:17Z', title: 'Gold star for reaching Arceus', new: [
    'Any Pokémon that reaches Arceus in a run now gets a little gold star on its portrait: in the Pokédex, on the main menu and in-game. Each Pokémon earns its own.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T15:05Z', title: 'New upgrade: Skip', new: [
    'A new upgrade in the Upgrades tab lets you skip a level-up without taking anything. Each level gives 1 skip per run, up to 3 at max level. Use the Skip button on the level-up screen or press X.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:50Z', title: 'Dates on the all-time leaderboard', new: [
    'Each run in the All-time leaderboard now shows the date it was set.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:47Z', title: 'New menu backgrounds', new: [
    'The main menu background now also shows rift arenas with their legendary boss and a small team facing it (Entei, Articuno, Kyogre, Giratina, Zapdos, Rayquaza and Arceus), mixed in with the forest, cave and volcano scenes.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:36Z', title: 'Life Orb buffed', chg: [
    'Life Orb now gives +50% damage (was +30%). It still costs a little HP with each attack.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:34Z', title: 'Heavy-Duty Boots block traps', chg: [
    'Heavy-Duty Boots now also make you immune to all ground traps (poison, sticky and explosive). The trap still goes off and hurts nearby enemies, it just does nothing to you.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:32Z', title: 'Eight new held items', new: [
    'Scope Lens: +20% critical hit chance.',
    'Flame Orb and Toxic Orb: your hits have a 30% chance to burn or poison the enemy.',
    'King\'s Rock: your hits have a 6% chance to freeze the enemy for 1.2 s (not bosses).',
    'Binding Band: your hits slow enemies by 25% for 1.5 s.',
    'Bright Powder: 10% chance to dodge any hit.',
    'Heavy-Duty Boots: you ignore lava damage and the slowing and sliding of water, mud and ice.',
    'Light Clay: shrine powers (Fury, Thunderbolt, Magnet, Haste, Guardian) last 50% longer.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:14Z', title: 'Support button is now a joke', chg: [
    'The Support button no longer links anywhere: it just shows a joke message. The donation messages on the end screen are gone too.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T14:10Z', title: 'Damage taken stat fixed', fix: [
    'The "damage taken" stat on the end screen now counts only the health you actually lost. Before, a huge killing blow (like from the legendaries in Arceus\' arena, which keep doubling in strength) added its full, overkill damage, giving absurd totals like 1.16 quadrillion.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T13:59Z', title: 'NEW tag in the Pokédex', new: [
    'The five newly added Pokémon (Jellicent, Sirfetch\'d, Copperajah, Toedscool and Pecharunt) now have a red NEW tag in the Pokédex, and there is a New filter to show only them.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T13:57Z', title: 'Five new Pokémon', new: [
    'Jellicent, Sirfetch\'d, Copperajah, Toedscool and Pecharunt are now in the game. They can be pulled in the gacha, picked as your partner and show up as enemies like the others (Pecharunt is a mythical, so it only appears in rifts and the Judgment pool, like the other legendaries).',
    'Their sprites have no dedicated attack animation yet, so they reuse their swing or idle animation when attacking.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T13:25Z', title: 'Fewer random disconnects in groups', fix: [
    'A short network blip (Wi-Fi hiccup, brief signal drop) no longer drops you from a group. The game now spends up to 25 s trying to reconnect before giving up, and the host keeps you in the game while the link is still alive.',
    'If your connection to the room server blinks, your spot in the room is now restored automatically instead of staying deleted.',
    'If you do get disconnected, the message now says why (for example "ice-failed"), so it is easier to track down.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T12:43Z', title: 'Stopwatch freezes everyone, for longer', chg: [
    'The Stopwatch now freezes every Pokémon on the map, not just nearby ones, and the freeze lasts 7 s instead of 5 s. Bosses are still only slowed by 50%, and Arceus is still unaffected.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T12:33Z', title: 'Healers no longer heal bosses', chg: [
    'Healing Pokémon (Chansey, Blissey, Audino and friends) can no longer heal bosses, so bosses are much easier to bring down when a healer is nearby. They still heal everything else.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T12:13Z', title: 'Stopwatch power-up', new: [
    'New Stopwatch pickup (blue clock). Grabbing it sends a swirl of time outward and freezes every nearby Pokémon for 5 s: they cannot move or attack, and take no contact damage from you. Bosses are not frozen but are slowed by 50% for 8 s. Arceus and its judgement are not affected. It drops rarely from enemies, and sometimes from bosses.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T11:39Z', title: 'Gold and Guardian shrines', new: [
    'Gold Shrine (gold orb, coin icon): for 25 s every coin the team picks up builds a combo (×1.15, ×1.30 ... up to ×3). The combo drops if no coin is picked up for 2.5 s, and each shrine gives at most 80 extra coins. It helps the whole team, but only one player can use the shrine.',
    'Guardian Shrine (silver orb, shield icon): you take 35% less damage for 25 s.'
  ], chg: [
    'The Haste shrine is now purple instead of yellow, so it does not look like the Gold shrine.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T11:24Z', title: 'Shrines you can tell apart', chg: [
    'Each power shrine now shows what it does without needing to remember its colour: a floating icon above it (fist = Fury, boot = Thunderbolt, magnet = Magnet, clock = Haste, the same icons as your buffs), a matching symbol carved on its column, and its own effect (embers, sparks, inward-drifting motes, or a ticking ring).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:54Z', title: 'Use all tickets button', new: [
    'A new "Use all tickets" button in the gacha spends every ticket you have on the selected banner (or the Surprise banner if it is on): ×10 tickets first, then groups of 10, then singles. It asks you to confirm first (with an in-game prompt), and shows a summary plus the new, shiny and Rare-or-better Pokémon you got, revealed one by one (click to skip ahead).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:44Z', title: 'Surprise me in the gacha', new: [
    'A new "Surprise me" toggle in the gacha: while it is on, every roll uses a random generation instead of the selected one, and the banner turns into a mystery banner with silhouettes. Use the normal pull buttons to roll; it has its own legendary guarantee counter.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:41Z', title: 'Bonding no longer switches your move', fix: [
    'Bonding moves together (for example a second bond while you already have a group of four) no longer jumps to the bonded slot. You stay on the move you had selected, unless that move was one of the ones just bonded.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:31Z', title: '5-player groups', new: [
    'Rooms and group runs now fit up to 5 players. With a 5th player the enemies get a little tougher and a few more can be on screen at once (bosses too), and there is a new orange colour for the fifth player.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:14Z', title: 'Most kills leaderboard', new: [
    'The leaderboard has a new "Most kills" category next to "Longest time survived", with the same Solo / Group, today / week / month / all-time and friends options. Only runs from now on count towards it.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:10Z', title: 'Choose your move with the Choice Band', new: [
    'When you pick up the Choice Band, the game now asks which move you want to be locked into before it carries on, so you are never stuck with a buff move by accident.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T10:02Z', title: 'Bigger move and item bar', chg: [
    'The move slots and held item at the bottom of the screen are larger (on phones and narrow screens they stay the same size). The move name, item name and slot numbers are bigger, brighter and outlined so they are easier to read.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:55Z', title: 'Tooltips for moves and items', new: [
    'Hover over a move or your held item at the bottom of the screen to see what it does (on a computer; there is no tooltip on touch screens).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:45Z', title: 'Stats tab on the end screen', new: [
    'The end-of-run screen now has a second "Stats" tab: damage dealt, biggest hit, damage taken, times downed, revives given and shrines used. In a group run it shows every player side by side, with the best in each row in gold.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:37Z', title: 'Favourites in the friends list', new: [
    'Each friend\'s three favourite Pokémon now show next to their name in the friends list.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:34Z', title: 'Spectate your teammates', new: [
    'When you are down in a group run, the camera now follows a living teammate. Press Q / E (or the arrow keys, or the on-screen arrows) to switch between teammates. When you are revived the camera returns to you.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:18Z', title: 'Easier to find bosses', chg: [
    'The boss name at the top of the screen is bigger, with the boss\'s icon next to it and a percentage of its health left.',
    'When a boss is off screen, an arrow with its icon, name and distance now points to it from the edge of the screen, so you can find it quickly (a living boss stops new rifts from appearing).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:10Z', title: 'Bigger health cards and buffs', chg: [
    'Your health card, your active buffs and your teammates\' cards are larger and easier to read (a bit less on small screens so they do not cover the timer).'
  ] },
  { d: '2026-10-17', at: '2026-10-17T09:08Z', title: 'Your own health card', chg: [
    'Your name, level and health now use the same card style as your teammates, with the icon of your Pokémon in a framed box, your HP numbers and a health bar.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:57Z', title: 'Who is choosing?', chg: [
    'When a teammate is choosing a Bond (or an item) and the game is paused for everyone, a pink notice at the top of the screen now says who is choosing, instead of just leaving the screen tinted.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:40Z', title: 'Partner changes sync in rooms', fix: [
    'Fixed a bug where changing your partner Pokémon (or its shiny version) while in a room sometimes did not update for the other players, who kept seeing your previous partner. It now updates right away and corrects itself if it ever gets out of sync.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:25Z', title: 'Safer friend removal', chg: [
    'Removing a friend now takes two taps: "Remove" turns into "Sure? Tap again" for a few seconds, and the button sits further away from "Invite" so it is harder to hit by mistake.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Revive protection', chg: [
    'A revived player now gets 3 seconds of invulnerability and 4 seconds of +50% movement speed, so they are not instantly downed again.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'New party list', chg: [
    'Each teammate now has their own card in the top left with the icon of the Pokémon they are playing, their name, their HP numbers and a health bar, spaced out and stacked downwards as more players join.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Buff icons and a bigger HUD', chg: [
    'Buffs now show an icon next to their text (attack, speed, defense, regeneration and the shrine powers) and wrap onto a new row instead of overlapping.',
    'The top-left HUD (health, teammates\' health and buffs) is a bit bigger.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Chests are targeted first', chg: [
    'Breakable chests within range of your active move are now targeted before enemies, so you no longer have to stand between a Pokémon and the chest to break it.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Safer rift exits', chg: [
    'Leaving a rift now puts every player together at the rift\'s exit, wherever they were before.',
    'Everyone also gets 3 seconds of immunity so nobody is hit the moment they come back.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Life Orb choice', chg: [
    'When you find the Life Orb and are not holding an item, you now choose whether to take it or discard it instead of it being equipped automatically.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Moves no longer switch by themselves', chg: [
    'When you learn a new move, the game no longer switches to it automatically: you keep the move you had selected.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Room invites mid-run', fix: [
    'If you accept a room invite in the middle of a run, the game now asks whether you want to leave the run first, and only then do you join the room.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'More English text', fix: [
    'The end-of-run screen no longer shows "recogidas" and "Shinies conseguidos" in Spanish.',
    '"Choose as partner", "View profile", "Search by name", the partners\' personality traits, the "/ month" price and the Gmail account-recovery help now display in English.',
    'Shiny Pokémon messages (a wild one appears, one is waiting in the rift) and the list of players still choosing a card now read correctly.'
  ] },
  { d: '2026-10-17', at: '2026-10-17T08:13Z', title: 'Move with the mouse', new: [
    'You can now move with the mouse: hold the left button and drag, and a joystick appears where you press. You can turn it off in Settings > Controls.',
    'New "Locked mouse joystick" setting: the joystick stays where you pressed and does not follow you when you drag far. Let go and press again to place it somewhere else.'
  ] },
  { d: '2026-10-16', at: '2026-10-16T20:36Z', title: 'Redeem codes and names', new: [
    'New "Code" tab in Settings: enter a code to win tickets or coins. Each code can be redeemed once per account.'
  ], chg: [
    'The Pokémon that still had Spanish names (such as Great Tusk and Iron Thorns) now use their English names.',
    'The text under the title now reads "Five Nights at the Chinese Parliament".'
  ] }
];
