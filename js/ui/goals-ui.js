/* ============ goals-ui.js — the Profile screen ============
 * One screen (the "Profile" tile on the menu; it used to be called Missions) with five tabs:
 *   Profile       your 3 favourites and your title; preview of the public profile
 *   History       your last runs
 *   Missions      3 daily + 2 weekly, with a bar, reward and collect button
 *   Achievements  medals by category; legendaries one by one with their sprite
 *   Badges        one per generation, for owning every Pokémon of it (25-10-2026)
 * and the public profile window for any player (G.ProfileUI.show).
 */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = t => (t >= 3600 ? Math.floor(t / 3600) + ':' + G.U.mmss(t % 3600).padStart(5, '0') : G.U.mmss(t));

  // ======================= BADGES (shared) =======================
  // One per generation: own every Pokémon of it (the same thing earns the region's Shiny Charm, systems/charms.js).
  const BADGE_MON = { 1: 150, 2: 249, 3: 384, 4: 483, 5: 643, 6: 716, 7: 791, 8: 888, 9: 1007 };
  /** { gens: [1..9], all: gen -> count, have: gen -> owned, earned: [gens] } for a save. */
  function badgeInfo(s) {
    const all = {}, have = {};
    for (const p of G.DEX) {
      all[p.gen] = (all[p.gen] || 0) + 1;
      if (s && s.owned && s.owned[p.dex]) have[p.gen] = (have[p.gen] || 0) + 1;
    }
    const gens = Object.keys(all).map(Number).sort((a, b) => a - b);
    return { gens, all, have, earned: gens.filter(g => have[g] === all[g]) };
  }
  /** The hexagon emblem with the region's legendary (a silhouette while not earned). */
  function badgeEmblem(gen, ok, size = 64) {
    const em = document.createElement('div');
    em.className = 'badge-em' + (ok ? ' ok' : '');
    em.style.width = em.style.height = size + 'px'; em.style.flexBasis = size + 'px';
    const mon = BADGE_MON[gen];
    if (mon && G.DEX_BY[mon]) em.appendChild(G.UI.spriteCanvas(mon, size, Math.round(size * 0.875), { scale: 1, silhouette: !ok }));
    return em;
  }
  const FEAT_ACH = 6;          // featured achievements on the public profile (save.profile.featAch)

  // ======================= SCREEN =======================

  G.GoalsUI = (() => {
    let tab = 'profile', cat = 'collection';

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
      else if (tab === 'badges') badges(box);
      else profile(box);
    }

    // ---------------- history (last 100 runs) ----------------

    const histState = { shown: 20, open: null };
    const fmtDate = ms => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const num = n => (n || 0).toLocaleString('en-GB');

    function history(box) {
      const list = G.DB.save.history || [];
      box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>Run history</h3>
        <span class="sub" translate="no">Last ${G.DB.HISTORY_MAX} runs · ${list.length} saved</span></div>`);
      if (!list.length) { box.insertAdjacentHTML('beforeend', '<p class="sub">No runs yet. Finish a run and it will show up here.</p>'); return; }
      runList(box, list, histState, render);
    }

    /**
     * Recent runs carry details (systems/runlog.js): each move's share of the damage, with a bar,
     * its level and how long it was your active move. Older runs just list the moves.
     */
    function dmgByMove(e) {
      const z = e.z;
      if (!z || !z.mv || !z.mv.length) return '';
      const rows = z.mv.map(([c, lv, ev, d, a, , bd]) => ({ id: G.RunLog.idOf(c), lv, ev, d, a, bd: bd || 0 })).filter(r => r.id && G.Moves.BY_ID[r.id]);
      if (!rows.length) return '';
      const total = rows.reduce((s, r) => s + r.d, 0) || 1, top = Math.max(...rows.map(r => r.d)) || 1;
      rows.sort((a, b) => b.d - a.d);
      const bonds = new Set(rows.filter(r => r.bd).map(r => r.bd)).size;
      return `<div class="hist-dmg"><span>Damage by move${bonds ? ' <small class="sub">· 🔗 bonded</small>' : ''}</span>${rows.map(r => {
        const m = G.Moves.BY_ID[r.id], name = r.ev && G.Moves.EVO[r.id] ? G.Moves.EVO[r.id][0] : m.name;
        // Bonded moves: a chip with the bond's number (moves with the same number were bonded together).
        const bond = r.bd ? ` <small class="hist-bond" title="Bonded${bonds > 1 ? ' (bond ' + r.bd + ')' : ''}: cast together with its partner move" style="color:#ffd23f">🔗${bonds > 1 ? r.bd : ''}</small>` : '';
        return `<div class="hist-dmg-row" title="Active for ${fmt(r.a)} of the run${r.bd ? ' · bonded' : ''}">
          <i>${G.Icons.html('move:' + r.id, 16)} ${esc(name)} <small>Lv.${r.lv}${r.ev ? ' ★' : ''}</small>${bond}</i>
          <b class="hist-dmg-bar"><em style="width:${(r.d / top * 100).toFixed(1)}%;background:${G.U.TYPE_COLOR[m.type]}"></em></b>
          <small translate="no">${num(r.d)} · ${Math.round(r.d / total * 100)}%</small></div>`;
      }).join('')}</div>`;
    }

    /** A list of runs (yours, or another player's from their profile). st = { shown, open } keeps the scroll-more and open state. */
    function runList(box, list, st, rerender) {
      const best = Math.max(...list.map(e => e.t));
      list.slice(0, st.shown).forEach(e => {
        const mon = G.DEX_BY[e.d];
        const el = document.createElement('div');
        el.className = 'hist-run' + (st.open === e.id ? ' open' : '');
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
            ${dmgByMove(e) || `<div class="hist-moves"><span>Moves</span>
              ${e.m.length ? e.m.map(([id, lv]) => `<i>${G.Icons.html('move:' + id, 16)} ${esc(G.Moves.BY_ID[id].name)} Lv.${lv}</i>`).join('') : '<i>—</i>'}</div>`}
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
        el.querySelector('.hist-head').onclick = () => { st.open = st.open === e.id ? null : e.id; rerender(); };
        box.appendChild(el);
      });
      if (list.length > st.shown) {
        const more = document.createElement('button');
        more.className = 'btn small ghost'; more.textContent = 'Show more (' + (list.length - st.shown) + ' left)';
        more.onclick = () => { st.shown += 20; rerender(); };
        box.appendChild(more);
      }
    }

    // ---------------- badges (25-10-2026) ----------------
    // One per generation: own every Pokémon of it. The same thing earns that region's Shiny Charm
    // (systems/charms.js), so a badge also shows the charm. save.charms[gen] is when it was first earned.
    function badges(box) {
      const s = G.DB.save, { gens, all, have, earned } = badgeInfo(s);
      box.insertAdjacentHTML('beforeend', `<div class="row between goals-h"><h3>Badges ${earned.length} / ${gens.length}</h3></div>
        <p class="sub">Own every Pokémon from a generation to earn its badge. Each badge also brings that region's Shiny Charm: shiny odds ×${G.Charms.MULT} for its Pokémon.</p>`);
      const grid = document.createElement('div');
      grid.className = 'badge-grid';
      for (const g of gens) {
        const n = have[g] || 0, ok = n === all[g], region = G.Charms.regionName(g);
        const col = ((G.Gacha.BANNERS[g - 1] || {}).color) || ['#3a4a6e', '#2a3a5e', '#1a2a4e'];
        const el = document.createElement('div');
        el.className = 'badge-card' + (ok ? ' ok' : '');
        el.style.setProperty('--b1', col[0]); el.style.setProperty('--b2', col[1]); el.style.setProperty('--b3', col[2]);
        el.appendChild(badgeEmblem(g, ok));
        const when = ok && s.charms && s.charms[g] ? new Date(s.charms[g]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        el.insertAdjacentHTML('beforeend', `<div class="badge-txt"><b>${esc(region)} Badge</b>
          <small>Generation ${g} · own all ${all[g]} Pokémon</small>
          ${ok ? `<div class="badge-got">${G.Icons.html('shiny', 12)} Earned${when ? ' ' + when : ''} · Shiny Charm</div>`
               : `<div class="bar"><i style="width:${(n / all[g] * 100).toFixed(1)}%"></i></div><small>${n} / ${all[g]}</small>`}</div>`);
        grid.appendChild(el);
      }
      box.appendChild(grid);
    }

    // ---------------- missions ----------------

    function untilText(kind) {
      const now = new Date();
      // Midnight (dailies) or Monday (weeklies), Spanish time approximated by the browser's.
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
          <span class="sub">Refreshes in ${untilText(weekly ? 'w' : 'd')}</span></div>`);
        list.forEach((m, i) => {
          const d = G.MissionDefs.BY[m.id];
          const done = G.Progress.done(m);
          const el = document.createElement('div');
          el.className = 'mission' + (m.claimed ? ' claimed' : done ? ' ready' : '');
          const pct = Math.min(100, m.prog / m.goal * 100);
          el.innerHTML = `
            <div class="m-txt"><b>${esc(G.Progress.text(m))}</b>
              <div class="bar"><i style="width:${pct}%"></i></div>
              <small>${Math.min(m.prog, m.goal).toLocaleString('en')} / ${m.goal.toLocaleString('en')}</small></div>
            <div class="m-rw">${G.Progress.rewardText(d.reward)}</div>`;
          const btn = document.createElement('button');
          if (m.claimed) { btn.className = 'btn small'; btn.disabled = true; btn.textContent = 'Claimed'; }
          else if (done) {
            btn.className = 'btn small gold'; btn.textContent = 'Claim'; btn.dataset.sfx = 'none';
            btn.onclick = () => { if (G.Progress.claim(m, weekly)) { G.Audio.sfx('buy'); G.UI.toast('Reward claimed!'); render(); } };
          } else if (!weekly && !M.rerolled) {
            btn.className = 'btn small ghost'; btn.textContent = 'Swap';
            btn.title = 'Swap this mission for another (once a day)';
            btn.onclick = () => { if (G.Progress.reroll(i)) render(); };
          } else { btn.className = 'btn small ghost'; btn.disabled = true; btn.textContent = 'In progress'; }
          el.appendChild(btn);
          box.appendChild(el);
        });
      };
      section('Daily', M.daily, false);
      section('Weekly', M.weekly, true);
    }

    // ---------------- achievements ----------------

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
      box.insertAdjacentHTML('beforeend', `<p class="sub">${got} of ${all.length} achievements · titles: ${G.Progress.titles().length}</p>`);
      box.appendChild(chips);

      const list = all.filter(a => a.cat === cat && !a.dex);
      const grid = document.createElement('div');
      grid.className = 'ach-grid';
      for (const a of list) grid.appendChild(achCard(a, s));
      box.appendChild(grid);

      // Legendaries: one by one, with their sprite (in shadow if you haven't defeated it yet).
      if (cat === 'legendaries') {
        const legs = all.filter(a => a.dex);
        const beaten = legs.filter(a => s.legends && s.legends[a.dex]).length;
        box.insertAdjacentHTML('beforeend', `<h3 style="margin:14px 0 6px">Legendaries defeated ${beaten} / ${legs.length}</h3>`);
        const lg = document.createElement('div');
        lg.className = 'leg-grid';
        for (const a of legs) {
          const ok = !!(s.legends && s.legends[a.dex]);
          const c = document.createElement('div');
          c.className = 'leg-cell' + (ok ? ' ok' : '');
          c.title = a.name + (ok ? ' · defeated!' : '');
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
          <div class="a-rw">${ok ? 'Unlocked!' : v.toLocaleString('en') + ' / ' + a.goal.toLocaleString('en')} · ${G.Progress.rewardText(a.reward)}
          ${a.title ? ` · <span class="gold">Title: ${esc(a.title)}</span>` : ''}</div></div>`;
      return el;
    }

    // ---------------- profile (editing) ----------------

    function profile(box) {
      const s = G.DB.save;
      s.profile = s.profile || { favs: [], title: '' };
      const P = s.profile;
      box.insertAdjacentHTML('beforeend', `<p class="sub">${G.DB.online ? 'This is how other players see you (from the leaderboard and friends list).'
        : 'Your profile is published when you play with an online account.'}</p>
        <h3>Your 3 favourite Pokémon</h3>`);
      const favs = document.createElement('div');
      favs.className = 'fav-slots';
      for (let i = 0; i < 3; i++) {
        const f = P.favs[i];
        const slot = document.createElement('div');
        slot.className = 'fav-slot';
        if (f && G.DEX_BY[f.dex]) {
          slot.appendChild(G.UI.spriteCanvas(f.dex, 120, 100, { scale: 2, lively: true, shiny: !!f.shiny }));
          slot.insertAdjacentHTML('beforeend', `<b>${f.shiny ? G.Icons.html('shiny', 12) + ' ' : ''}${esc(G.DEX_BY[f.dex].name)}</b>`);
        } else slot.innerHTML = '<span>Choose</span>';
        slot.onclick = () => pickFav(i);
        favs.appendChild(slot);
      }
      box.appendChild(favs);

      const titles = G.Progress.titles();
      // Titles used to be saved in Spanish: switch an old saved title to its English name.
      if (P.title && !titles.includes(P.title)) {
        const en = G.AchDefs.titleOf(P.title);
        if (en !== P.title && titles.includes(en)) { P.title = en; G.DB.commit(); if (G.Social.me) G.Social.publishProfile(true); }
      }
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Title</h3>`);
      const sel = document.createElement('select');
      sel.className = 'field';
      sel.style.maxWidth = '320px';
      sel.innerHTML = `<option value="">(no title)</option>` + titles.map(t => `<option value="${esc(t)}" ${t === P.title ? 'selected' : ''}>${esc(t)}</option>`).join('');
      sel.onchange = () => { P.title = sel.value; save(); };
      box.appendChild(sel);
      if (!titles.length) box.insertAdjacentHTML('beforeend', '<p class="note">Earn achievements to unlock titles.</p>');
      featured(box, s, P);

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
          b.insertAdjacentHTML('beforeend', `<small>${esc(it.name)}${it.anim ? ' ✦' : ''}</small>`);
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
      box.insertAdjacentHTML('beforeend', '<p class="sub" style="margin:2px 0 0">✦ animated</p>');
      // Profile background colour and wallpaper (19-10-2026).
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Profile background</h3>`);
      const bgr = document.createElement('div');
      bgr.className = 'cos-row';
      for (const it of C.BG_COLORS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cos-col' + ((P.pbg || '') === it.id ? ' on' : '');
        b.style.background = it.c || 'linear-gradient(180deg, var(--box1), var(--box2))';
        b.title = it.name;
        b.onclick = () => { P.pbg = it.id; save(); render(); };
        bgr.appendChild(b);
      }
      box.appendChild(bgr);
      pick('Profile wallpaper', C.WALLPAPERS, 'wall', (b, it) => {
        b.classList.add('wp'); b.dataset.wall = it.id;
        const c = C.find(C.BG_COLORS, P.pbg).c;
        if (c) b.style.setProperty('--pbg', c);
      });
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
      prev.textContent = 'View my public profile';
      prev.onclick = () => G.ProfileUI.showData(G.Social.profileData(), G.Social.uid);
      box.appendChild(prev);
    }

    // ---------------- featured achievements and badges (25-10-2026) ----------------
    // Shown in their own "Featured" section on your public profile. P.featAch: achievement ids (up to 6),
    // P.featBadges: generations (any of the badges you've earned).
    function featured(box, s, P) {
      box.insertAdjacentHTML('beforeend', `<h3 style="margin-top:14px">Featured on your profile</h3>
        <p class="sub" style="margin:0 0 6px">Pick the achievements and badges other players see first on your profile.</p>`);
      // Achievements: the chosen ones as small cards, and a Choose button.
      const ach = (P.featAch || []).filter(id => G.AchDefs.BY[id] && s.ach && s.ach[id]);
      const row = document.createElement('div');
      row.className = 'feat-row';
      for (const id of ach) row.appendChild(achChip(G.AchDefs.BY[id]));
      const ch = document.createElement('button');
      ch.type = 'button'; ch.className = 'btn small ghost';
      ch.textContent = ach.length ? 'Change achievements (' + ach.length + '/' + FEAT_ACH + ')' : 'Choose achievements (up to ' + FEAT_ACH + ')';
      ch.onclick = pickAch;
      row.appendChild(ch);
      box.appendChild(row);
      // Badges: every earned one as a toggle.
      const { earned } = badgeInfo(s);
      const br = document.createElement('div');
      br.className = 'feat-row';
      if (!earned.length) br.innerHTML = '<p class="note" style="margin:0">Earn a badge (own every Pokémon of a generation) to feature it.</p>';
      const on = new Set((P.featBadges || []).filter(g => earned.includes(g)));
      for (const g of earned) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'feat-badge' + (on.has(g) ? ' on' : '');
        b.title = G.Charms.regionName(g) + ' Badge' + (on.has(g) ? ' (featured)' : '');
        b.appendChild(badgeEmblem(g, true, 40));
        b.insertAdjacentHTML('beforeend', `<small>${esc(G.Charms.regionName(g))}</small>`);
        b.onclick = () => {
          if (on.has(g)) on.delete(g); else on.add(g);
          P.featBadges = [...on].sort((a, c) => a - c); save(); render();
        };
        br.appendChild(b);
      }
      box.appendChild(br);
    }

    function pickAch() {
      const s = G.DB.save, P = s.profile;
      const box = $('goals-body');
      const sel = (P.featAch || []).filter(id => G.AchDefs.BY[id] && s.ach && s.ach[id]);
      box.innerHTML = `<div class="row between"><h3>Featured achievements <span class="sub">${sel.length} / ${FEAT_ACH}</span></h3>
        <button class="btn small gold" id="feat-done">Done</button></div>
        <p class="sub">Tap to add or remove. They show on your profile in the order you pick them.</p>`;
      $('feat-done').onclick = () => { tab = 'profile'; render(); };
      const unlocked = G.AchDefs.LIST.filter(a => s.ach && s.ach[a.id]).sort((a, b) => (b.tier || 0) - (a.tier || 0));
      if (!unlocked.length) { box.insertAdjacentHTML('beforeend', '<p class="sub">No achievements unlocked yet.</p>'); return; }
      const grid = document.createElement('div');
      grid.className = 'feat-pick';
      for (const a of unlocked) {
        const i = sel.indexOf(a.id);
        const c = achChip(a, true);
        c.classList.toggle('on', i >= 0);
        if (i >= 0) c.insertAdjacentHTML('beforeend', `<em class="feat-n">${i + 1}</em>`);
        c.onclick = () => {
          if (i >= 0) sel.splice(i, 1);
          else if (sel.length >= FEAT_ACH) { G.UI.toast('You can feature up to ' + FEAT_ACH + ': remove one first'); G.Audio.sfx('error'); return; }
          else sel.push(a.id);
          P.featAch = sel.slice(); save(); pickAch();
        };
        grid.appendChild(c);
      }
      box.appendChild(grid);
    }

    function pickFav(i) {
      const s = G.DB.save;
      const box = $('goals-body');
      box.innerHTML = `<div class="row between"><h3>Choose favourite ${i + 1}</h3>
        <button class="btn small ghost" id="fav-back">Back</button></div>
        <input class="field" id="fav-q" placeholder="Search by name" style="max-width:320px;margin:6px 0 10px">
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

    return { init, open, render, runList };
  })();

  /** A small achievement card: medal (or the legendary's sprite), name and what it was for. */
  function achChip(a, button) {
    const c = document.createElement(button ? 'button' : 'div');
    if (button) c.type = 'button';
    c.className = 'feat-ach';
    c.title = a.desc;
    const ic = document.createElement('span');
    ic.className = 'feat-ic';
    if (a.dex && G.DEX_BY[a.dex]) ic.appendChild(G.UI.spriteCanvas(a.dex, 36, 32, { scale: 1 }));
    else ic.innerHTML = G.Icons.html('medal' + a.tier, 30);
    c.appendChild(ic);
    c.insertAdjacentHTML('beforeend', `<span class="feat-txt"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span>`);
    return c;
  }

  // ======================= PUBLIC PROFILE =======================

  G.ProfileUI = (() => {
    function init() {
      $('prof-close').onclick = close;
      $('scr-profile').onclick = e => { if (e.target.id === 'scr-profile') close(); };
    }
    function close() { $('scr-profile').classList.add('hidden'); }

    /** Opens another player's profile by their uid. */
    async function show(uid) {
      if (!uid) return;
      if (uid === G.Social.uid) { showData(G.Social.profileData(), uid); return; }
      $('prof-body').innerHTML = '<p class="sub">Loading…</p>';
      $('scr-profile').classList.remove('hidden');
      const d = await G.Social.getProfile(uid);
      if (!d) { $('prof-body').innerHTML = '<p class="sub">This player doesn\'t have a profile yet.</p>'; return; }
      showData(d, uid);
    }

    function showData(d, uid) {
      const b = d.best || {};
      const body = $('prof-body');
      body.innerHTML = `
        <div class="prof-head" id="prof-head"><h2 translate="no">${esc(d.name || '???')}</h2>${d.title ? `<span class="prof-title">${esc(G.AchDefs.titleOf(d.title))}</span>` : ''}${d.name ? '<button class="prof-copy" id="prof-copy" type="button" title="Copy this nickname (paste it in Friends to add them)">Copy name</button>' : ''}</div>
        <div class="fav-slots view" id="prof-favs"></div>
        <div class="prof-marks">
          <div><span>Best time</span><b>${fmt(b.solo || 0)}</b></div>
          <div><span>In a group</span><b>${fmt(b.group || 0)}</b></div>
          <div><span>Highest level</span><b>${b.level || 0}</b></div>
          <div><span>Bosses</span><b>${(b.bosses || 0).toLocaleString('en')}</b></div>
          <div><span>Legendaries</span><b>${b.legends || 0}</b></div>
          <div><span>Defeated</span><b>${(b.kills || 0).toLocaleString('en')}</b></div>
        </div>
        <div id="prof-feat" class="prof-feat hidden"><h3>Featured</h3><div class="prof-feat-badges" id="prof-feat-b"></div><div class="prof-feat-ach" id="prof-feat-a"></div></div>
        <h3>Medals <span class="sub">${b.medals || 0}</span>${b.badges ? ` · Badges <span class="sub">${b.badges} / 9</span>` : ''}</h3>
        <div class="prof-medals" id="prof-medals"></div>
        ${uid ? '<div style="margin-top:10px"><button class="btn small" id="prof-hist-btn">Run history</button></div><div id="prof-hist" style="margin-top:8px"></div>' : ''}`;
      if ($('prof-copy')) $('prof-copy').onclick = () => G.UI.copyText(d.name, 'Name copied: paste it in Friends to add them');
      if (uid) {
        // Another player's shared run history (or yours): opens under the medals.
        let list = null, open = false;
        const st = { shown: 20, open: null }, wrap = $('prof-hist'), btn = $('prof-hist-btn');
        const draw = () => {
          wrap.innerHTML = '';
          if (!open) return;
          if (list === null) { wrap.innerHTML = '<p class="sub">Loading…</p>'; return; }
          if (!list.length) { wrap.innerHTML = '<p class="sub">No runs to show. They may have turned sharing off, or not updated the game yet.</p>'; return; }
          G.GoalsUI.runList(wrap, list, st, draw);
        };
        btn.onclick = async () => {
          open = !open;
          btn.textContent = open ? 'Hide run history' : 'Run history';
          draw();
          if (open && list === null) { list = await G.Social.getHistory(uid); draw(); }
        };
      }
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
      if (!favs.children.length) favs.innerHTML = '<p class="sub">No favourites yet.</p>';
      // Featured achievements and badges (kept in `best` so the published profiles rules accept them).
      const fa = (Array.isArray(b.fa) ? b.fa : []).filter(id => G.AchDefs.BY[id]).slice(0, FEAT_ACH);
      const fbg = (Array.isArray(b.fb) ? b.fb : []).map(Number).filter(g => BADGE_MON[g]).slice(0, 9);
      if (fa.length || fbg.length) {
        $('prof-feat').classList.remove('hidden');
        for (const g of fbg) {
          const w = document.createElement('div');
          w.className = 'pf-badge';
          w.title = G.Charms.regionName(g) + ' Badge: every Pokémon of generation ' + g;
          w.appendChild(badgeEmblem(g, true, 48));
          w.insertAdjacentHTML('beforeend', `<small>${esc(G.Charms.regionName(g))}</small>`);
          $('prof-feat-b').appendChild(w);
        }
        for (const id of fa) $('prof-feat-a').appendChild(achChip(G.AchDefs.BY[id]));
      }
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
      if (!med.children.length) med.innerHTML = '<p class="sub">No medals yet.</p>';
      $('scr-profile').classList.remove('hidden');
    }

    return { init, show, showData };
  })();
})();
