/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. CADA CAMBIO va en su propia entrada (su propio
 * título), para que se distinga uno de otro; dentro, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés; T('texto') la pone igual en los dos
 * (el grupo juega en inglés: lo nuevo se escribe sólo en inglés).
 */
G.CHANGELOG = (() => {
const T = s => [s, s];
return [
  { d: '2026-10-17', title: T('New upgrade: Skip'), new: [
    T('A new upgrade in the Upgrades tab lets you skip a level-up without taking anything. Each level gives 1 skip per run, up to 3 at max level. Use the Skip button on the level-up screen or press X.')
  ] },
  { d: '2026-10-17', title: T('Dates on the all-time leaderboard'), new: [
    T('Each run in the All-time leaderboard now shows the date it was set.')
  ] },
  { d: '2026-10-17', title: T('New menu backgrounds'), new: [
    T('The main menu background now also shows rift arenas with their legendary boss and a small team facing it (Entei, Articuno, Kyogre, Giratina, Zapdos, Rayquaza and Arceus), mixed in with the forest, cave and volcano scenes.')
  ] },
  { d: '2026-10-17', title: T('Life Orb buffed'), chg: [
    T('Life Orb now gives +50% damage (was +30%). It still costs a little HP with each attack.')
  ] },
  { d: '2026-10-17', title: T('Heavy-Duty Boots block traps'), chg: [
    T('Heavy-Duty Boots now also make you immune to all ground traps (poison, sticky and explosive). The trap still goes off and hurts nearby enemies, it just does nothing to you.')
  ] },
  { d: '2026-10-17', title: T('Eight new held items'), new: [
    T('Scope Lens: +20% critical hit chance.'),
    T('Flame Orb and Toxic Orb: your hits have a 30% chance to burn or poison the enemy.'),
    T('King\'s Rock: your hits have a 6% chance to freeze the enemy for 1.2 s (not bosses).'),
    T('Binding Band: your hits slow enemies by 25% for 1.5 s.'),
    T('Bright Powder: 10% chance to dodge any hit.'),
    T('Heavy-Duty Boots: you ignore lava damage and the slowing and sliding of water, mud and ice.'),
    T('Light Clay: shrine powers (Fury, Thunderbolt, Magnet, Haste, Guardian) last 50% longer.')
  ] },
  { d: '2026-10-17', title: T('Support button is now a joke'), chg: [
    T('The Support button no longer links anywhere: it just shows a joke message. The donation messages on the end screen are gone too.')
  ] },
  { d: '2026-10-17', title: T('Damage taken stat fixed'), fix: [
    T('The "damage taken" stat on the end screen now counts only the health you actually lost. Before, a huge killing blow (like from the legendaries in Arceus\' arena, which keep doubling in strength) added its full, overkill damage, giving absurd totals like 1.16 quadrillion.')
  ] },
  { d: '2026-10-17', title: T('NEW tag in the Pokédex'), new: [
    T('The five newly added Pokémon (Jellicent, Sirfetch\'d, Copperajah, Toedscool and Pecharunt) now have a red NEW tag in the Pokédex, and there is a New filter to show only them.')
  ] },
  { d: '2026-10-17', title: T('Five new Pokémon'), new: [
    T('Jellicent, Sirfetch\'d, Copperajah, Toedscool and Pecharunt are now in the game. They can be pulled in the gacha, picked as your partner and show up as enemies like the others (Pecharunt is a mythical, so it only appears in rifts and the Judgment pool, like the other legendaries).'),
    T('Their sprites have no dedicated attack animation yet, so they reuse their swing or idle animation when attacking.')
  ] },
  { d: '2026-10-17', title: T('Fewer random disconnects in groups'), fix: [
    T('A short network blip (Wi-Fi hiccup, brief signal drop) no longer drops you from a group. The game now spends up to 25 s trying to reconnect before giving up, and the host keeps you in the game while the link is still alive.'),
    T('If your connection to the room server blinks, your spot in the room is now restored automatically instead of staying deleted.'),
    T('If you do get disconnected, the message now says why (for example "ice-failed"), so it is easier to track down.')
  ] },
  { d: '2026-10-17', title: T('Stopwatch freezes everyone, for longer'), chg: [
    T('The Stopwatch now freezes every Pokémon on the map, not just nearby ones, and the freeze lasts 7 s instead of 5 s. Bosses are still only slowed by 50%, and Arceus is still unaffected.')
  ] },
  { d: '2026-10-17', title: T('Healers no longer heal bosses'), chg: [
    T('Healing Pokémon (Chansey, Blissey, Audino and friends) can no longer heal bosses, so bosses are much easier to bring down when a healer is nearby. They still heal everything else.')
  ] },
  { d: '2026-10-17', title: T('Stopwatch power-up'), new: [
    T('New Stopwatch pickup (blue clock). Grabbing it sends a swirl of time outward and freezes every nearby Pokémon for 5 s: they cannot move or attack, and take no contact damage from you. Bosses are not frozen but are slowed by 50% for 8 s. Arceus and its judgement are not affected. It drops rarely from enemies, and sometimes from bosses.')
  ] },
  { d: '2026-10-17', title: T('Gold and Guardian shrines'), new: [
    T('Gold Shrine (gold orb, coin icon): for 25 s every coin the team picks up builds a combo (×1.15, ×1.30 ... up to ×3). The combo drops if no coin is picked up for 2.5 s, and each shrine gives at most 80 extra coins. It helps the whole team, but only one player can use the shrine.'),
    T('Guardian Shrine (silver orb, shield icon): you take 35% less damage for 25 s.')
  ], chg: [
    T('The Haste shrine is now purple instead of yellow, so it does not look like the Gold shrine.')
  ] },
  { d: '2026-10-17', title: T('Shrines you can tell apart'), chg: [
    T('Each power shrine now shows what it does without needing to remember its colour: a floating icon above it (fist = Fury, boot = Thunderbolt, magnet = Magnet, clock = Haste, the same icons as your buffs), a matching symbol carved on its column, and its own effect (embers, sparks, inward-drifting motes, or a ticking ring).')
  ] },
  { d: '2026-10-17', title: T('Use all tickets button'), new: [
    T('A new "Use all tickets" button in the gacha spends every ticket you have on the selected banner (or the Surprise banner if it is on): ×10 tickets first, then groups of 10, then singles. It asks you to confirm first (with an in-game prompt), and shows a summary plus the new, shiny and Rare-or-better Pokémon you got, revealed one by one (click to skip ahead).')
  ] },
  { d: '2026-10-17', title: T('Surprise me in the gacha'), new: [
    T('A new "Surprise me" toggle in the gacha: while it is on, every roll uses a random generation instead of the selected one, and the banner turns into a mystery banner with silhouettes. Use the normal pull buttons to roll; it has its own legendary guarantee counter.')
  ] },
  { d: '2026-10-17', title: T('Bonding no longer switches your move'), fix: [
    T('Bonding moves together (for example a second bond while you already have a group of four) no longer jumps to the bonded slot. You stay on the move you had selected, unless that move was one of the ones just bonded.')
  ] },
  { d: '2026-10-17', title: T('5-player groups'), new: [
    T('Rooms and group runs now fit up to 5 players. With a 5th player the enemies get a little tougher and a few more can be on screen at once (bosses too), and there is a new orange colour for the fifth player.')
  ] },
  { d: '2026-10-17', title: T('Most kills leaderboard'), new: [
    T('The leaderboard has a new "Most kills" category next to "Longest time survived", with the same Solo / Group, today / week / month / all-time and friends options. Only runs from now on count towards it.')
  ] },
  { d: '2026-10-17', title: T('Choose your move with the Choice Band'), new: [
    T('When you pick up the Choice Band, the game now asks which move you want to be locked into before it carries on, so you are never stuck with a buff move by accident.')
  ] },
  { d: '2026-10-17', title: T('Bigger move and item bar'), chg: [
    T('The move slots and held item at the bottom of the screen are larger (on phones and narrow screens they stay the same size). The move name, item name and slot numbers are bigger, brighter and outlined so they are easier to read.')
  ] },
  { d: '2026-10-17', title: T('Tooltips for moves and items'), new: [
    T('Hover over a move or your held item at the bottom of the screen to see what it does (on a computer; there is no tooltip on touch screens).')
  ] },
  { d: '2026-10-17', title: T('Stats tab on the end screen'), new: [
    T('The end-of-run screen now has a second "Stats" tab: damage dealt, biggest hit, damage taken, times downed, revives given and shrines used. In a group run it shows every player side by side, with the best in each row in gold.')
  ] },
  { d: '2026-10-17', title: T('Favourites in the friends list'), new: [
    T('Each friend\'s three favourite Pokémon now show next to their name in the friends list.')
  ] },
  { d: '2026-10-17', title: T('Spectate your teammates'), new: [
    T('When you are down in a group run, the camera now follows a living teammate. Press Q / E (or the arrow keys, or the on-screen arrows) to switch between teammates. When you are revived the camera returns to you.')
  ] },
  { d: '2026-10-17', title: T('Easier to find bosses'), chg: [
    T('The boss name at the top of the screen is bigger, with the boss\'s icon next to it and a percentage of its health left.'),
    T('When a boss is off screen, an arrow with its icon, name and distance now points to it from the edge of the screen, so you can find it quickly (a living boss stops new rifts from appearing).')
  ] },
  { d: '2026-10-17', title: T('Bigger health cards and buffs'), chg: [
    T('Your health card, your active buffs and your teammates\' cards are larger and easier to read (a bit less on small screens so they do not cover the timer).')
  ] },
  { d: '2026-10-17', title: T('Your own health card'), chg: [
    T('Your name, level and health now use the same card style as your teammates, with the icon of your Pokémon in a framed box, your HP numbers and a health bar.')
  ] },
  { d: '2026-10-17', title: T('Who is choosing?'), chg: [
    T('When a teammate is choosing a Bond (or an item) and the game is paused for everyone, a pink notice at the top of the screen now says who is choosing, instead of just leaving the screen tinted.')
  ] },
  { d: '2026-10-17', title: T('Partner changes sync in rooms'), fix: [
    T('Fixed a bug where changing your partner Pokémon (or its shiny version) while in a room sometimes did not update for the other players, who kept seeing your previous partner. It now updates right away and corrects itself if it ever gets out of sync.')
  ] },
  { d: '2026-10-17', title: T('Safer friend removal'), chg: [
    T('Removing a friend now takes two taps: "Remove" turns into "Sure? Tap again" for a few seconds, and the button sits further away from "Invite" so it is harder to hit by mistake.')
  ] },
  { d: '2026-10-17', title: T('Revive protection'), chg: [
    T('A revived player now gets 3 seconds of invulnerability and 4 seconds of +50% movement speed, so they are not instantly downed again.')
  ] },
  { d: '2026-10-17', title: T('New party list'), chg: [
    T('Each teammate now has their own card in the top left with the icon of the Pokémon they are playing, their name, their HP numbers and a health bar, spaced out and stacked downwards as more players join.')
  ] },
  { d: '2026-10-17', title: T('Buff icons and a bigger HUD'), chg: [
    T('Buffs now show an icon next to their text (attack, speed, defense, regeneration and the shrine powers) and wrap onto a new row instead of overlapping.'),
    T('The top-left HUD (health, teammates\' health and buffs) is a bit bigger.')
  ] },
  { d: '2026-10-17', title: T('Chests are targeted first'), chg: [
    T('Breakable chests within range of your active move are now targeted before enemies, so you no longer have to stand between a Pokémon and the chest to break it.')
  ] },
  { d: '2026-10-17', title: T('Safer rift exits'), chg: [
    T('Leaving a rift now puts every player together at the rift\'s exit, wherever they were before.'),
    T('Everyone also gets 3 seconds of immunity so nobody is hit the moment they come back.')
  ] },
  { d: '2026-10-17', title: T('Life Orb choice'), chg: [
    T('When you find the Life Orb and are not holding an item, you now choose whether to take it or discard it instead of it being equipped automatically.')
  ] },
  { d: '2026-10-17', title: T('Moves no longer switch by themselves'), chg: [
    T('When you learn a new move, the game no longer switches to it automatically: you keep the move you had selected.')
  ] },
  { d: '2026-10-17', title: T('Room invites mid-run'), fix: [
    T('If you accept a room invite in the middle of a run, the game now asks whether you want to leave the run first, and only then do you join the room.')
  ] },
  { d: '2026-10-17', title: T('More English text'), fix: [
    T('The end-of-run screen no longer shows "recogidas" and "Shinies conseguidos" in Spanish.'),
    T('"Choose as partner", "View profile", "Search by name", the partners\' personality traits, the "/ month" price and the Gmail account-recovery help now display in English.'),
    T('Shiny Pokémon messages (a wild one appears, one is waiting in the rift) and the list of players still choosing a card now read correctly.')
  ] },
  { d: '2026-10-17', title: T('Move with the mouse'), new: [
    T('You can now move with the mouse: hold the left button and drag, and a joystick appears where you press. You can turn it off in Settings > Controls.'),
    T('New "Locked mouse joystick" setting: the joystick stays where you pressed and does not follow you when you drag far. Let go and press again to place it somewhere else.')
  ] },
  { d: '2026-10-16', title: ['Códigos canjeables y nombres', 'Redeem codes and names'], new: [
    ['Nueva pestaña "Código" en Ajustes: escribe un código para ganar tickets o monedas. Cada código se puede canjear una vez por cuenta.',
     'New "Code" tab in Settings: enter a code to win tickets or coins. Each code can be redeemed once per account.']
  ], chg: [
    ['Los Pokémon que todavía tenían el nombre en español (como Colmilargo o Ferropúas) ahora usan su nombre en inglés.',
     'The Pokémon that still had Spanish names (such as Great Tusk and Iron Thorns) now use their English names.'],
    ['El texto bajo el título ahora dice "Five Nights at the Chinese Parliament".',
     'The text under the title now reads "Five Nights at the Chinese Parliament".']
  ] }
];
})();
