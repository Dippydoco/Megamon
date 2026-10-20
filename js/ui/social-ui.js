/* ============ social-ui.js — nickname, friends, room and invitations ============ */
(() => {
  const $ = G.UI.$;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Can the online features be used? If not, explains why. */
  function needOnline() {
    if (G.DB.online) return true;
    G.UI.toast(G.DB.guest ? 'Create an account to play with friends and appear on the leaderboard.'
      : 'This needs the online version of the game (with the cloud).', 3200);
    return false;
  }

  // ======================= NICKNAME =======================

  G.NickUI = (() => {
    let then = null, skipped = false;

    function init() {
      $('nick-form').onsubmit = async e => {
        e.preventDefault();
        $('nick-err').textContent = '';
        $('nick-ok').disabled = true;
        const r = await G.Social.claimNick($('nick-in').value);
        $('nick-ok').disabled = false;
        if (!r.ok) { $('nick-err').textContent = r.error; G.Audio.sfx('error'); return; }
        G.Audio.sfx('confirm');
        G.UI.toast('Your nickname is ' + G.Social.me.name);
        const cb = then; then = null;
        if (cb) cb(); else G.MenuUI.open();
      };
      $('nick-later').onclick = () => { skipped = true; then = null; G.MenuUI.open(); };
    }

    /** @param next  what to open after choosing it */
    function open(next) {
      then = next || null;
      G.UI.show('scr-nick');
      $('nick-err').textContent = '';
      $('nick-in').value = '';
      setTimeout(() => $('nick-in').focus(), 50);
    }

    return { init, open, get skipped() { return skipped; } };
  })();

  /** Opens `fn` if you have a nickname; if not, asks for the nickname first. */
  function withNick(fn) {
    if (!needOnline()) return;
    if (G.Social.me) { fn(); return; }
    G.Social.start().then(r => { if (r === 'ok') fn(); else G.NickUI.open(fn); });
  }

  // ======================= FRIENDS =======================

  G.FriendsUI = (() => {
    function init() {
      $('fr-add').onsubmit = async e => {
        e.preventDefault();
        const name = $('fr-name').value;
        msg('');
        const r = await G.Social.request(name);
        msg(r.ok ? r.msg : r.error, !r.ok);
        if (r.ok) $('fr-name').value = '';
      };
      $('fr-room').onclick = () => G.LobbyUI.open();
      G.Social.on(() => { if (G.UI.isOpen('scr-friends')) render(); });
      setInterval(() => { if (G.UI.isOpen('scr-friends') && document.visibilityState === 'visible') tickClocks(); }, 1000);
      // While the list is open, friends' activity is re-read about once a minute (cached 60 s inside refreshPresence).
      setInterval(() => { if (G.UI.isOpen('scr-friends') && document.visibilityState === 'visible') G.Social.refreshPresence(); }, 30000);
    }

    function msg(t, bad) {
      $('fr-msg').textContent = t || '';
      $('fr-msg').style.color = bad ? '#ffb0b8' : '';
      if (t) G.Audio.sfx(bad ? 'error' : 'confirm');
    }

    function open() { withNick(() => { G.UI.show('scr-friends', true); msg(''); render(); G.Social.refreshPresence(); }); }

    /** "5 min ago", "2 h ago", "3 days ago". */
    function ago(t) {
      const m = Math.max(1, Math.round((G.Social.now() - t) / 60000));
      if (m < 60) return m + ' min ago';
      const h = Math.round(m / 60);
      if (h < 48) return h + ' h ago';
      return Math.round(h / 24) + ' days ago';
    }

    // What an online friend is doing (G.Activity). Runs show how long they have been going.
    const ACT = { menu: 'In the menu', gacha: 'Opening gacha packs', upgrades: 'Browsing upgrades', dex: 'Browsing the Pokédex',
                  rank: 'Viewing rankings', goals: 'Viewing goals', lobby: 'In a lobby', run: 'In a run', group: 'In a group run', arceus: 'Facing Arceus' };
    const isRun = f => f.act === 'run' || f.act === 'group' || f.act === 'arceus';
    const runClock = f => G.U.mmss(Math.max(0, (G.Social.now() - f.since) / 1000));
    const runMon = f => (f.mon && G.DEX_BY[f.mon] ? ' · ' + G.DEX_BY[f.mon].name : '');
    function stateText(f) {
      if (f.status === 'in') return 'Wants to be your friend';
      if (f.status === 'out') return 'Request sent';
      if (!f.online) return f.seen ? 'Seen ' + ago(f.seen) : 'Offline';
      if (f.act && ACT[f.act]) return ACT[f.act] + (isRun(f) ? runMon(f) + (f.since ? ' · ' + runClock(f) : '') : '');
      return f.play ? 'Playing' : 'Online';
    }
    /** Keeps the run clocks in the list ticking. */
    function tickClocks() {
      document.querySelectorAll('#fr-list .st[data-uid]').forEach(el => {
        const f = G.Social.friends.find(x => x.uid === el.dataset.uid);
        if (f && f.online && isRun(f) && f.since) el.textContent = ACT[f.act] + runMon(f) + ' · ' + runClock(f);
      });
    }

    function render() {
      const room = G.Social.room;
      const myName = G.Social.me ? G.Social.me.name : '';
      $('fr-me').innerHTML = 'Your nickname: <b class="gold" translate="no">' + esc(myName) + '</b>'
        + (myName ? ' <button class="btn small" id="fr-copy" type="button">Copy</button>' : '')
        + ' · give it to your friends so they can add you (emoji included: copy and paste it).';
      if ($('fr-copy')) $('fr-copy').onclick = () => G.UI.copyText(myName, 'Nickname copied');
      $('fr-room').classList.toggle('hidden', !room);
      const list = G.Social.friends.sort((a, b) => {
        const rank = f => f.status === 'in' ? 0 : f.status === 'ok' ? (f.online ? (f.play || isRun(f) ? 2 : 1) : 3) : 4;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
      const box = $('fr-list');
      box.innerHTML = '';
      if (!list.length) {
        box.innerHTML = '<p class="sub">You haven\'t added any friends yet. Type a friend\'s nickname above.</p>';
        return;
      }
      for (const f of list) {
        const el = document.createElement('div');
        el.className = 'fr-row';
        const dot = f.status !== 'ok' ? 'pend' : !f.online ? 'off' : f.play || isRun(f) ? 'play' : 'on';
        const inRoom = room && room.members.some(m => m.uid === f.uid);
        el.innerHTML = `<i class="dot ${dot}"></i><b translate="no"><a href="#" class="plink">${esc(f.name)}</a></b><span class="st" data-uid="${esc(f.uid)}">${inRoom ? 'In your room' : stateText(f)}</span><span class="grow"></span>`;
        if (f.status === 'ok') el.querySelector('.plink').onclick = e => { e.preventDefault(); G.ProfileUI.show(f.uid); };
        if (f.status === 'ok') {
          // Favourite Pokémon (up to 3) next to the name; profile comes from the 10-min cache.
          const favs = document.createElement('span');
          favs.className = 'fr-favs';
          el.querySelector('.st').before(favs);
          Promise.resolve(G.Social.getProfile(f.uid)).then(pr => {
            if (!pr || !favs.isConnected) return;
            for (const fv of (pr.favs || []).slice(0, 3)) {
              const d = G.DEX_BY[fv.dex];
              if (!d) continue;
              const cv = G.UI.spriteCanvas(fv.dex, 36, 36, { shiny: !!fv.shiny });
              cv.title = (fv.shiny ? 'Shiny ' : '') + d.name;
              favs.appendChild(cv);
            }
          }).catch(() => {});
        }
        else el.querySelector('.plink').onclick = e => e.preventDefault();
        const btn = (txt, cls, fn) => {
          const b = document.createElement('button');
          b.className = 'btn small ' + cls; b.textContent = txt; b.onclick = fn; el.appendChild(b); return b;
        };
        if (f.status === 'in') {
          btn('Accept', 'gold', async () => { const r = await G.Social.accept(f.uid); msg(r.ok ? r.msg : r.error, !r.ok); });
          btn('Decline', 'ghost', () => G.Social.remove(f.uid));
        } else if (f.status === 'out') {
          btn('Cancel', 'ghost', () => G.Social.remove(f.uid));
        } else {
          const n = G.Chat.unread(f.uid);
          const cb = btn(n ? 'Chat (' + n + ')' : 'Chat', n ? 'gold' : 'ghost', () => G.DMUI.open(f.uid));
          cb.title = n ? n + ' unread' : 'Chat with ' + f.name;
          if (f.online && !f.play && !isRun(f) && !inRoom && (!room || room.isHost)) {
            btn('Invite', 'gold', async () => {
              const r = await G.Social.invite(f.uid);
              msg(r.ok ? r.msg : r.error, !r.ok);
              if (r.ok) G.LobbyUI.open();
            });
          }
          // Removing a friend takes two taps (the first asks to confirm and disarms itself),
          // and it's kept apart from "Invite" so it isn't hit by accident.
          let armed = false, armT = 0;
          const rm = btn('Remove', 'ghost', () => {
            if (armed) { clearTimeout(armT); G.Social.remove(f.uid); return; }
            armed = true;
            rm.textContent = 'Sure? Tap again';
            rm.style.color = '#ff8a96'; rm.style.borderColor = '#ff8a96';
            armT = setTimeout(() => { armed = false; rm.textContent = 'Remove'; rm.style.color = ''; rm.style.borderColor = ''; }, 3500);
          });
          rm.style.marginLeft = '18px';
        }
        box.appendChild(el);
      }
    }

    return { init, open, render };
  })();

  // ======================= ROOM =======================

  G.LobbyUI = (() => {
    let membersKey = '';

    function init() {
      $('lobby-leave').onclick = async () => {
        await G.Social.leaveRoom();
        G.Net.close();
        G.MenuUI.open();
      };
      $('lobby-menu').onclick = () => G.MenuUI.open();
      const diag = () => {
        const room = G.Social.room, names = {};
        if (room) for (const m of room.members) names[m.uid] = m.name;
        $('lobby-diag-text').value = G.Net.report(names);
      };
      $('lobby-diag').addEventListener('toggle', () => { if ($('lobby-diag').open) diag(); });
      $('lobby-diag-copy').onclick = async () => {
        diag();
        const t = $('lobby-diag-text');
        try { await navigator.clipboard.writeText(t.value); G.UI.toast('Copied', 1400); }
        catch (e) { t.select(); G.UI.toast('Select and copy the text', 2200); }
      };
      $('lobby-start').onclick = start;
      $('lobby-start').dataset.sfx = 'confirm';
      // Connects / disconnects the network when entering or leaving a room.
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) {
          G.Net.open(room.id, room.isHost, room.host);
          G.Net.syncMembers(room.members.map(m => m.uid));
        } else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') {
          G.UI.toast('The room has been closed', 2600);
          if (G.UI.isOpen('scr-lobby')) G.MenuUI.open();
        }
        if (G.UI.isOpen('scr-lobby')) render();
      });
      G.Net.onPeer(() => { if (G.UI.isOpen('scr-lobby')) render(); });
    }

    function open() {
      if (!G.Social.room) { G.MenuUI.open(); return; }
      G.Social.refreshMember();
      G.Social.refreshPresence();
      G.UI.show('scr-lobby', true);
      membersKey = '';
      render();
    }

    function close() { G.UI.hide('scr-lobby'); }

    /** What a guest sees about the link to the host: { cls: 'wait' | 'ok' | 'bad', text, hint, short }. */
    function guestLink(room) {
      const host = (room.members.find(m => m.uid === room.host) || {}).name || 'the host';
      switch (G.Net.mode(room.host)) {
        case 'direct': return { cls: 'ok', text: 'Connected to ' + host, hint: 'Waiting for ' + host + ' to start the game.', short: 'Host · Connected' };
        case 'relay': return { cls: 'ok', text: 'Connected to ' + host + ' (through the server)', hint: 'Your network blocks a direct link, so the game goes through the server. Waiting for ' + host + ' to start.', short: 'Host · Connected (server)' };
        case 'failed': return { cls: 'bad', text: "Couldn't connect to " + host, hint: 'Retrying automatically. If it keeps failing, check your internet connection.', short: 'Host · Not connected' };
        default: return { cls: 'wait', text: 'Connecting to ' + host + '…', hint: 'Setting up the link. This can take up to 15 seconds.', short: 'Host · Connecting…' };
      }
    }

    function connText(m, room) {
      if (m.uid === room.host) return room.isHost ? 'Host' : guestLink(room).short;
      if (!room.isHost) return m.uid === G.Social.uid ? 'You' : 'In the room';
      const mode = G.Net.mode(m.uid);
      return mode === 'direct' ? 'Connected' : mode === 'relay' ? 'Connected (via server)' : mode === 'failed' ? 'Could not connect (retrying…)' : 'Connecting…';
    }

    function render() {
      const room = G.Social.room;
      if (!room) return;
      if (G.RoomChatUI) G.RoomChatUI.renderLobby();
      const ms = room.members;
      $('lobby-sub').textContent = room.isHost
        ? 'You\'re the host. Invite your friends (up to ' + G.Social.MAX_PLAYERS + ') and start when you\'re ready.'
        : 'You\'re in ' + ((ms.find(m => m.uid === room.host) || {}).name || '…') + '\'s room. The host will start the game.';

      // The cards are only rebuilt if the members change (so the sprites don't flicker).
      const key = ms.map(m => m.uid + ':' + m.dex + ':' + (m.shiny ? 1 : 0)).join('|');
      const box = $('lobby-members');
      if (key !== membersKey) {
        membersKey = key;
        box.innerHTML = '';
        for (let i = 0; i < G.Social.MAX_PLAYERS; i++) {
          const m = ms[i];
          const c = document.createElement('div');
          c.className = 'lob-card' + (m ? '' : ' empty');
          if (m) {
            c.style.setProperty('--pc', G.Coop.COLORS[i]);
            c.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
            c.insertAdjacentHTML('beforeend', `<b translate="no">${esc(m.name)}</b><small>${esc((G.DEX_BY[m.dex] || {}).name || '')}</small><span class="conn" data-u="${m.uid}"></span>`);
          } else c.innerHTML = '<span>Free</span>';
          box.appendChild(c);
        }
      }
      box.querySelectorAll('.conn').forEach(el => {
        const m = ms.find(x => x.uid === el.dataset.u);
        if (!m) return;
        const t = connText(m, room);
        el.textContent = t;
        const gl = !room.isHost && m.uid === room.host ? guestLink(room) : null;
        el.className = 'conn' + (gl ? (gl.cls === 'ok' ? '' : ' ' + gl.cls) : t === 'Connecting…' ? ' wait' : '');
      });

      // Invite (host only, and if there's room).
      const canInvite = room.isHost && ms.length < G.Social.MAX_PLAYERS;
      $('lobby-inv-title').classList.toggle('hidden', !canInvite);
      const inv = $('lobby-invite');
      inv.classList.toggle('hidden', !canInvite);
      if (canInvite) {
        inv.innerHTML = '';
        const free = G.Social.friends.filter(f => f.status === 'ok' && f.online && !ms.some(m => m.uid === f.uid));
        if (!free.length) inv.innerHTML = '<p class="sub" style="margin:0">No friends online right now.</p>';
        for (const f of free) {
          const el = document.createElement('div');
          el.className = 'fr-row';
          el.innerHTML = `<i class="dot ${f.play ? 'play' : 'on'}"></i><b translate="no">${esc(f.name)}</b><span class="st">${f.play ? 'Playing' : 'Online'}</span><span class="grow"></span>`;
          const b = document.createElement('button');
          b.className = 'btn small gold'; b.textContent = 'Invite';
          b.onclick = async () => { const r = await G.Social.invite(f.uid); G.UI.toast(r.ok ? r.msg : r.error); };
          el.appendChild(b);
          inv.appendChild(el);
        }
      }

      // Guests: a clear status line about the link to the host.
      const st = $('lobby-status');
      st.classList.toggle('hidden', room.isHost);
      if (!room.isHost) {
        const gl = guestLink(room);
        st.className = 'lobby-status ' + gl.cls;
        $('lobby-status-text').textContent = gl.text;
        $('lobby-status-hint').textContent = gl.hint;
      }
      G.MiniUI.lobbyTools($('lobby-mini'));
      const btn = $('lobby-start');
      btn.classList.toggle('hidden', !room.isHost);
      const connecting = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'connecting');
      const failed = ms.some(m => m.uid !== room.host && G.Net.mode(m.uid) === 'failed');
      btn.disabled = !room.isHost || ms.length < 2 || connecting || failed;
      btn.textContent = 'Start game (' + ms.length + '/' + G.Social.MAX_PLAYERS + ')';
      $('lobby-note').textContent = !room.isHost ? ''
        : ms.length < 2 ? 'You need at least one friend in the room.'
        : failed ? 'Can\'t connect to one of your friends: their network (or yours) doesn\'t allow group play. Try another Wi-Fi or mobile data; it retries automatically.'
        : connecting ? 'Connecting to your friends…' : 'The game starts for everyone at once.';
    }

    let starting = false;      // Start clicked twice while the version check runs: start once
    async function start() {
      const room = G.Social.room;
      if (!room || !room.isHost || room.members.length < 2 || starting || G.Game.state !== 'ui') return;
      starting = true;
      let ok = false;
      try { ok = await G.Updater.gate(); } finally { starting = false; }
      if (!ok) return;                                       // new version out: reload instead of starting
      if (G.Social.room !== room || room.members.length < 2) return;
      // Draft Night: everyone plays the Pokémon they drafted (not their own partner).
      const drafted = room.members.some(m => G.MiniUI.draftedFor(m.uid));
      const cfg = {
        k: 'start', seed: Math.floor(Math.random() * 1e6), host: room.host, draft: drafted ? 1 : 0,
        // Your own partner is taken from your save (the most recent), not from what
        // has already come back from the room.
        members: room.members.map(m => m.uid === G.Social.uid
          ? { uid: m.uid, name: m.name, dex: G.DB.save.partner, shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) }
          : { uid: m.uid, name: m.name, dex: m.dex, shiny: !!m.shiny })
      };
      if (drafted) for (const m of cfg.members) { const d = G.MiniUI.draftedFor(m.uid); if (d) { m.dex = d; m.shiny = false; } }
      if (drafted) G.Social.setGame(null);          // the draft is used up by this run
      G.Social.setOpen(false);
      G.Net.broadcast(cfg);
      G.Flow.startCoop(cfg);
    }

    return { init, open, close, render, startDraftRun: () => { open(); start(); } };
  })();

  // ======================= INVITACIONES =======================

  G.InvitePop = (() => {
    let cur = null;

    function init() {
      $('inv-yes').onclick = async () => {
        if (!cur) return;
        const from = cur.from, who = cur.name;
        // Mid-run: it asks whether you want to leave it; if so, it's closed (what you earned
        // is saved, as when abandoning) and only then do you join the room.
        const st = G.Game.state;
        if (st !== 'ui') {
          if (st !== 'over' && !confirm('You are in the middle of a run. Leave it to join ' + who + "'s room? What you have earned so far will be saved.")) return;
          hide();
          G.Game.quit();
          G.UI.hideAll();
          G.Game.toUI();
          G.Audio.music('village');
        } else hide();
        G.UI.toast('Joining ' + who + "'s room…", 2500);
        const r = await G.Social.acceptInvite(from);
        if (!r.ok) { G.UI.toast(r.error, 3000); if (G.Game.state === 'ui') G.Flow.goMenu(); return; }
        G.LobbyUI.open();
      };
      $('inv-no').onclick = () => { if (cur) G.Social.declineInvite(cur.from); hide(); };
      G.Social.on(what => { if (what === 'invites' || what === 'room') refresh(); });
    }

    function hide() { cur = null; $('invite-pop').classList.add('hidden'); }

    /** Shows the oldest invitation (also mid-run: on accepting it asks whether you'll leave the run). */
    function refresh() {
      const room = G.Social.room;
      const list = G.Social.invites.filter(i => !room || i.room !== room.id).sort((a, b) => a.at - b.at);
      if (!list.length || !G.DB.loggedIn) { hide(); return; }
      if (cur && cur.from === list[0].from) return;
      cur = list[0];
      $('inv-text').innerHTML = `${G.Icons.html('friends', 22)} <b class="gold" translate="no">${esc(cur.name)}</b> invites you to play in their room`;
      $('invite-pop').classList.remove('hidden');
      G.Audio.sfx('shiny');
    }

    return { init, refresh };
  })();

  G.SocialUI = {
    init() { G.NickUI.init(); G.FriendsUI.init(); G.LobbyUI.init(); G.InvitePop.init(); },
    withNick, needOnline
  };
})();
