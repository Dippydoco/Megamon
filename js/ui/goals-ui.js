/* ============ goals-ui.js — misiones, logros y perfil ============
 * Una pantalla con tres pestañas:
 *   Misiones  3 diarias + 2 semanales, con barra, premio y botón de recoger
 *   Logros    medallas por categoría; los legendarios, uno a uno con su sprite
 *   Perfil    tus 3 favoritos y tu título; vista previa del perfil público
 * y la ventana del perfil público de cualquier jugador (G.ProfileUI.show).
 */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => (t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t));

  // ======================= PANTALLA =======================

  G.GoalsUI = (() => {
    let tab = 'missions', cat = 'coleccion';

    function init() {
      document.querySelectorAll('#goals-tabs .tab').forEach(t => {
        t.onclick = () => { tab = t.dataset.tab; render(); };
      });
    }

    function open(t) {
      if (t) tab = t;
      G.UI.show('scr-goals', true);
      G.Progress.ensure(G.DB.save);
      G.Progress.checkAch();
      render();
    }

    function render() {
      document.querySelectorAll('#goals-tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
      const box = $('goals-body');
      box.innerHTML = '';
      if (tab === 'missions') missions(box);
      else if (tab === 'ach') achievements(box);
      else if (tab === 'history') history(box);
      else profile(box);
    }

    // ---------------- history (last 100 runs) ----------------

    let histShown = 20, histOpen = null;
    const fmtDate = ms => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const num = n => (n || 0).toLocaleString('en-GB');

    function history(box) {
      const list = G.DB.save.history || [];
      box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>Run history</h3>
        <span class="sub" translate="no">Last ${G.DB.HISTORY_MAX} runs · ${list.length} saved</span></div>`);
      if (!list.length) { box.insertAdjacentHTML('beforeend', '<p class="sub">No runs yet. Finish a run and it will show up here.</p>'); return; }
      const best = Math.max(...list.map(e => e.t));
      list.slice(0, histShown).forEach(e => {
        const mon = G.DEX_BY[e.d];
        const el = document.createElement('div');
        el.className = 'hist-run' + (histOpen === e.id ? ' open' : '');
        const mates = e.mt || [];
        el.innerHTML = `
          <div class="hist-head">
            <span class="hist-mon"></span>
            <div class="hist-main">
              <b translate="no">${esc(mon ? mon.name : '?')}${e.sh ? ' ' + G.Icons.html('shiny', 12) : ''}${e.ar ? ' ' + G.Icons.html('star', 14) : ''}</b>
              <small translate="no">${fmtDate(e.id)}</small>
            </div>
            <div class="hist-nums" translate="no">
              <span class="hist-t${e.t === best ? ' best' : ''}">${fmt(e.t)}</span>
              <small>Lv. ${e.lv} · ${num(e.k)} kills</small>
            </div>
            <span class="hist-tag ${e.g ? 'grp' : ''}" translate="no">${e.g ? 'Group' : 'Solo'}</span>
          </div>
          <div class="hist-detail">
            <div class="hist-grid">
              <div><span>Result</span><b>${e.x ? 'Fainted' : 'Left the run'}</b></div>
              <div><span>Bosses beaten</span><b>${num(e.b)}</b></div>
              <div><span>Coins earned</span><b>${num(e.c)}</b></div>
              <div><span>Damage dealt</span><b>${num(e.dd)}</b></div>
              <div><span>Damage taken</span><b>${num(e.dt)}</b></div>
              <div><span>Held item</span><b>${e.it && G.Items.BY[e.it] ? esc(G.Items.BY[e.it].name) : '—'}</b></div>
              ${e.kb ? `<div style="grid-column:1/-1"><span>Defeated by</span><b translate="no">${esc(e.kb.n)} · ${esc(e.kb.a)}${e.kb.ty ? ' (' + esc(e.kb.ty) + ')' : ''} · ${num(e.kb.h)} damage</b></div>` : ''}
              ${e.ar ? `<div style="grid-column:1/-1"><span>Arceus</span><b>${G.Icons.html('star', 14)} Reached Arceus: ${fmt(e.ar[0])} in the fight · ${e.ar[1]} legendaries beaten</b></div>` : ''}
            </div>
            <div class="hist-moves"><span>Moves</span>
              ${e.m.length ? e.m.map(([id, lv]) => `<i>${G.Icons.html('move:' + id, 16)} ${esc(G.Moves.BY_ID[id].name)} Lv.${lv}</i>`).join('') : '<i>—</i>'}</div>
            ${mates.length ? `<div class="hist-mates"><span>Teammates</span><div class="hist-mate-row"></div></div>` : ''}
          </div>`;
        el.querySelector('.hist-mon').appendChild(G.UI.spriteCanvas(e.d, 44, 40, { scale: 1, shiny: !!e.sh }));
        const mr = el.querySelector('.hist-mate-row');
        if (mr) mates.forEach(([n, d, sh]) => {
          const m = document.createElement('span');
          m.className = 'hist-mate';
          if (G.DEX_BY[d]) m.appendChild(G.UI.spriteCanvas(d, 32, 30, { scale: 1, shiny: !!sh }));
          m.insertAdjacentHTML('beforeend', `<b translate="no">${esc(n)}</b><small translate="no">${G.DEX_BY[d] ? esc(G.DEX_BY[d].name) : ''}</small>`);
          mr.appendChild(m);
        });
        el.querySelector('.hist-head').onclick = () => { histOpen = histOpen === e.id ? null : e.id; render(); };
        box.appendChild(el);
      });
      if (list.length > histShown) {
        const more = document.createElement('button');
        more.className = 'btn small ghost'; more.textContent = 'Show more (' + (list.length - histShown) + ' left)';
        more.onclick = () => { histShown += 20; render(); };
        box.appendChild(more);
      }
    }

    // ---------------- misiones ----------------

    function untilText(kind) {
      const now = new Date();
      // Medianoche (diarias) o lunes (semanales), hora de España aproximada por la del navegador.
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      if (kind === 'w') { const add = (8 - (now.getDay() || 7)) % 7; end.setDate(end.getDate() + add); }
      const mins = Math.max(1, Math.round((end - now) / 60000));
      return mins >= 1440 ? Math.floor(mins / 1440) + ' d ' + Math.floor(mins % 1440 / 60) + ' h'
                          : Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
    }

    function missions(box) {
      const M = G.DB.save.missions;
      const section = (title, list, weekly) => {
        box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>${title}</h3>
          <span class="sub">Se renuevan en ${untilText(weekly ? 'w' : 'd')}</span></div>`);
        list.forEach((m, i) => {
          const d = G.MissionDefs.BY[m.id];
          const done = G.Progress.done(m);
          const el = document.createElement('div');
          el.className = 'mission' + (m.claimed ? ' claimed' : done ? ' ready' : '');
          const pct = Math.min(100, m.prog / m.goal * 100);
          el.innerHTML = `
            <div class="m-txt"><b>${esc(G.Progress.text(m))}</b>
              <div class="bar"><i style="width:${pct}%"></i></div>
              <small>${Math.min(m.prog, m.goal).toLocaleString('es')} / ${m.goal.toLocaleString('es')}</small></div>
            <div class="m-rw">${G.Progress.rewardText(d.reward)}</div>`;
          const btn = document.createElement('button');
          if (m.claimed) { btn.className = 'btn small'; btn.disabled = true; btn.textContent = 'Recogido'; }
          else if (done) {
            btn.className = 'btn small gold'; btn.textContent = 'Recoger'; btn.dataset.sfx = 'none';
            btn.onclick = () => { if (G.Progress.claim(m, weekly)) { G.Audio.sfx('buy'); G.UI.toast('¡Premio recogido!'); render(); } };
          } else if (!weekly && !M.rerolled) {
            btn.className = 'btn small ghost'; btn.textContent = 'Cambiar';
            btn.title = 'Cambia esta misión por otra (una vez al día)';
            btn.onclick = () => { if (G.Progress.reroll(i)) render(); };
          } else { btn.className = 'btn small ghost'; btn.disabled = true; btn.textContent = 'En curso'; }
          el.appendChild(btn);
          box.appendChild(el);
        });
      };
      section('Diarias', M.daily, false);
      section('Semanales', M.weekly, true);
    }

    // ---------------- logros ----------------

    function achievements(box) {
      const s = G.DB.save;
      const all = G.AchDefs.LIST;
      const got = all.filter(a => s.ach && s.ach[a.id]).length;
      const chips = document.createElement('div');
      chips.className = 'filters';
      for (const [k, label] of G.AchDefs.CATS) {
        const list = all.filter(a => a.cat === k);
        const n = list.filter(a => s.ach && s.ach[a.id]).length;
        const b = document.createElement('button');
        b.className = 'chip' + (k === cat ? ' on' : '');
        b.textContent = `${label} ${n}/${list.length}`;
        b.onclick = () => { cat = k; render(); };
        chips.appendChild(b);
      }
      box.insertAdjacentHTML('beforeend', `<p class="sub">${got} de ${all.length} logros · títulos: ${G.Progress.titles().length}</p>`);
      box.appendChild(chips);

      const list = all.filter(a => a.cat === cat && !a.dex);
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      for (const a of list) grid.appendChild(achCard(a, s));
      box.appendChild(grid);

      // Legendarios: uno a uno, con su sprite (en sombra si aún no le has vencido).
      if (cat === 'legendarios') {
        const legs = all.filter(a => a.dex);
        const beaten = legs.filter(a => s.legends && s.legends[a.dex]).length;
        box.insertAdjacentHTML('beforeend', `<h3 style="margin:14px 0 6px">Legendarios vencidos ${beaten} / ${legs.length}</h3>`);
        const lg = document.createElement('div');
        lg.className = 'leg-grid';
        for (const a of legs) {
          const ok = !!(s.legends && s.legends[a.dex]);
          const c = document.createElement('div');
          c.className = 'leg-cell' + (ok ? ' ok' : '');
          c.title = a.name + (ok ? ' · ¡vencido!' : '');
          c.appendChild(G.UI.spriteCanvas(a.dex, 64, 56, { scale: 1, silhouette: !ok, shadow: ok }));
          c.insertAdjacentHTML('beforeend', `<small>${ok ? esc(G.DEX_BY[a.dex].name) : '???'}</small>`);
          lg.appendChild(c);
        }
        box.appendChild(lg);
      }
    }

    function achCard(a, s) {
      const ok = !!(s.ach && s.ach[a.id]);
      const v = Math.min(a.goal, a.value(s));
      const el = document.createElement('div');
      el.className = 'ach' + (ok ? ' ok' : '');
      el.innerHTML = `${G.Icons.html(ok ? 'medal' + a.tier : 'medalOff', 36)}
        <div class="a-txt"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
          ${ok ? '' : `<div class="bar"><i style="width:${v / a.goal * 100}%"></i></div>`}
          <div class="a-rw">${ok ? '¡Conseguido!' : v.toLocaleString('es') + ' / ' + a.goal.toLocaleString('es')} · ${G.Progress.rewardText(a.reward)}
          ${a.title ? ` · <span class="gold">Título: ${esc(a.title)}</span>` : ''}</div></div>`;
      return el;
    }

    // ---------------- perfil (editar) ----------------

    function profile(box) {
      const s = G.DB.save;
      s.profile = s.profile || { favs: [], title: '' };
      const P = s.profile;
      box.insertAdjacentHTML('beforeend', `<p class="sub">${G.DB.online ? 'Así te ven los demás jugadores (desde el ranking y la lista de amigos).'
        : 'Tu perfil se publica cuando juegas con una cuenta online.'}</p>
        <h3>Tus 3 Pokémon favoritos</h3>`);
      const favs = document.createElement('div');
      favs.className = 'fav-slots';
      for (let i = 0; i < 3; i++) {
        const f = P.favs[i];
        const slot = document.createElement('div');
        slot.className = 'fav-slot';
        if (f && G.DEX_BY[f.dex]) {
          slot.appendChild(G.UI.spriteCanvas(f.dex, 120, 100, { scale: 2, lively: true, shiny: !!f.shiny }));
          slot.insertAdjacentHTML('beforeend', `<b>${f.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[f.dex].name)}</b>`);
        } else slot.innerHTML = '<span>Elegir</span>';
        slot.onclick = () => pickFav(i);
        favs.appendChild(slot);
      }
      box.appendChild(favs);

      const titles = G.Progress.titles();
      // Titles are Spanish keys that the page translates on screen. The dropdown used to save the
      // translated text, which never matched again. Fix any title saved that way.
      if (P.title && !titles.includes(P.title)) {
        const orig = titles.find(t => G.I18n.t(t) === P.title);
        if (orig) { P.title = orig; G.DB.commit(); if (G.Social.me) G.Social.publishProfile(true); }
      }
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Título</h3>`);
      const sel = document.createElement('select');
      sel.className = 'field';
      sel.style.maxWidth = '320px';
      sel.innerHTML = `<option value="">(sin título)</option>` + titles.map(t => `<option value="${esc(t)}" ${t === P.title ? 'selected' : ''}>${esc(t)}</option>`).join('');
      sel.onchange = () => { P.title = sel.value; save(); };
      box.appendChild(sel);
      if (!titles.length) box.insertAdjacentHTML('beforeend', '<p class="note">Consigue logros para desbloquear títulos.</p>');

      // Banner, border and chat name colour.
      const C = G.Cosmetics;
      const pick = (title, list, key, swatch) => {
        box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">${title}</h3>`);
        const row = document.createElement('div');
        row.className = 'cos-row';
        for (const it of list) {
          const ok = C.unlocked(it);
          const b = document.createElement('button');
          b.className = 'cos-sw' + ((P[key] || '') === it.id ? ' on' : '') + (ok ? '' : ' locked');
          b.type = 'button';
          swatch(b, it);
          b.title = it.name + (ok ? '' : ' (locked): ' + C.hint(it));
          b.insertAdjacentHTML('beforeend', `<small>${esc(it.name)}</small>`);
          b.onclick = () => {
            if (!ok) { G.UI.toast(C.hint(it), 2600); G.Audio.sfx('error'); return; }
            P[key] = it.id; save(); render();
          };
          row.appendChild(b);
        }
        box.appendChild(row);
      };
      pick('Profile banner', C.BANNERS, 'banner', (b, it) => { b.style.setProperty('--bg', it.bg); b.classList.add('bn'); });
      pick('Profile border', C.FRAMES, 'frame', (b, it) => { b.classList.add('fr'); b.dataset.frame = it.id; if (it.color) b.style.setProperty('--fc', it.color); });
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Chat name colour</h3>`);
      const cr = document.createElement('div');
      cr.className = 'cos-row';
      for (const c of C.NAME_COLORS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cos-col' + ((P.chatColor || '') === c ? ' on' : '');
        b.style.background = c || 'linear-gradient(135deg, #ffd23f 50%, #9fd4ff 50%)';
        b.title = c ? 'Use this colour' : 'Default (gold for you, blue for others)';
        b.onclick = () => { P.chatColor = c; save(); render(); };
        cr.appendChild(b);
      }
      box.appendChild(cr);
      const sample = document.createElement('p');
      sample.className = 'cm cos-sample'; sample.setAttribute('translate', 'no');
      sample.innerHTML = `<b style="${C.chatColor() ? 'color:' + C.chatColor() : ''}">${esc(G.Social.me ? G.Social.me.name : 'You')}</b> <span class="cm-t">This is how your name looks in chat</span>`;
      box.appendChild(sample);

      const prev = document.createElement('button');
      prev.className = 'btn gold'; prev.style.marginTop = '16px';
      prev.textContent = 'Ver mi perfil público';
      prev.onclick = () => G.ProfileUI.showData(G.Social.profileData());
      box.appendChild(prev);
    }

    function pickFav(i) {
      const s = G.DB.save;
      const box = $('goals-body');
      box.innerHTML = `<div class="row between"><h3>Elige el favorito ${i + 1}</h3>
        <button class="btn small ghost" id="fav-back">Volver</button></div>
        <input class="field" id="fav-q" placeholder="Buscar por nombre" style="max-width:320px;margin:6px 0 10px">
        <div class="grid" id="fav-grid"></div>`;
      $('fav-back').onclick = () => { tab = 'profile'; render(); };
      // All owned Pokémon (and their shinies), added to the grid 120 at a time as you scroll
      // (it used to stop at the first 120, so later generations never showed up).
      const PAGE = 120;
      const fill = q => {
        const g = $('fav-grid');
        g.innerHTML = '';
        g.scrollTop = 0;
        const items = [];
        const mons = Object.keys(s.owned).map(Number).filter(d => G.DEX_BY[d] && (!q || G.DEX_BY[d].name.toLowerCase().includes(q)));
        for (const d of mons) for (const shiny of G.DB.ownsShiny(d) ? [false, true] : [false]) items.push([d, shiny]);
        let shown = 0;
        const more = () => {
          for (const [d, shiny] of items.slice(shown, shown + PAGE)) {
            const c = document.createElement('div');
            c.className = 'cell';
            c.appendChild(G.UI.spriteCanvas(d, 92, 80, { scale: 2, shiny }));
            c.insertAdjacentHTML('beforeend', `<b>${shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[d].name)}</b>`);
            c.onclick = () => {
              s.profile.favs = (s.profile.favs || []).slice();
              s.profile.favs[i] = { dex: d, shiny };
              s.profile.favs = s.profile.favs.filter(Boolean).slice(0, 3);
              save(); tab = 'profile'; render();
            };
            g.appendChild(c);
          }
          shown = Math.min(items.length, shown + PAGE);
        };
        g.onscroll = () => { if (shown < items.length && g.scrollTop + g.clientHeight > g.scrollHeight - 400) more(); };
        more();
        // Tall screens: keep adding until the grid actually scrolls.
        while (shown < items.length && g.scrollHeight <= g.clientHeight + 50) more();
      };
      $('fav-q').oninput = () => fill($('fav-q').value.trim().toLowerCase());
      fill('');
    }

    function save() {
      G.DB.commit();
      if (G.Social.me) G.Social.publishProfile(true);
      G.Audio.sfx('confirm');
    }

    return { init, open, render };
  })();

  // ======================= PERFIL PÚBLICO =======================

  G.ProfileUI = (() => {
    function init() {
      $('prof-close').onclick = close;
      $('scr-profile').onclick = e => { if (e.target.id === 'scr-profile') close(); };
    }
    function close() { $('scr-profile').classList.add('hidden'); }

    /** Abre el perfil de otro jugador por su uid. */
    async function show(uid) {
      if (!uid) return;
      if (uid === G.Social.uid) { showData(G.Social.profileData()); return; }
      $('prof-body').innerHTML = '<p class="sub">Cargando…</p>';
      $('scr-profile').classList.remove('hidden');
      const d = await G.Social.getProfile(uid);
      if (!d) { $('prof-body').innerHTML = '<p class="sub">Este jugador aún no tiene perfil.</p>'; return; }
      showData(d);
    }

    function showData(d) {
      const b = d.best || {};
      const body = $('prof-body');
      body.innerHTML = `
        <div class="prof-head" id="prof-head"><h2 translate="no">${esc(d.name || '???')}</h2>${d.title ? `<span class="prof-title">${esc(d.title)}</span>` : ''}</div>
        <div class="fav-slots view" id="prof-favs"></div>
        <div class="prof-marks">
          <div><span>Mejor tiempo</span><b>${fmt(b.solo || 0)}</b></div>
          <div><span>En grupo</span><b>${fmt(b.group || 0)}</b></div>
          <div><span>Nivel máximo</span><b>${b.level || 0}</b></div>
          <div><span>Jefes</span><b>${(b.bosses || 0).toLocaleString('es')}</b></div>
          <div><span>Legendarios</span><b>${b.legends || 0}</b></div>
          <div><span>Derrotados</span><b>${(b.kills || 0).toLocaleString('es')}</b></div>
        </div>
        <h3>Medallas <span class="sub">${b.medals || 0}</span></h3>
        <div class="prof-medals" id="prof-medals"></div>`;
      G.Cosmetics.apply($('scr-profile').querySelector('.profile-box'), $('prof-head'), d);
      const favs = $('prof-favs');
      for (const f of (d.favs || []).slice(0, 3)) {
        if (!G.DEX_BY[f.dex]) continue;
        const slot = document.createElement('div');
        slot.className = 'fav-slot';
        slot.appendChild(G.UI.spriteCanvas(f.dex, 120, 100, { scale: 2, lively: true, shiny: !!f.shiny }));
        slot.insertAdjacentHTML('beforeend', `<b>${f.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[f.dex].name)}</b>`);
        favs.appendChild(slot);
      }
      if (!favs.children.length) favs.innerHTML = '<p class="sub">Sin favoritos todavía.</p>';
      const med = $('prof-medals');
      for (const id of d.medals || []) {
        const a = G.AchDefs.BY[id];
        if (!a) continue;
        const m = document.createElement('div');
        m.className = 'pm';
        m.title = a.name;
        if (a.dex) m.appendChild(G.UI.spriteCanvas(a.dex, 48, 40, { scale: 1 }));
        else m.innerHTML = G.Icons.html('medal' + a.tier, 36);
        m.insertAdjacentHTML('beforeend', `<small>${esc(a.name)}</small>`);
        med.appendChild(m);
      }
      if (!med.children.length) med.innerHTML = '<p class="sub">Aún sin medallas.</p>';
      $('scr-profile').classList.remove('hidden');
    }

    return { init, show, showData };
  })();
})();
