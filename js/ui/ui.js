/* ============ ui.js — shared interface utilities ============
 * - Showing / hiding screens.
 * - Animated PMD sprites inside DOM <canvas> elements (menu, collection,
 *   gacha...). They're registered here and the main loop animates them with tick().
 * - Interface sounds (by delegation: any button plays on its own).
 * - Sound panel, notices (toast), coins, type chips, stars.
 */
G.UI = (() => {
  const $ = id => document.getElementById(id);
  const SCREENS = ['scr-login', 'scr-test', 'scr-result', 'scr-starters', 'scr-menu',
                   'scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-levelup', 'scr-pause', 'scr-over',
                   'scr-nick', 'scr-friends', 'scr-lobby', 'scr-rank', 'scr-item', 'scr-goals', 'scr-bond', 'scr-mod', 'scr-random', 'scr-chat', 'scr-codex',
                   'scr-mini', 'scr-gbattle', 'scr-draft', 'scr-shop', 'scr-kipick', 'scr-tower', 'scr-tbadge', 'scr-moveset'];

  function show(id, keepMenu = false) {
    for (const s of SCREENS) if (s !== id && !(keepMenu && s === 'scr-menu')) $(s).classList.add('hidden');
    $(id).classList.remove('hidden');
    // Opening any screen (pause, level-up, menus) drops held keys and the joystick, so movement can't get stuck.
    if (G.Input) G.Input.reset();
    if (G.Touch && G.Touch.reset) G.Touch.reset();
  }
  function hide(id) { $(id).classList.add('hidden'); }
  function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); }
  function isOpen(id) { return !$(id).classList.contains('hidden'); }

  /** Top bar (coins, user, sound) only outside runs. */
  function chrome(on) {
    $('topbar').classList.toggle('hidden', !on);
    $('credits-line').classList.toggle('hidden', !on);
    $('ver-tag').classList.toggle('hidden', !on);
    if (!on) $('sound-panel').classList.add('hidden');
    if (on) refreshCoins();
    if (on && popPending) { const n = popPending; popPending = 0; setTimeout(() => coinPopNow(n), 350); }
  }

  /**
   * Coin pop (28-10-2026): the PokéCoins a run earned float up from the wallet when you're back on the menu, and the
   * number counts up to the new total. coinPop(n) is called at the end of a run, while the top bar is still hidden.
   */
  let popPending = 0;
  function coinPop(n) { if (n > 0) popPending += n; }
  function coinPopNow(n) {
    const el = $('coins'), s = G.DB.save;
    if (!el || !s || $('topbar').classList.contains('hidden')) return;
    const to = s.coins, from = Math.max(0, to - n), t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString('en');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
    const r = el.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'coin-pop';
    p.innerHTML = '<span class="coin"></span>+' + n.toLocaleString('en');
    p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.bottom + 4) + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1600);
    if (G.Audio) G.Audio.sfx('coin');
  }

  function refreshCoins() {
    const s = G.DB.save;
    $('coins').textContent = s ? s.coins.toLocaleString('en') : '0';
    const t = (s && s.tickets) || { t1: 0, t10: 0 };
    $('tickets-pill').innerHTML = `${G.Icons.html('ticket', 18)} ${t.t1} &nbsp;${G.Icons.html('ticket10', 18)} ${t.t10}`;
    $('stars-pill').innerHTML = `${G.Icons.html('star', 18)} ${G.DB.stars ? G.DB.stars() : 0}`;
    $('bp-pill').innerHTML = `${G.Icons.html('bp', 18)} ${(s && s.tower && s.tower.bp) || 0}`;      // Battle Tower points
    // Sync dot: green = saved in the cloud, yellow = saving,
    // red = offline (saved locally and uploaded when back).
    const st = G.DB.guest ? 'guest' : G.DB.syncState;
    const TIP = { ok: 'Saved in the cloud', syncing: 'Saving…', pending: 'Saving…',
                  offline: 'Offline: it will upload when you\'re back', local: 'Saved only in this browser', guest: 'Guest: not saved' };
    $('user-pill').innerHTML = G.Icons.html(G.DB.guest ? 'user' : 'crown', 18) + ' <span translate="no">' + (G.DB.guest ? 'Guest' : (G.DB.user || '')) + '</span>' +
      `<i class="sync ${st}" title="${TIP[st] || ''}"></i>`;
    $('user-pill').title = TIP[st] || '';
  }

  let toastEl = null, toastT = 0;
  /** Copies text (a nickname with emoji, say) to the clipboard, with a fallback for older browsers. */
  async function copyText(text, msg = 'Copied') {
    try { await navigator.clipboard.writeText(text); toast(msg, 1400); return; } catch (e) { /* fallback below */ }
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* nothing */ }
    t.remove();
    toast(ok ? msg : 'Couldn\'t copy: ' + text, ok ? 1400 : 3500);
  }

  function toast(msg, ms = 2200) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.style.display = 'none'; }, ms);
  }

  function typeChips(types) {
    return types.map(t => `<span class="type" style="background:${G.U.TYPE_COLOR[t]}">${G.U.TYPE_NAME[t]}</span>`).join('');
  }

  /** Rarity: its matching Poké Ball (see G.Icons.rarity). */
  function stars(n, size = 12) { return G.Icons.rarity(n, size > 16 ? 24 : 12); }

  // ---------------- interface sound ----------------

  const CLICKABLE = '.btn, .menu-item, .tab, .chip, .card, .cell:not(.locked), .answer, .gen-tab';
  let lastHover = null;

  function wireSounds() {
    document.addEventListener('pointerover', e => {
      const el = e.target.closest(CLICKABLE);
      if (el && el !== lastHover && !el.disabled) G.Audio.sfx('hover');
      lastHover = el;
    });
    document.addEventListener('click', e => {
      const el = e.target.closest(CLICKABLE);
      if (!el) return;
      if (el.disabled) { G.Audio.sfx('error'); return; }
      // Buttons with their own sound (buy, pull, choose...) play it themselves.
      if (el.dataset.sfx === 'none') return;
      G.Audio.sfx(el.matches('[data-back]') ? 'back' : el.dataset.sfx || 'click');
    }, true);
  }

  /** Volume controls (used in the top bar and in the pause menu). */
  function soundControls(box) {
    const st = G.Audio.settings;
    box.innerHTML = `
      <div class="snd-row">${G.Icons.html('sound', 18)}<span>Music</span>
        <input type="range" min="0" max="100" value="${Math.round(st.music * 100)}" data-k="music"></div>
      <div class="snd-row">${G.Icons.html('sound', 18)}<span>Effects</span>
        <input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" data-k="sfx"></div>
      <button class="btn small ${st.muted ? 'gold' : ''}" data-mute>${st.muted ? 'Unmute' : 'Mute all'}</button>`;
    box.querySelectorAll('input[type=range]').forEach(r => {
      r.oninput = () => G.Audio.setVolume(r.dataset.k, r.value / 100);
      r.onchange = () => G.Audio.sfx('click');
    });
    box.querySelector('[data-mute]').onclick = () => { G.Audio.toggleMute(); soundControls(box); refreshSoundIcon(); };
  }

  function refreshSoundIcon() {
    $('btn-sound').innerHTML = G.Icons.html(G.Audio.settings.muted ? 'mute' : 'sound', 20);
  }

  // ---------------- legal notice ----------------

  const CONTACT = 'jpieratorregrosa@gmail.com';
  const REPO = 'https://github.com/Dippydoco/Megamon';
  let legalBack = null;

  function openLegal() {
    legalBack = SCREENS.find(s => isOpen(s)) || null;
    $('legal-mail').textContent = CONTACT;
    $('legal-mail').href = 'mailto:' + CONTACT + '?subject=Pok%C3%A9Survivor';
    $('legal-repo').textContent = REPO.replace('https://', '');
    $('legal-repo').href = REPO;
    const canDelete = G.DB.loggedIn && !G.DB.guest;
    $('legal-delete').disabled = !canDelete;
    $('legal-del-msg').textContent = canDelete ? '' : 'Log in to be able to delete your account.';
    $('scr-legal').classList.remove('hidden');
  }

  /**
   * "Are you sure you want to delete the account?". Name and password
   * accounts type their password (Firebase asks to confirm who you are);
   * Google ones confirm it in Google's window when continuing.
   * Returns { pass } or null if cancelled.
   */
  function confirmDelete() {
    if (!G.DB.nameAccount) return Promise.resolve(confirm('Your account and all your progress will be deleted forever. Are you sure?') ? { pass: '' } : null);
    return new Promise(done => {
      const el = document.createElement('section');
      el.className = 'scr dim';
      el.style.zIndex = 70;
      el.innerHTML = `<div class="box center" style="max-width:380px">
        <h3>Delete account</h3>
        <p class="sub">Your account and all your progress will be deleted forever. To confirm, type your password.</p>
        <input class="field" type="password" maxlength="64" autocomplete="current-password" style="width:100%">
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn ghost" data-a="no">Cancel</button>
          <button class="btn danger" data-a="yes">Delete forever</button>
        </div></div>`;
      document.body.appendChild(el);
      const inp = el.querySelector('input');
      const end = v => { el.remove(); done(v); };
      el.querySelector('[data-a=no]').onclick = () => end(null);
      el.querySelector('[data-a=yes]').onclick = () => { if (inp.value) end({ pass: inp.value }); else inp.focus(); };
      inp.onkeydown = e => { if (e.key === 'Enter' && inp.value) end({ pass: inp.value }); if (e.key === 'Escape') end(null); };
      setTimeout(() => inp.focus(), 50);
    });
  }

  /** In-game yes/no prompt (instead of the browser's confirm). → Promise<boolean>; html is trusted markup. */
  function ask(title, html, yes = 'Confirm', no = 'Cancel') {
    return new Promise(done => {
      const el = document.createElement('section');
      el.className = 'scr dim';
      el.style.zIndex = 70;
      el.innerHTML = `<div class="box center" style="max-width:400px">
        <h3>${title}</h3>
        <p class="sub" style="margin:10px 0 16px">${html}</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn ghost" data-a="no">${no}</button>
          <button class="btn gold" data-a="yes">${yes}</button>
        </div></div>`;
      document.body.appendChild(el);
      const end = v => { document.removeEventListener('keydown', key, true); el.remove(); done(v); };
      const key = e => {
        if (e.key === 'Escape') { e.stopPropagation(); end(false); }
        else if (e.key === 'Enter') { e.stopPropagation(); end(true); }
      };
      document.addEventListener('keydown', key, true);
      el.querySelector('[data-a=no]').onclick = () => end(false);
      el.querySelector('[data-a=yes]').onclick = () => end(true);
    });
  }

  function closeLegal() { $('scr-legal').classList.add('hidden'); }

  function wireLegal() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-legal]')) { e.preventDefault(); openLegal(); }
    });
    $('legal-close').onclick = closeLegal;
    $('legal-delete').onclick = async () => {
      const ok = await confirmDelete();
      if (!ok) return;
      $('legal-delete').disabled = true;
      const r = await G.DB.deleteAccount(ok.pass);
      if (!r.ok) { $('legal-del-msg').textContent = r.error; $('legal-delete').disabled = false; return; }
      closeLegal();
      toast('Account deleted');
      G.Audio.music(null);
      G.Flow.toLogin();
    };
  }

  /** The build the page is running (hash from tools/build.js; same as version.json) and its date. */
  function buildLabel() {
    const b = window.PS_BUILD;
    if (!b) return 'dev build';
    const d = new Date(b.at);
    const when = isNaN(d) ? '' : ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return 'Build ' + b.v + when;
  }

  function initChrome() {
    $('ver-tag').textContent = buildLabel();
    G.Icons.installCss();
    wireLegal();
    G.DB.onSync(() => { if (!$('topbar').classList.contains('hidden')) refreshCoins(); });
    wireSounds();
    refreshSoundIcon();
    $('btn-sound').onclick = () => {
      const p = $('sound-panel');
      p.classList.toggle('hidden');
      if (!p.classList.contains('hidden')) soundControls(p);
    };
  }

  // ---------------- sprites in DOM canvases ----------------

  const live = new Set();
  // Only visible canvases are animated (the collection has hundreds).
  const seen = new WeakMap();
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting)), { rootMargin: '80px' })
    : null;

  /**
   * Animates a Pokémon inside a <canvas>.
   * opts: { anim='Idle', dir=0, shiny, silhouette, lively (attacks every
   *         so often), spin (keeps turning), shadow=true,
   *         scale=2   FIXED pixel size (×2 as in the game): all the
   *                   Pokémon in a view come out with the same pixel, even if
   *                   the giant ones don't fit whole
   *         hero      single-Pokémon view: it can reduce the scale so
   *                   it fits, because there's nothing to compare it with there }
   */
  function sprite(cv, dex, opts = {}) {
    for (const s of live) if (s.cv === cv) live.delete(s);
    const a = new G.Sprites.Animator(dex, 1, !!opts.shiny);
    a.dir = opts.dir || 0;
    a.loop(opts.anim || 'Idle');
    const s = { cv, ctx: cv.getContext('2d'), a, dex, opts, t: Math.random() * 3, spinT: 0, sparkT: 0 };
    live.add(s);
    if (io) io.observe(cv);
    return s;
  }

  // ---- Your partner in the menu box (28-10-2026, opts.partner) ----
  // Instead of only attacking now and then, it hops, spins, nods, eats, sits, poses... (whatever its sprite has:
  // tools/fetch_anims.py). With no input for a while it falls asleep with z's drifting up; any input wakes it, and
  // poke() (a tap on it) makes it react straight away.
  const NAP_AFTER = 40;
  let lastInput = performance.now();
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true, capture: true });
  addEventListener('pointermove', () => { lastInput = performance.now(); }, { passive: true });
  const MOODS = [['Attack', 1], ['Shoot', 1], ['Charge', 1], ['Hop', 2.5], ['Rotate', 1.2], ['Nod', 2], ['Eat', 2], ['LookUp', 2],
                 ['Sit', 1.5], ['Pose', 2], ['Twirl', 2], ['Appeal', 2], ['Dance', 2]];
  function canDo(s, name) {
    const m = G.Sprites.meta(s.dex);
    return !!(m && m.a[name] && !(s.a.shiny && m.sm && m.sm.includes(name)));
  }
  function partnerMood(s) {
    const opts = MOODS.filter(([n]) => canDo(s, n));
    let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
    for (const [n, w] of opts) { r -= w; if (r <= 0) return n; }
    return 'Attack';
  }
  function partnerTick(s, dt) {
    const idle = (performance.now() - lastInput) / 1000;
    if (s.asleep) {
      if (idle < 1) { s.asleep = false; s.a.loop('Idle'); s.a.play(canDo(s, 'Hop') ? 'Hop' : 'Idle'); s.t = G.U.rand(2, 3.5); }
      return;
    }
    if (idle > NAP_AFTER && canDo(s, 'Sleep')) { s.asleep = true; s.a.dir = 0; s.a.loop('Sleep'); s.zs = []; s.zT = 0.8; return; }
    s.t -= dt;
    if (s.t <= 0 && !s.a.busy()) { s.t = G.U.rand(3, 6); s.a.play(partnerMood(s)); }
  }
  /** A tap on your partner: it reacts at once (and wakes up). */
  function poke(cv) {
    for (const s of live) if (s.cv === cv && s.opts.partner) {
      lastInput = performance.now();
      if (s.asleep) { s.asleep = false; s.a.loop('Idle'); }
      s.a.play(G.U.pick(['Hop', 'Rotate', 'Pose', 'Appeal', 'Twirl'].filter(n => canDo(s, n))) || 'Attack');
      s.t = G.U.rand(3, 5);
    }
  }
  function drawZs(s, ctx, fx, fy, ay, k, dt) {
    s.zT -= dt;
    if (s.zT <= 0) { s.zT = G.U.rand(0.9, 1.4); s.zs.push({ t: 0, x: G.U.rand(4, 10), big: Math.random() < 0.5 }); }
    ctx.save();
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (let i = s.zs.length - 1; i >= 0; i--) {
      const z = s.zs[i];
      z.t += dt;
      if (z.t > 2.2) { s.zs.splice(i, 1); continue; }
      const px = Math.max(8, Math.round((z.big ? 7 : 5) * k));
      ctx.font = '800 ' + px + 'px Pixelify,"Segoe UI",sans-serif';
      ctx.globalAlpha = z.t < 1.6 ? 1 : (2.2 - z.t) / 0.6;
      const x = fx + (z.x + Math.sin(z.t * 3) * 2) * k, y = fy - ay * k * 0.55 - z.t * 9 * k;
      ctx.lineWidth = Math.max(2, k); ctx.strokeStyle = 'rgba(10,14,30,.8)'; ctx.strokeText(z.big ? 'Z' : 'z', x, y);
      ctx.fillStyle = '#d8e6ff'; ctx.fillText(z.big ? 'Z' : 'z', x, y);
    }
    ctx.restore();
  }

  function tick(dt) {
    for (const s of live) {
      if (!s.cv.isConnected) { live.delete(s); if (io) io.unobserve(s.cv); continue; }
      if (s.cv.offsetParent === null) continue;            // hidden screen
      if (io && seen.get(s.cv) === false) continue;         // out of view
      s.a.update(dt);

      if (s.opts.partner) partnerTick(s, dt);
      else if (s.opts.lively) {
        s.t -= dt;
        if (s.t <= 0) { s.t = G.U.rand(2.5, 4.5); s.a.play(G.U.pick(['Attack', 'Shoot', 'Charge'])); }
      }
      if (s.opts.spin) {
        s.spinT += dt;
        if (s.spinT > 1.4) { s.spinT = 0; s.a.dir = (s.a.dir + 7) % 8; }
      }

      const { cv, ctx } = s;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;

      // Integer scale so the pixels stay crisp.
      const m = G.Sprites.animMeta(s.dex, 'Idle');
      const ay = m ? m.ay : 24;
      let k = s.opts.scale || 2;
      if (s.opts.hero) k = Math.max(1, Math.min(k, Math.floor(cv.height * 0.8 / ay)));
      s.a.scale = k / G.Sprites.PX;
      // If it doesn't fit standing up, the body is centred in the box.
      const big = ay * k > cv.height * 0.8;
      const fx = cv.width / 2, fy = big ? cv.height / 2 + ay * k * 0.45 : cv.height * 0.88;

      if (s.opts.shadow !== false && !s.opts.silhouette) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.ellipse(fx, fy, 9 * k, 3.4 * k, 0, 0, 6.2832); ctx.fill();
      }
      if (s.opts.silhouette) {
        ctx.save();
        ctx.filter = 'brightness(0)';
        ctx.globalAlpha = 0.55;
        s.a.draw(ctx, fx, fy);
        ctx.restore();
      } else {
        s.a.draw(ctx, fx, fy);
      }
      if (s.asleep) drawZs(s, ctx, fx, fy, ay, k, dt);

      // Sparkles around shinies: each one appears at a random spot.
      if (s.opts.shiny && !s.opts.silhouette) {
        s.tw = s.tw || [];
        s.sparkT -= dt;
        if (s.sparkT <= 0 && s.tw.length < 4) {
          s.sparkT = G.U.rand(0.18, 0.45);
          s.tw.push({ x: fx + G.U.rand(-0.32, 0.32) * cv.width, y: G.U.rand(0.12, 0.7) * cv.height, t: 0, life: G.U.rand(0.5, 0.8) });
        }
        for (let i = s.tw.length - 1; i >= 0; i--) {
          const w = s.tw[i];
          w.t += dt;
          if (w.t >= w.life) { s.tw.splice(i, 1); continue; }
          G.Icons.twinkle(ctx, w.x, w.y, w.t / w.life, Math.max(2, k));
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Creates a <canvas> with an animated sprite (for grids). */
  function spriteCanvas(dex, w, h, opts) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    sprite(cv, dex, opts);
    return cv;
  }

  return { buildLabel, copyText, $, show, hide, hideAll, isOpen, chrome, refreshCoins, coinPop, poke, toast, typeChips, stars, confirmDelete,
           sprite, spriteCanvas, ask, tick, initChrome, soundControls };
})();
