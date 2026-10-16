/* ============ changelog.js — novedades del juego ============
 * Lo que ve la gente en el botón "Novedades" de la barra de arriba: cambios
 * de juego y fallos arreglados (nada de servidores ni bases de datos).
 * La fecha más nueva, arriba. En cada fecha, por apartados:
 *   new  lo nuevo · chg  cambios y ajustes · fix  fallos arreglados
 * Cada línea en español y en inglés.
 */
G.CHANGELOG = [
  { d: '2026-10-17', title: ['Mover con el ratón', 'Move with the mouse'], new: [
    ['Ahora puedes moverte con el ratón: mantén pulsado el botón izquierdo y arrastra, y aparece un joystick donde pulsas. Se puede quitar en Ajustes > Controles.',
     'You can now move with the mouse: hold the left button and drag, and a joystick appears where you press. You can turn it off in Settings > Controls.'],
    ['Nuevo ajuste "Joystick del ratón fijo": el joystick se queda donde pulsaste y no te sigue al arrastrar lejos. Suelta y vuelve a pulsar para colocarlo en otro sitio.',
     'New "Locked mouse joystick" setting: the joystick stays where you pressed and does not follow you when you drag far. Let go and press again to place it somewhere else.']
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
