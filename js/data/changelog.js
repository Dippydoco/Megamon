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
