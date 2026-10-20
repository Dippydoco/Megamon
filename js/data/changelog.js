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
