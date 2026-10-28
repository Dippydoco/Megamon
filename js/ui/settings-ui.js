/* ============ settings-ui.js — Settings screen (PC and mobile) ============
 * Opens on top of whatever is there (menu or pause) and goes back there on closing.
 * Tabs: Sound · Graphics · Controls · Account · About.
 * Settings belong to this device (G.Settings / G.Audio in the browser).
 */
G.SettingsUI = (() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VERSION = '1.2 · 2026-10-09';
  const REPO = 'https://github.com/Dippydoco/Megamon';
  let tab = 'sound';

  function init() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => { b.onclick = () => { tab = b.dataset.t; render(); }; });
    $('set-close').onclick = close;
    $('btn-settings').innerHTML = G.Icons.html('gear', 20);
    $('btn-settings').onclick = () => open();
    $('btn-pause-settings').onclick = () => open('sound');
    // Full screen (if the browser allows it; on iPhone, how to get it).
    if (canFull() || iosTip()) {
      $('btn-full').classList.remove('hidden');
      $('btn-full').innerHTML = G.Icons.html('full', 20);
      $('btn-full').onclick = toggleFull;
    }
  }

  function open(t) {
    if (t) tab = t;
    $('scr-settings').classList.remove('hidden');
    render();
  }
  function close() { $('scr-settings').classList.add('hidden'); }
  const isOpen = () => !$('scr-settings').classList.contains('hidden');

  // ---------------- full screen ----------------
  function canFull() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  // iPhone: Safari doesn't let a website go full screen (that's why the option
  // sometimes didn't appear). It can be done by opening it from the home screen.
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => !!navigator.standalone || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
  function iosTip() { return IOS && !canFull() && !standalone(); }
  // Links opened from Discord, Instagram, Messenger... open in a mini browser with no "Add to Home Screen": it has to be Safari.
  const UA = navigator.userAgent;
  const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Discord|Snapchat|TikTok|Twitter|WhatsApp|GSA\/|MicroMessenger/i.test(UA) || (IOS && !/Safari\//.test(UA));
  const IOS_TIP = IN_APP
    ? 'This page is open inside another app, which can\'t go fullscreen or add it to your home screen. Open it in Safari first (the compass or "Open in Safari" button, or the ⋯ menu).'
    : 'On iPhone, Safari does not let websites go fullscreen. In Safari tap Share (the square with an arrow; on newer iOS it may be under the ⋯ menu), scroll down and tap "Add to Home Screen", then open the game from that icon: it plays fullscreen.';
  function toggleFull() {
    if (!canFull()) { if (iosTip()) G.UI.toast(IOS_TIP, 9000); return; }
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      const el = document.documentElement;
      const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      // On mobile, it also tries to lock the screen to landscape.
      if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nothing */ } }).catch(() => {});
    }
    setTimeout(() => { if (isOpen()) render(); }, 300);
  }

  // ---------------- building blocks ----------------
  function section(title, sub) { return `<h3 class="set-h">${esc(title)}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}`; }
  function toggle(key, label, desc) {
    const on = !!G.Settings.get(key);
    return `<div class="set-row"><div class="grow"><b>${esc(label)}</b><small>${esc(desc)}</small></div>
      <button class="btn small switch ${on ? 'gold' : ''}" data-k="${key}">${on ? 'Yes' : 'No'}</button></div>`;
  }
  function choice(key, opts) {
    const cur = G.Settings.get(key);
    return `<div class="chips set-chips">${opts.map(([v, l]) => `<button class="chip ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  }

  function render() {
    document.querySelectorAll('#set-tabs .gen-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('set-body');
    box.scrollTop = 0;
    if (tab === 'sound') {
      box.innerHTML = section('Sound') + '<div id="set-sound" class="sound-inline"></div>';
      G.UI.soundControls($('set-sound'));
    } else if (tab === 'gfx') {
      const auto = ['low', 'medium', 'high'][G.Settings.autoLevel];
      box.innerHTML = section('Quality', 'How many effects and particles are drawn. <b>Auto</b> lowers it automatically if the game stutters (now: ' + auto + ').')
        + choice('quality', [['auto', 'Auto'], ['high', 'High'], ['mid', 'Medium'], ['low', 'Low']])
        + section('Display')
        + toggle('dmgNumbers', 'Damage numbers', 'The numbers that pop up when you hit or get hit.')
        + `<div class="set-row"><div class="grow"><b>Damage number size</b><small>How big the numbers are when you hit enemies.</small></div></div>`
        + choice('dmgSize', [[0.8, 'Small'], [1, 'Normal'], [1.35, 'Large']])
        + `<div class="set-row"><div class="grow"><b>Which hits show a number</b><small>"Important only" hides the small hits and keeps critical, super effective and boss hits (and the damage you take).</small></div></div>`
        + choice('dmgShow', [['all', 'All hits'], ['big', 'Important only']])
        + `<div class="set-row"><div class="grow"><b>Damage number colours</b><small>Colours show how effective a hit was. "White" keeps every number plain.</small></div></div>`
        + choice('dmgColor', [['type', 'Coloured'], ['white', 'White']])
        + toggle('calm', 'Less shaking and flashing', 'The camera shakes less and flashes are softer.')
        + toggle('moveTags', 'Move kind tags', 'Shows the attack kind (Projectile, Beam, Aura...) on level-up and Bond cards.')
        + toggle('fps', 'Show FPS', 'Frames per second, in the bottom corner.')
        + (canFull() ? `<div class="set-row"><div class="grow"><b>Full screen</b><small>No browser bars.</small></div>
             <button class="btn small" id="set-full">${isFull() ? 'Exit' : 'Turn on'}</button></div>`
           : iosTip() ? `<div class="set-row"><div class="grow"><b>Full screen</b><small>${esc(IOS_TIP)}</small></div></div>` : '');
    } else if (tab === 'ctl') {
      box.innerHTML = section('On mobile or tablet')
        + `<p class="sub">Put your finger anywhere and drag to move: the joystick appears where you touch. Tap an attack at the bottom to switch to it and the button at the top right to pause. To change which slot an attack is in, pause and use Arrange moves. The game is played in landscape.</p>`
        + `<div class="set-row"><div class="grow"><b>Joystick size</b><small>How far you have to drag your finger.</small></div></div>`
        + choice('stick', [[0.8, 'Small'], [1, 'Normal'], [1.25, 'Large']])
        + `<div class="set-row"><div class="grow"><b>Place the buttons</b><small>Put the attacks, pause and joystick (fixed, if you like) anywhere on the screen.</small></div>
             <button class="btn small" id="set-layout">Place</button></div>`
        + section('On PC')
        + toggle('mouseStick', 'Move with the mouse', 'Hold the left mouse button and drag: a joystick appears where you press. Let go to stop.')
        + toggle('mouseLock', 'Locked mouse joystick', 'The joystick stays where you pressed and does not follow you when you drag far. Let go and press again to place it somewhere else.')
        + `<div class="keys">
             <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows</div><span>move</span>
             <div><kbd>1</kbd>–<kbd>4</kbd> or click the icon</div><span>choose attack</span>
             <div><kbd>Q</kbd> / <kbd>E</kbd></div><span>previous / next attack</span>
             <div><kbd>Space</kbd> or <kbd>F</kbd></div><span>fire a ready Burst move without switching to it</span>
             <div>Drag an attack icon onto another</div><span>swap their slots (also in the pause menu)</span>
             <div><kbd>Esc</kbd> or <kbd>P</kbd></div><span>pause</span>
             <div><kbd>1</kbd>–<kbd>3</kbd></div><span>choose a card when levelling up</span>
           </div>`;
    } else if (tab === 'acc') {
      renderAccount(box);
    } else if (tab === 'code') {
      renderCode(box);
    } else {
      box.innerHTML = `<div class="about-logo">Megamon</div><p class="sub center">Version ${esc(VERSION)} · ${esc(G.UI.buildLabel())}</p>`
        + `<p class="sub">Fan game <b>free and non-profit</b>: no ads or purchases. Pokémon and its characters are owned by Nintendo, Creatures and GAME FREAK; this project is not affiliated with them.</p>`
        + section('Credits')
        + `<ul class="credits">
             <li><b>Sprites:</b> PMD SpriteCollab and its artists (CC BY-NC 4.0).</li>
             <li><b>Pokémon data:</b> PokéAPI.</li>
             <li><b>Music and sounds:</b> original, generated by the game itself.</li>
             <li><b>Font:</b> m6x11 by Daniel Linssen (free to use with credit), with Pixelify Sans (OFL) as a fallback.</li>
             <li><b>Type letters:</b> from <a href="https://www.deviantart.com/slevanas/art/Bigger-Pokemon-type-icons-and-font-501606704" target="_blank" rel="noopener">Bigger Pokemon type icons and font</a> by Slevanas.</li>
           </ul>`
        + `<div class="row wrap" style="justify-content:center;gap:8px">
             ${window.PS_PAGES ? `<a class="btn small" href="en/guide/" target="_blank">Guide and FAQ</a>
             <a class="btn small" href="en/pokedex/" target="_blank">Pokédex</a>` : ''}
             <button class="btn small" data-legal>Legal notice and privacy</button>
             <a class="btn small" href="${REPO}" target="_blank" rel="noopener">Code (GitHub)</a>
           </div>`;
    }
    wire(box);
  }

  /** Redeem a code (js/systems/redeem.js): tickets and/or coins, once per account. */
  function renderCode(box) {
    if (G.DB.guest) {
      box.innerHTML = section('Code', 'As a <b>guest</b> your progress is not saved, so codes cannot be redeemed. Create an account or sign in.')
        + `<button class="btn gold" id="set-login">Create an account or sign in</button>`;
      return;
    }
    box.innerHTML = section('Code', 'Enter a code to redeem it. Each code can be used once per account.')
      + `<div class="row wrap" style="gap:8px;align-items:center">
           <input class="field" id="code-in" type="text" maxlength="40" placeholder="Code" autocomplete="off" autocapitalize="characters" spellcheck="false" style="flex:1;min-width:180px">
           <button class="btn gold" id="code-go">Redeem</button>
         </div><p class="note" id="code-msg"></p>`;
    const input = $('code-in'), msg = $('code-msg');
    const go = () => {
      const r = G.Redeem.redeem(input.value);
      if (!r.ok) { G.Audio.sfx('error'); msg.textContent = r.error; return; }
      G.Audio.sfx('confirm');
      input.value = '';
      if (r.demo !== undefined) {
        const t = r.demo ? 'Gacha demo mode is ON: pulls cost nothing and nothing is saved. Enter the code again to turn it off.' : 'Gacha demo mode is OFF.';
        msg.textContent = t; G.UI.toast(r.demo ? 'Gacha demo mode ON' : 'Gacha demo mode OFF');
        return;
      }
      msg.innerHTML = 'Redeemed! You received: ' + G.Progress.rewardText(r.reward);
      G.UI.toast('Code redeemed!');
    };
    $('code-go').onclick = go;
    input.onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  function renderAccount(box) {
    const st = G.DB.guest ? 'guest' : G.DB.syncState;
    const SYNC = { ok: 'Saved in the cloud', syncing: 'Saving…', pending: 'Waiting to upload (uploads when you leave the game)',
                   offline: 'Offline: it will upload when you\'re back', local: 'Saved only in this browser', guest: 'Guest: not saved' };
    if (G.DB.guest) {
      box.innerHTML = section('Account', 'You\'re playing as a <b>guest</b>: your progress isn\'t saved when you leave.')
        + `<button class="btn gold" id="set-login">Create an account or sign in</button>`;
      return;
    }
    const nick = G.Social.me ? G.Social.me.name : (G.DB.user || '');
    const canRename = G.DB.mode === 'cloud' && !!G.Social.me;
    const kind = G.DB.mode === 'local' ? 'This browser\'s account' : G.DB.nameAccount ? 'Name and password' : 'Google';
    box.innerHTML = section('Account')
      + `<div class="set-row"><div class="grow"><b>Nickname</b><small>It's unique. ${canRename ? 'Friends see the new one too.' : 'It can only be changed on a cloud account.'}</small></div><span class="gold" translate="no">${esc(nick)}</span>${nick ? '<button class="btn small" id="set-nick-copy" type="button">Copy</button>' : ''}${canRename ? '<button class="btn small" id="set-nick">Change</button>' : ''}</div>
         <form id="set-nick-form" class="row wrap hidden" style="gap:8px;margin:4px 0 8px"><input class="field" id="set-nick-in" maxlength="32" autocomplete="off" placeholder="New nickname (3-16 letters, numbers, _ or emoji)" translate="no"><button class="btn gold small" type="submit">Save</button><button class="btn ghost small" type="button" id="set-nick-x">Cancel</button></form>
         <p class="note" id="set-nick-err"></p>`
      + `<div class="set-row"><div class="grow"><b>Account type</b></div><span>${esc(kind)}</span></div>`
      + `<div class="set-row"><div class="grow"><b>Save</b></div><span>${esc(SYNC[st] || st)}</span></div>`
      + toggle('shareHist', 'Share my run history', 'Other players can open your last runs from your profile, and shared runs help us balance the game (averages only). Off: your shared copy is deleted and nobody can see them.')
      + toggle('shareAct', 'Show what I\'m doing', 'Friends can see if you are in the menu, opening gacha packs or in a run (and for how long). Off: they only see that you are online.')
      + `<div class="row wrap" style="gap:8px;margin-top:12px">
           <button class="btn" id="set-logout">Log out</button>
           <button class="btn danger" id="set-delete">Delete account</button>
         </div><p class="note" id="set-msg"></p>`;
  }

  function wire(box) {
    box.querySelectorAll('.switch[data-k]').forEach(b => { b.onclick = () => { G.Settings.set(b.dataset.k, !G.Settings.get(b.dataset.k)); render(); }; });
    box.querySelectorAll('.chip[data-k]').forEach(b => {
      b.onclick = () => { const v = b.dataset.v; G.Settings.set(b.dataset.k, isNaN(+v) ? v : +v); render(); };
    });
    const full = $('set-full'); if (full) full.onclick = toggleFull;
    if ($('set-nick-copy')) $('set-nick-copy').onclick = () => G.UI.copyText(nick, 'Nickname copied');
    const nb = $('set-nick');
    if (nb) {
      const form = $('set-nick-form'), inp = $('set-nick-in'), err = $('set-nick-err');
      nb.onclick = () => { form.classList.remove('hidden'); nb.classList.add('hidden'); inp.value = ''; inp.focus(); };
      $('set-nick-x').onclick = () => { form.classList.add('hidden'); nb.classList.remove('hidden'); err.textContent = ''; };
      form.onsubmit = async e => {
        e.preventDefault();
        err.textContent = '';
        const v = inp.value.trim();
        if (G.Social.me && v === G.Social.me.name) { err.textContent = 'That is already your nickname.'; return; }
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        const r = await G.Social.claimNick(v);
        btn.disabled = false;
        if (!r.ok) { err.textContent = r.error; G.Audio.sfx('error'); return; }
        G.Audio.sfx('confirm');
        G.UI.toast('Your nickname is now ' + G.Social.me.name);
        render();
      };
    }
    const lay = $('set-layout'); if (lay) lay.onclick = () => G.LayoutUI.open();
    const lo = $('set-login'); if (lo) lo.onclick = () => { close(); leave(); };
    const out = $('set-logout'); if (out) out.onclick = () => { close(); leave(); };
    const del = $('set-delete');
    if (del) del.onclick = async () => {
      const ok = await G.UI.confirmDelete();
      if (!ok) return;
      del.disabled = true;
      const r = await G.DB.deleteAccount(ok.pass);
      if (!r.ok) { $('set-msg').textContent = r.error; del.disabled = false; return; }
      close();
      G.UI.toast('Account deleted');
      G.Audio.music(null);
      G.Flow.toLogin();
    };
  }

  /** Sign out (if you're in a run, it's abandoned). */
  function leave() {
    if (G.DB.guest && !confirm('You\'re a guest: all your progress will be lost. Log out?')) return;
    if (G.Game.state !== 'ui') G.Game.quit && G.Game.quit();
    G.Audio.music(null);
    G.DB.logout().then(() => G.Flow.toLogin());
  }

  return { init, open, close, get isOpen() { return isOpen(); } };
})();
